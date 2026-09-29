// Airtable proxy + static server. Node 18+, zero dependencies.
// Reads .env by hand, gates every data route behind a shared password (signed cookie session),
// whitelists the two table ids, caches reads for a few seconds and adds the bearer token
// server-side. The token never reaches the browser and is never logged.

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RateLimiter, ReadCache, cookieHeader, parseCookies, signSession, timingSafeEqualStr, verifySession } from './auth.mjs'
import { SnapshotStore, friendlyMessage } from './snapshot.mjs'
import { SheetsSource, friendlySheetsMessage, normalizePrivateKey } from './sheets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

// ---------- .env loader (no dotenv) ----------

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(path.join(ROOT, '.env'))
// Some hosts keep the code folder read-only, so the settings file can live elsewhere: set
// ENV_FILE to its path and it is loaded on top of any local .env.
if (process.env.ENV_FILE) loadEnvFile(process.env.ENV_FILE)

const env = (name, fallback = '') => {
  const v = process.env[name]
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

const TOKEN = env('AIRTABLE_TOKEN')
const BASE_ID = env('AIRTABLE_BASE_ID')
const CALLS_TABLE = env('AIRTABLE_CALLS_TABLE', env('VITE_AIRTABLE_CALLS_TABLE'))
const DM_TABLE = env('AIRTABLE_DM_TABLE', env('VITE_AIRTABLE_DM_TABLE'))
// PROXY_PORT on purpose, not PORT: dev tools and hosts often set PORT for the web server,
// and the proxy must never land on the same port as Vite.
const PORT = Number(env('PROXY_PORT', '8787')) || 8787

const isPlaceholder = (v) => !v || /x{6,}|your_token|goes_here/i.test(v)
const AIRTABLE_CONFIGURED = !isPlaceholder(TOKEN) && !isPlaceholder(BASE_ID) && !isPlaceholder(CALLS_TABLE) && !isPlaceholder(DM_TABLE)
const ALLOWED_TABLES = new Set([CALLS_TABLE, DM_TABLE].filter(Boolean))

// ---------- data source: Google Sheets (default since Sep 2026) or Airtable ----------
// The team's forms write into a Google Sheet now. Airtable stays supported so the old setup keeps
// working, and so we can switch back in one line if the sheet ever goes away.
const DATA_SOURCE = env('DATA_SOURCE', 'sheets').toLowerCase() === 'airtable' ? 'airtable' : 'sheets'
const SHEET_ID = env('GOOGLE_SHEET_ID')
const SHEET_CALLS_TAB = env('SHEET_CALLS_TAB', 'Post Call Report')
const SHEET_DM_TAB = env('SHEET_DM_TAB', 'Text Close Report')

/**
 * The service account can be given as the whole JSON (GOOGLE_SERVICE_ACCOUNT_JSON), as a path to
 * the JSON file (GOOGLE_SERVICE_ACCOUNT_JSON_PATH), or as the two fields on their own. Whichever is
 * easiest to paste into the settings file wins. The private key is never logged.
 */
function readServiceAccount() {
  const inline = env('GOOGLE_SERVICE_ACCOUNT_JSON')
  const fromPath = env('GOOGLE_SERVICE_ACCOUNT_JSON_PATH')
  let parsed = null
  if (inline) {
    try {
      parsed = JSON.parse(inline)
    } catch {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON, ignoring it.')
    }
  } else if (fromPath && fs.existsSync(fromPath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(fromPath, 'utf8'))
    } catch {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON_PATH could not be read as JSON, ignoring it.')
    }
  }
  const email = env('GOOGLE_CLIENT_EMAIL', parsed?.client_email ?? '')
  const privateKey = normalizePrivateKey(env('GOOGLE_PRIVATE_KEY', parsed?.private_key ?? ''))
  return email && privateKey ? { email, privateKey } : null
}

const sheetsSource =
  DATA_SOURCE === 'sheets'
    ? new SheetsSource({
        sheetId: SHEET_ID,
        tabs: { calls: SHEET_CALLS_TAB, dm: SHEET_DM_TAB },
        serviceAccount: readServiceAccount(),
        apiKey: env('GOOGLE_API_KEY'),
        cryptoImpl: crypto,
        log: (message) => console.log(message),
      })
    : null

const CONFIGURED = DATA_SOURCE === 'sheets' ? Boolean(sheetsSource?.configured) : AIRTABLE_CONFIGURED
const SOURCE_LABEL = DATA_SOURCE === 'sheets' ? 'Google Sheets' : 'Airtable'

