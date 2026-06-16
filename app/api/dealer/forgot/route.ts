import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db, ensureSchema } from '@/lib/db'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Forgot password: a reset link is ONLY ever sent to ADMIN_EMAIL
// (bas@steinhauserovi.cz). Any other address gets the same generic response
// and NO email — no enumeration, and no one else can ever receive mail.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string }
  const admin = process.env.ADMIN_EMAIL || ''
  const generic = NextResponse.json({ ok: true })   // identical response always
  if (!email || email.trim().toLowerCase() !== admin.toLowerCase()) return generic
  await ensureSchema()
  const token = crypto.randomBytes(24).toString('base64url')
  await db().query(
    `INSERT INTO admin_auth (id, email, reset_token, reset_expires) VALUES (1,$1,$2, now() + interval '1 hour')
     ON CONFLICT (id) DO UPDATE SET reset_token=$2, reset_expires=now() + interval '1 hour'`,
    [admin, token],
  )
  // Email send is wired when a sender key (RESEND_API_KEY) is configured.
  if (process.env.RESEND_API_KEY) {
    const link = `${process.env.NEXT_PUBLIC_APP_URL || ''}/dealer/reset?token=${token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Poker <noreply@wemakeai.work>', to: admin, subject: 'Dealer password reset', text: `Reset your dealer password: ${link}` }),
    }).catch(() => {})
  }
  return generic
}
