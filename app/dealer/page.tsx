'use client'

/**
 * /dealer — hidden single-admin backstage (no link from the public site).
 * Logged out: a minimal login + "forgot password". Logged in: save the current
 * planner setup as a template, and manage existing ones as cards — Edit loads a
 * template into the planner (and overwrites it on save, no duplicates), Delete
 * removes it. Only bas@steinhauserovi.cz can ever hold a session.
 */

import { useEffect, useState } from 'react'
import { type Setup, DEFAULT_SETUP, SETUP_KEY, EDITING_KEY } from '@/lib/setup'

interface Tmpl { id: string; name: string; config: Partial<Setup> }
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US')

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
    try { config = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') } catch {}
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config }) })
    if (r.ok) { setName(''); setMsg('Saved.'); refresh() }
    else if (r.status === 401) { setAuthed(false); setMsg('Session expired — log in again.') }
    else setMsg('Save failed.')
  }
  async function del(id: string) {
    if (!confirm('Delete this template?')) return
    const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (r.ok) refresh(); else if (r.status === 401) setAuthed(false)
  }
  function edit(t: Tmpl) {
    // load the template into the planner and mark it for overwrite-on-save
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({ ...DEFAULT_SETUP, ...t.config }))
      localStorage.setItem(EDITING_KEY, JSON.stringify({ id: t.id, name: t.name }))
    } catch {}
    window.location.href = '/'
  }

  const loggedIn = authed === true

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
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
              <h2 style={{ margin: 0 }}>Save current setup as a new template</h2>
              <button onClick={logout}>Log out</button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 12-player Friday" style={{ flex: 1 }} />
              <button className="primary" onClick={saveCurrent} disabled={!name.trim()}>Save new</button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Saves whatever you last configured on the <a href="/">home page</a>. To change an existing template, use <b>Edit</b> below.</p>
            {msg && <p className="warn">{msg}</p>}
          </div>
          <div className="card">
            <h2 style={{ margin: '0 0 10px' }}>Templates ({templates.length})</h2>
            {templates.length === 0 ? <p className="muted">None yet.</p> : (
              <div className="cards">
                {templates.map(t => {
                  const c = t.config
                  return (
                    <div key={t.id} className="tcard">
                      <h3>{t.name}</h3>
                      <div className="meta">
                        {c.players ?? '?'} players · stack {fmt(c.startingStack ?? 0)}<br />
                        {c.speed ?? 'normal'} blinds{c.antes ? ' · antes' : ''}{c.rebuys ? ' · rebuys' : ''}{c.addOns ? ' · add-ons' : ''}<br />
                        {c.payoutMode === 'cash' ? 'cash game' : `split ${(c.payoutSplit ?? []).join('/')}`} · buy-in {fmt(c.buyInPrice ?? 0)} {c.currency ?? ''}
                      </div>
                      <div className="acts">
                        <button className="primary" onClick={() => edit(t)}>Edit</button>
                        <button onClick={() => del(t.id)}>Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}
