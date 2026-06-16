'use client'

/**
 * A bright red "B" pinned to the top-right corner — visible on every page
 * ONLY while the single admin (bas@steinhauserovi.cz) is logged in. The session
 * cookie is httpOnly, so we ask the server via /api/dealer/me. Click it to jump
 * to the dealer backstage.
 */
import { useEffect, useState } from 'react'

export default function AdminBadge() {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    fetch('/api/dealer/me').then(r => r.json()).then(d => setAdmin(!!d.admin)).catch(() => {})
  }, [])
  if (!admin) return null
  return (
    <a href="/dealer" title="Logged in as dealer" aria-label="Logged in as dealer" className="admin-badge">B</a>
  )
}
