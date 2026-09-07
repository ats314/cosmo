# Teaching: the four channels and the guards that keep them from colliding

**What this answers:** how a mechanic gets explained in `src/game/runtime.js`,
what "spending" a lesson means, and every condition under which a lesson is
deferred rather than shown.

## The four channels, in the order a player meets them

1. **The level card** — `LV[].mech` (3008–3080), two or three rows, drawn by
   `drawHUD`'s `lvend` branch. Says what the level *is*, never what it will
   contain; level 1 is three rows and levels 2–6 are two. Checked against
   `docs/MECHANICS.md` by hand.
2. **The tier banner** — `TIERS[].name` / `.sub` / `.subFn` (4626–4715), fired by
   the ratchet in `update()` (8163–8207). Announces a rung the moment it lands.
3. **The first-encounter lesson** — `MEET` (5438) via `firstMeet(type)` (5560).
   Once per device, persisted in `cometloop:seen`.
4. **The death coach** — `G.coach`, set in `die()` (6367–6379), which reads the
   same `MEET` row word for word.

The doctrine, stated at 5427–5437: **one sentence per idea, and the same one
every time.** Each `MEET` entry is word-for-word the `sub` on its tier banner;
three paraphrases of one rule read as three rules. Changing one means changing
both.

## `firstMeet(type)` — every deferral, in source order

A deferral leaves `G.seen[type]` unset, so the *next* encounter of the same type
offers the lesson again. That distinction is the whole design: a lesson is either
shown or re-offered, never silently spent.

| Guard | Line | Why |
|---|---|---|
| `G.intro` | 5561 | the first-flight tutorial owns the screen |
| already `seen`, or no `MEET` row | 5562 | once per device |
| `LAB.on` | 5571 | the lab shows one orb dozens of times; the first would permanently retire the lesson the real game gives you |
| `G.t < G.meetNext` | 5582 | 9 s minimum spacing between lessons |
| a hop rehearsal is running | 5586 | overwriting `teachKind` mid-rehearsal stranded both the radial guide and its 8 s window |
| a banner younger than 2.4 s | 5587 | a lesson behind a banner is spent without being read |
| `G.landFx \|\| G.secFx` | 5588 | the centre slot is taken |
| `bhActive()` | 5598 | the mode owns the centre slot and already runs at 0.42× |
| soft and `!G.seen.single` | 5606 | reward lessons yield to the one about the thing that kills. Measured on a fresh device: combo fired at 5.4 s, music 14.4 s, orbit 24.7 s, lapcost 33.9 s, and the red shard's lesson at 44.3 s |
| hard, and a timed reward is live | 5610–5613 | a hard lesson freezes the world; 2.8 frozen seconds would burn a third of a hypernova |
| hard, and a lethal shard is armed within 1.2 rad on the player's ring | 5615–5617 | never slow-motion someone mid-danger |

`soft` is `MEET[type].soft || G.seen2[type]` (5601) — reward orbs are soft by
table flag, and a **re-offer** after a death is always soft, so a veteran is
never slow-motioned twice.

On success: `G.meetNext = G.t + 9`, `G.seen[type] = 1`, persisted, `G.teach =
max(G.teach, 2.8)`, `G.teachKind = 'see'`, `G.teachSoft = soft`, `cueLesson()`.

`G.teach` then drives `sdt`'s dilation (8127–8128): a `'see'` lesson runs the
world at 0.06× under a dim veil with the specimen spotlit (`sp.spot`), while the
hop rehearsal keeps 0.35× because it needs a world moving enough to practise
against.

## The lab neither spends nor re-arms a lesson

Three separate guards, and the file records that finding two of them looked like
the whole job:

- `firstMeet` returns early on `LAB.on` (5571) — the sentence.
- the orb pickup path guards the shortcut where *taking* an orb counts as having
  been taught it (8548–8551).
- `die()` guards the re-offer, so a sandbox death cannot burn a shape's one
  `seen2` re-arm (6386–6390).

`hop()` has the same shape for the lifetime hop flag: `everHopped` gates the
once-ever first-hop rehearsal, so a fresh player who opened the lab first must
not spend it there (6935–6942).

## The exam waits for the lesson

`tierIndex()` (4744) holds the ladder at SECOND RING until the first landed hop,
because TWIN is the tier that makes the hop compulsory. The release valve is 30
difficulty-seconds (`d - G.holdD >= 30`), after which `G.holdTimeout` is set —
the purest "the hop lesson did not land" signal telemetry has. Level 2+ and the
lab are exempt. The clamp lives in `tierIndex` and not in the ratchet, so
`pickType` and the banner can never disagree about the tier.

## The tier ratchet's own deferrals

`update()` 8163–8166 refuses to advance `G.tier` while: the finale is on or
pending, a banner is live, a black hole is active, a hard lesson is freezing the
world, or the run is inside a level's last 10 difficulty-seconds. Each was a
screenshotted collision — "UNLOCKED / THE SAUCER" printed across the singularity,
"FLICKER PAIRS" firing 1.0 s into the black hole lesson's veil, THE STORM
announced over level 2's graduation. The crossing a window swallows is owned by
the next level's silent pre-climb in `startGame` (6272–6280).

## Recording

`flushLesson(cut)` (6878) writes the `lesson_shown` telemetry event when a lesson
*ends* — by running its course, or cut short by a death (`die`, 6316) or a finish
line (`levelComplete`, 3594). Without the cut flush, exactly the lessons
interrupted by the death they should explain vanished from the funnel. It also
clears `sp.spot` on every shard so a later lesson cannot inherit a previous
specimen's gold ring.
