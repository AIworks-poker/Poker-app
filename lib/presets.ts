/**
 * Padel&Poker — BJS's fixed house templates (8 / 12 / 16 players).
 *
 * These are hand-tuned configs, NOT the general solver output: known chip set,
 * fixed 2,500 starting stack composed from fixed colour values, the padel
 * winning head-start on top, and a default blind structure with the settle
 * grace period. A returning organiser taps "12-player night" and everything is
 * pre-filled; the general engine (chips.ts/planChips) stays for arbitrary
 * inventories. Players can still tweak any field after loading.
 */

import type { BlindSettings } from './blinds'

// House chip set — fixed COLOURS, COUNTS and VALUES (so a stack composes to 2500).
export const HOUSE_INVENTORY = [
  { name: 'White',  count: 210, value: 10 },
  { name: 'Red',    count: 200, value: 20 },
  { name: 'Blue',   count: 150, value: 50 },
  { name: 'Black',  count: 150, value: 100 },
  { name: 'Green',  count: 100, value: 500 },
  { name: 'Purple', count: 75,  value: 1000 },
]

export interface HouseTemplate {
  id: '8p' | '12p' | '16p'
  label: string
  players: number
  startingStack: number               // 2500
  padelHeadStart: boolean             // rank bonus on top (100 + (players-rank)*50)
  /** per-stack base composition (colour -> count), sums to startingStack.
   *  Tiered so the fixed supply fits incl. the head-start chips at each size. */
  baseComposition: Record<string, number>
  blinds: BlindSettings
}

const COMMON_BLINDS = (players: number): BlindSettings => ({
  startingStack: 2500,
  players,
  startingSmallBlind: 10,
  speed: 'normal',          // 15-min levels
  antes: true,
  breakEvery: 4,
  breakMinutes: 10,
  graceSeconds: 60,         // BJS: 1-min settle between levels
  levels: 16,
})

export const TEMPLATES: HouseTemplate[] = [
  {
    id: '8p', label: '8-player night', players: 8, startingStack: 2500, padelHeadStart: true,
    // 15×10 + 10×20 + 5×50 + 4×100 + 3×500 = 2500
    baseComposition: { White: 15, Red: 10, Blue: 5, Black: 4, Green: 3, Purple: 0 },
    blinds: COMMON_BLINDS(8),
  },
  {
    id: '12p', label: '12-player night', players: 12, startingStack: 2500, padelHeadStart: true,
    // 8×10 + 6×20 + 4×50 + 6×100 + 3×500 = 2500
    baseComposition: { White: 8, Red: 6, Blue: 4, Black: 6, Green: 3, Purple: 0 },
    blinds: COMMON_BLINDS(12),
  },
  {
    id: '16p', label: '16-player night', players: 16, startingStack: 2500, padelHeadStart: true,
    // 5×10 + 5×20 + 5×50 + 6×100 + 3×500 = 2500
    baseComposition: { White: 5, Red: 5, Blue: 5, Black: 6, Green: 3, Purple: 0 },
    blinds: COMMON_BLINDS(16),
  },
]

export function getTemplate(id: HouseTemplate['id']): HouseTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}