// Optional per-table view ids (viw...). When set, reads go through that view so its filters apply.
const isView = (v) => /^viw[A-Za-z0-9]+$/.test(v)
const DEFAULT_VIEWS = new Map(
  [
    [CALLS_TABLE, env('AIRTABLE_CALLS_VIEW')],
    [DM_TABLE, env('AIRTABLE_DM_VIEW')],
  ].filter(([table, view]) => table && isView(view)),
)

// ---------- access control settings ----------

const PASSWORD = env('DASHBOARD_PASSWORD')
const ALLOW_NO_PASSWORD = env('ALLOW_NO_PASSWORD') === 'true'
const AUTH_REQUIRED = PASSWORD !== ''
const SESSION_SECRET = env('SESSION_SECRET') || crypto.randomBytes(32).toString('hex')
const SESSION_DAYS = Math.max(1, Number(env('SESSION_DAYS', '30')) || 30)
const SESSION_COOKIE = 'vc_session'
const TRUST_PROXY = env('TRUST_PROXY', 'true') !== 'false' // nginx sits in front on the VPS
const CACHE_MS = Math.max(0, Number(env('CACHE_MS', '20000')) || 0)
const IS_PRODUCTION = env('NODE_ENV') === 'production'

// ---------- snapshot settings (SPEC section 13) ----------
// The server alone talks to the data source: every REFRESH_MINUTES plus the Refresh button (with a
// cooldown). Browsers read the snapshot. This slow timer was forced by Airtable's Free plan (1,000
// calls a month per workspace); it stays on Sheets because nobody needs the numbers sooner.
const REFRESH_MINUTES = Math.max(5, Number(env('DATA_REFRESH_MINUTES', env('AIRTABLE_REFRESH_MINUTES', '240'))) || 240)
const MANUAL_COOLDOWN_MINUTES = Math.max(1, Number(env('MANUAL_REFRESH_MINUTES', '10')) || 10)
const DATA_DIR = process.env.ENV_FILE ? path.dirname(process.env.ENV_FILE) : path.join(ROOT, '.data')
const SNAPSHOT_FILE = env('SNAPSHOT_FILE', path.join(DATA_DIR, 'snapshot.json'))
const snapshot = new SnapshotStore({
  file: SNAPSHOT_FILE,
  token: TOKEN,
  baseId: BASE_ID,
  tables: { calls: CALLS_TABLE, dm: DM_TABLE },
  views: Object.fromEntries(DEFAULT_VIEWS),
  source: sheetsSource,
  describeError: DATA_SOURCE === 'sheets' ? friendlySheetsMessage : friendlyMessage,
  refreshMs: REFRESH_MINUTES * 60_000,
  manualCooldownMs: MANUAL_COOLDOWN_MINUTES * 60_000,
  log: (message) => console.log(`${new Date().toISOString().slice(11, 19)} ${message}`),
})

const loginLimiter = new RateLimiter(10, 60_000) // 10 attempts per minute per address
const readCache = new ReadCache(CACHE_MS)
setInterval(() => {
  loginLimiter.prune()
  readCache.prune()
}, 60_000).unref()

// ---------- helpers ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
}

function sendJson(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  })
  res.end(text)
  return status
}

function log(method, url, status, extra = '') {
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`${stamp} ${method} ${url} -> ${status}${extra ? ` ${extra}` : ''}`)
}

function isSecure(req) {
  if (req.socket && req.socket.encrypted) return true
  if (!TRUST_PROXY) return false
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  return proto === 'https'
}

function clientAddress(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (forwarded) return forwarded
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown'
}

function hasSession(req) {
  if (!AUTH_REQUIRED) return true
  const cookies = parseCookies(req.headers.cookie)
  return verifySession(SESSION_SECRET, cookies[SESSION_COOKIE])
}

function readJsonBody(req, limitBytes = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ---------- auth routes ----------

function sessionRoute(req, res) {
  return sendJson(res, 200, { authenticated: hasSession(req), required: AUTH_REQUIRED })
}

async function loginRoute(req, res) {
  if (!AUTH_REQUIRED) return sendJson(res, 200, { ok: true, required: false })
  const address = clientAddress(req)
  if (!loginLimiter.hit(address)) {
    return sendJson(res, 429, { error: 'Too many attempts. Wait a minute and try again.' })
  }
  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Send the password as JSON.' })
  }
  const supplied = typeof body.password === 'string' ? body.password : ''
  if (!supplied || !timingSafeEqualStr(supplied, PASSWORD)) {
    return sendJson(res, 401, { error: 'Wrong password.' })
  }
  const maxAgeSeconds = SESSION_DAYS * 86_400
  const token = signSession(SESSION_SECRET, Date.now() + maxAgeSeconds * 1000)
  return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(SESSION_COOKIE, token, { maxAgeSeconds, secure: isSecure(req) }) })
}

