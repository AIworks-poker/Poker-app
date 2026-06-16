'use client'

/**
 * /dealer — hidden single-admin backstage (no link from the public site).
 * Logged out: a minimal login + "forgot password". Logged in: save the
 * current planner setup as a public template, and manage existing ones.
 * There is NO "create account" — only bas@steinhauserovi.cz can hold a session.
 */

import { useEffect, useState } from 'react'

interface Tmpl { id: string; name: string; config: unknown }

export default function Dealer() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [templates, setTemplates] = useState<Tmpl[]>([])
  const [name, setName] = useState('')

  async function refresh() {
    const r = await fetch('/api/templates').then(r => r.json()).catch(() => ({ templates: [] }))
    setTemplates(r.templates ?? [])
  }
  useEffect(() => { refresh() }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await fetch('/api/dealer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })
    if (r.ok) { setAuthed(true); setPw('') } else { setMsg('Login failed.') }
  }
  async function forgot() {
    setMsg('')
    await fetch('/api/dealer/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setMsg('If that address is the dealer, a reset link is on its way.')
  }
  async function logout() { await fetch('/api/dealer/logout', { method: 'POST' }); setAuthed(false) }

  async function saveCurrent() {
    setMsg('')
    let config: unknown = {}
    try { config = JSON.parse(localStorage.getItem('poker_setup') || '{}') } catch {}
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config }) })
    if (r.ok) { setName(''); setMsg('Saved.'); refresh() }
    else if (r.status === 401) { setAuthed(false); setMsg('Session expired — log in again.') }
    else setMsg('Save failed.')
  }
  async function del(id: string) {
    const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (r.ok) refresh(); else if (r.status === 401) setAuthed(false)
  }

  // we don't have a "whoami" call; infer from a save attempt — simplest: show
  // both, let actions 401 if not authed. Treat null as logged-out view.
  const loggedIn = authed === true

  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h1>🎴 Dealer</h1>
      {!loggedIn ? (
        <div className="card">
          <p className="sub">Backstage — saving public templates. Dealer only.</p>
          <form onSubmit={login} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
            <div className="row">
              <button className="primary" type="submit">Log in</button>
              <button type="button" onClick={forgot}>Forgot password</button>
            </div>
          </form>
          {msg && <p className="warn" style={{ marginTop: 10 }}>{msg}</p>}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Save current setup as template</h2>
              <button onClick={logout}>Log out</button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 12-player Friday" style={{ flex: 1 }} />
              <button className="primary" onClick={saveCurrent} disabled={!name.trim()}>Save</button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Saves whatever you last configured on the home page (this browser).</p>
            {msg && <p className="warn">{msg}</p>}
          </div>
          <div className="card">
            <h2 style={{ margin: '0 0 8px' }}>Templates ({templates.length})</h2>
            {templates.length === 0 ? <p className="muted">None yet.</p> : templates.map(t => (
              <div key={t.id} className="row" style={{ justifyContent: 'space-between', borderTop: '1px dashed var(--line)', padding: '6px 0' }}>
                <span>{t.name}</span>
                <button onClick={() => del(t.id)} style={{ fontSize: 12 }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
