import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/auth'
import { route } from '@/lib/log'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Is the current visitor the logged-in admin? (used by the AdminBadge and by
// /dealer to recognise an existing session instead of showing a login form to
// someone who is already signed in.)
//
// `recovery` says whether a password-reset mail can actually be sent. Resend is
// deliberately dormant (no RESEND_API_KEY), so without this flag /dealer offers
// a "Forgot password" button that always claims a link is on its way and never
// sends one. It leaks nothing: it describes our own configuration, not any user.
export const GET = route('dealer.me', async () => {
  return NextResponse.json(
    { admin: !!(await currentAdmin()), recovery: !!process.env.RESEND_API_KEY },
    { headers: { 'Cache-Control': 'no-store' } },
  )
})
