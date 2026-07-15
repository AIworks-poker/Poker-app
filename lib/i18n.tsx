'use client'

/**
 * Tiny i18n for the poker app — EN / CZ / NL, full coverage. No framework, no
 * cookies: the choice lives in localStorage. `en` defines the shape; `cz`/`nl`
 * are typed against it so a missing key fails the build (keeps all three full).
 */
import { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'en' | 'cz' | 'nl'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'cz', label: 'CZ' }, { code: 'nl', label: 'NL' },
]

const en = {
  // common
  title: '♠ Poker Tournament Planner',
  footer: 'No accounts, no cookies, no tracking. We never log your IP.',
  save: 'Save', cancel: 'Cancel', load: 'Load', edit: 'Edit', del: 'Delete', logout: 'Log out',
  // home / setup
  homeSub: 'Set your chips, players, prices and blinds → start the clock. Everything stays in your browser.',
  editingTemplate: 'Editing template', saveChanges: 'Save changes', saveAsNew: 'Save as new',
  templates: 'Templates', templatePlayers: (n: number, v: string) => `${n} players · stack ${v}`,
  tagAntes: 'antes', tagRebuys: 'rebuys', tagAddOns: 'add-ons', cashGame: 'cash game',
  splitTag: (s: string) => `split ${s}`, buyInTag: (v: string) => `buy-in ${v}`,
  editHint: 'To edit a template, open it from ', loaded: (n: string) => `Loaded "${n}".`,
  saveOk: (n: string) => `Saved "${n}".`, saveChangedOk: (n: string) => `Saved changes to "${n}".`,
  saveFail: 'Save failed — log in at /dealer first.', promptName: 'Template name?',
  playersFormat: 'Players & format', playersLabel: 'Players', startingStack: 'Starting stack',
  blindSpeed: 'Blind speed', speedFast: 'Fast (10 min)', speedNormal: 'Normal (15 min)', speedSlow: 'Slow (20 min)',
  grace: 'Grace between levels (s)', rebuys: 'Rebuys', maxTotal: 'max total', maxPerPlayer: 'max per player',
  addOns: 'Add-ons', addOnChips: 'add-on chips', antes: 'Antes',
  money: 'Money', currency: 'Currency', buyInPrice: 'Buy-in price', rebuyPrice: 'Rebuy price', addOnPrice: 'Add-on price',
  payout: 'Payout', payoutTournament: 'Tournament (split the pool)', payoutCash: 'Cash game (chips = cash)',
  addPlace: '+ place', removePlace: '− place', winnerTakesAll: 'Winner-takes-all', preset603010: '60/30/10',
  splitWarn: (x: number) => `Split adds up to ${x}% (normalised to 100% when paying out).`,
  playerNames: (n: number) => `Player names (${n})`, playerPh: (i: number) => `Player ${i}`,
  // padel (admin)
  padelTitle: '🎾 Padel', padelOnly: '— only you (the dealer) see this',
  padelFeed: 'Feed padel finishing order into starting stacks (head-start)',
  courtPrice: 'Court price', ballPrice: 'Balls price (per set)',
  padelCost: (c: number, s: number, t: string, ph: string) => `${c} courts · ${s} ball sets · total ${t} → ${ph} per player (shared equally — pays the venue, not the poker pot).`,
  padelNeeds: (n: number) => `Padel needs a multiple of 4 players (8/12/16/20/24). Currently ${n}.`,
  playScheme: (r: number, c: number) => `Play scheme — ${r} rounds × ${c} courts (americano)`,
  round: 'Round', court: (n: number) => `Court ${n}`, vs: 'v',
  schemeNote: 'Everyone partners exactly once; no opponent more than twice. Names come from the field above.',
  schemeOnly: 'Play scheme is pre-computed for 8, 12 and 16 players.',
  // chips
  chips: 'Chips', colColour: 'Colour', colHave: 'Have', colValue: 'Value', colPerStack: 'Per stack',
  addColour: '+ Add colour', remove: 'Remove',
  chipsHint: "Set each colour's value freely (e.g. Purple 10, White 500). The most numerous colour is usually the smallest denomination.",
  // preview
  preview: 'Preview', kpiStackValue: 'stack value', kpiBuyIns: 'buy-ins covered', kpiChipsUsed: 'chips used',
  kpiLength: 'est. length', kpiPool: 'est. prize pool',
  estWinner: (x: string) => `Est. winner receives ${x}`,
  supplyOk: 'Your chips cover the night', supplyShort: (x: string) => `Short ${x} in chip value`,
  supplyNeedHave: (a: string, b: string) => `Need ${a} · have ${b}.`,
  supplyBreakdown: (players: number, rebuys: string, stack: string, padel: string, addons: string) =>
    `${players} stacks${rebuys} × ${stack}${padel}${addons} (no recycling — every rebuy is a fresh stack).`,
  supplyFix: ' Raise chip values / counts, lower the stack, or cut rebuys.',
  // stacks
  startingStacks: 'Starting stacks', padelOn: '(padel head-start ON)', flat: '(flat)',
  colFinish: 'Finish', colBonus: 'Bonus', colChipsAdd: 'Chips to add (on top)', colTotal: 'Total',
  flatNote: (v: string) => `Everyone starts with ${v} (padel head-start applies to 8/12/16/20/24-player nights).`,
  // blinds
  blindStructure: 'Blind structure', colLevel: 'Level', colBlinds: 'Small / Big', colAnte: 'Ante', colLength: 'Length',
  breakRow: '— break —', startTournament: 'Start tournament ▶',
  // run
  setup: '← Setup', resetLive: 'Reset live data', confirmResetLive: 'Clear live data (rebuys, add-ons, knockouts)?',
  nothingSetUp: 'Nothing set up yet.', configure: 'Configure a tournament →', loading: 'Loading…',
  complete: 'Tournament complete', breakLbl: 'Break', getSettled: 'Get settled — next level in', levelN: (n: number) => `Level ${n}`,
  next: (s: string) => `Next: ${s}`, nextBreak: 'Break', nextLevel: (n: number, b: string) => `L${n} — ${b}`,
  cPrev: '⏮ Prev', cStart: '▶ Start', cPause: '⏸ Pause', cNext: 'Next ⏭', cReset: '↺ Reset',
  mute: 'Mute buzzer', unmute: 'Unmute buzzer',
  kpiPrizePool: 'prize pool', kpiPlayers: 'players', kpiRebuysUsed: 'rebuys used', kpiAddOns: 'add-ons',
  kpiWinnerGets: 'winner gets', kpiPerChip: 'per chip',
  rosterPlayers: 'Players', colRebuysLeft: (n: number) => `Rebuys (${n} left)`, colRebuys: 'Rebuys',
  colAddOn: 'Add-on', colBusted: 'Busted?', colFinalChips: 'Final chips', statusIn: 'in', noRebuysLeft: 'No rebuys left',
  bustHint: 'Tick a player when they bust. Finishing places fill from last upward; the last player left wins. Untick to undo.',
  leaderboard: 'Leaderboard', colRank: '#', colPlayer: 'Player', colCash: 'Cash', colPrize: 'Prize',
  cashNote: (rate: string, cur: string, total: string) => `Cash = final chips × ${rate} ${cur} (prize pool ÷ all ${total} chips in play — padel head-start chips included). Enter each player's final stack above; they should sum to ${total}.`,
  // dealer
  dealer: '🎴 Dealer', dealerSub: 'Backstage — saving public templates. Dealer only.',
  email: 'Email', password: 'Password', login: 'Log in', forgot: 'Forgot password', loginFail: 'Login failed.',
  forgotSent: 'If that address is the dealer, a reset link is on its way.',
  saveCurrent: 'Save current setup as a new template', tmplNamePh: 'e.g. 12-player Friday', saveNew: 'Save new',
  saveCurrentHint1: 'Saves whatever you last configured on the ', saveCurrentHint2: '. To change an existing template, use ', saveCurrentHint3: ' below.',
  saved: 'Saved.', sessionExpired: 'Session expired — log in again.', saveFailShort: 'Save failed.',
  templatesN: (n: number) => `Templates (${n})`, noneYet: 'None yet.', confirmDelete: 'Delete this template?',
  homePage: 'home page',
  // reset
  setPw: 'Set dealer password', newPw: 'New password (8+ chars)', setPwBtn: 'Set password',
  pwSet: 'Password set. You can now log in at /dealer.', pwInvalid: 'Invalid or expired link.',
  // ordinal
  ord: (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`,
  first: '🏆 1st',
}

type Dict = typeof en

const cz: Dict = {
  title: '♠ Plánovač pokerového turnaje',
  footer: 'Žádné účty, žádné cookies, žádné sledování. Nikdy nezaznamenáváme vaši IP.',
  save: 'Uložit', cancel: 'Zrušit', load: 'Načíst', edit: 'Upravit', del: 'Smazat', logout: 'Odhlásit',
  homeSub: 'Nastavte žetony, hráče, ceny a blindy → spusťte hodiny. Vše zůstává ve vašem prohlížeči.',
  editingTemplate: 'Úprava šablony', saveChanges: 'Uložit změny', saveAsNew: 'Uložit jako novou',
  templates: 'Šablony', templatePlayers: (n, v) => `${n} hráčů · stack ${v}`,
  tagAntes: 'ante', tagRebuys: 'rebuy', tagAddOns: 'add-ony', cashGame: 'cash game',
  splitTag: (s) => `rozdělení ${s}`, buyInTag: (v) => `buy-in ${v}`,
  editHint: 'Šablonu upravíte přes ', loaded: (n) => `Načteno „${n}".`,
  saveOk: (n) => `Uloženo „${n}".`, saveChangedOk: (n) => `Změny uloženy do „${n}".`,
  saveFail: 'Uložení selhalo — nejprve se přihlaste na /dealer.', promptName: 'Název šablony?',
  playersFormat: 'Hráči a formát', playersLabel: 'Hráči', startingStack: 'Počáteční stack',
  blindSpeed: 'Rychlost blindů', speedFast: 'Rychlé (10 min)', speedNormal: 'Normální (15 min)', speedSlow: 'Pomalé (20 min)',
  grace: 'Prodleva mezi úrovněmi (s)', rebuys: 'Rebuy', maxTotal: 'max celkem', maxPerPlayer: 'max na hráče',
  addOns: 'Add-ony', addOnChips: 'žetony add-onu', antes: 'Ante',
  money: 'Peníze', currency: 'Měna', buyInPrice: 'Cena buy-inu', rebuyPrice: 'Cena rebuy', addOnPrice: 'Cena add-onu',
  payout: 'Výplata', payoutTournament: 'Turnaj (rozdělit bank)', payoutCash: 'Cash game (žetony = peníze)',
  addPlace: '+ místo', removePlace: '− místo', winnerTakesAll: 'Vítěz bere vše', preset603010: '60/30/10',
  splitWarn: (x) => `Rozdělení je celkem ${x} % (při výplatě se normalizuje na 100 %).`,
  playerNames: (n) => `Jména hráčů (${n})`, playerPh: (i) => `Hráč ${i}`,
  padelTitle: '🎾 Padel', padelOnly: '— vidíte jen vy (dealer)',
  padelFeed: 'Zohlednit pořadí z padelu v počátečních staccích (náskok)',
  courtPrice: 'Cena kurtu', ballPrice: 'Cena míčků (za sadu)',
  padelCost: (c, s, t, ph) => `${c} kurtů · ${s} sad míčků · celkem ${t} → ${ph} na hráče (rozděleno rovným dílem — platí místo, ne pokerový bank).`,
  padelNeeds: (n) => `Padel potřebuje počet hráčů dělitelný 4 (8/12/16/20/24). Nyní ${n}.`,
  playScheme: (r, c) => `Herní rozpis — ${r} kol × ${c} kurtů (americano)`,
  round: 'Kolo', court: (n) => `Kurt ${n}`, vs: 'v',
  schemeNote: 'Každý je spoluhráčem právě jednou; žádný soupeř více než dvakrát. Jména se berou z pole výše.',
  schemeOnly: 'Herní rozpis je připraven pro 8, 12 a 16 hráčů.',
  chips: 'Žetony', colColour: 'Barva', colHave: 'Máte', colValue: 'Hodnota', colPerStack: 'Na stack',
  addColour: '+ Přidat barvu', remove: 'Odebrat',
  chipsHint: 'Hodnotu každé barvy nastavte volně (např. fialová 10, bílá 500). Nejpočetnější barva je obvykle nejmenší nominál.',
  preview: 'Náhled', kpiStackValue: 'hodnota stacku', kpiBuyIns: 'pokryté buy-iny', kpiChipsUsed: 'použité žetony',
  kpiLength: 'odh. délka', kpiPool: 'odh. bank',
  estWinner: (x) => `Odh. vítěz získá ${x}`,
  supplyOk: 'Vaše žetony na večer stačí', supplyShort: (x) => `Chybí ${x} v hodnotě žetonů`,
  supplyNeedHave: (a, b) => `Potřeba ${a} · máte ${b}.`,
  supplyBreakdown: (players, rebuys, stack, padel, addons) =>
    `${players} stacků${rebuys} × ${stack}${padel}${addons} (bez recyklace — každý rebuy je nový stack).`,
  supplyFix: ' Zvyšte hodnoty/počty žetonů, snižte stack nebo omezte rebuy.',
  startingStacks: 'Počáteční stacky', padelOn: '(padel náskok ZAP)', flat: '(rovné)',
  colFinish: 'Umístění', colBonus: 'Bonus', colChipsAdd: 'Žetony navíc', colTotal: 'Celkem',
  flatNote: (v) => `Každý začíná s ${v} (padel náskok platí pro večery s 8/12/16/20/24 hráči).`,
  blindStructure: 'Struktura blindů', colLevel: 'Úroveň', colBlinds: 'Malý / Velký', colAnte: 'Ante', colLength: 'Délka',
  breakRow: '— pauza —', startTournament: 'Spustit turnaj ▶',
  setup: '← Nastavení', resetLive: 'Vymazat živá data', confirmResetLive: 'Vymazat živá data (rebuy, add-ony, vyřazení)?',
  nothingSetUp: 'Zatím nic nastaveno.', configure: 'Nastavit turnaj →', loading: 'Načítání…',
  complete: 'Turnaj dokončen', breakLbl: 'Pauza', getSettled: 'Usaďte se — další úroveň za', levelN: (n) => `Úroveň ${n}`,
  next: (s) => `Další: ${s}`, nextBreak: 'Pauza', nextLevel: (n, b) => `Ú${n} — ${b}`,
  cPrev: '⏮ Předchozí', cStart: '▶ Start', cPause: '⏸ Pauza', cNext: 'Další ⏭', cReset: '↺ Reset',
  mute: 'Ztlumit bzučák', unmute: 'Zapnout bzučák',
  kpiPrizePool: 'bank', kpiPlayers: 'hráči', kpiRebuysUsed: 'využité rebuy', kpiAddOns: 'add-ony',
  kpiWinnerGets: 'vítěz bere', kpiPerChip: 'za žeton',
  rosterPlayers: 'Hráči', colRebuysLeft: (n) => `Rebuy (zbývá ${n})`, colRebuys: 'Rebuy',
  colAddOn: 'Add-on', colBusted: 'Vypadl?', colFinalChips: 'Konečné žetony', statusIn: 've hře', noRebuysLeft: 'Žádné rebuy nezbývá',
  bustHint: 'Zaškrtněte hráče, když vypadne. Umístění se plní odspodu; poslední ve hře vyhrává. Odškrtnutím vrátíte zpět.',
  leaderboard: 'Žebříček', colRank: '#', colPlayer: 'Hráč', colCash: 'Peníze', colPrize: 'Výhra',
  cashNote: (rate, cur, total) => `Peníze = konečné žetony × ${rate} ${cur} (bank ÷ všech ${total} žetonů ve hře — včetně padel náskoku). Zadejte konečný stack každého hráče výše; součet má být ${total}.`,
  dealer: '🎴 Dealer', dealerSub: 'Zákulisí — ukládání veřejných šablon. Pouze dealer.',
  email: 'E-mail', password: 'Heslo', login: 'Přihlásit', forgot: 'Zapomenuté heslo', loginFail: 'Přihlášení selhalo.',
  forgotSent: 'Pokud je to adresa dealera, odkaz pro obnovu je na cestě.',
  saveCurrent: 'Uložit aktuální nastavení jako novou šablonu', tmplNamePh: 'např. Páteční 12 hráčů', saveNew: 'Uložit novou',
  saveCurrentHint1: 'Uloží to, co jste naposledy nastavili na ', saveCurrentHint2: '. Existující šablonu změníte tlačítkem ', saveCurrentHint3: ' níže.',
  saved: 'Uloženo.', sessionExpired: 'Relace vypršela — přihlaste se znovu.', saveFailShort: 'Uložení selhalo.',
  templatesN: (n) => `Šablony (${n})`, noneYet: 'Zatím žádné.', confirmDelete: 'Smazat tuto šablonu?',
  homePage: 'domovské stránce',
  setPw: 'Nastavit heslo dealera', newPw: 'Nové heslo (8+ znaků)', setPwBtn: 'Nastavit heslo',
  pwSet: 'Heslo nastaveno. Nyní se můžete přihlásit na /dealer.', pwInvalid: 'Neplatný nebo vypršelý odkaz.',
  ord: (n) => `${n}.`,
  first: '🏆 1.',
}

const nl: Dict = {
  title: '♠ Pokertoernooiplanner',
  footer: 'Geen accounts, geen cookies, geen tracking. We loggen nooit je IP.',
  save: 'Opslaan', cancel: 'Annuleren', load: 'Laden', edit: 'Bewerken', del: 'Verwijderen', logout: 'Uitloggen',
  homeSub: 'Stel je fiches, spelers, prijzen en blinds in → start de klok. Alles blijft in je browser.',
  editingTemplate: 'Sjabloon bewerken', saveChanges: 'Wijzigingen opslaan', saveAsNew: 'Opslaan als nieuw',
  templates: 'Sjablonen', templatePlayers: (n, v) => `${n} spelers · stack ${v}`,
  tagAntes: 'antes', tagRebuys: 'rebuys', tagAddOns: 'add-ons', cashGame: 'cashgame',
  splitTag: (s) => `verdeling ${s}`, buyInTag: (v) => `buy-in ${v}`,
  editHint: 'Bewerk een sjabloon via ', loaded: (n) => `"${n}" geladen.`,
  saveOk: (n) => `"${n}" opgeslagen.`, saveChangedOk: (n) => `Wijzigingen in "${n}" opgeslagen.`,
  saveFail: 'Opslaan mislukt — log eerst in op /dealer.', promptName: 'Sjabloonnaam?',
  playersFormat: 'Spelers & format', playersLabel: 'Spelers', startingStack: 'Startstack',
  blindSpeed: 'Blindsnelheid', speedFast: 'Snel (10 min)', speedNormal: 'Normaal (15 min)', speedSlow: 'Langzaam (20 min)',
  grace: 'Speling tussen niveaus (s)', rebuys: 'Rebuys', maxTotal: 'max totaal', maxPerPlayer: 'max per speler',
  addOns: 'Add-ons', addOnChips: 'add-on fiches', antes: 'Antes',
  money: 'Geld', currency: 'Valuta', buyInPrice: 'Buy-in prijs', rebuyPrice: 'Rebuy prijs', addOnPrice: 'Add-on prijs',
  payout: 'Uitbetaling', payoutTournament: 'Toernooi (pot verdelen)', payoutCash: 'Cashgame (fiches = geld)',
  addPlace: '+ plaats', removePlace: '− plaats', winnerTakesAll: 'Winnaar pakt alles', preset603010: '60/30/10',
  splitWarn: (x) => `Verdeling telt op tot ${x}% (wordt bij uitbetaling naar 100% genormaliseerd).`,
  playerNames: (n) => `Spelersnamen (${n})`, playerPh: (i) => `Speler ${i}`,
  padelTitle: '🎾 Padel', padelOnly: '— alleen jij (de dealer) ziet dit',
  padelFeed: 'Padel-eindstand meenemen in de startstacks (voorsprong)',
  courtPrice: 'Baanprijs', ballPrice: 'Ballenprijs (per set)',
  padelCost: (c, s, t, ph) => `${c} banen · ${s} ballensets · totaal ${t} → ${ph} per speler (gelijk gedeeld — betaalt de locatie, niet de pokerpot).`,
  padelNeeds: (n) => `Padel heeft een veelvoud van 4 spelers nodig (8/12/16/20/24). Nu ${n}.`,
  playScheme: (r, c) => `Speelschema — ${r} rondes × ${c} banen (americano)`,
  round: 'Ronde', court: (n) => `Baan ${n}`, vs: 'v',
  schemeNote: 'Iedereen speelt precies één keer samen; geen tegenstander meer dan twee keer. Namen komen uit het veld hierboven.',
  schemeOnly: 'Speelschema is voorberekend voor 8, 12 en 16 spelers.',
  chips: 'Fiches', colColour: 'Kleur', colHave: 'Aantal', colValue: 'Waarde', colPerStack: 'Per stack',
  addColour: '+ Kleur toevoegen', remove: 'Verwijderen',
  chipsHint: 'Stel de waarde van elke kleur vrij in (bijv. paars 10, wit 500). De talrijkste kleur is meestal de kleinste coupure.',
  preview: 'Voorbeeld', kpiStackValue: 'stackwaarde', kpiBuyIns: 'buy-ins gedekt', kpiChipsUsed: 'fiches gebruikt',
  kpiLength: 'gesch. duur', kpiPool: 'gesch. prijzenpot',
  estWinner: (x) => `Gesch. winnaar krijgt ${x}`,
  supplyOk: 'Je fiches dekken de avond', supplyShort: (x) => `${x} tekort aan fichewaarde`,
  supplyNeedHave: (a, b) => `Nodig ${a} · aanwezig ${b}.`,
  supplyBreakdown: (players, rebuys, stack, padel, addons) =>
    `${players} stacks${rebuys} × ${stack}${padel}${addons} (geen hergebruik — elke rebuy is een nieuwe stack).`,
  supplyFix: ' Verhoog fichewaarden/aantallen, verlaag de stack of beperk rebuys.',
  startingStacks: 'Startstacks', padelOn: '(padel-voorsprong AAN)', flat: '(vlak)',
  colFinish: 'Plaats', colBonus: 'Bonus', colChipsAdd: 'Fiches erbij', colTotal: 'Totaal',
  flatNote: (v) => `Iedereen start met ${v} (padel-voorsprong geldt voor avonden met 8/12/16/20/24 spelers).`,
  blindStructure: 'Blindstructuur', colLevel: 'Niveau', colBlinds: 'Klein / Groot', colAnte: 'Ante', colLength: 'Duur',
  breakRow: '— pauze —', startTournament: 'Toernooi starten ▶',
  setup: '← Instellen', resetLive: 'Live data wissen', confirmResetLive: 'Live data wissen (rebuys, add-ons, afvallers)?',
  nothingSetUp: 'Nog niets ingesteld.', configure: 'Een toernooi instellen →', loading: 'Laden…',
  complete: 'Toernooi voltooid', breakLbl: 'Pauze', getSettled: 'Ga zitten — volgend niveau over', levelN: (n) => `Niveau ${n}`,
  next: (s) => `Volgende: ${s}`, nextBreak: 'Pauze', nextLevel: (n, b) => `N${n} — ${b}`,
  cPrev: '⏮ Vorige', cStart: '▶ Start', cPause: '⏸ Pauze', cNext: 'Volgende ⏭', cReset: '↺ Reset',
  mute: 'Zoemer dempen', unmute: 'Zoemer aan',
  kpiPrizePool: 'prijzenpot', kpiPlayers: 'spelers', kpiRebuysUsed: 'rebuys gebruikt', kpiAddOns: 'add-ons',
  kpiWinnerGets: 'winnaar krijgt', kpiPerChip: 'per fiche',
  rosterPlayers: 'Spelers', colRebuysLeft: (n) => `Rebuys (${n} over)`, colRebuys: 'Rebuys',
  colAddOn: 'Add-on', colBusted: 'Afgevallen?', colFinalChips: 'Eindfiches', statusIn: 'in', noRebuysLeft: 'Geen rebuys meer',
  bustHint: 'Vink een speler aan als hij afvalt. Plaatsen vullen van onder naar boven; de laatste speler wint. Uitvinken om terug te draaien.',
  leaderboard: 'Klassement', colRank: '#', colPlayer: 'Speler', colCash: 'Cash', colPrize: 'Prijs',
  cashNote: (rate, cur, total) => `Cash = eindfiches × ${rate} ${cur} (prijzenpot ÷ alle ${total} fiches in het spel — inclusief padel-voorsprongfiches). Voer hierboven ieders eindstack in; die moeten optellen tot ${total}.`,
  dealer: '🎴 Dealer', dealerSub: 'Backstage — publieke sjablonen opslaan. Alleen dealer.',
  email: 'E-mail', password: 'Wachtwoord', login: 'Inloggen', forgot: 'Wachtwoord vergeten', loginFail: 'Inloggen mislukt.',
  forgotSent: 'Als dat het dealer-adres is, is er een herstellink onderweg.',
  saveCurrent: 'Huidige instelling als nieuw sjabloon opslaan', tmplNamePh: 'bijv. Vrijdag 12 spelers', saveNew: 'Nieuw opslaan',
  saveCurrentHint1: 'Slaat op wat je het laatst instelde op de ', saveCurrentHint2: '. Een bestaand sjabloon wijzig je met ', saveCurrentHint3: ' hieronder.',
  saved: 'Opgeslagen.', sessionExpired: 'Sessie verlopen — log opnieuw in.', saveFailShort: 'Opslaan mislukt.',
  templatesN: (n) => `Sjablonen (${n})`, noneYet: 'Nog geen.', confirmDelete: 'Dit sjabloon verwijderen?',
  homePage: 'startpagina',
  setPw: 'Dealer-wachtwoord instellen', newPw: 'Nieuw wachtwoord (8+ tekens)', setPwBtn: 'Wachtwoord instellen',
  pwSet: 'Wachtwoord ingesteld. Je kunt nu inloggen op /dealer.', pwInvalid: 'Ongeldige of verlopen link.',
  ord: (n) => `${n}e`,
  first: '🏆 1e',
}

export const STR: Record<Lang, Dict> = { en, cz, nl }

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  useEffect(() => {
    try {
      const v = localStorage.getItem('poker_lang') as Lang | null
      if (v && STR[v]) { setLangState(v); return }
      const b = navigator.language.slice(0, 2).toLowerCase()
      if (b === 'cs') setLangState('cz'); else if (b === 'nl') setLangState('nl')
    } catch {}
  }, [])
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('poker_lang', l) } catch {} }
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export function useLang() {
  const { lang, setLang } = useContext(LangCtx)
  return { lang, setLang, t: STR[lang] }
}

export function LangSwitch() {
  const { lang, setLang } = useContext(LangCtx)
  return (
    <div className="lang-switch">
      {LANGS.map(l => (
        <button key={l.code} className={l.code === lang ? 'active' : ''} onClick={() => setLang(l.code)}>{l.label}</button>
      ))}
    </div>
  )
}
