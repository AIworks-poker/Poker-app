// Set the dealer password to one YOU choose. Put the plaintext password on
// the first line of ../poker-new-password.txt, then: node scripts/set-password.cjs
// It bcrypt-hashes into BOTH Neon DBs (preview + prod). The plaintext is never
// printed. Delete poker-new-password.txt afterwards.
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

const KEYS = path.join(__dirname, '..', '..', 'poker-vercel-env-keys.txt')
const PWIN = path.join(__dirname, '..', '..', 'poker-new-password.txt')
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

async function update(name, url, hash) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const r = await c.query(
    `UPDATE admin_auth SET password_hash = $2, reset_token = NULL, reset_expires = NULL
     WHERE id = 1 AND email = $1`, [ADMIN_EMAIL, hash])
  await c.end()
  console.log(`  ${name}: ${r.rowCount === 1 ? 'password updated' : 'NO admin row (run db-setup.cjs first)'}`)
}

;(async () => {
  if (!fs.existsSync(PWIN)) { console.error('Put your password on line 1 of poker-new-password.txt first.'); process.exit(1) }
  const pw = fs.readFileSync(PWIN, 'utf8').split(/\r?\n/).map(s => s.trim()).find(Boolean) || ''
  if (pw.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1) }
  const hash = await bcrypt.hash(pw, 10)
  const keys = parseKeys()
  for (const [name, env] of [['PREVIEW', keys.preview], ['PRODUCTION', keys.production]]) {
    const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
    if (!url) { console.log(`  ${name}: no URL`); continue }
    await update(name, url, hash)
  }
  console.log('done — now delete poker-new-password.txt')
})().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
