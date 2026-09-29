// Google Sheets data source.
//
// Why this exists: Airtable's Free plan allows 1,000 API calls a month for the whole workspace and
// we ran it dry on 17 Sep 2026. The team's forms now write into a Google Sheet instead, and Sheets
// has no limit we would ever reach. The sheet is private, so the server signs in as a Google
// service account that the sheet is shared with as a Viewer.
//
// Zero dependencies, same as the rest of the server: the JWT is signed with node:crypto, exchanged
// for an access token at Google's token endpoint, and the token is cached until shortly before it
// expires. Rows come back as Airtable-shaped records ({ id, fields }) so the browser's existing
// mapping layer, metrics and tests do not change at all.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_LIFETIME_SECONDS = 3600
const TOKEN_EARLY_REFRESH_MS = 5 * 60_000

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Private keys arrive from a settings file as one line with literal \n sequences. Turn those back
 * into real newlines, otherwise the PEM will not parse.
 */
export function normalizePrivateKey(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const unquoted = (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")) ? text.slice(1, -1) : text
  return unquoted.replace(/\\n/g, '\n')
}

/** Build and sign the JWT that Google swaps for an access token. */
export function buildJwt({ email, privateKey, scope = SCOPE, now = Date.now() }, cryptoImpl) {
  const issuedAt = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    }),
  )
  const signingInput = `${header}.${claims}`
  const signature = cryptoImpl.sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
  return `${signingInput}.${base64url(signature)}`
}

/**
 * Turn a Sheets value range into Airtable-shaped records. Row 1 is the header. Blank rows are
 * dropped, blank cells are left out entirely so pickField behaves exactly as it does for Airtable,
 * and the row number becomes a stable id so the same call keeps the same id between refreshes.
 */
export function rowsToRecords(values, idPrefix) {
  const rows = Array.isArray(values) ? values : []
  if (rows.length < 2) return []
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim())
  const records = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const fields = {}
    let hasValue = false
    for (let c = 0; c < header.length; c++) {
      const name = header[c]
      if (!name) continue
      const cell = row[c]
      const text = typeof cell === 'string' ? cell.trim() : cell === undefined || cell === null ? '' : String(cell)
      if (text === '') continue
      fields[name] = text
      hasValue = true
    }
    if (!hasValue) continue
    // i + 1 is the spreadsheet row number, so ids line up with what the team sees in the sheet.
    records.push({ id: `${idPrefix}-row${i + 1}`, fields })
  }
  return records
}

export class SheetsSource {
  /**
   * @param {object} options
   * @param {string} options.sheetId          the spreadsheet id from its URL
   * @param {{calls: string, dm: string}} options.tabs   tab names, exactly as they appear in the sheet
   * @param {{email: string, privateKey: string}} [options.serviceAccount]
   * @param {string} [options.apiKey]         only works when the sheet is readable by anyone with the link
   */
  constructor({ sheetId, tabs, serviceAccount = null, apiKey = '', fetchImpl = fetch, cryptoImpl, log = () => {} }) {
    this.sheetId = sheetId
    this.tabs = tabs
    this.serviceAccount = serviceAccount && serviceAccount.email && serviceAccount.privateKey ? serviceAccount : null
    this.apiKey = apiKey
    this.fetchImpl = fetchImpl
    this.cryptoImpl = cryptoImpl
    this.log = log
    this.token = null // { value, expiresAt }
    this.tokenInFlight = null
  }

  get name() {
    return 'sheets'
  }

  get configured() {
    return Boolean(this.sheetId && this.tabs?.calls && this.tabs?.dm && (this.serviceAccount || this.apiKey))
  }

