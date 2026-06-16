/**
 * Padel&Poker — chip economy (framework-agnostic, GENERAL).
 *
 * Works for ANY inventory (e.g. 400 chips in 3 colours) and ANY player count —
 * not just the house 6-colour set or 8/12/16. The padel layer is optional;
 * this engine only needs chips + players + how many buy-ins to plan for.
 *
 * Model: deal the supply across all buy-ins (start stacks + expected rebuys +
 * add-ons). Each stack gets floor(count/buyIns) of every colour; leftovers are
 * spares. The stack VALUE is then whatever those chips are worth — derived from
 * the colour values (user-supplied, or auto-suggested). This always produces a
 * valid plan and uses (almost) all the chips, regardless of inventory shape.
 */

export interface ChipColor {
  name: string
  count: number
  value?: number          // optional: user-assigned denomination
}

export interface ChipOpts {
  players: number
  rebuysPerPlayer?: number   // expected; default 0 (toggle on for a rebuy night)
  addOnsPerPlayer?: number   // expected; default 0
  targetStack?: number       // optional: if set, scale suggested values toward it
}

export interface ChipPlan {
  buyIns: number
  values: Record<string, number>
  perStack: Record<string, number>
  stackValue: number          // DERIVED — what one starting stack is actually worth
  chipsUsed: number
  leftover: number
  note?: string
}

/** Clean ascending denomination ladder; we take as many rungs as there are
 *  colours and assign the smallest value to the MOST numerous colour. */
const LADDER = [5, 25, 100, 500, 1000, 2000, 5000, 10000]

function suggestValues(sortedByCountDesc: ChipColor[]): number[] {
  // most numerous colour = smallest denomination
  return sortedByCountDesc.map((_, i) => LADDER[Math.min(i, LADDER.length - 1)])
}

export function planChips(inventory: ChipColor[], opts: ChipOpts): ChipPlan {
  const players = Math.max(1, opts.players)
  const buyIns = Math.max(
    players,
    Math.round(players * (1 + (opts.rebuysPerPlayer ?? 0) + (opts.addOnsPerPlayer ?? 0))),
  )
  const total = inventory.reduce((a, c) => a + c.count, 0)

  // assign values: keep user's where given; suggest for the rest by abundance
  const order = [...inventory].sort((a, b) => b.count - a.count)
  const suggested = suggestValues(order)
  const valueByName: Record<string, number> = {}
  order.forEach((c, i) => { valueByName[c.name] = c.value ?? suggested[i] })

  // deal evenly; leftovers are spares
  const perStack: Record<string, number> = {}
  let chipsUsed = 0
  for (const c of inventory) {
    const each = Math.floor(c.count / buyIns)
    perStack[c.name] = each
    chipsUsed += each * buyIns
  }

  let stackValue = inventory.reduce((s, c) => s + perStack[c.name] * valueByName[c.name], 0)

  // optional: if a target stack was requested, nudge the TOP denominations'
  // values so the derived stack lands near it (keeps small chips for blinds).
  let note: string | undefined
  if (opts.targetStack && stackValue > 0) {
    const factor = opts.targetStack / stackValue
    note = `Derived stack ${stackValue}; target ${opts.targetStack} → scale values ~${factor.toFixed(2)}× or adjust rebuy rate.`
  }
  if (Object.values(perStack).every(v => v === 0)) {
    note = `Only ${total} chips for ${buyIns} buy-ins — too few to give every colour to each stack. Reduce rebuys or player count.`
  }

  return {
    buyIns,
    values: valueByName,
    perStack,
    stackValue,
    chipsUsed,
    leftover: total - chipsUsed,
    note,
  }
}

/* ── Padel head-start (OPTIONAL — only when a padel tournament feeds the poker
 *    seeding; padel needs multiples of 4). Poker alone uses flat stacks. ──── */

export function padelApplies(players: number): boolean {
  return players >= 8 && players % 4 === 0
}

export function rankBonus(players: number, rank: number): number {
  return 100 + (players - rank) * 50
}

export interface PlayerStack { rank: number; bonus: number; total: number }

/** Per-finishing-position starting stacks. With padel: base + rank bonus.
 *  Without (plain poker): everyone gets the flat stack. */
export function playerStacks(players: number, stackValue: number, withPadel = true): PlayerStack[] {
  const padel = withPadel && padelApplies(players)
  return Array.from({ length: players }, (_, i) => {
    const rank = i + 1
    const bonus = padel ? rankBonus(players, rank) : 0
    return { rank, bonus, total: stackValue + bonus }
  })
}
