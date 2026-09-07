# The orbs that were cut, and why

*What this answers: which power-ups Cosmo used to ship, what killed each one,
and what their removal did to the spawn odds — so nobody re-proposes them.*

Four names appear in the design record but not in `LAB_ORBS`. Two more survive
only as banned teaching keys.

## SPOTLIGHT → redesigned into MAGNET

Not removed: **replaced in place**. The owner found the stage metaphor
confusing and the reward uninteresting. Its internal id, guarantee flag, glow
envelope and upgrade id are all still called `spot`, `spotPlaced`, `spotGlow`
and `stagelight` (`src/game/runtime.js:8626` states why: save compatibility).
`docs/design/powerups.md:243-278` keeps the retired implementation on the record
— a review found its active state changed **zero arena pixels** for nine to
fourteen seconds: the whole inventory was an audio mix move plus a text chip
that only drew on tall viewports, and the one universal effect (stars paying
double) printed the *undoubled* number in its popup.

Its art is still shipped. `public/art/sprites/power-spotlight.webp` is in the
manifest and `BootScene` loads it, but nothing in `runtime.js` reads the key —
`docs/art/catalog.json` marks it "Retired Spotlight art; not the current Magnet.
Do not map to runtime spot."

## THE BASS BOMB

Owner's call after a full review of the seven orbs. Its named identity — "drops
the low end" — lived entirely in the audio channel, and its visual tell (a
subwoofer cone slamming on the beat) rode `G.beat`, which only moves when the
audio scheduler feeds it. With the sound off the sprite sat motionless and the
pickup was a cyan flash; what remained was strictly a weaker nova — the same
`novaConvert` pipeline over a ±60° wedge instead of the whole board, with no
invulnerability, at the same odds. Its clear region was never drawn, so the
`LONG FUSE` upgrade widened an invisible number. `LONG FUSE` went with it.

## THE MAGNETAR

Died twice proving that a first-order chase never arrives on a circular board.
It is the reason THE MIRROR derives its angle (`G.angle + Math.PI`) rather than
integrating one. It is also the reason `tools/check.mjs:108-135` forbids any
second radius on an ember or an orb: the magnetar gave embers a free radius in
`s.pr` so they could curve between rings, the bloom pass never read it, and
sixteen glows sat detached from their embers by up to 89 px on a 390 px screen.

## Redistribution: removal changes *what* can appear, never the ratios

Both cuts followed the same rule, and it is stated twice in `spawnPow`'s
comments (`src/game/runtime.js:6027-6045`): the removed orb's share is spread
**proportionally** across the survivors, so the survivors keep their ratios
exactly. The magnetar's 0.11 and the bass bomb's 0.15 both went that way. The
additions ran the rule in reverse — the five existing orbs kept
`.36/.22/.17/.16/.09` of the old space (0.302, 0.185, 0.143, 0.134, 0.076) and
the mirror and scorch took a flat 0.16 between them off the top.

SLIPSTREAM and STAR TRAIL did **not** follow that rule: they were appended at
0.095 each, taking the table's total to 1.190 rather than renormalising it. The
runtime divides by `ptot` anyway, so the effect is a proportional dilution of
all seven older orbs — the same outcome the rule describes, arrived at by a
different arithmetic. The comment at `src/game/runtime.js:6040-6045` still
describes the seven-orb table.

## ECHO and METEOR — banned teaching keys, not banned strings

`docs/design/powerups.md` says ECHO "is a banned string that fails the build".
The actual guard (`tools/check.mjs:67-71`) is narrower:

```js
for (const dead of ['echo', 'meteor']) {
  if (new RegExp(`(MEET\\s*=|teachSoft\\s*=)[^;]*'${dead}'`).test(src)) …
}
```

It only fails when the **teaching data** references the cut orb id — a `MEET`
table or a `teachSoft` assignment naming `'echo'` or `'meteor'`. The word may
appear anywhere else in the file, and does (`echo` in prose, `Meteors` as a sky
event in `MECHANICS.md:515`). `meteor` is a second cut orb whose name survives
nowhere else in the design record.
