/**
 * The tournament setup object — the single shape that the setup page edits,
 * localStorage persists, a dealer template stores, and the /run screen reads.
 */
import type { ChipColor } from './chips'
import type { Speed } from './blinds'
import type { PayoutMode } from './money'
import { HOUSE_INVENTORY } from './presets'

export interface Setup {
  inventory: ChipColor[]
  players: number              // 2..24 (slider)
  startingStack: number
  rebuys: boolean
  maxRebuysTotal: number       // global pool of rebuys; when exhausted, no more
  maxRebuysPerPlayer: number   // cap per player
  addOns: boolean
  addOnValue: number           // chip value of one add-on
  speed: Speed
  antes: boolean
  graceSeconds: number
  padel: boolean
  // padel (admin-only layer): shared court + ball costs
  courtPrice: number
  ballPrice: number
  // money
  currency: string
  buyInPrice: number
  rebuyPrice: number
  addOnPrice: number
  payoutMode: PayoutMode
  payoutSplit: number[]        // % per place; [100] = winner-takes-all
  // roster
  names: string[]
}

export const MAX_PLAYERS = 24

export const DEFAULT_SETUP: Setup = {
  inventory: HOUSE_INVENTORY,
  players: 12,
  startingStack: 2500,
  rebuys: true,
  maxRebuysTotal: 10,
  maxRebuysPerPlayer: 2,
  addOns: false,
  addOnValue: 2500,
  speed: 'normal',
  antes: true,
  graceSeconds: 60,
  padel: false,           // off by default; the dealer enables it in the padel card
  courtPrice: 750,
  ballPrice: 160,
  currency: 'Kč',
  buyInPrice: 295,
  rebuyPrice: 295,
  addOnPrice: 295,
  payoutMode: 'tournament',
  payoutSplit: [60, 30, 10],
  names: [],
}

/** Keep the names array exactly `players` long (trim / pad with blanks). */
export function normalizeNames(names: string[], players: number): string[] {
  const out = names.slice(0, players)
  while (out.length < players) out.push('')
  return out
}

export const SETUP_KEY = 'poker_setup'
export const LIVE_KEY = 'poker_live'
export const EDITING_KEY = 'poker_editing'

export function loadSetup(): Setup {
  try {
    const v = localStorage.getItem(SETUP_KEY)
    if (v) return { ...DEFAULT_SETUP, ...JSON.parse(v) }
  } catch {}
  return DEFAULT_SETUP
}
