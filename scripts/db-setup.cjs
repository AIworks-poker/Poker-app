// One-off: create schema + seed the single admin row (with an initial
// password) in BOTH the preview and production Neon DBs. Reads the
// connection strings from the keys file, writes the temp password to a local
// gitignored file for BJS. Run: node scripts/db-setup.cjs
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const KEYS = path.join(__dirname, '..', '..', 'poker-vercel-env-keys.txt')
const PWOUT = path.join(__dirname, '..', '..', 'poker-dealer-password.txt')
const ADMIN_EMAIL = 'bas@steinhauserovi.cz'

function parseKeys() {
  const raw = fs.readFileSync(KEYS, 'utf8')
  const out = { preview: {}, production: {} }
  let section = null
  for (const ln of raw.split(/\r?\n/)) {
    const t = ln.trim()
    if (!t) continue
    if (/^#.*preview/i.test(t)) { section = 'preview'; continue }
    if (/^#.*production/i.test(t)) { section = 'production'; continue }
    const i = t.indexOf('=')
    if (i > 0 && section) out[section][t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

async function setup(name, url, hash) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, config JSONB NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS admin_auth (
      id INTEGER PRIMARY KEY DEFAULT 1, email TEXT NOT NULL, password_hash TEXT,
      reset_token TEXT, reset_expires TIMESTAMPTZ, CONSTRAINT one_row CHECK (id = 1));`)
  await c.query(
    `INSERT INTO admin_auth (id, email, password_hash) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET email = $1, password_hash = $2`,
    [ADMIN_EMAIL, hash])
  const t = (await c.query('SELECT count(*)::int n FROM templates')).rows[0].n
  await c.end()
  console.log(`  ${name}: schema ok, admin row set (${t} templates)`)
}

;(async () => {
  const keys = parseKeys()
  // strong, readable temp password
  const pw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
  const hash = await bcrypt.hash(pw, 10)
  for (const [name, env] of [['PREVIEW', keys.preview], ['PRODUCTION', keys.production]]) {
    const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
    if (!url) { console.log(`  ${name}: no URL`); continue }
    await setup(name, url, hash)
  }
  fs.writeFileSync(PWOUT, `Dealer login (poker app)\nURL:   /dealer\nEmail: ${ADMIN_EMAIL}\nPass:  ${pw}\n\nChange it later via /dealer -> Forgot password (once an email key is set),\nor re-run scripts/db-setup.cjs to reset to a new temp password.\n`)
  console.log('temp password written to ../poker-dealer-password.txt')
})().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
