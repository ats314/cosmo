# Invariants that are load-bearing

Breaking one of these is a product regression, not a style question.

Every entry here was paid for by a bug that shipped. They are grouped by what
you would have to be touching to be at risk; the routing table in `CLAUDE.md`
points at these groups by name. **Read the group your change lands in, in full.**
Nothing has been shortened — only sorted.

## Curriculum, teaching and the ledger

*You are adding or moving a formation, an orb, a level boundary, a lesson, or
any player-facing sentence.*

- **The curriculum rule, as the owner revised it.** The rule used to end
  teaching at level 4's floor. The owner's call, verbatim: *"We are going to
  change to balance power up introduction, mechanics, and difficulty all the
  way the level 4."* So the boundary differs by KIND, and the split is
  deliberate rather than a loophole:
  - **Formations** — the shard shapes on the tier ladder — complete by
    **dl 520**, level 5's finish line, NOT dl 340. That boundary moved when the
    run went to six levels: teaching that stopped at level 3 left levels 4, 5
    and 6 introducing nothing for twelve minutes, which is a plateau rather
    than an exam. DIVERS (dl 395, level 4) and THE NARROWS (dl 520, level 5)
    are the two rungs that fill it, and THE EYE moved to dl 610, level 6's
    floor. The guards moved with it and none of them is indexed by a literal
    any more: `check.mjs` derives the boundary from `ends[ends.length-1]`
    (every level but the last carries a numeric `end`, so that count IS the
    number of teaching levels), `curriculum.mjs` reads `EXAM = LV.length` and
    fails if a tier banner fires inside the exam level, and `smoke.mjs` pins
    the last tier to `LV[LV.length-2].end` — so a rung can be inserted
    anywhere below THE EYE but never appended after it. If you move a tier,
    all three must pass.
  - **Orbs** spread across levels 1–5, taught by `firstMeet` at first
    contact: the intro trio on level 1, then one guaranteed home apiece —
    hypernova level 2, spotlight level 3, mirror level 4, scorch level 5 —
    with the black hole guaranteed once on level 4 and otherwise left to its
    rare roll from level 3 on, because guaranteeing something rare early to
    satisfy a boundary would have destroyed the thing that makes it work.
  This is the owner's decision and not an inference from the code. Level 6 is
  the exam: it introduces nothing, and everything the game has is in play
  when it opens. Do not read the latitude on orbs as permission to scatter
  formations into the exam — that half is enforced three ways. And this entry
  has drifted before, twice, always the same way: it said "the end of level
  2" while every guard said level 3, then said dl 340 while the guards said
  dl 520 — each time the exam moved and the prose stayed. A constraint that
  disagrees with its own enforcement costs more than a missing one, because
  it makes the careful reader wrong. The guards are derived from the tables
  now precisely so the next move drags them along; nothing derives this
  paragraph, so update it in the same commit.

- **Adding a tier is wider than it looks, and the twelve hardcoded ordinals
  are gone now.** `curriculum.mjs` used to hardcode the last tier's index
  (`G.tier !== 9`), so inserting a row anywhere failed the build with a message
  about the wrong thing; it derives it from `TIERS.length`. The other half of
  this entry used to end "twelve places in `index.html` still hardcode tier
  ordinals for the sky band, the NEW SOUND ladder and the star instrument —
  inserting below the highest of them shifts every one", and then DIVERS and
  THE NARROWS were inserted and did exactly that: THE EYE moved from index 10
  to index 12, so every `G.tier>=10` silently stopped meaning "the last rung"
  and started meaning "two rungs early" — the sky's deepest band, the electric
  guitar, the NEW SOUND announcement and the death screen's teaser would all
  have fired at DIVERS. They are derived from the table by NAME now (`T_VOICE`
  and `T_SKY`), so the next insert costs nothing and a renamed row fails
  loudly instead of quietly re-timing the audio ladder.

- **Ceremonies are per RUN, never per level.** `startGame` runs at every level
  advance, not only when a run begins, so any "first time" flag it resets
  unconditionally becomes a per-level ceremony. Everything that introduces —
  the hint-ladder flags (`didReverse`, `didHop`, `didDodge`, `sawDrop` and
  kin), the shield→slow-mo→nova intro trio (`G.introN`), the four
  orb-guarantee flags — resets only under `!carried`, the same signal `bhRun`
  uses. (`carried`, not `G.carryScore`: the latter is consumed and zeroed
  before the resets run, so reading it there is always false.) Unguarded,
  every back-half level replayed "tap anywhere to turn around" and re-paraded
  every guaranteed orb — HYPERNOVA guaranteed on L2 through L6, level 5
  opening with six marquee arrivals in 54 seconds — burying SCORCH and THE
  NARROWS, the only two things level 5 actually introduces. On a picked
  start the guarantee flags begin pre-spent for every home level already
  behind the run, so a REDSHIFT start owes level 2 nothing. `G.powN` stays
  per-level on purpose: it is pacing and telemetry, not a ceremony.

