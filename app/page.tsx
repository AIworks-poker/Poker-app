'use client'

/**
 * Setup page — configure the night (chips, players via slider, names, prices,
 * blinds, payout mode), see the live chip plan / stacks / blind preview, load
 * or edit dealer templates, then hit "Start tournament" to open the live clock.
 * Pure client-side; state persists in localStorage (no cookies, no tracking).
 */

import { useEffect, useMemo, useState } from 'react'
import { planChips, playerStacks, padelApplies, chipBreakdown } from '@/lib/chips'
import { generateBlinds, totalDuration, type Speed } from '@/lib/blinds'
import { prizePool, tournamentPayouts, formatMoney } from '@/lib/money'
import { padelCosts, padelSchedule } from '@/lib/padel'
import { type Setup, DEFAULT_SETUP, MAX_PLAYERS, normalizeNames, SETUP_KEY, EDITING_KEY } from '@/lib/setup'
import { useLang } from '@/lib/i18n'

const CHIP_CSS: Record<string, string> = {
  White: '#f4f4f4', Red: '#e74c3c', Blue: '#3498db', Black: '#222831',
  Green: '#27ae60', Purple: '#8e44ad',
}
const fmt = (n: number) => n.toLocaleString('en-US')

interface Tmpl { id: string; name: string; config: Partial<Setup> }

