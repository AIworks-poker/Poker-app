import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'
import { log, route } from '@/lib/log'
export const runtime = 'nodejs'

export const POST = route('dealer.logout', async () => {
  clearSessionCookie()
  log.info('dealer.logout.ok', {})
  return NextResponse.json({ ok: true })
})