- **No aimed input.** There is no target to hit anywhere in this game. Landing
  the beat drop is *any* move in the window, wherever the thumb is.

- **A lesson may only reference actions and objects the game actually has.**
  Cosmo has two verbs (turn around, change ring), rings, red, stars, shields
  and the beat. It has no aimed movement: no positioning, no threading a gap,
  no outrunning, no stopping. Two twin wordings shipped that each invoked a
  manoeuvre from some other game, and both read to players as nonsense — not
  because they were inaccurate, but because they answered a question the player
  had no way to be asking. Checking a sentence against the *code* does not
  catch this; the code will happily support a true statement about something
  the player can never do. Ask instead: is this sentence about something the
  player could attempt? When in doubt, claim only what is countable and name a
  verb the game has.

- **`MECHANICS.md` and the code move together.** Change a mechanic, update the
  ledger row and the level card text in the same commit.
  **This is enforced now, in `check.mjs`.** Every `TIERS[].name` and every
  `LAB_ORBS[].n` must appear somewhere in `MECHANICS.md`, matched
  case-insensitively because the code shouts and the ledger is prose. It was a
  sentence asking people to remember until the guard was written, and the guard
  failed on its first run: THE EYE — the last rung of the tier ladder, then at
  dl 340 on level 4's floor, dl 610 now — had shipped with no ledger row at
  all. The check runs
  FORWARD only, because "every mechanic the code ships is in the ledger" is
  precise, while asking which of the ledger's hundred rows ought to name a code
  symbol would guess, and a guard that guesses gets deleted the first time it
  is wrong.

- **THE HOUSE STYLE — three rules, and they are what "cohesive" meant.** The
  owner playtested six levels and reported, verbatim: *"the game feels exactly
  like 50 different agents have worked on it ... very pieced together, not
  cohesive, not well thought out. If I played, my first thought would be 'ai
  made this'."* No individual feature was the fault. Every feature had arrived
  with its own vocabulary, because nothing in the repository said what the
  vocabulary WAS — so each session invented one more, and the composite read
  as a committee. The rules now live at the top of `index.html` beside `COL`,
  where anything adding a player-facing string will pass them:

  1. **One name per thing.** The player is on a LEVEL, and the level has a
     name. That name appears on the card, in the header, on the death screen
     and in the share text, and nothing else is printed alongside it. The
     tier ladder is real and is not furniture: it speaks by *arriving* — a
     banner — never by sitting in the corner. A mode may not borrow a level's
     name for its eyebrow. What this replaced, screenshotted: the header read
     `LEVEL 4 · FLICKER PAIRS` (a tier) while the card that opened the level
     said EVENT HORIZON, the music was in E♭ because of EVENT HORIZON, the
     sky was EVENT HORIZON's — and then the black hole arrived carrying
     `EVENT HORIZON` as its eyebrow, directly above a header label reading
     `BLACK HOLE · 17s` and a banner reading `BLACK HOLE`. Four names for one
     situation, two of them duplicated, none agreeing. An earlier session met
     exactly this collision and fixed it by *renaming the tier* (see the note
     on THE EYE in `TIERS`); the collision came back one level later, because
     the defect was printing two ladders side by side, not the words chosen.
  2. **One counter idiom.** `NOUN ×N` is a multiplier — `COMBO ×3`,
     `ON BEAT ×8`, `OVERDRIVE ×2`, `SPOTLIGHT ×2`. `NOUN · N` is a count or a
     clock — `SHIELDS · 3`, `CLEAN ORBITS · 3`, `BLACK HOLE · 12s`,
     `LEVEL 4 · REDSHIFT`. The middot is already this file's connector
     everywhere else, so the two symbols carry the whole distinction and no
     label has to spell it out in words. **A lesson names a counter with the
     exact string the HUD prints for it.** What this replaced: the word
     *chain* named three unrelated mechanics — the star combo's lesson said
     "chain stars", the on-beat counter's lesson said "the chain climbs", and
     the finale paid `+60 CHAIN` on a fourth rule again — while the header
     printed `×2 COMBO`, written backwards from the two labels immediately
     under it. A player cannot learn a word that means three things.
  3. **One colour per meaning, and the list is closed.** cyan = you; gold =
     earned; violet = the music; pink-red = death, and death only; mint =
     shield; white = the peak. Everything past that is an *orb's* identity
     (magenta hypernova, violet-blue black hole, blue mirror, orange scorch)
     and is spent on that orb alone — never on a readout, never on a reward.
     A new colour needs a meaning nothing above already owns. This half was
     already being followed; it is written down so it keeps being followed.

