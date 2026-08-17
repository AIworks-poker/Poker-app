import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db, ensureSchema } from '@/lib/db'
import { log, route, readJson } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Forgot password: a reset link is ONLY ever sent to ADMIN_EMAIL
// (bas@steinhauserovi.cz). Any other address gets the same generic response
// and NO email — no enumeration, and no one else can ever receive mail.
export const POST = route('dealer.forgot', async (req: NextRequest) => {
  const { email } = await readJson<{ email: string }>(req, 'dealer.forgot')
  const admin = process.env.ADMIN_EMAIL || ''
  const generic = () => NextResponse.json({ ok: true })   // identical response always
  if (!email || email.trim().toLowerCase() !== admin.toLowerCase()) {
    log.warn('dealer.forgot.ignored', { reason: 'not-admin-address' })
    return generic()
  }
  await ensureSchema()
  const token = crypto.randomBytes(24).toString('base64url')
  await db().query(
    `INSERT INTO admin_auth (id, email, reset_token, reset_expires) VALUES (1,$1,$2, now() + interval '1 hour')
     ON CONFLICT (id) DO UPDATE SET reset_token=$2, reset_expires=now() + interval '1 hour'`,
    [admin, token],
  )
  log.info('dealer.forgot.tokenIssued', { emailSender: process.env.RESEND_API_KEY ? 'resend' : 'none' })
  // Email send is wired when a sender key (RESEND_API_KEY) is configured.
  // Resend is deliberately dormant (project decision 2026-06-16): recovery is
  // re-running scripts/db-setup.cjs. If it is ever switched on, a failed send
  // must not look like a success.
  if (process.env.RESEND_API_KEY) {
    const link = `${process.env.NEXT_PUBLIC_APP_URL || ''}/dealer/reset?token=${token}`
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Poker <noreply@wemakeai.work>', to: admin, subject: 'Dealer password reset', text: `Reset your dealer password: ${link}` }),
      })
      if (!res.ok) log.error('dealer.forgot.sendFailed', new Error(`resend responded ${res.status}`), { status: res.status })
      else log.info('dealer.forgot.sent', {})
    } catch (err) {
      log.error('dealer.forgot.sendFailed', err)
    }
  }
  return generic()
})
