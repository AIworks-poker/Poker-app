'use client'

/**
 * A bright red "B" pinned to the top-right corner — visible on every page
 * ONLY while the single admin (ADMIN_EMAIL) is logged in. The session
 * cookie is httpOnly, so we ask the server via /api/dealer/me. Click it to jump
 * to the dealer backstage.
 */
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n'
import { log } from '@/lib/log'

export default function AdminBadge() {
  const { t } = useLang()
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    fetch('/api/dealer/me').then(r => r.json()).then(d => setAdmin(!!d.admin))
      .catch(err => log.warn('adminBadge.checkFailed', { msg: String(err) }))
  }, [])
  if (!admin) return null
  return (
    <a href="/dealer" title={t.adminBadgeTitle} aria-label={t.adminBadgeTitle} className="admin-badge">B</a>
  )
}
