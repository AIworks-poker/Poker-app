import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/auth'
import { route } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Is the current visitor the logged-in admin? (used by the AdminBadge.)
export const GET = route('dealer.me', async () => {
  return NextResponse.json({ admin: !!(await currentAdmin()) }, { headers: { 'Cache-Control': 'no-store' } })
})
