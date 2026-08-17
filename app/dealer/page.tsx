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
import { log } from '@/lib/log'

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
  // Can a reset mail actually be sent? Resend is dormant, so normally no —
  // and a button that cannot work should not be on screen.
  const [recovery, setRecovery] = useState(false)

  async function refresh() {
    const r = await fetch('/api/templates').then(r => r.json())
      .catch(err => { log.error('dealer.templatesLoadFailed', err); return { templates: [] } })
    setTemplates(r.templates ?? [])
  }
  useEffect(() => { refresh() }, [])

  // The session cookie is httpOnly, so ask the server whether we are already
  // signed in — otherwise a logged-in dealer is shown a login form.
  useEffect(() => {
    fetch('/api/dealer/me').then(r => r.json())
      .then(d => { setAuthed(!!d.admin); setRecovery(!!d.recovery) })
      .catch(err => log.warn('dealer.sessionCheckFailed', { msg: String(err) }))
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    try {
      const r = await fetch('/api/dealer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })
      if (r.ok) { setAuthed(true); setPw('') } else { log.warn('dealer.loginRejected', { status: r.status }); setMsg(t.loginFail) }
    } catch (err) {
      log.error('dealer.loginFailed', err)
      setMsg(t.loginFail)
    }
  }
  async function forgot() {
    setMsg('')
    // A blank field is not an enumeration question — refusing it tells a
    // stranger nothing — so say so plainly instead of claiming a mail was sent.
    if (!email.trim()) { setMsg(t.enterEmail); return }
    try {
      await fetch('/api/dealer/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    } catch (err) {
      log.error('dealer.forgotFailed', err)
    }
    setMsg(t.forgotSent)   // identical for a right or wrong address — no enumeration
  }
  async function logout() {
    try { await fetch('/api/dealer/logout', { method: 'POST' }) }
    catch (err) { log.error('dealer.logoutFailed', err) }
    setAuthed(false)
  }

  async function saveCurrent() {
    setMsg('')
    let config: unknown = {}
    try { config = JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') }
    catch (err) { log.error('dealer.setupReadFailed', err) }
    try {
      const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config }) })
      if (r.ok) { setName(''); setMsg(t.saved); refresh() }
      else if (r.status === 401) { setAuthed(false); setMsg(t.sessionExpired) }
      else { log.error('dealer.saveRejected', new Error(`POST /api/templates → ${r.status}`), { status: r.status }); setMsg(t.saveFailShort) }
    } catch (err) {
      log.error('dealer.saveFailed', err)
      setMsg(t.saveFailShort)
    }
  }
  async function del(id: string) {
    if (!confirm(t.confirmDelete)) return
    try {
      const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (r.ok) refresh()
      else if (r.status === 401) setAuthed(false)
      else log.error('dealer.deleteRejected', new Error(`DELETE /api/templates → ${r.status}`), { id, status: r.status })
    } catch (err) {
      log.error('dealer.deleteFailed', err, { id })
    }
  }
  function edit(tm: Tmpl) {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({ ...DEFAULT_SETUP, ...tm.config }))
      localStorage.setItem(EDITING_KEY, JSON.stringify({ id: tm.id, name: tm.name }))
    } catch (err) {
      // The handoff to the planner rides on localStorage; if it failed, the
      // planner will open with the PREVIOUS setup and "save" would overwrite
      // the wrong template. Do not navigate on a broken handoff.
      log.error('dealer.editHandoffFailed', err, { id: tm.id })
      setMsg(t.saveFailShort)
      return
    }
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
              {/* Only offered when a mail sender is configured — otherwise this
                  button can never deliver anything. Recovery without it is
                  re-running scripts/db-setup.cjs (see the project brief). */}
              {recovery && <button type="button" onClick={forgot}>{t.forgot}</button>}
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
