# The scheduler: one clock, a lookahead, and four queues

*What this answers: how notes stay sample-accurate across frame stalls, what
the grid is, how player inputs and game replies get quantised onto it, and how
the audible timestamp drives the picture.*

## The grid

`runtime.js:858` — `const BPM=104, SPB=60/BPM, STEPS=32;`

- `SPB` = 0.5769230769 s per beat (quarter).
- The scheduler counts in **eighths**: `MU.step` runs 0..31, i.e. four bars of
  four beats. One eighth is `SPB/2` = 0.2884615 s.
- `S16 = SPB/4` = 0.1442307 s — the sixteenth, the quantise grid
  (`runtime.js:905`).
- `PAY = 32` eighths = 8 bars; `PAYLEN = PAY*(SPB/2)` = 9.2307 s;
  `PAYREST = 0`.
- Tempo never changes, on any level, in any mode. The black hole runs at half
  time *on the same grid* by consuming two scheduler steps per musical eighth
  (`bhStep`'s `if(fs&1)return;`).

## The lookahead

`musicTick` (`runtime.js:2673-2694`), called at the end of `bedTick`, which
`update()` calls unconditionally every frame:

```js
if (!A||!AC||!MU||!BED||AC.state!=='running') return;
if (G.state!=='playing') { ...endSection()...; MU.next=0; return; }
const now = AC.currentTime;
if (!MU.next || MU.next < now-0.4) { endSection(); MU.next=now+0.06; MU.step=0; MU.chord=-1; }
const k = Math.min(1, dl()/150);
let guard=0;
while (MU.next < now+0.16 && guard++<16) {
  musicStep(MU.step, MU.next, k);
  MU.step = (MU.step+1)%STEPS;
  MU.next += SPB/2;
}
```

Three properties matter and all three are load-bearing:

1. **Everything is scheduled against `AC.currentTime`**, never `performance.now()`.
   A frame stall delays *when the schedule is extended*, not *when the notes
   sound*. Notes already written keep their timestamps.
2. **A stall longer than 0.4 s resyncs rather than flushing.** `MU.next` falling
   more than 0.4 s behind ends the section, restarts on a fresh grid line and
   resets `MU.step` to 0. A backgrounded tab returning after five seconds does
   not fire its whole backlog as one chord. This is the same path a pause takes:
   `pauseAudio()` is deliberately a copy of the `visibilitychange` handler.
3. **`guard++<16` bounds the worst case.** At most 16 eighths (4.6 s of music)
   can be written in one call.

`k` — the intensity term every layer gate reads — is `dl()/150` clamped to 1,
where `dl()` is the difficulty clock. `bedTick`'s own `k` uses `dl()/170`, a
different divisor for the pad's cutoff.

## `musicStep`: the dispatcher

`runtime.js:1623-2176`. Order of business, and the order is the contract:

1. **Section evaluation**, only at `i===0`, only when nothing else owns the
   harmony, and only from bar 8 onward.
2. **The pad retune**, above every `return` — so the pad keeps tracking the
   progression while ducked, through the whole payoff, and through a black
   hole, and comes back *in tune* rather than glissing into place.
   `MU.chord` tracks the **bar ordinal**, not the pitch.
3. `MU.barN++` on `beat===0`.
4. **Handoffs, each of which returns:** black hole → `bhStep`; live payoff →
   `payoffStep`; armed drop → `fireDrop` + `payoffStep`; star dive → `finStep`;
   drum break → `breakStep`.
5. `G.chorusBars++` sits *below* every handoff, so telemetry counts bars the
   chorus arrangement actually owns.
6. The ordinary arrangement: sparse (`!driving`) or full.

## Quantising the player: `gridNear`

`runtime.js:2445-2461`. Returns the **nearest** sixteenth grid point, which may
sit slightly in the past; the caller clamps.

Snapping forward only would cost up to a full slot (144 ms), past the point
where a sound stops feeling attached to the tap. Nearest halves the worst case
to 72 ms.

The subtlety: it returns the grid point *itself*, not a clamped `now+0.012`.
Returning the clamp made every front-half tap a unique timestamp, so
`performerHit`'s one-note-per-slot dedupe (`Math.abs(slot-PLAY.slot)<1e-4`)
compared fresh numbers and never fired — held-Space auto-repeat stacked three
or four notes into a single sixteenth.

## Quantising the game's replies: `cueTone`

`runtime.js:2465-2476`. Every scored event keeps its instant transient (touch is
felt immediately, so nothing reads as lag) and hands its **tonal payload** to
`cueTone`, which places it on the sixteenth grid:

```js
let t = Math.max(gridNear(), now+0.012);
if (CUE.slot >= t-1e-4 && CUE.slot-now < SPB) t = CUE.slot + S16;
CUE.slot = t;
fn(t-now);                       // callback receives a DELAY, not a timestamp
```

One voice per slot; a taken slot cascades to the next sixteenth, capped a beat
out so a burst compresses rather than drifting away from its cause. A string of
embers therefore comes out as an actual sixteenth-note run. If there is no
context or the scheduler is not running, `fn(0)` fires immediately — the cue is
never lost, only un-quantised.

## The four queues

| Queue | Filled by | Drained by | Purpose |
|---|---|---|---|
| `BEATQ` | `musicStep` (`beat%2===0`), `payoffStep`, `bhStep`, `finStep` | `bedTick` | the visual quarter pulse — the sky follows the **audible** strike |
| `DROPQ` | `fireDrop` | `bedTick` | Starfall's visual release waits for the audible downbeat |
| `LOOPQ` | **nobody** | `bedTick` (`LOOPQ.length=0` every frame) | retired recorder; inert |
| `CUE.slot` | `cueTone` | — | not a queue, a single high-water mark |

`BEATQ` is capped: `if (BEATQ.length>32) BEATQ.length=0;` — a stall must not
bank a burst. Both `BEATQ` and `DROPQ` are cleared outright on pause,
backgrounding and death.

`DROPQ` is the interesting one. `fireDrop` pushes the exact audio timestamp of
the impact, and `bedTick` calls `startStarfall()` when the clock reaches it —
so the screen flash, the ring expansion and the gameplay reward all land on the
sound, not on the scheduling call that preceded it by up to 160 ms.

## Timing judgement: `gridOff` and its anchor

`runtime.js:2522-2532`. Signed offset from a grid line: negative early, positive
late. It walks the anchor both down *and* up, because a stalled tick can leave
the anchor behind `now`.

The anchor is the trap. `MU.next` is the next unscheduled **eighth**, so it lies
on the sixteenth grid always but on the quarter grid only when `MU.step` is
even. `judgeTiming` therefore hands in a corrected anchor:

```js
const off4 = gridOff(SPB, MU.next + ((MU.step%2) ? SPB/2 : 0));
const off16 = gridOff(SPB/4);
```

Anchored wrong, the judged beat lands on the offbeat whenever the scheduler head
has odd parity. `musiccheck` catches it.