- **A HUD METER APPEARS WHEN IT HAS A READING, NOT WHEN THE RUN STARTS.**
  Screenshotted at second three of level 1: eight band dots with one lit,
  above four hollow ember diamonds, under a gold line — three instrumentation
  rows on a board holding one ring, one comet and one star, for a player who
  had not yet turned around. None of them was readable yet; what *was*
  readable is that the game has a lot of dials. `G.bandSeen` and `G.embSeen`
  latch on the first real reading and never clear inside a run, so a meter
  cannot flicker out mid-glance. Nothing was deleted — it arrives when it is
  true. The same rule is why the timed-state label yields to its own banner
  for the banner's first 3.2s instead of printing the state's name twice, 25px
  apart, on the same frame.

- **THE FRONT DOOR RANKS BY WHAT IT IS FOR: the name, what you do, START,
  then side doors.** `POWERUP TESTING` sat *second* on the title screen —
  directly under the game's name, above the four lines that say what the game
  is and above the button that plays it — so the loudest object on the front
  door was a developer sandbox that keeps no record and pins the difficulty
  clock. Nothing had decided that; it was the last thing added and the layout
  had a slot free where the mode cards used to be. It hangs off the START
  pill's bottom edge now, and the key rows take the band it vacated (which
  also closed a 119px dead gap above them). The bar itself is unchanged —
  the reasoning that made it a violet bar rather than a card still holds.
  **It falls back to the old slot when there is no room under the button**
  (`labRoom`): on a short landscape viewport `bottomY` collapses onto the
  bottom safe area and the pill *is* the last row, and a door nobody can
  reach is worse than a door in the wrong place.

- **ONE THING OWNS THE CENTRE, AND BOTH SET PIECES COUNT.** `hintText()`
  returns null inside the black hole *and* inside the star dive. This was
  described in that function's comment and implemented for only one of them,
  which is worse than either: the comment said the dive owned the screen while
  the code tested `bhActive()` alone. Screenshotted mid-finale — *"tap anywhere
  to turn around"* dead centre through the guide line, over the constellation,
  under a banner reading THE FINALE. If you add a third set piece, it goes in
  that guard in the same commit.

## Modes, records and the powerup lab

*You are touching MODES, the level select, a stored record, or anything
reachable from POWERUP TESTING.*

- **ONE MODE SHIPS, AND `MODES` STAYS ANYWAY.** CHILL is retired — the owner's
  call, one mode until the game is perfected — and the table is kept at a
  single row on purpose. Do not "finish the job" by deleting it. The table is
  where the rule lives that **a second difficulty is a derivative and never a
  second implementation**, and that rule was arrived at rather than obvious.
  Delete the table and a future mode rediscovers it as a branch on a flag in
  the game code, which is the thing the table exists to prevent.
  The guards stay armed and `check.mjs` still enforces them. **The one row is
  the identity mode** — every knob 1, or 0 for the additive shield — so every
  expression reduces to exactly what shipped and the table can never quietly
  become the place the real game is tuned. **A knob declared and never read
  fails the build**, for the same reason a dead upgrade tile does. **Every mode
  has the same knob set** is vacuous at one row and stays armed for the row
  that comes back. `smoke.mjs` is what keeps the wiring honest with nothing
  shipped on it: it INJECTS a synthetic mode with every knob off neutral and
  measures every curve through the real functions, so a table wired to nothing
  cannot pass. Do not delete that test as dead weight — it is the only thing
  standing between a future second mode and a day spent discovering the
  plumbing rotted while nobody was looking.
  If a mode ever needs behaviour a multiplier cannot express, that is the
  conversation to have first — not a branch on `MODE` in the game code. And a
  mode must not touch the curriculum, the music or the scoring: tiers are keyed
  on `dl` and orbs on `G.level`, and `curriculum.mjs` fails if a mode moves a
  tier, a finish line or a level boundary.

- **A picked starting level cannot forge a climb.** The level select can start
  any level on any device, including ones never reached — that is what it is
  for. `G.startLevel` is the level the run *opened* on, and the level record
  (`FURTHEST YET`, `cometloop:gl`) only moves when it is 1. Never widen this to
  "the level the run is on": a run that starts at 1 and climbs must keep
  counting across retries, and a run that jumped must never count at all.
  Records are still keyed per mode and **the unsuffixed storage keys are
  SKILL's**, which is exactly why retiring chill cost no player their history:
  every value ever written to `cometloop:best` was skill's, because any other
  mode's went to a suffixed key. Never let `recKey` suffix skill — that
  silently changes what every stored record on every device means, which is the
  retired-`cometloop:level` failure exactly. `check.mjs` guards it. The
  `:chill` keys and `cometloop:mode` are left on disk deliberately and
  `cometloop:mode` is no longer read: a device that last played chill has
  `chill` under it, and honouring that selects a mode that does not exist.

