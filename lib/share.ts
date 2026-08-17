/**
 * Shareable setup links — the "suggest a template" mechanism.
 *
 * A visitor cannot write to our database (every template write is dealer-only),
 * and deliberately so: a public write endpoint would need moderation, rate
 * limiting and spam handling, and it would break the promise in the footer that
 * nothing about the visitor is stored. Instead the whole setup travels IN the
 * link: the visitor copies it, sends it to the dealer however they like, and the
 * dealer opens it, reviews it, and saves it as a template if they want it.
 *
 * Player NAMES are stripped before encoding (rule 20 — minimise personal data).
 * A suggested structure has no use for who was at the table, and a link is a
 * thing people paste into chats.
 */
import { type Setup } from './setup'
import { log } from './log'

export const SHARE_PARAM = 't'

/** base64url so the value survives a URL, a chat client and a copy-paste. */
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Encode a setup for a link. Returns '' if encoding fails — never throws. */
export function encodeSetup(s: Setup): string {
  try {
    const { names, ...rest } = s   // names deliberately dropped
    void names
    return toBase64Url(JSON.stringify(rest))
  } catch (err) {
    log.error('share.encodeFailed', err)
    return ''
  }
}

/**
 * Decode a shared setup. Returns null on anything unexpected — the value comes
 * from a URL a stranger may have edited, so it is treated as untrusted input and
 * merged over DEFAULT_SETUP by the caller rather than used as-is.
 */
export function decodeSetup(raw: string | null): Partial<Setup> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Partial<Setup>
  } catch (err) {
    log.warn('share.decodeFailed', { msg: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/** The full link for the current setup. */
export function shareUrl(s: Setup): string {
  return `${window.location.origin}/?${SHARE_PARAM}=${encodeSetup(s)}`
}
