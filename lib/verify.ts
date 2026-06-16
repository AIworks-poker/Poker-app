// Engine check across DIFFERENT inventories + player counts.
//   npx ts-node --project tsconfig.scripts.json lib/verify.ts
import { generateBlinds, totalDuration } from './blinds'
import { planChips, playerStacks, padelApplies } from './chips'

function show(label: string, inv: { name: string; count: number; value?: number }[], players: number, rebuys = 0) {
  console.log(`\n===== ${label} — ${players} players, rebuys/player ${rebuys} =====`)
  const plan = planChips(inv, { players, rebuysPerPlayer: rebuys })
  console.log(`buy-ins=${plan.buyIns} | chips used ${plan.chipsUsed}/${plan.chipsUsed + plan.leftover} | stack value=${plan.stackValue}`)
  console.log('values:  ', plan.values)
  console.log('perStack:', plan.perStack)
  if (plan.note) console.log('note:', plan.note)
  const stacks = playerStacks(players, plan.stackValue)
  console.log(`padel head-start: ${padelApplies(players) ? `ON — winner ${stacks[0].total} … last ${stacks[players-1].total}` : 'OFF (not a multiple of 4) — flat stacks'}`)
}

// BJS's generalisation: tiny set
show('Tiny set', [{ name: 'White', count: 200 }, { name: 'Red', count: 120 }, { name: 'Blue', count: 80 }], 5, 1)
// the house set, no padel-friendly count
show('House set', [
  { name: 'White', count: 210 }, { name: 'Red', count: 200 }, { name: 'Blue', count: 150 },
  { name: 'Black', count: 150 }, { name: 'Green', count: 100 }, { name: 'Purple', count: 75 },
], 12, 1.5)
// valued chips supplied by the user
show('Pre-valued chips', [
  { name: 'White', count: 100, value: 25 }, { name: 'Red', count: 100, value: 100 }, { name: 'Green', count: 50, value: 500 },
], 6, 1)

console.log('\n===== blinds (5p, slow, no antes, no breaks, 10 levels) =====')
const lv = generateBlinds({ startingStack: 1000, players: 5, speed: 'slow', antes: false, breakEvery: 0, levels: 10 })
for (const l of lv) console.log(`L${l.level}: ${l.smallBlind}/${l.bigBlind}  ${l.durationMin}m`)
console.log(`total ≈ ${Math.floor(totalDuration(lv) / 60)}h ${totalDuration(lv) % 60}m`)

// ── templates + grace period ──────────────────────────────────────────────
import { TEMPLATES, HOUSE_INVENTORY } from './presets'
import { rankBonus } from './chips'
console.log('\n===== house templates =====')
for (const t of TEMPLATES) {
  const baseVal = HOUSE_INVENTORY.reduce((s, c) => s + (t.baseComposition[c.name] || 0) * (c.value || 0), 0)
  console.log(`${t.label}: base stack ${baseVal} (target ${t.startingStack} ${baseVal === t.startingStack ? 'OK' : 'MISMATCH'}) | winner +${rankBonus(t.players,1)} → ${t.startingStack + rankBonus(t.players,1)} | last +${rankBonus(t.players,t.players)}`)
}
console.log('\n===== blinds with 60s grace (12p normal) =====')
const g = generateBlinds(TEMPLATES[1].blinds)
for (const l of g.slice(0, 6)) console.log(l.isBreak ? `   -- BREAK ${l.durationMin}m --` : `L${l.level}: ${l.smallBlind}/${l.bigBlind}${l.ante?` a${l.ante}`:''}  ${l.durationMin}m${l.graceSecondsAfter?` +${l.graceSecondsAfter}s grace`:''}`)
console.log(`total ≈ ${Math.floor(totalDuration(g)/60)}h ${totalDuration(g)%60}m`)
