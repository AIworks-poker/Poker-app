'use client'

/**
 * v0 — single page: pick a house template or enter a custom setup; see the
 * live chip plan, starting stacks (with optional padel head-start) and blind
 * structure. Pure client-side; state persists in localStorage. (Clock screen,
 * share-link and padel scoring come next.)
 */

import { useEffect, useMemo, useState } from 'react'
import { planChips, playerStacks, padelApplies, type ChipColor } from '@/lib/chips'
import { generateBlinds, totalDuration, type Speed } from '@/lib/blinds'
import { TEMPLATES, HOUSE_INVENTORY, getTemplate } from '@/lib/presets'

const CHIP_CSS: Record<string, string> = {
  White: '#f4f4f4', Red: '#e74c3c', Blue: '#3498db', Black: '#222831',
  Green: '#27ae60', Purple: '#8e44ad',
}
const fmt = (n: number) => n.toLocaleString('en-US')

interface State {
  inventory: ChipColor[]
  players: number
  startingStack: number
  rebuys: boolean
  rebuysPerPlayer: number
  speed: Speed
  antes: boolean
  graceSeconds: number
  padel: boolean
}

const DEFAULT: State = {
  inventory: HOUSE_INVENTORY,
  players: 12, startingStack: 2500,
  rebuys: true, rebuysPerPlayer: 1.5,
  speed: 'normal', antes: true, graceSeconds: 60, padel: true,
}

export default function Home() {
  const [s, setS] = useState<State>(DEFAULT)

  // localStorage persistence (auto-remember on this device)
  useEffect(() => {
    try { const v = localStorage.getItem('poker_setup'); if (v) setS({ ...DEFAULT, ...JSON.parse(v) }) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('poker_setup', JSON.stringify(s)) } catch {}
  }, [s])

  const set = <K extends keyof State>(k: K, v: State[K]) => setS(p => ({ ...p, [k]: v }))

  // Public read-only: dealer-curated templates from the DB (anonymous configs).
  const [saved, setSaved] = useState<{ id: string; name: string; config: Partial<State> }[]>([])
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setSaved(d.templates ?? [])).catch(() => {})
  }, [])

  function loadTemplate(id: '8p' | '12p' | '16p') {
    const t = getTemplate(id)!
    setS(p => ({
      ...p, inventory: HOUSE_INVENTORY, players: t.players, startingStack: t.startingStack,
      padel: t.padelHeadStart, speed: t.blinds.speed ?? 'normal', antes: !!t.blinds.antes,
      graceSeconds: t.blinds.graceSeconds ?? 60, rebuys: true,
    }))
  }

  const plan = useMemo(
    () => planChips(s.inventory, { players: s.players, rebuysPerPlayer: s.rebuys ? s.rebuysPerPlayer : 0 }),
    [s.inventory, s.players, s.rebuys, s.rebuysPerPlayer],
  )
  const stacks = useMemo(
    () => playerStacks(s.players, plan.stackValue, s.padel),
    [s.players, plan.stackValue, s.padel],
  )
  const blinds = useMemo(
    () => generateBlinds({ startingStack: s.startingStack, players: s.players, speed: s.speed, antes: s.antes, graceSeconds: s.graceSeconds, breakEvery: 4, levels: 16 }),
    [s.startingStack, s.players, s.speed, s.antes, s.graceSeconds],
  )
  const dur = totalDuration(blinds)

  function updInv(i: number, field: 'count' | 'value', v: number) {
    setS(p => { const inv = p.inventory.map((c, j) => j === i ? { ...c, [field]: v } : c); return { ...p, inventory: inv } })
  }

  return (
    <main className="wrap">
      <h1>♠ Poker Tournament Planner</h1>
      <p className="sub">Enter your chips & players → get the chip plan, stacks and blind clock. Everything stays in your browser.</p>

      {/* Templates */}
      <div className="card">
        <h2 style={{ margin: '0 0 10px' }}>Quick start</h2>
        <div className="row">
          {TEMPLATES.map(t => (
            <button key={t.id} className="pill" onClick={() => loadTemplate(t.id)}>{t.label}</button>
          ))}
          <span className="muted" style={{ fontSize: 12 }}>house set · 2,500 stack · padel head-start</span>
        </div>
        {saved.length > 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            {saved.map(t => (
              <button key={t.id} className="pill" onClick={() => setS(p => ({ ...p, ...t.config }))}>{t.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Setup */}
      <div className="card">
        <h2 style={{ margin: '0 0 12px' }}>Setup</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <label>Players<input type="number" min={2} max={100} value={s.players} onChange={e => set('players', +e.target.value || 0)} /></label>
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
          <label className="toggle"><input type="checkbox" checked={s.antes} onChange={e => set('antes', e.target.checked)} /> Antes</label>
          <label className="toggle"><input type="checkbox" checked={s.padel} onChange={e => set('padel', e.target.checked)} /> Padel head-start</label>
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
      <h2>Result</h2>
      <div className="card">
        <div className="kpi">
          <div><b>{fmt(plan.stackValue)}</b><span>stack value</span></div>
          <div><b>{plan.buyIns}</b><span>buy-ins covered ({s.players} + {plan.buyIns - s.players} rebuys)</span></div>
          <div><b>{plan.chipsUsed}/{plan.chipsUsed + plan.leftover}</b><span>chips used</span></div>
          <div><b>{Math.floor(dur / 60)}h{String(dur % 60).padStart(2, '0')}</b><span>est. length</span></div>
        </div>
        {plan.note && <p className="warn">⚠ {plan.note}</p>}
      </div>

      {/* Starting stacks */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Starting stacks {s.padel && padelApplies(s.players) ? '(padel head-start ON)' : '(flat)'}</h2>
        {s.padel && padelApplies(s.players) ? (
          <table>
            <thead><tr><th>Finish</th><th>Bonus</th><th className="right">Total</th></tr></thead>
            <tbody>
              {stacks.map(st => (
                <tr key={st.rank}><td>{st.rank === 1 ? '🏆 1st' : `${st.rank}${st.rank===2?'nd':st.rank===3?'rd':'th'}`}</td><td>+{st.bonus}</td><td className="right">{fmt(st.total)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Everyone starts with {fmt(plan.stackValue)} (padel head-start applies to 8/12/16-player nights).</p>
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

      <p className="muted" style={{ fontSize: 11, marginTop: 20 }}>No accounts, no cookies, no tracking. We never log your IP.</p>
    </main>
  )
}
