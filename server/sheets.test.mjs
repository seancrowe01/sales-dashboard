import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SheetsSource, buildJwt, friendlySheetsMessage, normalizePrivateKey, rowsToRecords } from './sheets.mjs'

// A throwaway key pair, generated per run. Nothing real is ever committed here.
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const TEST_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' })

const SERVICE_ACCOUNT = { email: 'reader@example.iam.gserviceaccount.com', privateKey: TEST_PEM }
const TABS = { calls: 'Post Call Report', dm: 'Text Close Report' }

function okJson(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}
function errJson(status, body) {
  return { ok: false, status, text: async () => JSON.stringify(body) }
}

/** A fetch stub that answers the token endpoint and then each tab. */
function makeFetch(tabValues, { tokenStatus = 200, tabStatus = 200 } = {}) {
  const urls = []
  const impl = async (url, options) => {
    urls.push(url)
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (tokenStatus !== 200) return errJson(tokenStatus, { error: 'invalid_grant', error_description: 'Invalid JWT' })
      return okJson({ access_token: 'ya29.test-token', expires_in: 3600 })
    }
    if (tabStatus !== 200) return errJson(tabStatus, { error: { message: 'The caller does not have permission' } })
    const tab = decodeURIComponent(new URL(url).pathname.split('/values/')[1] ?? '')
    return okJson({ values: tabValues[tab] ?? [] })
  }
  impl.urls = urls
  impl.lastOptions = () => options
  return impl
}

function makeSource(fetchImpl, extra = {}) {
  return new SheetsSource({
    sheetId: 'sheet123',
    tabs: TABS,
    serviceAccount: SERVICE_ACCOUNT,
    fetchImpl,
    cryptoImpl: crypto,
    ...extra,
  })
}

describe('rowsToRecords', () => {
  it('uses row 1 as the header and the sheet row number as the id', () => {
    const records = rowsToRecords(
      [
        ['Date', 'Closer Name', 'Call Status'],
        ['2026-09-04', 'Sam Rivera', 'Showed'],
        ['2026-09-05', 'Sam Rivera', 'No Show'],
      ],
      'calls',
    )
    expect(records).toEqual([
      { id: 'calls-row2', fields: { Date: '2026-09-04', 'Closer Name': 'Sam Rivera', 'Call Status': 'Showed' } },
      { id: 'calls-row3', fields: { Date: '2026-09-05', 'Closer Name': 'Sam Rivera', 'Call Status': 'No Show' } },
    ])
  })

  it('leaves blank cells out entirely, the way Airtable does', () => {
    const [record] = rowsToRecords(
      [
        ['Date', 'Call Outcome', 'Cash Collected'],
        ['2026-09-04', '', '  '],
      ],
      'calls',
    )
    expect(record.fields).toEqual({ Date: '2026-09-04' })
    expect('Call Outcome' in record.fields).toBe(false)
  })

  it('handles ragged rows, because Sheets truncates trailing empty cells', () => {
    const [record] = rowsToRecords(
      [
        ['Date', 'Closer Name', 'Call Status', 'Call Outcome'],
        ['2026-09-04', 'Sam Rivera', 'No Show'],
      ],
      'calls',
    )
    expect(record.fields).toEqual({ Date: '2026-09-04', 'Closer Name': 'Sam Rivera', 'Call Status': 'No Show' })
  })

  it('drops rows with nothing in them and trims whitespace', () => {
    const records = rowsToRecords(
      [
        ['Date', 'Closer Name'],
        ['  2026-09-04  ', ' Sam Rivera '],
        ['', ''],
        [],
      ],
      'calls',
    )
    expect(records.length).toBe(1)
    expect(records[0].fields).toEqual({ Date: '2026-09-04', 'Closer Name': 'Sam Rivera' })
  })

  it('ignores columns with no header name', () => {
    const [record] = rowsToRecords(
      [
        ['Date', '', 'Closer Name'],
        ['2026-09-04', 'stray', 'Sam Rivera'],
      ],
      'calls',
    )
    expect(record.fields).toEqual({ Date: '2026-09-04', 'Closer Name': 'Sam Rivera' })
  })

  it('returns nothing for an empty tab or a header with no rows', () => {
    expect(rowsToRecords([], 'calls')).toEqual([])
    expect(rowsToRecords([['Date', 'Closer Name']], 'calls')).toEqual([])
  })
})

describe('normalizePrivateKey', () => {
  it('turns literal backslash-n into real newlines', () => {
    const out = normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n')
    expect(out.split('\n').length).toBe(4)
    expect(out.includes('\\n')).toBe(false)
  })

  it('strips wrapping quotes and copes with empty input', () => {
    expect(normalizePrivateKey('"line1\\nline2"')).toBe('line1\nline2')
    expect(normalizePrivateKey('')).toBe('')
    expect(normalizePrivateKey(undefined)).toBe('')
  })
})

