'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n'

export default function Reset() {
  const { t } = useLang()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = new URLSearchParams(window.location.search).get('token') || ''
    const r = await fetch('/api/dealer/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) })
    setMsg(r.ok ? t.pwSet : t.pwInvalid)
  }
  return (
    <main className="wrap" style={{ maxWidth: 480 }}>
      <h1>{t.setPw}</h1>
      <div className="card">
        <form onSubmit={submit} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <label>{t.newPw}<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className="primary" type="submit" disabled={pw.length < 8}>{t.setPwBtn}</button>
        </form>
        {msg && <p className="warn" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </main>
  )
}
