/**
 * Padel&Poker — blind-structure generator (framework-agnostic).
 *
 * Turns the organiser's settings (speed, antes, breaks, target stack/field)
 * into a printable level list for the clock. Designed so a "fast" night and a
 * "slow" night come from one knob, and antes/breaks are toggles.
 */

export type Speed = 'fast' | 'normal' | 'slow'

export interface BlindSettings {
  startingStack: number        // chip value per starting stack (e.g. 2500)
  players: number
  startingSmallBlind?: number  // default 10
  speed?: Speed                // fast=10 / normal=15 / slow=20 min levels
  levelMinutes?: number        // explicit override; wins over `speed`
  antes?: boolean              // add antes in the later half
  anteFromLevel?: number       // default: start of the second third
  breakEvery?: number          // a break every N played levels (default 4); 0 = none
  breakMinutes?: number        // default 10
  levels?: number              // how many blind levels to generate (default 20)
  graceSeconds?: number        // nr (BJS): settle slack AFTER each level before
                               // the next blinds bite. Uncommon but wanted. 0 = off.
}

export interface BlindLevel {
  level: number | null         // null on a break row
  isBreak: boolean
  smallBlind: number
  bigBlind: number
  ante: number
  durationMin: number
  graceSecondsAfter: number    // settle window after this level (0 on breaks / last)
  elapsedMinAtStart: number     // running clock offset (minutes, may be fractional)
}

const SPEED_MINUTES: Record<Speed, number> = { fast: 10, normal: 15, slow: 20 }

/**
 * Blind ladder: doubles early (10/20 → 20/40 → …), then eases to ~+25–30%
 * steps once it would otherwise explode, so a stack stays playable. Values are
 * rounded to "table-friendly" steps (10/25/50/100/…).
 */
function ladder(startSB: number, n: number): { sb: number; bb: number }[] {
  const out: { sb: number; bb: number }[] = []
  let sb = startSB
  for (let i = 0; i < n; i++) {
    out.push({ sb, bb: sb * 2 })
    // double for the first few, then grow ~1.4× and round to a clean step
    const next = i < 3 ? sb * 2 : roundClean(sb * 1.45)
    sb = next
  }
  return out
}

function roundClean(x: number): number {
  // round to a friendly increment based on magnitude
  const step = x < 100 ? 5 : x < 500 ? 25 : x < 2000 ? 50 : 100
  return Math.max(step, Math.round(x / step) * step)
}

export function generateBlinds(s: BlindSettings): BlindLevel[] {
  const startSB    = s.startingSmallBlind ?? 10
  const minutes    = s.levelMinutes ?? SPEED_MINUTES[s.speed ?? 'normal']
  const nLevels    = s.levels ?? 20
  const breakEvery = s.breakEvery ?? 4
  const breakMin   = s.breakMinutes ?? 10
  const anteFrom   = s.anteFromLevel ?? Math.ceil(nLevels / 3) + 1
  const base       = ladder(startSB, nLevels)
  const grace      = s.graceSeconds ?? 0

  const rows: BlindLevel[] = []
  let elapsed = 0
  for (let i = 0; i < nLevels; i++) {
    const lvl = i + 1
    const ante = s.antes && lvl >= anteFrom ? roundClean(base[i].bb * 0.1) : 0
    const last = lvl === nLevels
    const breakNext = breakEvery > 0 && lvl % breakEvery === 0 && !last
    // grace applies between consecutive LEVELS (not when a break follows — the
    // break already gives slack, and not after the final level).
    const graceAfter = !last && !breakNext ? grace : 0
    rows.push({
      level: lvl, isBreak: false,
      smallBlind: base[i].sb, bigBlind: base[i].bb, ante,
      durationMin: minutes, graceSecondsAfter: graceAfter, elapsedMinAtStart: elapsed,
    })
    elapsed += minutes + graceAfter / 60
    if (breakNext) {
      rows.push({
        level: null, isBreak: true,
        smallBlind: 0, bigBlind: 0, ante: 0,
        durationMin: breakMin, graceSecondsAfter: 0, elapsedMinAtStart: elapsed,
      })
      elapsed += breakMin
    }
  }
  return rows
}

/** Total scheduled minutes (levels + breaks + grace) — for the "≈ Xh Ym" preview. */
export function totalDuration(levels: BlindLevel[]): number {
  return Math.round(levels.reduce((m, l) => m + l.durationMin + l.graceSecondsAfter / 60, 0))
}