- **A LAB SESSION LEAVES NOTHING BEHIND, and that is the whole feature.**
  POWERUP TESTING is a sandbox reached from the title screen: it forces one
  orb, pins `dl()` to `LAB_DL` (40), and switches red off by default. Every one of
  its guarantees is a `!LAB.on` sitting on a line whose ordinary job is to
  write to the device — the best score, the level record, the run count, the
  struggle streak, the `seen` bits, telemetry — so an omitted guard looks
  exactly like the others in a diff and no amount of reading finds it. Do not
  add another such line without its guard, and do not trust a review to catch
  it: `smoke.mjs` CLEARS `localStorage`, plays a lab session including hops and
  taps, and fails if any key reappears — which is the only enforcement that
  scales. It has to clear rather than diff, and that distinction is the whole
  lesson: the first version snapshotted a store the earlier tests had already
  filled, so three leaked writes (`hopped`, `groove`, `landed`) wrote `'1'`
  over `'1'` and the comparison saw nothing. A lab session must be unable to
  CREATE a key, not merely unable to change one.
  **The gameplay verbs write too, not just the menus.** `hop()` persists
  `cometloop:hopped`, and `G.everHopped` gates the once-ever first-hop
  rehearsal — so an unguarded lab could spend a fresh player's tutorial for the
  hardest gesture in the game before they ever met the real second ring. Two
  more sit in `tryLand()` and `judgeTiming()`, and **neither is reachable in
  `smoke.mjs` at all**: both return immediately without `AC`/`MU`, and smoke
  removes WebAudio by design. `check.mjs` covers that gap with a tripwire on
  the set of persisted keys — it cannot tell whether a write is guarded, but a
  new one cannot be added without someone being asked the question.
  **Two writers spend a lesson, not one** — `firstMeet()` fires the sentence,
  and the pickup path separately treats *taking* a musical orb as being taught
  it. Guarding only the first was the shipped-looking bug the harness caught:
  one black hole lab session would have permanently retired the black hole's
  lesson on a device that had never met one in the real game.
  **The lab is not a MODES row and must not become one.** `MODES` is the
  difficulty table and `check.mjs` holds it to that shape; a sandbox that pins
  the clock rather than scaling it has no knob set to offer. It is a flag with
  its own front screen, and the two mode cards are untouched. Likewise the
  title bar that opens it is a DOOR, not a card — it navigates, the way the
  menu's `change` swipe control already does, so "cards select rather than
  start" survives intact.
  **A pinned clock has one trap and it is already sprung once.** Anything
  written as "N difficulty-seconds from now" is a deadline that never arrives
  in the lab, because the difference is always zero. `tierIndex`'s hop-hold
  release valve was exactly that and is exempted; check any new one.

## Simulation, state and telemetry

*You are touching pause, the clocks, ring geometry, difficulty numbers, or
any event property.*

- **Pause is a FLAG, and the freeze is one line ABOVE `G.t+=dt`.** Both halves
  are load-bearing. It cannot be a `G.state`, because `draw()` dispatches on the
  state with the DEATH SCREEN as its final `else` — a `'paused'` state renders
  GAME OVER over a live run. And the return has to sit before the clock
  advances, because every deadline in the file is written against `G.t`: put it
  one line lower and the world freezes while its deadlines keep expiring. If you
  add anything that must keep moving while paused, drive it off the real frame
  delta the way the count-in does, never off `G.t`.
  **The hidden board and the cooldown are balance, not decoration.** Shards
  telegraph for 1–2.35s, so a visible frozen board makes pause a free look at a
  live warning; and without a re-pause cooldown, pause–resume–pause rebuilds
  that free look out of the count-in. Removing either is a difficulty change and
  should be argued as one. `smoke.mjs` mutation-tests both.
  **The pad is the trap here too** — see the `bedTick` entry below. Freezing
  `update()` stops its only writer, which does not silence the band, it freezes
  it at playing volume.
  **Anything measuring REAL elapsed time must read `performance.now()`, never
  `dt`.** `frame()` clamps `dt` to 0.05s so a stalled tab cannot fast-forward
  the simulation, and `requestAnimationFrame` does not fire at all while a tab
  is hidden — so a `dt` accumulator recorded a ten-minute paused break as 0.05
  seconds, which is the one measurement `paused_seconds` exists to make,
  reported as its opposite. The clamp is correct and is not the bug; using a
  simulation delta to measure wall time is. `smoke.mjs` advances its clock
  without running a frame, which is what a locked phone does.

- **Two ladders, two names.** `G.tier` is the thirteen-rung *unlock* ladder
  (what has been introduced); `G.level` is the 1–6 structure the player is told
  about. Everything player-facing — the HUD, the death headline, the pips, the
  share text, `FURTHEST YET` — uses `G.level`. Never call the tier ladder a
  level, in UI or in telemetry.

