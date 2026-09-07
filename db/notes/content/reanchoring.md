# Re-anchoring the content records when the runtime moves

*What this answers: the content records were first written against commit
`8d10559` and the repository moved to `01a3a25` underneath them. This is what
changed, what it did to the anchors, and the mechanical way to move a whole
part file's line numbers onto a new commit without re-reading the file by eye.*

## What happened

`db/INDEX.md` records the commit a build was made from. This database was built
from `8d10559`, where `src/game/runtime.js` is 12,272 lines. Three commits then
landed — `f13d7c6` (restore living procedural scenery), `dd9bbaa` (worlds
respond to flight without flashing), `01a3a25` (check star draw positions) —
and the file is 12,335 lines. Net +63, but the shift is **not uniform**: content
was removed above line 325 and added between 3,000 and 11,000, so the offset a
given anchor needs is anywhere from −11 to +127.

| landmark | at `8d10559` | at `01a3a25` | shift |
|---|---|---|---|
| `RINGS` | 210 | 210 | 0 |
| `WORLDS` | 276 | 265 | −11 |
| `LEVEL_HOME` | 336 | 325 | −11 |
| `const LV` | 3008 | 3042 | +34 |
| `dl()` | 4409 | 4435 | +26 |
| `const TIERS` | 4626 | 4652 | +26 |
| `const MEET` | 5472 | 5506 | +34 |
| `spawnSpike` | 5635 | 5669 | +34 |
| `startGame` | 6122 | 6122 | 0 |
| the finale latch | 7897 | 7929 | +32 |
| the tier crossing | 8181 | 8181 | 0 |
| the funnel draw | 10792 | 10919 | +127 |
| the level card | 11884 | 11942 | +58 |

`node db/build.mjs` only rejects an anchor that points **past the end of** the
file it names. Every one of these shifts is silently valid: the record still
builds, and it sends the reader to the wrong place in a twelve-thousand-line
file, which the README correctly calls worse than sending them nowhere.

## The two content changes that were not just movement

1. **`BLINKERS` → `SHUTTERS`, `FLICKER PAIRS` → `SHUTTER PAIRS`**, with both
   lessons rewritten and the draw changed from opacity to geometry. The type
   keys `blink` and `blinktwin` did not change. See
   [prose-vs-source](prose-vs-source.md) §10 for the followers that were left
   behind, including a `curriculum.mjs` assertion that now silently skips two
   rungs.
2. **`flashHit(0.6)` left `levelComplete()`**, which is why that function is
   3626–3669 rather than 3626–3670. Part of the same effects audit.

Nothing in `LV`, `SHAPE_RANK`, `POWPOOL`, `LEVEL_HOME` or any tier `at` value
changed. Every dl window, every threshold and every tuned constant these records
carry survived the move unaltered — which is the thing worth knowing, because it
means the re-anchor was purely mechanical.

## How to do it mechanically

Do not re-read the file and guess offsets. Take each old anchor's exact text out
of the old blob and find it in the new one:

```js
const O = execSync(`git show ${OLD}:${path}`).toString()
            .replace(/\r\n/g, '\n').split('\n');          // git blobs are LF
const N = readFileSync(path, 'utf8')
            .replace(/\r\n/g, '\n').split('\n');          // the worktree is CRLF
const block = O.slice(a - 1, b);                          // the old anchor's lines
// scan N for the unique occurrence of `block`; report 0 hits and >1 hits
```

Three outcomes and what each means:

- **exactly one hit** — the anchor moved; rewrite the numbers. This covered 66
  of the 73 line citations across the five content notes.
- **no hit** — the anchored text itself changed. Read it. This is how the
  SHUTTERS rename and the `levelComplete` edit were found; a pure offset patch
  would have moved those anchors onto text that no longer says what the record
  claims.
- **more than one hit** — the anchor was a single line of boilerplate
  (`firstMeet(type);`, `const gw=G.seen[type]?{}:{warn:warnTime()*1.6};`).
  Widen it to a block that includes its branch and re-run, or anchor the
  enclosing range instead. A one-line anchor on a repeated line was already a
  weak anchor before the file moved.

The same block-match run over the record file's `anchors` arrays produces the
whole remap in one pass, and its failures are exactly the records that need a
human read.

## The rule this argues for

**Anchor a range that contains something unique**, not a bare line number. A
range whose first and last lines are distinctive survives a diff and relocates
itself; a lone line number pointing at `firstMeet(type);` does not, and neither
the build nor the reader can tell that it has stopped meaning anything.

And check `db/INDEX.md`'s commit against `git rev-parse --short HEAD` before
trusting any line number in this database. `node db/build.mjs --verify` says the
same thing more loudly — it fingerprints the sources and fails when they move.
