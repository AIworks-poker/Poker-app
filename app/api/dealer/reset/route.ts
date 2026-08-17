import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureSchema } from '@/lib/db'
import { log, route, readJson, present } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Set a new password using a valid, unexpired reset token. Also the initial
// password-set path. Token only ever issued to ADMIN_EMAIL.
export const POST = route('dealer.reset', async (req: NextRequest) => {
  const { token, password } = await readJson<{ token: string; password: string }>(req, 'dealer.reset')
  if (!token || !password || password.length < 8) {
    log.warn('dealer.reset.rejected', { reason: 'missing-token-or-short-password', token: present(token) })
    return NextResponse.json({ ok: false, error: 'token + 8+ char password' }, { status: 400 })
  }
  await ensureSchema()
  const row = (await db().query('SELECT reset_token, reset_expires FROM admin_auth WHERE id=1')).rows[0]
  if (!row || row.reset_token !== token || !row.reset_expires || new Date(row.reset_expires) < new Date()) {
    log.warn('dealer.reset.rejected', {
      reason: !row ? 'no-admin-row' : row.reset_token !== token ? 'token-mismatch' : 'token-expired',
    })
    return NextResponse.json({ ok: false, error: 'invalid or expired token' }, { status: 400 })
  }
  const hash = await bcrypt.hash(password, 10)
  await db().query('UPDATE admin_auth SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=1', [hash])
  log.info('dealer.reset.ok', {})
  return NextResponse.json({ ok: true })
})
