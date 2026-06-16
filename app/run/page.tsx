'use client'

/**
 * /run — the live tournament screen. Reads the setup from localStorage and runs:
 *  - a big blind countdown clock (Start / Pause / Next / Prev), honouring the
 *    grace period between levels and breaks;
 *  - per-player rebuy / add-on registration (when enabled), which feeds the pool;
 *  - a leaderboard: tournament mode pays the pool out by the split as players are
 *    knocked out; cash-game mode converts each final stack to cash.
 * No accounts, no cookies — live state persists only in this browser.
 */

import { useEffect, useMemo, useState } from 'react'
import { generateBlinds, type BlindLevel } from '@/lib/blinds'
import { prizePool, tournamentPayouts, cashRate, formatMoney } from '@/lib/money'
import { type Setup, DEFAULT_SETUP, normalizeNames, loadSetup, LIVE_KEY } from '@/lib/setup'

type Phase = 'level' | 'grace' | 'over'
interface Live { rebuys: number[]; addOns: boolean[]; out: number[]; finalChips: number[] }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

export default function Run() {
  const [s, setS] = useState<Setup | null>(null)
  const [live, setLive] = useState<Live>({ rebuys: [], addOns: [], out: [], finalChips: [] })
  const [clock, setClock] = useState<{ idx: number; phase: Phase; secondsLeft: number }>({ idx: 0, phase: 'level', secondsLeft: 0 })
  const [running, setRunning] = useState(false)

  // load setup + live state
  useEffect(() => {
    const setup = loadSetup()
    setS(setup)
    let l: Live | null = null
    try { const v = localStorage.getItem(LIVE_KEY); if (v) l = JSON.parse(v) } catch {}
    const n = setup.players
    setLive({
      rebuys: pad(l?.rebuys, n, 0), addOns: pad(l?.addOns, n, false),
      out: (l?.out ?? []).filter(i => i < n), finalChips: pad(l?.finalChips, n, 0),
    })
  }, [])
  useEffect(() => { if (s) try { localStorage.setItem(LIVE_KEY, JSON.stringify(live)) } catch {} }, [live, s])

  const blinds: BlindLevel[] = useMemo(
    () => s ? generateBlinds({ startingStack: s.startingStack, players: s.players, speed: s.speed, antes: s.antes, graceSeconds: s.graceSeconds, breakEvery: 4, levels: 16 }) : [],
    [s],
  )
  // initialise the clock once blinds exist
  useEffect(() => { if (blinds.length && clock.secondsLeft === 0 && clock.idx === 0 && clock.phase === 'level') setClock(c => ({ ...c, secondsLeft: blinds[0].durationMin * 60 })) }, [blinds]) // eslint-disable-line react-hooks/exhaustive-deps

  // tick
  useEffect(() => {
    if (!running || !blinds.length) return
    const t = setInterval(() => {
      setClock(c => {
        if (c.secondsLeft > 1) return { ...c, secondsLeft: c.secondsLeft - 1 }
        const row = blinds[c.idx]
        if (c.phase === 'level' && row && row.graceSecondsAfter > 0) return { idx: c.idx, phase: 'grace', secondsLeft: row.graceSecondsAfter }
        const next = c.idx + 1
        if (next >= blinds.length) return { idx: c.idx, phase: 'over', secondsLeft: 0 }
        return { idx: next, phase: 'level', secondsLeft: blinds[next].durationMin * 60 }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, blinds])
  useEffect(() => { if (clock.phase === 'over') setRunning(false) }, [clock.phase])

  if (!s) return <main className="wrap"><p className="muted">Loading…</p></main>
  if (!s.players) return <main className="wrap"><p>Nothing set up yet. <a href="/">Configure a tournament →</a></p></main>

  const names = normalizeNames(s.names, s.players).map((n, i) => n.trim() || `Player ${i + 1}`)
  const row = blinds[clock.idx]
  const nextRow = blinds[clock.idx + 1]

  function advance(dir: 1 | -1) {
    setClock(c => { const ni = Math.min(blinds.length - 1, Math.max(0, c.idx + dir)); return { idx: ni, phase: 'level', secondsLeft: blinds[ni].durationMin * 60 } })
  }
  function resetClock() { setClock({ idx: 0, phase: 'level', secondsLeft: blinds[0].durationMin * 60 }); setRunning(false) }

  const totalRebuys = live.rebuys.reduce((a, b) => a + b, 0)
  const totalAddOns = live.addOns.filter(Boolean).length
  const pool = prizePool({ players: s.players, buyInPrice: s.buyInPrice, rebuys: totalRebuys, rebuyPrice: s.rebuyPrice, addOns: totalAddOns, addOnPrice: s.addOnPrice })
  const payouts = tournamentPayouts(pool, s.payoutSplit)
  const rate = cashRate(s.buyInPrice, s.startingStack)
  const money = (n: number) => formatMoney(n, s.currency)

  // tournament finishing places from elimination order (first out = last place)
  const placeOf = (i: number) => { const k = live.out.indexOf(i); return k < 0 ? null : s.players - k }
  const aliveIdx = Array.from({ length: s.players }, (_, i) => i).filter(i => !live.out.includes(i))
  const winnerIdx = aliveIdx.length === 1 ? aliveIdx[0] : null

  function setRebuy(i: number, d: number) { setLive(l => ({ ...l, rebuys: l.rebuys.map((v, j) => j === i ? Math.max(0, v + d) : v) })) }
  function toggleAddOn(i: number) { setLive(l => ({ ...l, addOns: l.addOns.map((v, j) => j === i ? !v : v) })) }
  function knockOut(i: number) { setLive(l => l.out.includes(i) ? l : ({ ...l, out: [...l.out, i] })) }
  function reviveLast() { setLive(l => ({ ...l, out: l.out.slice(0, -1) })) }
  function setFinal(i: number, v: number) { setLive(l => ({ ...l, finalChips: l.finalChips.map((x, j) => j === i ? v : x) })) }

  // standings for the leaderboard
  const standings = Array.from({ length: s.players }, (_, i) => i).map(i => {
    if (s.payoutMode === 'cash') { const cash = Math.round((live.finalChips[i] || 0) * rate); return { i, sortKey: cash, cash } }
    const place = i === winnerIdx ? 1 : placeOf(i)
    const pay = place && place <= payouts.length ? payouts[place - 1] : 0
    return { i, sortKey: place ? -place : 1e9, place, pay }
  }).sort((a, b) => b.sortKey - a.sortKey)

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <a href="/"><button>← Setup</button></a>
        <button onClick={() => { if (confirm('Clear live data (rebuys, add-ons, knockouts)?')) setLive({ rebuys: pad([], s.players, 0), addOns: pad([], s.players, false), out: [], finalChips: pad([], s.players, 0) }) }}>Reset live data</button>
      </div>

      {/* Clock */}
      <div className="card clock">
        <div className="lvl">{clock.phase === 'over' ? 'Tournament complete' : row?.isBreak ? 'Break' : clock.phase === 'grace' ? 'Get settled — next level in' : `Level ${row?.level}`}</div>
        <div className={`time ${clock.phase === 'grace' ? 'grace' : clock.phase === 'over' ? 'over' : ''}`}>{clock.phase === 'over' ? '✓' : mmss(clock.secondsLeft)}</div>
        {clock.phase !== 'over' && !row?.isBreak && (
          <>
            <div className="blinds">{row?.smallBlind.toLocaleString()} / {row?.bigBlind.toLocaleString()}</div>
            {row?.ante ? <div className="ante">ante {row.ante.toLocaleString()}</div> : null}
          </>
        )}
        {nextRow && clock.phase !== 'over' && (
          <div className="next">Next: {nextRow.isBreak ? 'Break' : `L${nextRow.level} — ${nextRow.smallBlind.toLocaleString()}/${nextRow.bigBlind.toLocaleString()}`}</div>
        )}
        <div className="ctrls">
          <button onClick={() => advance(-1)}>⏮ Prev</button>
          <button className="primary" onClick={() => setRunning(r => !r)} disabled={clock.phase === 'over'}>{running ? '⏸ Pause' : '▶ Start'}</button>
          <button onClick={() => advance(1)}>Next ⏭</button>
          <button onClick={resetClock}>↺ Reset</button>
        </div>
      </div>

      {/* Prize pool */}
      <div className="card">
        <div className="kpi">
          <div><b>{money(pool)}</b><span>prize pool</span></div>
          <div><b>{s.players}</b><span>players</span></div>
          {s.rebuys && <div><b>{totalRebuys}</b><span>rebuys</span></div>}
          {s.addOns && <div><b>{totalAddOns}</b><span>add-ons</span></div>}
          {s.payoutMode === 'tournament'
            ? <div><b>{money(payouts[0] ?? 0)}</b><span>winner gets</span></div>
            : <div><b>{rate.toFixed(3)} {s.currency}</b><span>per chip</span></div>}
        </div>
      </div>

      {/* Roster + registration */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Players</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              {s.rebuys && <th>Rebuys</th>}
              {s.addOns && <th>Add-on</th>}
              {s.payoutMode === 'tournament' ? <th className="right">Status</th> : <th className="right">Final chips</th>}
            </tr>
          </thead>
          <tbody>
            {names.map((nm, i) => {
              const place = i === winnerIdx ? 1 : placeOf(i)
              return (
                <tr key={i}>
                  <td>{nm}</td>
                  {s.rebuys && <td><span className="cnt"><button onClick={() => setRebuy(i, -1)}>−</button>{live.rebuys[i] || 0}<button onClick={() => setRebuy(i, 1)}>+</button></span></td>}
                  {s.addOns && <td><input type="checkbox" checked={!!live.addOns[i]} onChange={() => toggleAddOn(i)} /></td>}
                  {s.payoutMode === 'tournament'
                    ? <td className="right">{place ? `${ord(place)}${place <= payouts.length ? ` · ${money(payouts[place - 1])}` : ''}` : <button onClick={() => knockOut(i)} style={{ fontSize: 12, padding: '4px 12px' }}>Knock out</button>}</td>
                    : <td className="right"><input type="number" min={0} value={live.finalChips[i] || 0} onChange={e => setFinal(i, +e.target.value || 0)} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {s.payoutMode === 'tournament' && live.out.length > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}><button onClick={reviveLast} style={{ fontSize: 12, padding: '4px 12px' }}>Undo last knockout</button> ({names[live.out[live.out.length - 1]]})</p>
        )}
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Leaderboard</h2>
        <table className="leader">
          <thead><tr><th>#</th><th>Player</th><th className="right">{s.payoutMode === 'cash' ? 'Cash' : 'Prize'}</th></tr></thead>
          <tbody>
            {standings.map((st, r) => {
              const isWin = s.payoutMode === 'cash' ? r === 0 && st.cash! > 0 : st.place === 1
              return (
                <tr key={st.i} className={isWin ? 'win' : ''}>
                  <td><span className="pos">{s.payoutMode === 'cash' ? r + 1 : (st.place ?? '—')}</span></td>
                  <td>{names[st.i]}{isWin ? ' 🏆' : ''}</td>
                  <td className="right">{s.payoutMode === 'cash' ? money(st.cash!) : (st.pay ? money(st.pay) : '—')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {s.payoutMode === 'cash' && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Cash = final chips × {rate.toFixed(3)} {s.currency} (buy-in ÷ starting stack). Enter each player's final stack above.</p>}
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 20, textAlign: 'center' }}>No accounts, no cookies, no tracking. We never log your IP.</p>
    </main>
  )
}

function pad<T>(arr: T[] | undefined, n: number, fill: T): T[] {
  const out = (arr ?? []).slice(0, n)
  while (out.length < n) out.push(fill)
  return out
}
