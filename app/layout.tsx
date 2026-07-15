import type { Metadata } from 'next'
import './globals.css'
import AdminBadge from './AdminBadge'
import { LangProvider, LangSwitch } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Poker Tournament Planner',
  description: 'Free poker-night planner — chips, stacks, blinds, optional padel seeding. Everything stays in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>
          <LangSwitch />
          <AdminBadge />
          {children}
        </LangProvider>
      </body>
    </html>
  )
}
