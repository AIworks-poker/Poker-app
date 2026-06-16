'use client'

import { useState } from 'react'

export default function Reset() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = new URLSearchParams(window.location.search).get('token') || ''
    const r = await fetch('/api/dealer/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) })
    setMsg(r.ok ? 'Password set. You can now log in at /dealer.' : 'Invalid or expired link.')
  }
  return (
    <main className="wrap" style={{ maxWidth: 480 }}>
      <h1>Set dealer password</h1>
      <div className="card">
        <form onSubmit={submit} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <label>New password (8+ chars)<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className="primary" type="submit" disabled={pw.length < 8}>Set password</button>
        </form>
        {msg && <p className="warn" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </main>
  )
}
