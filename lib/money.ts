/**
 * Padel&Poker — money: prize pool + payouts (framework-agnostic).
 *
 * Pool = all the cash that went in (buy-ins + rebuys + add-ons, at the prices
 * the organiser set). Two ways to pay it out:
 *  - tournament: split the pool by a percentage schedule (e.g. 60/30/10, or
 *    100 for winner-takes-all);
 *  - cash game: chips ARE money — each player cashes their final stack at the
 *    buy-in rate (buy-in price ÷ starting stack).
 */

export type PayoutMode = 'tournament' | 'cash'

export interface PoolInput {
  players: number
  buyInPrice: number
  rebuys: number       // total rebuys bought across the field
  rebuyPrice: number
  addOns: number       // total add-ons bought across the field
  addOnPrice: number
}

export function prizePool(o: PoolInput): number {
  return o.players * o.buyInPrice + o.rebuys * o.rebuyPrice + o.addOns * o.addOnPrice
}

/** Cash amount per paid place, from a percentage split (normalised to its sum). */
export function tournamentPayouts(pool: number, split: number[]): number[] {
  const sum = split.reduce((a, b) => a + b, 0) || 1
  return split.map(p => Math.round((pool * p) / sum))
}

/** Cash-game conversion: what one chip is worth (buy-in price ÷ starting stack). */
export function cashRate(buyInPrice: number, startingStack: number): number {
  return startingStack > 0 ? buyInPrice / startingStack : 0
}

export function formatMoney(amount: number, currency = 'Kč'): string {
  const n = Math.round(amount).toLocaleString('en-US')
  // symbol-before for €/$/£, after for Kč and word currencies
  return /^[€$£]$/.test(currency) ? `${currency}${n}` : `${n} ${currency}`
}
