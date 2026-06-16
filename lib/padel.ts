/**
 * Padel layer (admin-only): shared court/ball costs + the americano play scheme.
 * Costs are split equally across players (the venue, not the poker pot). The
 * scheme is the pre-computed whist tournament (partner-unique, opponent ≤2×)
 * for 8/12/16 players from data/whist-schedules.json.
 */
import schedules from '@/data/whist-schedules.json'

export interface PadelCosts { courts: number; sets: number; total: number; perHead: number }

export function padelCosts(players: number, courtPrice: number, ballPrice: number): PadelCosts {
  const courts = Math.floor(players / 4)
  const sets = courts // one fresh set of balls per court
  const total = courts * courtPrice + sets * ballPrice
  return { courts, sets, total, perHead: players > 0 ? total / players : 0 }
}

// schedule[round][court] = [[a, b], [c, d]]  (0-based player indices)
export type Round = number[][][]
export function padelSchedule(players: number): Round[] | null {
  return (schedules as Record<string, Round[]>)[String(players)] ?? null
}
