import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureSchema } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({})) as { email?: string; password?: string }
  await ensureSchema()
  const admin = process.env.ADMIN_EMAIL || ''
  // generic failure (no account enumeration)
  const fail = NextResponse.json({ ok: false }, { status: 401 })
  if (!email || !password || email.trim().toLowerCase() !== admin.toLowerCase()) return fail
  const row = (await db().query('SELECT password_hash FROM admin_auth WHERE id=1')).rows[0]
  if (!row?.password_hash) return fail
  if (!(await bcrypt.compare(password, row.password_hash))) return fail
  setSessionCookie(admin)
  return NextResponse.json({ ok: true })
}
