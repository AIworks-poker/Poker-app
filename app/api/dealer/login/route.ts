import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureSchema } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'
import { log, route, readJson, present } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = route('dealer.login', async (req: NextRequest) => {
  const { email, password } = await readJson<{ email: string; password: string }>(req, 'dealer.login')
  const admin = process.env.ADMIN_EMAIL || ''
  if (!admin) log.error('dealer.login.misconfigured', new Error('ADMIN_EMAIL is not set'))
  // generic failure (no account enumeration) — the caller never learns which
  // check failed; the log does, so a real lockout is diagnosable.
  const fail = (reason: string) => {
    log.warn('dealer.login.failed', { reason, email: present(email), password: present(password) })
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  // Check the address before touching the database: a bogus login should not
  // cost a round-trip, and should not turn into a 500 when the DB is unreachable.
  if (!email || !password || email.trim().toLowerCase() !== admin.toLowerCase()) return fail('email-mismatch')
  await ensureSchema()
  const row = (await db().query('SELECT password_hash FROM admin_auth WHERE id=1')).rows[0]
  if (!row?.password_hash) return fail('no-password-set')
  if (!(await bcrypt.compare(password, row.password_hash))) return fail('bad-password')
  await setSessionCookie(admin)
  log.info('dealer.login.ok', {})
  return NextResponse.json({ ok: true })
})
