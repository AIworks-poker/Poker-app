/**
 * Structured logging (portfolio rule 12 / C17): errors are logged with context,
 * never silently swallowed. Lines are plain JSON on stdout/stderr, so they stay
 * greppable both in `next dev` and in Vercel's runtime log viewer.
 *
 * Rule 20 (protect user data): NEVER pass personal data into a log line — no
 * emails, passwords, reset tokens, session cookies, IPs. When you need to say
 * *whether* such a value was present, pass `present(value)`, which records only
 * its length. There is deliberately no way to log the value itself.
 *
 * This file is isomorphic on purpose — no `next/server` import — so the client
 * components can log through the same helper. Browser lines land in the console
 * (the only place a browser has); server lines land in Vercel's log viewer.
 */

type Level = 'info' | 'warn' | 'error'
type Ctx = Record<string, unknown>

/** Presence + length of a sensitive value — never the value. */
export function present(v: unknown): string {
  if (typeof v !== 'string' || v.length === 0) return 'absent'
  return `present(${v.length})`
}

function describe(err: unknown): Ctx {
  if (err instanceof Error) {
    return { err: err.name, msg: err.message, stack: err.stack, cause: err.cause ? String(err.cause) : undefined }
  }
  return { err: 'NonError', msg: String(err) }
}

function emit(level: Level, event: string, ctx?: Ctx, err?: unknown) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...ctx,
    ...(err === undefined ? {} : describe(err)),
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (event: string, ctx?: Ctx) => emit('info', event, ctx),
  warn: (event: string, ctx?: Ctx) => emit('warn', event, ctx),
  error: (event: string, err: unknown, ctx?: Ctx) => emit('error', event, ctx, err),
}

/**
 * Wrap a route handler so an unexpected throw is logged with its route name and
 * answered with a generic 500 — instead of surfacing a framework stack trace to
 * the caller, or (worse) vanishing.
 */
export function route<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (err) {
      log.error('route.unhandled', err, { route: name })
      return new Response(JSON.stringify({ ok: false, error: 'server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}

/**
 * Parse a JSON request body. A malformed body is a client mistake, not a server
 * fault, so it is a warn (with the route name) rather than an error — but it is
 * no longer invisible, which is what `.catch(() => ({}))` used to make it.
 */
export async function readJson<T>(req: Request, routeName: string): Promise<Partial<T>> {
  try {
    const body = await req.json()
    return (body && typeof body === 'object' ? body : {}) as Partial<T>
  } catch (err) {
    log.warn('route.badJson', { route: routeName, msg: err instanceof Error ? err.message : String(err) })
    return {}
  }
}