- **One name per thing, and the level's name is the level's.** The standing
  HUD line, the death screen subtitle and the share text all print
  `LV[G.level-1].name`; `tierLabel()` survives in telemetry only, as
  `tier_name`. This rule replaced a channel that kept manufacturing
  collisions: tier-ladder labels leaked into player-facing surfaces beside a
  level ordinal, so every level-4 run printed "LEVEL 4 · STORM" under a level
  the card had just named EVENT HORIZON, while level 3 was THE STORM — and the
  black hole's banner wore EVENT HORIZON, level 4's own name, as its eyebrow
  (it says NO ESCAPE now). Each collision — STORM, THE EYE, the eyebrow —
  was first answered with a rename, which spends a good name to keep a bad
  channel; the channel was the bug. A new surface that wants a name prints the
  level's own, and two different things never share one.

- **Telemetry: one name per ordinal.** `game_level` is the 1–6 level on every
  event; `tier` is the only name for the unlock ladder. Retire ambiguous
  property names rather than redefining them — a redefined property silently
  corrupts historical rows. The difficulty mode is `play_mode` on every event
  and deliberately not `mode`, which `swipe_mode_chosen` has always used for the
  swipe rule; that is the rule being applied, not an inconsistency to tidy up.

- **Ring index 0 is the OUTERMOST orbit.** `RAD_OFF` is `[1.0,0.76,0.545,0]`
  and `RAD_BH` is `[1.0,0.80,0.62,0.45]`: the index counts *inward*, so
  `G.ringI--` moves the comet AWAY from the centre and `ring===0` is the widest,
  safest lane. Two black hole mechanics shipped inverted on this and neither
  was catchable by reading: the gravity pull "dragging the comet inward" pushed
  it outward and then stopped at the rim forever, and the "inner ring 2× star"
  bonus paid on the outer ring — so the mode's two risk/reward systems both
  rewarded avoiding risk, while their comments described the opposite. When
  code and comment can both be read as true under different meanings of "ring
  0", write the geometry, not the index: say *nearest the centre*, use
  `G.nRings-1`, and assert on `radiusOf()` rather than on the ordinal.
  `smoke.mjs` now fails if the pull's direction flips.

- **Two clocks: `G.t` measures, `G.vt` shows.** `G.t` is real seconds and every
  deadline in the file is written against it (`G.invuln`, cooldowns, the audio
  scheduler), so it must never be dilated. `G.vt` is the same clock scaled by
  `G.tsCur` — the one the *visible* world rides: the backdrop, the camera
  dolly, ripples, popups, the trail, the particles, the hop. Slow motion used
  to reach the simulation and stop there, and the result was a mode running at
  0.42× behind a sky, a dolly and a debris field still at 1.0×, which reads to
  a player as not being slow at all. Adding a new animated layer means choosing
  one of these two on purpose. A deadline on `G.vt` will drift; an animation on
  `G.t` will contradict every slow-motion effect in the game.

- **Difficulty is measured PER RING, not per board.** The player stands on one
  orbit; what kills them is what arrives there. A board-wide count divided by
  nothing will read a mode that adds a fourth ring as harder when the same
  shard budget spread over four orbits is 0.75× the per-ring density of three.
  The black hole was reported at 1.18×/1.28× "effective pressure" on a
  board-wide metric and measures 0.82×/0.84× on a per-ring one, in the same
  build, on the same day. Quote the per-ring figure, say which metric any
  number came from, and be suspicious of a difficulty claim that improves the
  moment a ring is added.

## Audio and the arrangement

*You are touching PROG, PROGB, a voice, a kit, the pad, or any pitch in the
audio path.*

- **Silencing the scheduler is not silencing the band.** The pad is a bank of
  eight continuously running oscillators whose gain is written every frame by
  `bedTick`, which is its ONLY writer. A mode that stops `musicStep` from
  scheduling notes has not stopped the music — the pad sustains the level's
  progression straight through at full level. This was diagnosed once for the
  drop's hush, written up above `DROPQ`, and then repeated verbatim by the
  black hole, where it left 54% of the mix identical either side of an entry
  the pitch describes as the music "immediately cutting out". Any new mode that
  claims to replace the arrangement must have a branch in `bedTick`.

- **A MOMENT THAT MUST BE IMMEDIATE CANNOT BE A SECTION.** The section machinery
  changes only at a four-bar seam, which is the right rule for the chorus and
  the wrong one for anything a player triggers and expects to hear. The
  hypernova is the case: it is already in the hot-play set that lifts the
  record into the chorus, but the lift can only land at a seam, and a seam can
  be most of a loop away against a star that lasts four bars — so the payoff
  could arrive after the star had ended, or never. THE STAR RUN IS AN OVERLAY
  instead: a voice added above whatever harmony is already playing, starting on
  the frame the orb is taken. That is what makes it immediate, and it is also
  why it cannot collide with the chorus, the payoff or the black hole — it owns
  no table. Reach for an overlay whenever the answer to "when will the player
  hear this?" has to be "now"; reach for a section only when it can wait.

