import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Is the current visitor the logged-in admin? (used by the AdminBadge.)
export async function GET() {
  return NextResponse.json({ admin: !!currentAdmin() }, { headers: { 'Cache-Control': 'no-store' } })
}