export default function Home() {
  const { t } = useLang()
  const [s, setS] = useState<Setup>(DEFAULT_SETUP)
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [saved, setSaved] = useState<Tmpl[]>([])
  const [msg, setMsg] = useState('')
  const [admin, setAdmin] = useState(false)   // padel layer is visible only to the logged-in dealer
  useEffect(() => { fetch('/api/dealer/me').then(r => r.json()).then(d => setAdmin(!!d.admin)).catch(() => {}) }, [])

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
    () => planChips(s.inventory, { players: s.players, rebuysPerPlayer: s.rebuys ? s.maxRebuysTotal / s.players : 0, addOnsPerPlayer: s.addOns ? 1 : 0 }),
    [s.inventory, s.players, s.rebuys, s.maxRebuysTotal, s.addOns],
  )
  const stacks = useMemo(() => playerStacks(s.players, plan.stackValue, s.padel), [s.players, plan.stackValue, s.padel])
  const blinds = useMemo(
    () => generateBlinds({ startingStack: s.startingStack, players: s.players, speed: s.speed, antes: s.antes, graceSeconds: s.graceSeconds, breakEvery: 4, levels: 16 }),
    [s.startingStack, s.players, s.speed, s.antes, s.graceSeconds],
  )
  const dur = totalDuration(blinds)

  const estPool = useMemo(() => prizePool({
    players: s.players, buyInPrice: s.buyInPrice,
    rebuys: s.rebuys ? s.maxRebuysTotal : 0, rebuyPrice: s.rebuyPrice,
    addOns: s.addOns ? s.players : 0, addOnPrice: s.addOnPrice,
  }), [s])
  const estPayouts = useMemo(() => tournamentPayouts(estPool, s.payoutSplit), [estPool, s.payoutSplit])

  // No-recycle feasibility: every base stack, every rebuy (fresh stack), every
  // padel head-start and every add-on needs its own chips from the box.
  const supply = useMemo(() => {
    const valOf = (c: { name: string; value?: number }) => c.value ?? plan.values[c.name] ?? 0
    const haveValue = s.inventory.reduce((a, c) => a + c.count * valOf(c), 0)
    const padelBonusTotal = (s.padel && padelApplies(s.players)) ? stacks.reduce((a, st) => a + st.bonus, 0) : 0
    const baseAndRebuys = (s.players + (s.rebuys ? s.maxRebuysTotal : 0)) * s.startingStack
    const addOnValue = s.addOns ? s.players * s.addOnValue : 0
    const neededValue = baseAndRebuys + padelBonusTotal + addOnValue
    return { haveValue, neededValue, padelBonusTotal, fits: haveValue >= neededValue }
  }, [s, plan.values, stacks])

  function updInv(i: number, field: 'count' | 'value', v: number) {
    setS(p => ({ ...p, inventory: p.inventory.map((c, j) => j === i ? { ...c, [field]: v } : c) }))
  }
  function updName(i: number, name: string) {
    setS(p => ({ ...p, inventory: p.inventory.map((c, j) => j === i ? { ...c, name } : c) }))
  }
  function addColor() {
    setS(p => ({ ...p, inventory: [...p.inventory, { name: `Colour ${p.inventory.length + 1}`, count: 100, value: 5 }] }))
  }
  function removeColor(i: number) {
    setS(p => ({ ...p, inventory: p.inventory.filter((_, j) => j !== i) }))
  }
  function setSplit(i: number, v: number) {
    setS(p => ({ ...p, payoutSplit: p.payoutSplit.map((x, j) => j === i ? v : x) }))
  }
  function loadTemplate(tm: Tmpl) {
    setS({ ...DEFAULT_SETUP, ...tm.config, names: normalizeNames(tm.config.names ?? [], tm.config.players ?? DEFAULT_SETUP.players) })
    clearEditing(); setMsg(t.loaded(tm.name))
  }
  function clearEditing() { setEditing(null); try { localStorage.removeItem(EDITING_KEY) } catch {} }

  async function saveChanges() {
    if (!editing) return
    const r = await fetch('/api/templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, name: editing.name, config: s }) })
    setMsg(r.ok ? t.saveChangedOk(editing.name) : t.saveFail)
    if (r.ok) { clearEditing(); refresh() }
  }
  async function saveAsNew() {
    const name = prompt(t.promptName)?.trim()
    if (!name) return
    const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config: s }) })
    setMsg(r.ok ? t.saveOk(name) : t.saveFail)
    if (r.ok) refresh()
  }
  function refresh() { fetch('/api/templates').then(r => r.json()).then(d => setSaved(d.templates ?? [])).catch(() => {}) }

  const padelOn = s.padel && padelApplies(s.players)
  const pCosts = padelCosts(s.players, s.courtPrice, s.ballPrice)
  const scheme = padelSchedule(s.players)
  const pnames = normalizeNames(s.names, s.players).map((n, i) => n.trim() || `P${i + 1}`)
  const splitSum = s.payoutSplit.reduce((a, b) => a + b, 0)

  return (
    <main className="wrap">
      <h1>{t.title}</h1>
      <p className="sub">{t.homeSub}</p>

      {editing && (
        <div className="banner">
          <span>{t.editingTemplate} <b>{editing.name}</b></span>
          <button className="primary" onClick={saveChanges}>{t.saveChanges}</button>
          <button onClick={saveAsNew}>{t.saveAsNew}</button>
          <button onClick={clearEditing}>{t.cancel}</button>
        </div>
      )}

      {saved.length > 0 && (
        <div className="card">
          <h2 style={{ margin: '0 0 10px' }}>{t.templates}</h2>
          <div className="cards">
            {saved.map(tm => {
              const c = tm.config
              const tags = [c.antes && t.tagAntes, c.rebuys && t.tagRebuys, c.addOns && t.tagAddOns].filter(Boolean).join(' · ')
              return (
                <div key={tm.id} className="tcard">
                  <h3>{tm.name}</h3>
                  <div className="meta">
                    {t.templatePlayers(c.players ?? 0, fmt(c.startingStack ?? 0))}<br />
                    {tags}{tags ? <br /> : null}
                    {c.payoutMode === 'cash' ? t.cashGame : t.splitTag((c.payoutSplit ?? []).join('/'))}
                  </div>
                  <div className="acts"><button className="primary" onClick={() => loadTemplate(tm)}>{t.load}</button></div>
                </div>
              )
            })}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t.editHint}<a href="/dealer">/dealer</a>.</p>
        </div>
      )}
      {msg && <p className="warn">{msg}</p>}

      {/* Players + format */}
      <div className="card">
        <h2 style={{ margin: '0 0 12px' }}>{t.playersFormat}</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ flex: 1, minWidth: 240 }}>{t.playersLabel}: <b style={{ color: 'var(--text)' }}>{s.players}</b>
            <input type="range" min={2} max={MAX_PLAYERS} value={s.players} onChange={e => setPlayers(+e.target.value)} />
          </label>
          <label>{t.startingStack}<input type="number" min={100} step={100} value={s.startingStack} onChange={e => set('startingStack', +e.target.value || 0)} /></label>
          <label>{t.blindSpeed}
            <select value={s.speed} onChange={e => set('speed', e.target.value as Speed)}>
              <option value="fast">{t.speedFast}</option><option value="normal">{t.speedNormal}</option><option value="slow">{t.speedSlow}</option>
            </select>
          </label>
          <label>{t.grace}<input type="number" min={0} max={300} step={15} value={s.graceSeconds} onChange={e => set('graceSeconds', +e.target.value || 0)} /></label>
        </div>
        <div className="row">
          <label className="toggle"><input type="checkbox" checked={s.rebuys} onChange={e => set('rebuys', e.target.checked)} /> {t.rebuys}</label>
          {s.rebuys && <label>{t.maxTotal}<input type="number" min={0} value={s.maxRebuysTotal} onChange={e => set('maxRebuysTotal', +e.target.value || 0)} /></label>}
          {s.rebuys && <label>{t.maxPerPlayer}<input type="number" min={0} value={s.maxRebuysPerPlayer} onChange={e => set('maxRebuysPerPlayer', +e.target.value || 0)} /></label>}
          <label className="toggle"><input type="checkbox" checked={s.addOns} onChange={e => set('addOns', e.target.checked)} /> {t.addOns}</label>
          {s.addOns && <label>{t.addOnChips}<input type="number" min={0} step={100} value={s.addOnValue} onChange={e => set('addOnValue', +e.target.value || 0)} /></label>}
          <label className="toggle"><input type="checkbox" checked={s.antes} onChange={e => set('antes', e.target.checked)} /> {t.antes}</label>
        </div>
      </div>

      {/* Money */}
      <div className="card">
        <h2 style={{ margin: '0 0 12px' }}>{t.money}</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <label>{t.currency}
            <select value={s.currency} onChange={e => set('currency', e.target.value)}>
              <option value="Kč">Kč</option><option value="€">€</option><option value="$">$</option><option value="£">£</option>
            </select>
          </label>
          <label>{t.buyInPrice}<input type="number" min={0} value={s.buyInPrice} onChange={e => set('buyInPrice', +e.target.value || 0)} /></label>
          {s.rebuys && <label>{t.rebuyPrice}<input type="number" min={0} value={s.rebuyPrice} onChange={e => set('rebuyPrice', +e.target.value || 0)} /></label>}
          {s.addOns && <label>{t.addOnPrice}<input type="number" min={0} value={s.addOnPrice} onChange={e => set('addOnPrice', +e.target.value || 0)} /></label>}
        </div>
        <div className="row">
          <label>{t.payout}
            <select value={s.payoutMode} onChange={e => set('payoutMode', e.target.value as Setup['payoutMode'])}>
              <option value="tournament">{t.payoutTournament}</option>
              <option value="cash">{t.payoutCash}</option>
            </select>
          </label>
          {s.payoutMode === 'tournament' && (
            <>
              <div className="row" style={{ gap: 6 }}>
                {s.payoutSplit.map((p, i) => (
                  <label key={i} style={{ alignItems: 'center' }}>{t.ord(i + 1)} %
                    <input className="split-in" type="number" min={0} max={100} value={p} onChange={e => setSplit(i, +e.target.value || 0)} />
                  </label>
                ))}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button onClick={() => set('payoutSplit', [...s.payoutSplit, 0])}>{t.addPlace}</button>
                {s.payoutSplit.length > 1 && <button onClick={() => set('payoutSplit', s.payoutSplit.slice(0, -1))}>{t.removePlace}</button>}
                <button onClick={() => set('payoutSplit', [100])}>{t.winnerTakesAll}</button>
                <button onClick={() => set('payoutSplit', [60, 30, 10])}>{t.preset603010}</button>
              </div>
            </>
          )}
        </div>
        {s.payoutMode === 'tournament' && splitSum !== 100 && <p className="warn">{t.splitWarn(splitSum)}</p>}
      </div>

      {/* Names */}
      <div className="card">
        <h2 style={{ margin: '0 0 10px' }}>{t.playerNames(s.players)}</h2>
        <div className="names">
          {Array.from({ length: s.players }, (_, i) => (
            <label key={i}>#{i + 1}<input value={s.names[i] ?? ''} placeholder={t.playerPh(i + 1)} onChange={e => setS(p => ({ ...p, names: normalizeNames(p.names, p.players).map((n, j) => j === i ? e.target.value : n) }))} /></label>
          ))}
        </div>
      </div>

      {/* Padel — ADMIN ONLY */}
      {admin && (
        <div className="card" style={{ borderStyle: 'dashed', borderColor: '#7F77DD' }}>
          <h2 style={{ margin: '0 0 10px', color: '#9b94e6' }}>{t.padelTitle} <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{t.padelOnly}</span></h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="toggle"><input type="checkbox" checked={s.padel} onChange={e => set('padel', e.target.checked)} /> {t.padelFeed}</label>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <label>{t.courtPrice}<input type="number" min={0} value={s.courtPrice} onChange={e => set('courtPrice', +e.target.value || 0)} /></label>
            <label>{t.ballPrice}<input type="number" min={0} value={s.ballPrice} onChange={e => set('ballPrice', +e.target.value || 0)} /></label>
          </div>
          {padelApplies(s.players) ? (
            <p className="muted" style={{ fontSize: 12 }}>{t.padelCost(pCosts.courts, pCosts.sets, formatMoney(pCosts.total, s.currency), formatMoney(pCosts.perHead, s.currency))}</p>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>{t.padelNeeds(s.players)}</p>
          )}
          {scheme ? (
            <>
              <h3 style={{ margin: '14px 0 6px', fontSize: 13 }}>{t.playScheme(scheme.length, pCosts.courts)}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>{t.round}</th>{Array.from({ length: pCosts.courts }, (_, c) => <th key={c}>{t.court(c + 1)}</th>)}</tr></thead>
                  <tbody>
                    {scheme.map((round, r) => (
                      <tr key={r}>
                        <td><b>{r + 1}</b></td>
                        {round.map((c2, c) => (
                          <td key={c} style={{ whiteSpace: 'nowrap' }}>{pnames[c2[0][0]]} &amp; {pnames[c2[0][1]]} <span className="muted">{t.vs}</span> {pnames[c2[1][0]]} &amp; {pnames[c2[1][1]]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t.schemeNote}</p>
            </>
          ) : padelApplies(s.players) ? (
            <p className="muted" style={{ fontSize: 12 }}>{t.schemeOnly}</p>
          ) : null}
        </div>
      )}

      {/* Chips */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>{t.chips}</h2>
        <table>
          <thead><tr><th>{t.colColour}</th><th>{t.colHave}</th><th>{t.colValue}</th><th className="right">{t.colPerStack}</th><th></th></tr></thead>
          <tbody>
            {s.inventory.map((c, i) => (
              <tr key={i}>
                <td><span className="chip" style={{ background: CHIP_CSS[c.name] ?? '#888' }} /><input value={c.name} style={{ width: 100 }} onChange={e => updName(i, e.target.value)} /></td>
                <td><input type="number" min={0} value={c.count} onChange={e => updInv(i, 'count', +e.target.value || 0)} /></td>
                <td><input type="number" min={1} value={c.value ?? plan.values[c.name] ?? 0} onChange={e => updInv(i, 'value', +e.target.value || 0)} /></td>
                <td className="right">{plan.perStack[c.name] ?? 0}</td>
                <td className="right"><button onClick={() => removeColor(i)} title={t.remove} style={{ padding: '4px 10px', fontSize: 12 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={addColor}>{t.addColour}</button>
          <span className="muted" style={{ fontSize: 11 }}>{t.chipsHint}</span>
        </div>
      </div>

      {/* Preview */}
      <h2>{t.preview}</h2>
      <div className="card">
        <div className="kpi">
          <div><b>{fmt(plan.stackValue)}</b><span>{t.kpiStackValue}</span></div>
          <div><b>{plan.buyIns}</b><span>{t.kpiBuyIns}</span></div>
          <div><b>{plan.chipsUsed}/{plan.chipsUsed + plan.leftover}</b><span>{t.kpiChipsUsed}</span></div>
          <div><b>{Math.floor(dur / 60)}h{String(dur % 60).padStart(2, '0')}</b><span>{t.kpiLength}</span></div>
          <div><b>{formatMoney(estPool, s.currency)}</b><span>{t.kpiPool}</span></div>
        </div>
        {plan.note && <p className="warn">⚠ {plan.note}</p>}
        {s.payoutMode === 'tournament' && estPayouts.length > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.estWinner('')}<b style={{ color: 'var(--accent)' }}>{formatMoney(estPayouts[0], s.currency)}</b>{estPayouts.length > 1 ? ` · ${estPayouts.slice(1).map(p => formatMoney(p, s.currency)).join(' · ')}` : ''}</p>
        )}
      </div>

      {/* Chip-supply feasibility (no recycling) */}
      <div className="card" style={{ borderColor: supply.fits ? 'var(--accent)' : '#ff1f1f' }}>
        <p style={{ margin: 0, fontWeight: 700, color: supply.fits ? 'var(--accent)' : '#ff5b5b' }}>
          {supply.fits ? `✓ ${t.supplyOk}` : `✗ ${t.supplyShort(fmt(supply.neededValue - supply.haveValue))}`}
        </p>
        <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
          {t.supplyNeedHave(fmt(supply.neededValue), fmt(supply.haveValue))}{' '}
          {t.supplyBreakdown(
            s.players,
            s.rebuys ? ` + ${s.maxRebuysTotal} ${t.tagRebuys}` : '',
            fmt(s.startingStack),
            supply.padelBonusTotal ? ` + ${fmt(supply.padelBonusTotal)} padel` : '',
            s.addOns ? ` + ${s.players} × ${fmt(s.addOnValue)}` : '',
          )}
          {!supply.fits && t.supplyFix}
        </p>
      </div>

      {/* Starting stacks */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>{t.startingStacks} {padelOn ? t.padelOn : t.flat}</h2>
        {padelOn ? (
          <table>
            <thead><tr><th>{t.colFinish}</th><th>{t.colBonus}</th><th>{t.colChipsAdd}</th><th className="right">{t.colTotal}</th></tr></thead>
            <tbody>
              {stacks.map(st => {
                const bd = chipBreakdown(st.bonus, plan.values)
                return (
                  <tr key={st.rank}>
                    <td>{st.rank === 1 ? t.first : t.ord(st.rank)}</td>
                    <td>+{st.bonus}</td>
                    <td>{bd.length === 0 ? '—' : bd.map((c, k) => (
                      <span key={c.name} style={{ whiteSpace: 'nowrap' }}>{k > 0 ? ' · ' : ''}<span className="chip" style={{ background: CHIP_CSS[c.name] ?? '#888' }} />{c.count}× {c.name}</span>
                    ))}</td>
                    <td className="right">{fmt(st.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">{t.flatNote(fmt(plan.stackValue))}</p>
        )}
      </div>

      {/* Blinds */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>{t.blindStructure}</h2>
        <table>
          <thead><tr><th>{t.colLevel}</th><th>{t.colBlinds}</th><th>{t.colAnte}</th><th className="right">{t.colLength}</th></tr></thead>
          <tbody>
            {blinds.map((l, i) => (
              <tr key={i}>
                <td>{l.isBreak ? <span className="muted">{t.breakRow}</span> : `L${l.level}`}</td>
                <td>{l.isBreak ? '' : `${fmt(l.smallBlind)} / ${fmt(l.bigBlind)}`}</td>
                <td>{l.ante ? fmt(l.ante) : ''}</td>
                <td className="right">{l.durationMin}m{l.graceSecondsAfter ? <span className="muted"> +{l.graceSecondsAfter}s</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'center', margin: '22px 0 6px' }}>
        <a href="/run"><button className="primary" style={{ padding: '14px 32px', fontSize: 16 }}>{t.startTournament}</button></a>
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 20, textAlign: 'center' }}>{t.footer}</p>
    </main>
  )
}
