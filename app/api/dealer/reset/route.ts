import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureSchema } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Set a new password using a valid, unexpired reset token. Also the initial
// password-set path. Token only ever issued to ADMIN_EMAIL.
export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({})) as { token?: string; password?: string }
  if (!token || !password || password.length < 8) return NextResponse.json({ ok: false, error: 'token + 8+ char password' }, { status: 400 })
  await ensureSchema()
  const row = (await db().query('SELECT reset_token, reset_expires FROM admin_auth WHERE id=1')).rows[0]
  if (!row || row.reset_token !== token || !row.reset_expires || new Date(row.reset_expires) < new Date())
    return NextResponse.json({ ok: false, error: 'invalid or expired token' }, { status: 400 })
  const hash = await bcrypt.hash(password, 10)
  await db().query('UPDATE admin_auth SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=1', [hash])
  return NextResponse.json({ ok: true })
}