function logoutRoute(req, res) {
  return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(SESSION_COOKIE, '', { maxAgeSeconds: 0, secure: isSecure(req) }) })
}

// ---------- data routes ----------

function snapshotRoute(res) {
  if (!CONFIGURED) {
    return sendJson(res, 503, { error: `${SOURCE_LABEL} is not configured on the server. Fill in the settings file and restart.`, configured: false })
  }
  return sendJson(res, 200, { configured: true, dataSource: DATA_SOURCE, sourceLabel: SOURCE_LABEL, ...snapshot.get() })
}

async function refreshRoute(res) {
  if (!CONFIGURED) {
    return sendJson(res, 503, { ok: false, error: { message: `${SOURCE_LABEL} is not configured on the server.` } })
  }
  return sendJson(res, 200, await snapshot.manualRefresh())
}

// Retired: the browser no longer reads tables one by one. Old bundles left open in a tab get a
// clear answer instead of burning the Airtable allowance.
async function proxyAirtable(res, tableId, search) {
  if (!env('ALLOW_DIRECT_AIRTABLE')) {
    return sendJson(res, 410, { error: 'This dashboard now reads a server snapshot. Reload the page.' })
  }
  if (!ALLOWED_TABLES.has(tableId) || !/^tbl[A-Za-z0-9]+$/.test(tableId)) {
    return sendJson(res, 403, { error: 'Table not allowed. Only the two tables in .env can be read.' })
  }
  if (!CONFIGURED) {
    return sendJson(res, 503, { error: `${SOURCE_LABEL} is not configured on the server. Fill in the settings file and restart.` })
  }
  const params = new URLSearchParams(search)
  const forward = new URLSearchParams()
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 100))
  forward.set('pageSize', String(pageSize))
  const offset = params.get('offset')
  if (offset) forward.set('offset', offset)
  const view = params.get('view') || DEFAULT_VIEWS.get(tableId)
  if (view && isView(view)) forward.set('view', view)

  const url = `https://api.airtable.com/v0/${encodeURIComponent(BASE_ID)}/${encodeURIComponent(tableId)}?${forward.toString()}`
  const cacheKey = url
  try {
    const { value, cached } = await readCache.get(
      cacheKey,
      async () => {
        const upstream = await fetch(url, {
          headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        })
        return { status: upstream.status, text: await upstream.text() }
      },
      { shouldCache: (v) => v.status === 200 },
    )
    res.writeHead(value.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Cache': cached ? 'HIT' : 'MISS',
      ...SECURITY_HEADERS,
    })
    res.end(value.text)
    return value.status
  } catch (err) {
    const message = err && err.message ? err.message : 'Upstream request failed'
    return sendJson(res, 502, { error: `Could not reach Airtable: ${message}` })
  }
}

function healthRoute(res) {
  return sendJson(res, 200, {
    ok: true,
    configured: CONFIGURED,
    dataSource: DATA_SOURCE,
    // What is still missing, so the footer can say exactly what to fix. Never the values.
    missing:
      DATA_SOURCE === 'sheets'
        ? (sheetsSource?.missingSettings() ?? [])
        : [
            isPlaceholder(TOKEN) ? 'AIRTABLE_TOKEN' : null,
            isPlaceholder(BASE_ID) ? 'AIRTABLE_BASE_ID' : null,
            isPlaceholder(CALLS_TABLE) ? 'AIRTABLE_CALLS_TABLE' : null,
            isPlaceholder(DM_TABLE) ? 'AIRTABLE_DM_TABLE' : null,
          ].filter(Boolean),
    sheet: DATA_SOURCE === 'sheets' ? { tabs: { calls: SHEET_CALLS_TAB, dm: SHEET_DM_TAB } } : null,
    tables: { calls: CALLS_TABLE, dm: DM_TABLE },
    views: { calls: DEFAULT_VIEWS.get(CALLS_TABLE) || null, dm: DEFAULT_VIEWS.get(DM_TABLE) || null },
    cacheMs: CACHE_MS,
    snapshot: {
      fetchedAt: snapshot.state.fetchedAt,
      refreshMinutes: REFRESH_MINUTES,
      manualCooldownMinutes: MANUAL_COOLDOWN_MINUTES,
      error: snapshot.state.error,
      file: SNAPSHOT_FILE,
    },
  })
}

