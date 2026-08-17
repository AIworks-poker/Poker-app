# ♠ Poker Tournament Planner

A free, no-signup web tool that runs a whole poker evening — chip planning, blind
structure, live clock, rebuys, payouts — with an optional **padel** layer that
turns the afternoon's tournament into the evening's chip stacks.

**Live: [poker.wemakeai.work](https://poker.wemakeai.work)**

---

## The idea

There are plenty of poker clocks and plenty of padel apps. The thing this does
that others don't is join them: play a padel *americano* in the afternoon, and
the finishing order becomes a head start at the poker table that night. First
place physically receives the tallest tower of chips.

Everything else follows from wanting one tool for one evening, with no
spreadsheet fiddling between the two halves.

## What it does

**Setup** — chip inventory (any colours, counts and values), 2–24 players,
starting stack, blind speed, antes, rebuy caps, add-ons, buy-in prices, currency,
and payout mode (split the pot, winner-takes-all, or cash game where chips convert
back to money). Everything recalculates live: chip plan, per-player stacks, the
full blind ladder, estimated length and estimated prize pool.

**Feasibility check** — tells you *before* the night whether your physical chip
set actually covers the format you just described, including every rebuy as a
fresh stack.

**Live clock** (`/run`) — the in-room screen. Countdown per level, next blinds,
grace period between levels, breaks, an audible buzzer on each raise, plus rebuy
and knock-out registration that feeds the pool and the leaderboard.

**Padel layer** — an americano schedule for 8/12/16 players from pre-computed
tables where every pair partners at most once and no two players meet more than
twice as opponents. Court and ball costs are split per head.

**Templates** — the organiser saves a configuration once and loads it next time.

## Design decisions worth pointing at

**No accounts, no cookies, no tracking.** Visitor state lives in `localStorage`
and in the URL. A cookie exists only after the single administrator signs in.
Nothing about a visitor reaches the server, so there is nothing to leak.

**Suggestions travel in links, not in a database.** Anyone can propose a setup,
but nobody can write to the database except the dealer. "Suggest a template"
encodes the configuration into a URL for the visitor to send onward — so there is
no public write endpoint, no moderation queue, no spam surface, and the privacy
promise above stays true. Player names are stripped from the link.

**Missing translations fail the build.** The English dictionary defines the shape
and the Czech and Dutch ones are typed against it, so an untranslated string is a
compile error rather than a word that quietly shows up in the wrong language.
Sentences with embedded links pass a *link renderer* rather than being glued
together, so each language keeps its own word order.

**Errors are never swallowed.** Every failure path logs through one structured
logger with context. Sensitive values can only be recorded as a presence marker
(`present(24)`) — there is deliberately no way to log the value itself.

**The exact-cover schedules are pre-computed, not generated at runtime.** Finding
partner-unique, opponent-balanced americano rounds is a search problem; the
solved tables ship as data (`data/whist-schedules.json`) with their properties
verified.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Postgres (Neon) for the
dealer's templates only · deployed on Vercel.

The domain logic is deliberately framework-free and lives in `lib/`:

| file | what |
|---|---|
| `lib/blinds.ts` | blind ladder generation — levels, antes, breaks, grace periods |
| `lib/chips.ts` | chip value solver and per-player stack composition |
| `lib/padel.ts` | americano schedule and court/ball cost splitting |
| `lib/money.ts` | prize pool, payout splits, cash-game conversion |
| `lib/share.ts` | setup ⇄ shareable link encoding |
| `lib/i18n.tsx` | the build-enforced dictionaries |
| `lib/log.ts` | structured logging |

## Running it locally

```bash
npm install
npm run dev
```

The planner, the clock and the padel layer all work with no database — that part
is entirely client-side. Only the dealer's saved templates need Postgres. To run
that too, provide `DATABASE_URL`, `ADMIN_EMAIL` and `SESSION_SECRET` in
`.env.local`, then create the schema:

```bash
node scripts/db-setup.cjs
```

## Licence

No licence granted — the source is public to read, not to reuse.
