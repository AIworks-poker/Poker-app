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
import { useLang } from '@/lib/i18n'

interface Tmpl { id: string; name: string; config: Partial<Setup> }
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US')

export default function Dealer() {
  const { t } = useLang()
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
    if (r.ok) { setAuthed(true); setPw('') } else { setMsg(t.loginFail) }
  }
  async function forgot() {
    setMsg('')
    await fetch('/api/dealer/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setMsg(t.forgotSent)
  }
  async function logout() { await fetch('/api/dealer/logout', { method: 'POST' }); setAuthed(false) }

  async function saveCurrent() {
    setMsg('')
    let config: unknown = {}
    try { config = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') } catch {}
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config }) })
    if (r.ok) { setName(''); setMsg(t.saved); refresh() }
    else if (r.status === 401) { setAuthed(false); setMsg(t.sessionExpired) }
    else setMsg(t.saveFailShort)
  }
  async function del(id: string) {
    if (!confirm(t.confirmDelete)) return
    const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (r.ok) refresh(); else if (r.status === 401) setAuthed(false)
  }
  function edit(tm: Tmpl) {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({ ...DEFAULT_SETUP, ...tm.config }))
      localStorage.setItem(EDITING_KEY, JSON.stringify({ id: tm.id, name: tm.name }))
    } catch {}
    window.location.href = '/'
  }

  const loggedIn = authed === true

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <h1>{t.dealer}</h1>
      {!loggedIn ? (
        <div className="card">
          <p className="sub">{t.dealerSub}</p>
          <form onSubmit={login} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <label>{t.email}<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>{t.password}<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
            <div className="row">
              <button className="primary" type="submit">{t.login}</button>
              <button type="button" onClick={forgot}>{t.forgot}</button>
            </div>
          </form>
          {msg && <p className="warn" style={{ marginTop: 10 }}>{msg}</p>}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>{t.saveCurrent}</h2>
              <button onClick={logout}>{t.logout}</button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t.tmplNamePh} style={{ flex: 1 }} />
              <button className="primary" onClick={saveCurrent} disabled={!name.trim()}>{t.saveNew}</button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.saveCurrentHint1}<a href="/">{t.homePage}</a>{t.saveCurrentHint2}<b>{t.edit}</b>{t.saveCurrentHint3}</p>
            {msg && <p className="warn">{msg}</p>}
          </div>
          <div className="card">
            <h2 style={{ margin: '0 0 10px' }}>{t.templatesN(templates.length)}</h2>
            {templates.length === 0 ? <p className="muted">{t.noneYet}</p> : (
              <div className="cards">
                {templates.map(tm => {
                  const c = tm.config
                  const tags = [c.antes && t.tagAntes, c.rebuys && t.tagRebuys, c.addOns && t.tagAddOns].filter(Boolean).join(' · ')
                  return (
                    <div key={tm.id} className="tcard">
                      <h3>{tm.name}</h3>
                      <div className="meta">
                        {t.templatePlayers(c.players ?? 0, fmt(c.startingStack ?? 0))}<br />
                        {tags}{tags ? <br /> : null}
                        {c.payoutMode === 'cash' ? t.cashGame : t.splitTag((c.payoutSplit ?? []).join('/'))} · {t.buyInTag(fmt(c.buyInPrice ?? 0))} {c.currency ?? ''}
                      </div>
                      <div className="acts">
                        <button className="primary" onClick={() => edit(tm)}>{t.edit}</button>
                        <button onClick={() => del(tm.id)}>{t.del}</button>
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
