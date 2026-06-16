/**
 * Single-admin session — HMAC-signed token in an httpOnly cookie.
 * Only bas@steinhauserovi.cz (ADMIN_EMAIL) can ever hold a session; there is
 * no signup. The cookie exists ONLY after the admin logs in at /dealer — the
 * public never receives one.
 */
import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE = 'dealer_session'
const MAX_AGE = 60 * 60 * 24 * 30   // 30 days

function secret(): string { return process.env.SESSION_SECRET || 'dev-insecure-secret' }

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
  if (sign(payload) !== token) return null
  try {
    const { e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return e === process.env.ADMIN_EMAIL ? e : null
  } catch { return null }
}

export function setSessionCookie(email: string) {
  cookies().set(COOKIE, createSessionToken(email), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  })
}
export function clearSessionCookie() { cookies().set(COOKIE, '', { path: '/', maxAge: 0 }) }

/** The logged-in admin email, or null. Use to gate every write endpoint. */
export function currentAdmin(): string | null {
  return verifySessionToken(cookies().get(COOKIE)?.value)
}