- **Audio is optional everywhere.** The game must be completable with no
  WebAudio at all. Every audio path is guarded; keep it that way.

- **The sub register turns around at 40Hz.** `subF()` octave-doubles any sub
  voice below 40Hz — the drop's boom, the payoff floor, the braam, the black
  hole's swallow, the layer-three drone all pass through it, and any new sub
  voice must. Bought with the six-key descent: the whole-tone walk down had
  pushed the drop's boom to 23–26Hz on levels 5 and 6, below what any phone
  speaker reproduces, so the game's biggest hits were inaudible on the levels
  that lean on them hardest. The pitch CLASS keeps descending, which is what
  the ear tracks; only the sounding register folds back up. And the interval
  rule above is now actually true of the in-run reward cues: the orbit payout
  arpeggio, the score milestone, the shield save and pickup, the ring unlock
  and the level-start chime are written `CH[0][0]*(old/110)` — an interval
  over the level's tonic, bit-identical on level 1 where the tonic IS the old
  literal — where they used to be absolute A-minor/C-major pitches, chromatic
  on most levels. `musiccheck.mjs` tracks the 40Hz floor; never write a bare
  frequency into a cue.

- **Every chord is diatonic to its level's natural minor, and every pitch is
  written as an interval over the level's tonic.** These are one rule seen from
  two sides. The SFX pentatonic is scaled into each level's key and every sound
  in the game speaks through it, so a chord borrowed from outside the mode —
  a major dominant being the obvious temptation — puts the entire effects layer
  a semitone out against the band. And an absolute pitch is a chord from
  outside the mode on five levels out of six: the beat drop, the snare body
  and the tom fill were each hardcoded to A-minor pitches and each rang wrong
  everywhere else, unnoticed for as long as the levels differed only by
  transposition. Never write a bare frequency into the audio path. `PROG` and
  `musiccheck.mjs` are where both halves are enforced.
  **The song is two sections per level now, and the chorus obeys four extra
  laws.** `PROGB` is the chorus table, `CHOFF` its per-level walk rotation,
  `SEVB` its color tones; `applySect` is the ONLY writer of the live `CH`/`ARP`
  tables and `chI()` the only translator from bar ordinal to chord. (1) Chord
  0 of every row in BOTH tables is the i chord: `CH[0][0]` is read as "the
  level's tonic" by ~25 call sites at arbitrary moments in either section, so
  a chorus opens off-tonic only through the rotation, never by reordering a
  row. (2) Sections change only at a four-bar seam, never inside a payoff,
  rise, black hole or star dive, and a level's first eight bars are always
  the verse. (3) The chorus's harmonic color lives in `SEVB` (stacked-third
  sevenths: m7 on minor chords, maj7 on III/VI, the dominant-shaped m7 on
  VII — the stacked third decides, never a hand-picked quality); the arps stay
  plain pentatonic under degree 4, the band's ceiling below the player's
  register. (4) The chorus lean never doubles a drum already playing: the
  sky bands FLOOR at `G.level-1`, so level 4 always rides band 3's beat-4
  snare and level 3 band 2's open offbeat hat, and the first lean stacked
  its "arriving" backbeat and open hat straight onto both — each addition
  yields wherever its slot already has that tenant (`skyI`/`rs` gates). All
  four are enforced in `musiccheck.mjs`, including walk ORDER (the L2
  chorus is the verse's chords walked the other way — invisible to any
  pitch-set comparison), the seam glides, the star dive's first-bar revert
  reaching the oscillators, `chorus_bars` holding through black hole and
  payoff, and a doubled-snare-body tripwire run at each level's sky floor.

## Graphics, shaders and the sky

*You are touching a draw pass, a shader, a uniform, the glow chain or the
render scale.*

- **A halo belongs to an object; a backdrop belongs to nobody.** These are
  tuned by opposite rules and the constants do not transfer. The sky's
  gravitational lens bounds its pull as a FRACTION of the radius, which is
  right for a smooth field where nothing has to stay anywhere. Copied onto the
  arena's glow it is a catastrophe: the orbits live between 0.09 and 0.20 of
  screen height, the clamp binds across that whole band, and the halo is
  dragged 120-170px off the light it belongs to — the detached-glow failure
  recorded at length in `check.mjs`'s free-radius guard, when an ember's bloom
  stayed parked on the ring it started from. Anything applied to light that is
  attached to an object must be bounded in ABSOLUTE terms and the bound quoted
  in pixels.
  This was caught by measurement, not by reading: the code was a faithful copy
  of a shipped, correct lens, and it looked right in review.

