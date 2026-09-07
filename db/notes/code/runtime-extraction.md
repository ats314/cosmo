# How the harnesses get the runtime body

*What this answers: what `tools/lib/game-source.mjs` extracts, what the two
markers guarantee, why the output is padded with blank lines, and what breaks if
you move them.*

Eight harnesses need to run the game without a browser or without Phaser. None of
them holds a copy of it. `tools/lib/game-source.mjs` cuts the canonical body out
of `src/game/runtime.js` at build-free read time.

## The markers

```
src/game/runtime.js:6    export function createCosmoRuntime(host={}){
src/game/runtime.js:7    // @runtime-body:start
…
src/game/runtime.js:12265 // @runtime-body:end
src/game/runtime.js:12266   return { step:runtimeStep, render:runtimeRender, … };
```

`loadGameSource()` (game-source.mjs:9-25) refuses to proceed unless there is
**exactly one ordered pair**: it checks `indexOf(start, a+1) < 0` and
`indexOf(end, b+1) < 0`. A second marker of either kind, or an end before a
start, throws `runtime.js needs exactly one ordered pair of runtime-body
markers`. An empty body throws too.

Everything between the markers is the body; the `return {…}` object literal after
the end marker is *not* included, which is why the harnesses drive the runtime
through its lexical globals (`G`, `MU`, `pointerDown`, `musicTick`) rather than
through the returned interface.

## The host stub, and the line padding

The extracted body is prefixed with:

```js
'const host = {};' + '\n'.repeat(prefixLines) + <body>
```

Two things follow.

**The legacy path turns on.** `host` is an empty object, so `runtimeHost` is
empty, so `externalLoop` and `externalLifecycle` are both falsy and the runtime
installs its own rAF loop, canvas listeners, window resize listener and
visibilitychange listener. That is deliberate: `smoke`, `dropcheck`,
`curriculum`, `musiccheck`, `fxcheck` and `rendercheck` drive the game *through
its real handlers*, by firing the listeners it registered. See
`db/notes/code/double-loop.md` for the production side of the same switch.

**Stack lines stay honest.** `prefixLines` counts the newlines up to and
including the start-marker line, so the emitted body's line *N* is
`src/game/runtime.js` line *N* for every N from 8 to the end marker. Verified in
this session: line 8 of the generated body is the `Runtime host ownership is
explicit` comment, exactly as in the file. `tools/drawcheck.mjs` depends on this
— it names its VM script `src/game/runtime.js` (drawcheck.mjs:237) and reports
violations by matching `src/game/runtime\.js:(\d+)` out of the stack
(drawcheck.mjs:57-61). Change the padding and every drawcheck diagnostic points
at the wrong line in a 12,000-line file.

The `lineOffset: 0` field the loader returns is a leftover of that design; no
caller reads it.

## The second entry point

`loadGameHtml()` (game-source.mjs:27-36) assembles a self-contained document:
`index.html` with **every** `<script>` stripped, `src/styles.css` inlined into
`<head>`, and the extracted body inlined as one `<script>` before `</body>`. Six
harnesses use it. `tools/check.mjs` then asserts the result contains exactly one
script block that parses (check.mjs:12-21) and that every `getElementById` id the
body looks up exists in the markup (check.mjs:36-43) — a derived list, so `#bg`,
`#c` and `#safe` cannot be renamed out from under the runtime silently.

`tools/enginecheck.mjs` is the only harness that does not use this file at all.
It loads the real Vite `dist` build through `vite preview`, which is what makes
it the only check that sees the Phaser host.
