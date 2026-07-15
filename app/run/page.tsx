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

import { useEffect, useMemo, useRef, useState } from 'react'
import { generateBlinds, type BlindLevel } from '@/lib/blinds'
import { playerStacks, padelApplies } from '@/lib/chips'
import { prizePool, tournamentPayouts, formatMoney } from '@/lib/money'
import { type Setup, normalizeNames, loadSetup, LIVE_KEY } from '@/lib/setup'
import { useLang } from '@/lib/i18n'

type Phase = 'level' | 'grace' | 'over'
interface Live { rebuys: number[]; addOns: boolean[]; out: number[]; finalChips: number[] }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Run() {
  const { t } = useLang()
  const [s, setS] = useState<Setup | null>(null)
  const [live, setLive] = useState<Live>({ rebuys: [], addOns: [], out: [], finalChips: [] })
  const [clock, setClock] = useState<{ idx: number; phase: Phase; secondsLeft: number }>({ idx: 0, phase: 'level', secondsLeft: 0 })
  const [running, setRunning] = useState(false)
  const [sound, setSound] = useState(true)
  const acRef = useRef<AudioContext | null>(null)
  const prevLevelIdx = useRef(0)

  function ensureAudio() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      if (!acRef.current) acRef.current = new AC()
      if (acRef.current.state === 'suspended') acRef.current.resume()
    } catch {}
  }
  function playBuzzer() {
    ensureAudio()
    const ac = acRef.current
    if (!ac) return
    const t0 = ac.currentTime
    for (const [off, f] of [[0, 880], [0.2, 660]] as const) {
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'square'; o.frequency.value = f
      o.connect(g); g.connect(ac.destination)
      g.gain.setValueAtTime(0.0001, t0 + off)
      g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18)
      o.start(t0 + off); o.stop(t0 + off + 0.2)
    }
  }

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
  useEffect(() => { if (blinds.length && clock.secondsLeft === 0 && clock.idx === 0 && clock.phase === 'level') setClock(c => ({ ...c, secondsLeft: blinds[0].durationMin * 60 })) }, [blinds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running || !blinds.length) return
    const tick = setInterval(() => {
      setClock(c => {
        if (c.secondsLeft > 1) return { ...c, secondsLeft: c.secondsLeft - 1 }
        const row = blinds[c.idx]
        if (c.phase === 'level' && row && row.graceSecondsAfter > 0) return { idx: c.idx, phase: 'grace', secondsLeft: row.graceSecondsAfter }
        const next = c.idx + 1
        if (next >= blinds.length) return { idx: c.idx, phase: 'over', secondsLeft: 0 }
        return { idx: next, phase: 'level', secondsLeft: blinds[next].durationMin * 60 }
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [running, blinds])
  useEffect(() => { if (clock.phase === 'over') setRunning(false) }, [clock.phase])
  useEffect(() => {
    const r = blinds[clock.idx]
    if (clock.phase === 'level' && clock.idx !== prevLevelIdx.current && clock.idx > 0 && r && !r.isBreak && sound) playBuzzer()
    prevLevelIdx.current = clock.idx
  }, [clock.idx, clock.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <main className="wrap"><p className="muted">{t.loading}</p></main>
  if (!s.players) return <main className="wrap"><p>{t.nothingSetUp} <a href="/">{t.configure}</a></p></main>

  const names = normalizeNames(s.names, s.players).map((n, i) => n.trim() || t.playerPh(i + 1))
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
  const padelBonusTotal = s.padel && padelApplies(s.players) ? playerStacks(s.players, 0, true).reduce((a, st) => a + st.bonus, 0) : 0
  const totalChipsInPlay = s.players * s.startingStack + padelBonusTotal + totalRebuys * s.startingStack + totalAddOns * s.addOnValue
  const rate = totalChipsInPlay > 0 ? pool / totalChipsInPlay : 0
  const money = (n: number) => formatMoney(n, s.currency)

  const placeOf = (i: number) => { const k = live.out.indexOf(i); return k < 0 ? null : s.players - k }
  const aliveIdx = Array.from({ length: s.players }, (_, i) => i).filter(i => !live.out.includes(i))
  const winnerIdx = aliveIdx.length === 1 ? aliveIdx[0] : null

  function setRebuy(i: number, d: number) {
    setLive(l => {
      const cur = l.rebuys[i] || 0
      const next = Math.max(0, cur + d)
      if (d > 0) {
        if (s!.maxRebuysPerPlayer && next > s!.maxRebuysPerPlayer) return l
        const total = l.rebuys.reduce((a, b) => a + b, 0)
        if (s!.maxRebuysTotal && total - cur + next > s!.maxRebuysTotal) return l
      }
      return { ...l, rebuys: l.rebuys.map((v, j) => j === i ? next : v) }
    })
  }
  function toggleAddOn(i: number) { setLive(l => ({ ...l, addOns: l.addOns.map((v, j) => j === i ? !v : v) })) }
  function toggleOut(i: number) { setLive(l => l.out.includes(i) ? { ...l, out: l.out.filter(x => x !== i) } : { ...l, out: [...l.out, i] }) }
  function setFinal(i: number, v: number) { setLive(l => ({ ...l, finalChips: l.finalChips.map((x, j) => j === i ? v : x) })) }

  const standings = Array.from({ length: s.players }, (_, i) => i).map(i => {
    if (s.payoutMode === 'cash') { const cash = Math.round((live.finalChips[i] || 0) * rate); return { i, sortKey: cash, cash } }
    const place = i === winnerIdx ? 1 : placeOf(i)
    const pay = place && place <= payouts.length ? payouts[place - 1] : 0
    return { i, sortKey: place ? -place : 1e9, place, pay }
  }).sort((a, b) => b.sortKey - a.sortKey)

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <a href="/"><button>{t.setup}</button></a>
        <button onClick={() => { if (confirm(t.confirmResetLive)) setLive({ rebuys: pad([], s.players, 0), addOns: pad([], s.players, false), out: [], finalChips: pad([], s.players, 0) }) }}>{t.resetLive}</button>
      </div>

      {/* Clock */}
      <div className="card clock">
        <div className="lvl">{clock.phase === 'over' ? t.complete : row?.isBreak ? t.breakLbl : clock.phase === 'grace' ? t.getSettled : t.levelN(row?.level ?? 0)}</div>
        <div className={`time ${clock.phase === 'grace' ? 'grace' : clock.phase === 'over' ? 'over' : ''}`}>{clock.phase === 'over' ? '✓' : mmss(clock.secondsLeft)}</div>
        {clock.phase !== 'over' && !row?.isBreak && (
          <>
            <div className="blinds">{row?.smallBlind.toLocaleString()} / {row?.bigBlind.toLocaleString()}</div>
            {row?.ante ? <div className="ante">{t.colAnte.toLowerCase()} {row.ante.toLocaleString()}</div> : null}
          </>
        )}
        {nextRow && clock.phase !== 'over' && (
          <div className="next">{t.next(nextRow.isBreak ? t.nextBreak : t.nextLevel(nextRow.level ?? 0, `${nextRow.smallBlind.toLocaleString()}/${nextRow.bigBlind.toLocaleString()}`))}</div>
        )}
        <div className="ctrls">
          <button onClick={() => advance(-1)}>{t.cPrev}</button>
          <button className="primary" onClick={() => { if (!running) ensureAudio(); setRunning(r => !r) }} disabled={clock.phase === 'over'}>{running ? t.cPause : t.cStart}</button>
          <button onClick={() => advance(1)}>{t.cNext}</button>
          <button onClick={resetClock}>{t.cReset}</button>
          <button onClick={() => { setSound(v => !v); ensureAudio() }} title={sound ? t.mute : t.unmute}>{sound ? '🔊' : '🔇'}</button>
        </div>
      </div>

      {/* Prize pool */}
      <div className="card">
        <div className="kpi">
          <div><b>{money(pool)}</b><span>{t.kpiPrizePool}</span></div>
          <div><b>{s.players}</b><span>{t.kpiPlayers}</span></div>
          {s.rebuys && <div><b>{totalRebuys}{s.maxRebuysTotal ? `/${s.maxRebuysTotal}` : ''}</b><span>{t.kpiRebuysUsed}</span></div>}
          {s.addOns && <div><b>{totalAddOns}</b><span>{t.kpiAddOns}</span></div>}
          {s.payoutMode === 'tournament'
            ? <div><b>{money(payouts[0] ?? 0)}</b><span>{t.kpiWinnerGets}</span></div>
            : <div><b>{rate.toFixed(3)} {s.currency}</b><span>{t.kpiPerChip}</span></div>}
        </div>
      </div>

      {/* Roster + registration */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>{t.rosterPlayers}</h2>
        <table>
          <thead>
            <tr>
              <th>{t.colPlayer}</th>
              {s.rebuys && <th>{s.maxRebuysTotal ? t.colRebuysLeft(Math.max(0, s.maxRebuysTotal - totalRebuys)) : t.colRebuys}</th>}
              {s.addOns && <th>{t.colAddOn}</th>}
              {s.payoutMode === 'tournament' ? <th className="right">{t.colBusted}</th> : <th className="right">{t.colFinalChips}</th>}
            </tr>
          </thead>
          <tbody>
            {names.map((nm, i) => {
              const place = i === winnerIdx ? 1 : placeOf(i)
              return (
                <tr key={i}>
                  <td>{nm}</td>
                  {s.rebuys && (() => {
                    const cur = live.rebuys[i] || 0
                    const capped = (!!s.maxRebuysPerPlayer && cur >= s.maxRebuysPerPlayer) || (!!s.maxRebuysTotal && totalRebuys >= s.maxRebuysTotal)
                    return <td><span className="cnt"><button onClick={() => setRebuy(i, -1)} disabled={cur === 0}>−</button>{cur}<button onClick={() => setRebuy(i, 1)} disabled={capped} title={capped ? t.noRebuysLeft : ''}>+</button></span></td>
                  })()}
                  {s.addOns && <td><input type="checkbox" checked={!!live.addOns[i]} onChange={() => toggleAddOn(i)} /></td>}
                  {s.payoutMode === 'tournament'
                    ? <td className="right"><label className="toggle" style={{ justifyContent: 'flex-end' }}><input type="checkbox" checked={live.out.includes(i)} onChange={() => toggleOut(i)} /> {place ? `${t.ord(place)}${place <= payouts.length ? ` · ${money(payouts[place - 1])}` : ''}` : t.statusIn}</label></td>
                    : <td className="right"><input type="number" min={0} value={live.finalChips[i] || 0} onChange={e => setFinal(i, +e.target.value || 0)} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {s.payoutMode === 'tournament' && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.bustHint}</p>}
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>{t.leaderboard}</h2>
        <table className="leader">
          <thead><tr><th>{t.colRank}</th><th>{t.colPlayer}</th><th className="right">{s.payoutMode === 'cash' ? t.colCash : t.colPrize}</th></tr></thead>
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
        {s.payoutMode === 'cash' && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t.cashNote(rate.toFixed(3), s.currency, totalChipsInPlay.toLocaleString())}</p>}
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 20, textAlign: 'center' }}>{t.footer}</p>
    </main>
  )
}

function pad<T>(arr: T[] | undefined, n: number, fill: T): T[] {
  const out = (arr ?? []).slice(0, n)
  while (out.length < n) out.push(fill)
  return out
}