- **A HALO MUST BE COMPOSITED IN THE SAME TRANSFORM ITS SOURCE WAS DRAWN IN,
  and "the same transform" is a thing to check rather than assume.** This is
  the entry above's failure one level worse: there the halo's displacement
  *bound* was wrong, which a better constant fixes; here the halo was in the
  wrong coordinate *space*, which no constant can fix.
  `drawBloom`'s bright pass draws every light with `setTransform(s,0,0,s,0,0)`
  — a pure scale, no camera dolly. The composite that lays the finished glow
  back down ran INSIDE the world pass, which is wrapped in
  `ctx.translate(camX,camY)`. So the whole glow layer sat offset from the
  lights it was made of by exactly the dolly, every frame, oscillating on a
  sine. Two player-visible defects out of that one mismatch, both reported in
  the same sentence — *"it's like you put a layer over the screen ...
  everything just kind of wobbles around"*: every halo drifted off its own
  light and back forever, and the full-screen layer hung past the frame
  boundary so `drawImage`'s upscale clamped and smeared the outermost texel
  into a hairline rim. Measured on the 2D layer alone, left device columns
  0/1/2 against an interior of 3.6: 5.0/4.4/3.5 before, 3.5/3.5/3.5 after.
  **Nothing in the suite could ever have seen this.** The harnesses stub the
  canvas, so a `drawImage` at the wrong translate is indistinguishable from
  one at the right translate — `drawcheck.mjs` counts the call and validates
  its arguments, and both versions are valid on every count. It needed a
  screenshot. If you add a full-screen composite, state which transform its
  source used and put the composite in that one.

- **A SCREEN-SPACE WARP IS INVERSE SAMPLING, so its sign is the opposite of
  what it looks like.** The shader is handed a destination fragment and asked
  which part of the source to read, so reading from a SMALLER radius
  magnifies and pushes content OUTWARD. The glow's black hole lens shipped
  subtracting its pull, at the right magnitude, under a comment promising the
  opposite — halos moved 6.8 to 8.8px away from the singularity. **This is the
  third time this precise inversion has hit the black hole**: the gravity pull
  that "dragged the comet inward" pushed it outward, the "inner ring 2x" bonus
  paid on the outer ring, and now this. The pattern is always the same — code
  and comment are each true under a different reading of which way the number
  counts, so review confirms both. Nothing catches it except asking where a
  specific thing ENDS UP, in pixels, which `fxcheck.mjs` now does by parsing
  the coefficients out of the shader rather than copying them.

- **THE SKY CAN NEVER GO BLACK, and the set of skies is CLOSED.** The nebula's
  coverage gate rides a single sample of a noise field — the screen spans a
  quarter of one coverage cell — and the drift clock (G.vt) never resets. As a
  straight line, the drift walked into barren stretches where the gate zeroed
  the ENTIRE nebula for 10+ minutes while the stars stayed alive, which reads
  as the game being broken, not as weather. It shipped that way from the
  shader's first day and was found from two same-build screenshots hours
  apart: one vivid, one black. Two rules now hold. The drift is an ELLIPSE, so
  one lap (~14 minutes at the current `GL_MOTION` of 0.72) is every drift the game can
  ever show, and a closed set can be verified end to end. The gate is FLOORED
  (`0.10 + 0.90*smoothstep`), so a barren stretch reads quiet, never black.
  **These two numbers were wrong here for two commits** — this entry quoted the
  retired `0.42 + 0.58` floor and a ~95-minute lap, both superseded when the
  orbit's territory was re-chosen to match the historical look. `README.md`
  carried the same pair. That is the exact failure the curriculum entry above
  warns about: a constraint that disagrees with its own enforcement costs more
  than a missing one, because it makes the careful reader wrong.

  **THE CLOSED SET IS NOW A PRODUCT, AND THE WORLD TABLE IS WHY IT IS STILL
  CLOSED.** "One lap is every sky" was true when there was one structure.
  There are eight now — `WORLDS` — and the reachable set is (drift orbit) x
  (adjacent world pair). It stays finite and sweepable because of three
  properties, and all three are enforced in `fxcheck.mjs` rather than trusted:
  every row's four structure weights SUM TO 1, so a world is a blend and never
  a gain, and a lerp between two such rows still sums to 1; `cov` is a mix
  factor in 0..1 and the gate enters as `mix(1.0, gate, cov)`, which can only
  ever RAISE the never-black floor and never lower it; and the exponents are
  >= 1, because `pow(0.0, 0.0)` is undefined in GLSL ES and both of those
  bases reach 0. `fxcheck.mjs` sweeps all eight worlds AND three points along
  each morph between neighbours over the full drift orbit — the midpoint alone
  was not enough, because the first cut of this found a transition measuring
  0.238 mean against 0.166 and 0.164 at its two ends: **a blend of two safe
  worlds is not automatically a safe world.**

  `fxcheck.mjs` carries a line-for-line port of the nebula chain, parses the
  orbit, gate, structure-blend and spin constants out of the shader source,
  reads `WORLDS` out of `index.html` rather than copying it, and pins both
  directions of the luminance band — and its fake GL asserts every uniform
  component is FINITE, because a NaN reaching a uniform renders as black on a
  real GPU and throws nowhere. **DRIFT is the anchor and is held to the
  historical numbers to four decimals** (0.1490 mean, 0.0374 darkest, against
  the measured 0.149/0.038 of the sky that shipped); the other seven are held
  only to "does not black out, does not flood, does not stop resting", because
  a world brighter or fuller than DRIFT is a world rather than a regression.
  If you retune the sky, the port retunes with you; if you restructure the
  chain, update the port in the same commit or the parse tripwires fail loudly.