  /** Missing settings, named the way they appear in the settings file. */
  missingSettings() {
    const missing = []
    if (!this.sheetId) missing.push('GOOGLE_SHEET_ID')
    if (!this.tabs?.calls) missing.push('SHEET_CALLS_TAB')
    if (!this.tabs?.dm) missing.push('SHEET_DM_TAB')
    if (!this.serviceAccount && !this.apiKey) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_API_KEY)')
    return missing
  }

  async accessToken() {
    if (!this.serviceAccount) return null
    if (this.token && this.token.expiresAt - TOKEN_EARLY_REFRESH_MS > Date.now()) return this.token.value
    // Both tabs are read in parallel, so without this they would each ask Google for a token.
    if (!this.tokenInFlight) {
      this.tokenInFlight = this.requestToken().finally(() => {
        this.tokenInFlight = null
      })
    }
    return this.tokenInFlight
  }

  async requestToken() {
    const jwt = buildJwt(this.serviceAccount, this.cryptoImpl)
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
    const res = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`Google token ${res.status}`)
      err.status = res.status
      err.type = 'GOOGLE_AUTH_FAILED'
      err.detail = describeGoogleError(text)
      throw err
    }
    const parsed = JSON.parse(text)
    const expiresIn = Number(parsed.expires_in) || TOKEN_LIFETIME_SECONDS
    this.token = { value: parsed.access_token, expiresAt: Date.now() + expiresIn * 1000 }
    return this.token.value
  }

  /** Read one tab. Returns Airtable-shaped records. */
  async fetchTab(tabName, idPrefix) {
    // A1 notation with no bounds means "everything in this tab", so new rows need no config change.
    const range = encodeURIComponent(`${tabName}`)
    const params = new URLSearchParams({ majorDimension: 'ROWS' })
    // FORMATTED_VALUE on purpose: dates come back as the sheet shows them (2026-09-04) and money as
    // "£997.00", which the browser's existing parsers already handle. UNFORMATTED_VALUE would hand
    // back Google's date serial numbers instead, which they do not.
    params.set('valueRenderOption', 'FORMATTED_VALUE')
    if (!this.serviceAccount && this.apiKey) params.set('key', this.apiKey)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.sheetId)}/values/${range}?${params.toString()}`

    const headers = { Accept: 'application/json' }
    const token = await this.accessToken()
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await this.fetchImpl(url, { headers })
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`Sheets ${res.status}`)
      err.status = res.status
      err.type = res.status === 403 || res.status === 401 ? 'SHEETS_ACCESS_DENIED' : 'SHEETS_ERROR'
      err.detail = describeGoogleError(text)
      err.tab = tabName
      throw err
    }
    const parsed = JSON.parse(text)
    return rowsToRecords(parsed.values ?? [], idPrefix)
  }

  /** Both tabs in parallel. The shape matches what SnapshotStore stores for Airtable. */
  async fetchAll() {
    const [calls, dm] = await Promise.all([this.fetchTab(this.tabs.calls, 'calls'), this.fetchTab(this.tabs.dm, 'dm')])
    return { calls, dm }
  }
}

function describeGoogleError(text) {
  try {
    const body = JSON.parse(text)
    return body?.error?.message ?? body?.error_description ?? body?.error ?? String(text).slice(0, 200)
  } catch {
    return String(text).slice(0, 200)
  }
}

/** Plain-English version of a Sheets failure, for the footer. */
export function friendlySheetsMessage(err) {
  if (!err) return 'Could not reach Google Sheets. Showing the last data received.'
  if (err.type === 'GOOGLE_AUTH_FAILED') {
    return 'Google rejected the service account sign in. Check GOOGLE_SERVICE_ACCOUNT_JSON in the settings file.'
  }
  if (err.type === 'SHEETS_ACCESS_DENIED') {
    return 'Google Sheets refused access. Share the sheet with the service account email as a Viewer. Showing the last data received.'
  }
  if (err.status === 404) return 'That Google Sheet id was not found. Check GOOGLE_SHEET_ID in the settings file.'
  if (err.status === 400 && err.tab) return `The sheet has no tab named "${err.tab}". Check the tab names in the settings file.`
  if (err.status === 429) return 'Google is rate limiting requests. Showing the last data received.'
  return `Could not read the Google Sheet (${err.detail || err.message || 'unknown error'}). Showing the last data received.`
}