// ---------- static files ----------

function serveStatic(res, pathname) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS })
    res.end('No dist/ folder yet. Run "npm run build" first, or use "npm run dev" for development.')
    return 404
  }
  let filePath = path.join(DIST, decodeURIComponent(pathname))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end()
    return 403
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html') // SPA fallback
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS })
    res.end('dist/index.html is missing. Run "npm run build" and deploy again.')
    return 404
  }
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  const stream = fs.createReadStream(filePath)
  // A read error must never take the whole process down.
  stream.on('error', (err) => {
    console.error('Static file error:', err && err.message ? err.message : err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS })
      res.end('Could not read that file.')
    } else {
      res.end()
    }
  })
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, ...SECURITY_HEADERS })
  })
  stream.pipe(res)
  return 200
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const pathname = url.pathname
  let status = 200

  try {
    if (pathname === '/api/session' && method === 'GET') {
      status = sessionRoute(req, res)
    } else if (pathname === '/api/login' && method === 'POST') {
      status = await loginRoute(req, res)
    } else if (pathname === '/api/logout' && method === 'POST') {
      status = logoutRoute(req, res)
    } else if (pathname === '/api/refresh' && method === 'POST') {
      if (!AUTH_REQUIRED && !ALLOW_NO_PASSWORD) status = sendJson(res, 503, { error: 'No DASHBOARD_PASSWORD set.' })
      else if (!hasSession(req)) status = sendJson(res, 401, { error: 'Sign in required' })
      else status = await refreshRoute(res)
    } else if (pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        status = sendJson(res, 405, { error: 'Method not allowed' })
      } else if (!AUTH_REQUIRED && !ALLOW_NO_PASSWORD) {
        status = sendJson(res, 503, {
          error: 'No DASHBOARD_PASSWORD set. Add one to .env (or ALLOW_NO_PASSWORD=true for local testing) and restart.',
        })
      } else if (!hasSession(req)) {
        status = sendJson(res, 401, { error: 'Sign in required' })
      } else if (pathname === '/api/health') {
        status = healthRoute(res)
      } else if (pathname === '/api/snapshot') {
        status = snapshotRoute(res)
      } else if (pathname.startsWith('/api/airtable/')) {
        const tableId = pathname.slice('/api/airtable/'.length).split('/')[0]
        status = await proxyAirtable(res, tableId, url.search)
      } else {
        status = sendJson(res, 404, { error: 'Not found' })
      }
    } else if (method === 'GET' || method === 'HEAD') {
      status = serveStatic(res, pathname === '/' ? '/index.html' : pathname)
    } else {
      status = sendJson(res, 405, { error: 'Method not allowed' })
    }
  } catch (err) {
    status = 500
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error' })
    console.error('Server error:', err && err.message ? err.message : err)
  }
  log(method, pathname, status)
})

server.listen(PORT, () => {
  console.log(`Sales dashboard proxy listening on http://localhost:${PORT}`)
  console.log(`Data source: ${SOURCE_LABEL} ${CONFIGURED ? '(live data)' : '(not configured, dashboard will use sample data)'}`)
  if (!CONFIGURED && DATA_SOURCE === 'sheets') {
    console.log(`  still needed in the settings file: ${(sheetsSource?.missingSettings() ?? []).join(', ')}`)
  }
  if (AUTH_REQUIRED) {
    console.log(`Access: password required, sessions last ${SESSION_DAYS} days${env('SESSION_SECRET') ? '' : ' (SESSION_SECRET not set, so sessions reset on restart)'}`)
  } else if (ALLOW_NO_PASSWORD) {
    console.log('Access: OPEN, no password (ALLOW_NO_PASSWORD=true). Never run like this on the internet.')
  } else {
    console.log('Access: BLOCKED until DASHBOARD_PASSWORD is set in .env')
  }
  if (IS_PRODUCTION && !AUTH_REQUIRED) console.warn('WARNING: production mode without a password.')
  console.log(`Static files: ${fs.existsSync(DIST) ? 'serving dist/' : 'no dist/ yet, API only'}`)
  if (CONFIGURED) {
    console.log(
      `${SOURCE_LABEL} snapshot: every ${REFRESH_MINUTES} minutes, Refresh button cooldown ${MANUAL_COOLDOWN_MINUTES} minutes, file ${SNAPSHOT_FILE}`,
    )
    if (DATA_SOURCE === 'sheets') console.log(`  tabs: "${SHEET_CALLS_TAB}" and "${SHEET_DM_TAB}"`)
    snapshot.load()
    snapshot.start()
  }
})