- **THE RED BAN IS LIFTED, AND WHAT REPLACED IT IS NARROWER RATHER THAN
  ABSENT.** The sky was kept out of the red family and under the opening
  band's luminance so it could never compete with a shard for the word
  "danger". The owner lifted both, deliberately and against a stated risk, so
  that worlds like EMBERFALL could exist and the backdrop could stop being
  four recolours of one picture. The contract is now held where it is actually
  read: `SKY_ARENA_CALM` (currently **0.10**, was 0.34) compresses local contrast in the annulus the orbits
  occupy (0.09–0.20 of screen height), so a hot sky burns at the rim while the
  band a shard is read against stays quiet. **Hue is free everywhere;
  brightness and contrast directly behind the rings are not.** If a playtest
  ever reports mistaking backdrop for hazard, that dial is the first thing to
  move and 0 gives the unmoderated sky — do not reintroduce a hue ban without
  asking, it was a decision and not an oversight.

- **A SCREEN-SPACE ROTATION IS THE SAME TRAP AS A SCREEN-SPACE WARP.** The
  orbit spin turns the sky by rotating the SAMPLE coordinate, so its sign is
  the opposite of its intent, exactly like the lens below. It is stated in the
  code as a sentence about where a thing ends up — "a feature drawn at uv
  angle A appears at angle A + uOrb.y" — and `fxcheck.mjs` asserts that
  sentence numerically by running the parsed transform, because this precise
  inversion has shipped backwards three times in this file. The second frame
  conversion beside it is just as easy to get wrong and just as invisible:
  `uOrb2.x/.y` carry the comet's angle and direction from the game's y-DOWN
  frame into the shader's y-UP one, and inverting that pair lights the half of
  the sky the comet has NOT swept — which animates convincingly and teaches
  the player the opposite of the mechanic. Also asserted, the same way.
  **Anything new that rotates, sweeps or sweeps-behind gets the same
  treatment: follow one point through both frames and assert where it lands.**

- **The GL path has its own harness, and the 2D path still has none.**
  `fxcheck.mjs` covers the shader specifically — use it and extend it. The
  other harnesses stub the canvas, so the 2D render path is uncovered by
  construction. That is a fact about the tooling, not a rule about what you may
  ship.
  The failures behind it are kept because the SHAPES recur: the black hole once
  carried thirteen documented visual and audio features of which a playtester
  could perceive one, each individually correct at its own site and disabled by
  something elsewhere. The arena-scale art was gated on WebGL having *failed*;
  the shader's lens inverted the UV field so its own gravity well darkened
  nothing; `pow(x,2.0)` with `x` negative is undefined in GLSL ES and that is
  half of every gaussian ring; particles integrated on raw `dt` inside slow
  motion. Those are worth recognising again. Whether to measure before shipping
  is a judgement call, not a gate.

## Delivery

*You are touching the deploy, the build stamp or the freshness check.*

- **THE PLAY LINK IS A CONTRACT: the plain URL serves the newest build.**
  GitHub Pages caches `index.html` for ten minutes and its CDN keys on the
  exact URL, so on a multi-release day the front door hands back stale copies
  — which turned a full day of "it's fixed, go look" into arguments, because
  the tester was replaying the previous build through the button that had
  always been trustworthy. The page checks its own freshness at boot
  (`freshCheck`): it fetches its first bytes past the CDN, reads the BUILD
  stamp, and swaps a stale title screen to the newer build — once. The guards
  ARE the feature: never from a live run, never a second hop from a `?u=`
  URL, and every failure is silence. `smoke.mjs` asserts all of it; the
  deploy workflow stamps `BUILD` with the commit sha, and the title screen
  shows it, so a screenshot proves which build it came from.