describe('buildJwt', () => {
  it('signs a three part JWT with the right issuer, scope and audience', () => {
    const jwt = buildJwt({ ...SERVICE_ACCOUNT, now: 1_700_000_000_000 }, crypto)
    const parts = jwt.split('.')
    expect(parts.length).toBe(3)
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(claims.iss).toBe(SERVICE_ACCOUNT.email)
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token')
    expect(claims.scope).toBe('https://www.googleapis.com/auth/spreadsheets.readonly')
    expect(claims.exp - claims.iat).toBe(3600)
  })

  it('produces a signature that verifies against the public key', () => {
    const jwt = buildJwt(SERVICE_ACCOUNT, crypto)
    const [header, claims, signature] = jwt.split('.')
    const publicKey = crypto.createPublicKey(TEST_PEM)
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url'))
    expect(ok).toBe(true)
  })
})

describe('SheetsSource', () => {
  it('reads both tabs and returns Airtable shaped records', async () => {
    const fetchImpl = makeFetch({
      'Post Call Report': [
        ['Date', 'Closer Name', 'Call Status'],
        ['2026-09-04', 'Sam Rivera', 'Showed'],
      ],
      'Text Close Report': [
        ['Date', 'Closer Name', 'Close Type'],
        ['2026-09-12', 'Sam Rivera', 'Text Follow-Up Close'],
      ],
    })
    const { calls, dm } = await makeSource(fetchImpl).fetchAll()
    expect(calls).toEqual([{ id: 'calls-row2', fields: { Date: '2026-09-04', 'Closer Name': 'Sam Rivera', 'Call Status': 'Showed' } }])
    expect(dm).toEqual([{ id: 'dm-row2', fields: { Date: '2026-09-12', 'Closer Name': 'Sam Rivera', 'Close Type': 'Text Follow-Up Close' } }])
  })

  it('asks for formatted values, so dates stay as the sheet shows them', async () => {
    const fetchImpl = makeFetch({ 'Post Call Report': [['Date'], ['2026-09-04']], 'Text Close Report': [] })
    await makeSource(fetchImpl).fetchAll()
    const tabUrl = fetchImpl.urls.find((u) => u.includes('/values/'))
    expect(new URL(tabUrl).searchParams.get('valueRenderOption')).toBe('FORMATTED_VALUE')
    expect(tabUrl).toContain('Post%20Call%20Report')
  })

  it('sends the bearer token and only asks Google for it once', async () => {
    const fetchImpl = makeFetch({ 'Post Call Report': [['Date'], ['2026-09-04']], 'Text Close Report': [['Date'], ['2026-09-12']] })
    const source = makeSource(fetchImpl)
    await source.fetchAll()
    await source.fetchAll()
    const tokenCalls = fetchImpl.urls.filter((u) => u.startsWith('https://oauth2.googleapis.com/token'))
    expect(tokenCalls.length).toBe(1)
  })

  it('explains a permission error in words the team can act on', async () => {
    const fetchImpl = makeFetch({}, { tabStatus: 403 })
    await expect(makeSource(fetchImpl).fetchAll()).rejects.toMatchObject({ type: 'SHEETS_ACCESS_DENIED', status: 403 })
    try {
      await makeSource(fetchImpl).fetchAll()
    } catch (err) {
      expect(friendlySheetsMessage(err)).toContain('Share the sheet with the service account email')
    }
  })

  it('reports a rejected sign in separately from a rejected sheet', async () => {
    const fetchImpl = makeFetch({}, { tokenStatus: 400 })
    try {
      await makeSource(fetchImpl).fetchAll()
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.type).toBe('GOOGLE_AUTH_FAILED')
      expect(friendlySheetsMessage(err)).toContain('GOOGLE_SERVICE_ACCOUNT_JSON')
    }
  })

  it('names a missing tab in the error, because tab names are easy to mistype', () => {
    expect(friendlySheetsMessage({ status: 400, tab: 'Post Call Reports' })).toContain('"Post Call Reports"')
  })

  it('knows when it is not configured and says what is missing', () => {
    const bare = new SheetsSource({ sheetId: '', tabs: { calls: '', dm: '' }, cryptoImpl: crypto })
    expect(bare.configured).toBe(false)
    expect(bare.missingSettings()).toEqual([
      'GOOGLE_SHEET_ID',
      'SHEET_CALLS_TAB',
      'SHEET_DM_TAB',
      'GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_API_KEY)',
    ])
    expect(makeSource(makeFetch({})).configured).toBe(true)
  })

  it('falls back to an api key when there is no service account', async () => {
    const fetchImpl = makeFetch({ 'Post Call Report': [['Date'], ['2026-09-04']], 'Text Close Report': [] })
    const source = new SheetsSource({ sheetId: 'sheet123', tabs: TABS, apiKey: 'AIzaTEST', fetchImpl, cryptoImpl: crypto })
    await source.fetchAll()
    const tabUrl = fetchImpl.urls.find((u) => u.includes('/values/'))
    expect(new URL(tabUrl).searchParams.get('key')).toBe('AIzaTEST')
    expect(fetchImpl.urls.some((u) => u.includes('oauth2.googleapis.com'))).toBe(false)
  })
})
