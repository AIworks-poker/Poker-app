'use client'

/**
 * Setup page — configure the night (chips, players via slider, names, prices,
 * blinds, payout mode), see the live chip plan / stacks / blind preview, load
 * or edit dealer templates, then hit "Start tournament" to open the live clock.
 * Pure client-side; state persists in localStorage (no cookies, no tracking).
 */

import { useEffect, useMemo, useState } from 'react'
import { planChips, playerStacks, padelApplies } from '@/lib/chips'
import { generateBlinds, totalDuration, type Speed } from '@/lib/blinds'
import { prizePool, tournamentPayouts, formatMoney } from '@/lib/money'
import { type Setup, DEFAULT_SETUP, MAX_PLAYERS, normalizeNames, SETUP_KEY, EDITING_KEY } from '@/lib/setup'

const CHIP_CSS: Record<string, string> = {
  White: '#f4f4f4', Red: '#e74c3c', Blue: '#3498db', Black: '#222831',
  Green: '#27ae60', Purple: '#8e44ad',
}
const fmt = (n: number) => n.toLocaleString('en-US')

interface Tmpl { id: string; name: string; config: Partial<Setup> }

export default function Home() {
  const [s, setS] = useState<Setup>(DEFAULT_SETUP)
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [saved, setSaved] = useState<Tmpl[]>([])
  const [msg, setMsg] = useState('')

  // load persisted setup + any "edit this template" handoff from /dealer
  useEffect(() => {
    try { const v = localStorage.getItem(SETUP_KEY); if (v) setS({ ...DEFAULT_SETUP, ...JSON.parse(v) }) } catch {}
    try { const e = localStorage.getItem(EDITING_KEY); if (e) setEditing(JSON.parse(e)) } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)) } catch {} }, [s])
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setSaved(d.templates ?? [])).catch(() => {})
  }, [])

  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setS(p => ({ ...p, [k]: v }))
  const setPlayers = (n: number) => setS(p => ({ ...p, players: n, names: normalizeNames(p.names, n) }))

  const plan = useMemo(
    () => planChips(s.inventory, { players: s.players, rebuysPerPlayer: s.rebuys ? s.rebuysPerPlayer : 0, addOnsPerPlayer: s.addOns ? 1 : 0 }),
    [s.inventory, s.players, s.rebuys, s.rebuysPerPlayer, s.addOns],
  )
  const stacks = useMemo(() => playerStacks(s.players, plan.stackValue, s.padel), [s.players, plan.stackValue, s.padel])
  const blinds = useMemo(
    () => generateBlinds({ startingStack: s.startingStack, players: s.players, speed: s.speed, antes: s.antes, graceSeconds: s.graceSeconds, breakEvery: 4, levels: 16 }),
    [s.startingStack, s.players, s.speed, s.antes, s.graceSeconds],
  )
  const dur = totalDuration(blinds)

  // estimated pool (assumes rebuysPerPlayer avg + 1 add-on/player if enabled) — live tally happens on /run
  const estPool = useMemo(() => prizePool({
    players: s.players, buyInPrice: s.buyInPrice,
    rebuys: s.rebuys ? Math.round(s.players * s.rebuysPerPlayer) : 0, rebuyPrice: s.rebuyPrice,
    addOns: s.addOns ? s.players : 0, addOnPrice: s.addOnPrice,
  }), [s])
  const estPayouts = useMemo(() => tournamentPayouts(estPool, s.payoutSplit), [estPool, s.payoutSplit])

  function updInv(i: number, field: 'count' | 'value', v: number) {
    setS(p => ({ ...p, inventory: p.inventory.map((c, j) => j === i ? { ...c, [field]: v } : c) }))
  }
  function setSplit(i: number, v: number) {
    setS(p => ({ ...p, payoutSplit: p.payoutSplit.map((x, j) => j === i ? v : x) }))
  }
  function loadTemplate(t: Tmpl) {
    setS({ ...DEFAULT_SETUP, ...t.config, names: normalizeNames(t.config.names ?? [], t.config.players ?? DEFAULT_SETUP.players) })
    clearEditing(); setMsg(`Loaded "${t.name}".`)
  }
  function clearEditing() { setEditing(null); try { localStorage.removeItem(EDITING_KEY) } catch {} }

  async function saveChanges() {
    if (!editing) return
    const r = await fetch('/api/templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, name: editing.name, config: s }) })
    setMsg(r.ok ? `Saved changes to "${editing.name}".` : 'Save failed — log in at /dealer first.')
    if (r.ok) { clearEditing(); refresh() }
  }
  async function saveAsNew() {
    const name = prompt('Template name?')?.trim()
    if (!name) return
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config: s }) })
    setMsg(r.ok ? `Saved "${name}".` : 'Save failed — log in at /dealer first.')
    if (r.ok) refresh()
  }
  function refresh() { fetch('/api/templates').then(r => r.json()).then(d => setSaved(d.templates ?? [])).catch(() => {}) }

  const padelOn = s.padel && padelApplies(s.players)

  return (
    <main className="wrap">
      <h1>♠ Poker Tournament Planner</h1>
      <p className="sub">Set your chips, players, prices and blinds → start the clock. Everything stays in your browser.</p>

      {editing && (
        <div className="banner">
          <span>Editing template <b>{editing.name}</b></span>
          <button className="primary" onClick={saveChanges}>Save changes</button>
          <button onClick={saveAsNew}>Save as new</button>
          <button onClick={clearEditing}>Cancel</button>
        </div>
      )}

      {/* Saved templates */}
      {saved.length > 0 && (
        <div className="card">
          <h2 style={{ margin: '0 0 10px' }}>Templates</h2>
          <div className="cards">
            {saved.map(t => {
              const c = t.config
              return (
                <div key={t.id} className="tcard">
                  <h3>{t.name}</h3>
                  <div className="meta">
                    {c.players ?? '?'} players · stack {fmt(c.startingStack ?? 0)}<br />
                    {c.speed ?? 'normal'} blinds{c.antes ? ' · antes' : ''}{c.rebuys ? ' · rebuys' : ''}{c.addOns ? ' · add-ons' : ''}<br />
                    {c.payoutMode === 'cash' ? 'cash game' : `split ${(c.payoutSplit ?? []).join('/')}`}
                  </div>
                  <div className="acts"><button className="primary" onClick={() => loadTemplate(t)}>Load</button></div>
                </div>
              )
            })}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>To edit a template, open it from <a href="/dealer">/dealer</a>.</p>
        </div>
      )}
      {msg && <p className="warn">{msg}</p>}

      {/* Players + format */}
      <div className="card">
        <h2 style={{ margin: '0 0 12px' }}>Players & format</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ flex: 1, minWidth: 240 }}>Players: <b style={{ color: 'var(--text)' }}>{s.players}</b>
            <input type="range" min={2} max={MAX_PLAYERS} value={s.players} onChange={e => setPlayers(+e.target.value)} />
          </label>
          <label>Starting stack<input type="number" min={100} step={100} value={s.startingStack} onChange={e => set('startingStack', +e.target.value || 0)} /></label>
          <label>Blind speed
            <select value={s.speed} onChange={e => set('speed', e.target.value as Speed)}>
              <option value="fast">Fast (10 min)</option><option value="normal">Normal (15 min)</option><option value="slow">Slow (20 min)</option>
            </select>
          </label>
          <label>Grace between levels (s)<input type="number" min={0} max={300} step={15} value={s.graceSeconds} onChange={e => set('graceSeconds', +e.target.value || 0)} /></label>
        </div>
        <div className="row">
          <label className="toggle"><input type="checkbox" checked={s.rebuys} onChange={e => set('rebuys', e.target.checked)} /> Rebuys</label>
          {s.rebuys && <label>per player (avg)<input type="number" min={0} max={5} step={0.5} value={s.rebuysPerPlayer} onChange={e => set('rebuysPerPlayer', +e.target.value || 0)} /></label>}
          <label className="toggle"><input type="checkbox" checked={s.addOns} onChange={e => set('addOns', e.target.checked)} /> Add-ons</label>
          {s.addOns && <label>add-on chips<input type="number" min={0} step={100} value={s.addOnValue} onChange={e => set('addOnValue', +e.target.value || 0)} /></label>}
          <label className="toggle"><input type="checkbox" checked={s.antes} onChange={e => set('antes', e.target.checked)} /> Antes</label>
          <label className="toggle"><input type="checkbox" checked={s.padel} onChange={e => set('padel', e.target.checked)} /> Padel head-start</label>
        </div>
      </div>

      {/* Prices & payout */}
      <div className="card">
        <h2 style={{ margin: '0 0 12px' }}>Money</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <label>Currency
            <select value={s.currency} onChange={e => set('currency', e.target.value)}>
              <option value="Kč">Kč</option><option value="€">€</option><option value="$">$</option><option value="£">£</option>
            </select>
          </label>
          <label>Buy-in price<input type="number" min={0} value={s.buyInPrice} onChange={e => set('buyInPrice', +e.target.value || 0)} /></label>
          {s.rebuys && <label>Rebuy price<input type="number" min={0} value={s.rebuyPrice} onChange={e => set('rebuyPrice', +e.target.value || 0)} /></label>}
          {s.addOns && <label>Add-on price<input type="number" min={0} value={s.addOnPrice} onChange={e => set('addOnPrice', +e.target.value || 0)} /></label>}
        </div>
        <div className="row">
          <label>Payout
            <select value={s.payoutMode} onChange={e => set('payoutMode', e.target.value as Setup['payoutMode'])}>
              <option value="tournament">Tournament (split the pool)</option>
              <option value="cash">Cash game (chips = cash)</option>
            </select>
          </label>
          {s.payoutMode === 'tournament' && (
            <>
              <div className="row" style={{ gap: 6 }}>
                {s.payoutSplit.map((p, i) => (
                  <label key={i} style={{ alignItems: 'center' }}>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} %
                    <input className="split-in" type="number" min={0} max={100} value={p} onChange={e => setSplit(i, +e.target.value || 0)} />
                  </label>
                ))}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button onClick={() => set('payoutSplit', [...s.payoutSplit, 0])}>+ place</button>
                {s.payoutSplit.length > 1 && <button onClick={() => set('payoutSplit', s.payoutSplit.slice(0, -1))}>− place</button>}
                <button onClick={() => set('payoutSplit', [100])}>Winner-takes-all</button>
                <button onClick={() => set('payoutSplit', [60, 30, 10])}>60/30/10</button>
              </div>
            </>
          )}
        </div>
        {s.payoutMode === 'tournament' && s.payoutSplit.reduce((a, b) => a + b, 0) !== 100 && (
          <p className="warn">Split adds up to {s.payoutSplit.reduce((a, b) => a + b, 0)}% (normalised to 100% when paying out).</p>
        )}
      </div>

      {/* Names */}
      <div className="card">
        <h2 style={{ margin: '0 0 10px' }}>Player names ({s.players})</h2>
        <div className="names">
          {Array.from({ length: s.players }, (_, i) => (
            <label key={i}>#{i + 1}<input value={s.names[i] ?? ''} placeholder={`Player ${i + 1}`} onChange={e => setS(p => ({ ...p, names: normalizeNames(p.names, p.players).map((n, j) => j === i ? e.target.value : n) }))} /></label>
          ))}
        </div>
      </div>

      {/* Chip inventory */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Chips</h2>
        <table>
          <thead><tr><th>Colour</th><th>Have</th><th>Value</th><th className="right">Per stack</th></tr></thead>
          <tbody>
            {s.inventory.map((c, i) => (
              <tr key={c.name}>
                <td><span className="chip" style={{ background: CHIP_CSS[c.name] ?? '#888' }} />{c.name}</td>
                <td><input type="number" min={0} value={c.count} onChange={e => updInv(i, 'count', +e.target.value || 0)} /></td>
                <td><input type="number" min={1} value={c.value ?? plan.values[c.name] ?? 0} onChange={e => updInv(i, 'value', +e.target.value || 0)} /></td>
                <td className="right">{plan.perStack[c.name] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview */}
      <h2>Preview</h2>
      <div className="card">
        <div className="kpi">
          <div><b>{fmt(plan.stackValue)}</b><span>stack value</span></div>
          <div><b>{plan.buyIns}</b><span>buy-ins covered</span></div>
          <div><b>{plan.chipsUsed}/{plan.chipsUsed + plan.leftover}</b><span>chips used</span></div>
          <div><b>{Math.floor(dur / 60)}h{String(dur % 60).padStart(2, '0')}</b><span>est. length</span></div>
          <div><b>{formatMoney(estPool, s.currency)}</b><span>est. prize pool</span></div>
        </div>
        {plan.note && <p className="warn">⚠ {plan.note}</p>}
        {s.payoutMode === 'tournament' && estPayouts.length > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Est. winner receives <b style={{ color: 'var(--accent)' }}>{formatMoney(estPayouts[0], s.currency)}</b>{estPayouts.length > 1 ? ` · ${estPayouts.slice(1).map(p => formatMoney(p, s.currency)).join(' · ')}` : ''}</p>
        )}
      </div>

      {/* Starting stacks */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Starting stacks {padelOn ? '(padel head-start ON)' : '(flat)'}</h2>
        {padelOn ? (
          <table>
            <thead><tr><th>Finish</th><th>Bonus</th><th className="right">Total</th></tr></thead>
            <tbody>
              {stacks.map(st => (
                <tr key={st.rank}><td>{st.rank === 1 ? '🏆 1st' : `${st.rank}${st.rank === 2 ? 'nd' : st.rank === 3 ? 'rd' : 'th'}`}</td><td>+{st.bonus}</td><td className="right">{fmt(st.total)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Everyone starts with {fmt(plan.stackValue)} (padel head-start applies to 8/12/16/20/24-player nights).</p>
        )}
      </div>

      {/* Blinds */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Blind structure</h2>
        <table>
          <thead><tr><th>Level</th><th>Small / Big</th><th>Ante</th><th className="right">Length</th></tr></thead>
          <tbody>
            {blinds.map((l, i) => (
              <tr key={i}>
                <td>{l.isBreak ? <span className="muted">— break —</span> : `L${l.level}`}</td>
                <td>{l.isBreak ? '' : `${fmt(l.smallBlind)} / ${fmt(l.bigBlind)}`}</td>
                <td>{l.ante ? fmt(l.ante) : ''}</td>
                <td className="right">{l.durationMin}m{l.graceSecondsAfter ? <span className="muted"> +{l.graceSecondsAfter}s</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'center', margin: '22px 0 6px' }}>
        <a href="/run"><button className="primary" style={{ padding: '14px 32px', fontSize: 16 }}>Start tournament ▶</button></a>
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 20, textAlign: 'center' }}>No accounts, no cookies, no tracking. We never log your IP.</p>
    </main>
  )
}
