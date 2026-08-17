/**
 * Single-admin session — HMAC-signed token in an httpOnly cookie.
 * Only bas@steinhauserovi.cz (ADMIN_EMAIL) can ever hold a session; there is
 * no signup. The cookie exists ONLY after the admin logs in at /dealer — the
 * public never receives one.
 */
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { log } from './log'

const COOKIE = 'dealer_session'
const MAX_AGE = 60 * 60 * 24 * 30   // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) {
    // Falling back to a public constant means anyone can mint an admin cookie.
    // Acceptable locally, never in production — so say so, loudly.
    log.error('auth.noSessionSecret', new Error('SESSION_SECRET is not set — using the insecure dev fallback'), {
      env: process.env.NODE_ENV,
    })
    return 'dev-insecure-secret'
  }
  return s
}

/** Constant-time string compare — a plain !== leaks the MAC byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function sign(payload: string): string {
  const mac = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

export function createSessionToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, t: Date.now() })).toString('base64url')
  return sign(payload)
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  if (!safeEqual(sign(payload), token)) {
    log.warn('auth.badSignature', {})
    return null
  }
  try {
    const { e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return e === process.env.ADMIN_EMAIL ? e : null
  } catch (err) {
    // Signature was valid but the payload is not the JSON we wrote — that means
    // our own token format changed, not an attack. Worth seeing.
    log.error('auth.malformedPayload', err)
    return null
  }
}

// Next 15 made cookies() async, so these three are async too — every caller
// must await them. Forgetting the await on currentAdmin() would return a
// Promise, which is truthy, and silently open a write endpoint to the public;
// the return types below are what makes that a compile error instead.
export async function setSessionCookie(email: string): Promise<void> {
  (await cookies()).set(COOKIE, createSessionToken(email), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  })
}
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0 })
}

/** The logged-in admin email, or null. Use to gate every write endpoint. */
export async function currentAdmin(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(COOKIE)?.value)
}
