# The runtime, region by region

**What this answers:** where in `src/game/runtime.js` (12,272 lines) any given
subsystem lives, so an agent can `sed -n 'A,Bp'` the right slice instead of
reading or grepping the whole file.

The file is one function, `createCosmoRuntime(host={})`, opened at line 6 and
closed at 12,272. Everything between `// @runtime-body:start` (line 7) and
`// @runtime-body:end` (line 12,265) is the canonical body that
`tools/lib/game-source.mjs` extracts for the VM harnesses; the markers are
load-bearing and must not move or be reworded. The closing `return {...}`
(12,266–12,272) is the typed surface the Phaser host drives.

Regions are contiguous and ordered. Line numbers are inclusive.

| Lines | Region |
|---|---|
| 6–49 | host adapter: `runtimeHost`, `gameHaptic`, `runtimeListen`, pointer/key event normalizers |
| 50–65 | canvas/context acquisition, `IN_APP_BROWSER` sniff |
| 66–108 | `BUILD` stamp and `freshCheck()` self-refresh |
| 109–161 | `COL` palette and the written-down house style (naming, counter idiom, colour meanings) |
| 162–243 | arena geometry constants: `ARENA_STRETCH`, `RADII`/`RAD_OFF`/`RAD_BH`, `RINGS`, `nebulas`, `MOTES`, `FLK` |
| 244–339 | sprite-cache declaration, `SKY_BANDS`, sky-motion constants, `WORLDS`, `ORB_PER_WORLD`, `LEVEL_HOME`, `SKY_ARENA_CALM` |
| 340–616 | `makeCanvas`, `buildStarField`, `makeSprite`, `blit`, `buildSprites` |
| 617–677 | `resize()` and its one listener + first call |
| 678–745 | arena projection: `angDist`, `ringOf`, `radiusOf`, parallax (`PARA_K`, `depthOf`, `posAt`, `ecx`, `ecy`) |
| 746–836 | the audio bus: `MASTER`, `buildBus()` |
| 837–1030 | music tables: `BPM`/`SPB`/`STEPS`, `CH`, `ARP`, `STARRUN`, `LAYER_AT`, `PAY`, `HOOKL`, `HOOKBL`, `ANSWERL` |
| 1031–1088 | `buildBed()` — pad oscillators, noise buffer, the `MU` scheduler record |
| 1089–1273 | synthesis voices: `subF`, `note`, `hat`, `kick`, `snare`, `bassN`, `swellPad`, `riser`, `lead`, `gtr` |
| 1274–1403 | the build meter and Starfall: `build()`, `dropNeed()`, `startStarfall`, `tickStarfall`, `armDrop` |
| 1404–1622 | the payoff section: `schedulePreDrop`, `fireDrop`, `payoffStep`, `endSection`, `fireLift`, `breakStep`, `powerColour` |
| 1623–2213 | `musicStep()` — the whole arrangement — plus `chI`/`chTone` |
| 2214–2239 | `PLAY`, `LOOP`, and the `FIN` star-dive record |
| 2240–2424 | black hole: constants, `BH`, `bhTick`, `startBlackHole`, `endBlackHole`, `bhStep` |
| 2425–2443 | `finStep()` — the star dive's arrangement |
| 2444–2515 | grid quantization: `gridNear`, `cueTone` |
| 2516–2648 | timing judgement: `TIGHT`, `gridOff`, `judgeTiming` (the groove chain) |
| 2649–2671 | `performerHit()` — the player's own instrument |
| 2672–2694 | `musicTick()` — the lookahead scheduler |
| 2695–2817 | `bedTick()` — the only writer of `BED.g` — and `duckBed` |
| 2818–2884 | audio lifecycle: `ensureAudio`, `runtimeVisibilityChanged`, `toggleMute` |
| 2885–2949 | `beep`, `panAt`, `PENT`/`PENT_BASE` |
| 2950–3081 | `LV` — the six levels — and `LEVEL_MAX` |
| 3082–3172 | `MODES`, `MD()`, `REC`, `recKey`, `useMode` |
| 3173–3237 | the powerup lab: `LAB_ORBS`, `LAB_DL`, `LAB`, `labGhost` |
| 3238–3318 | pause: `PAUSE_COUNT`, `PAUSE_COOL`, `PAUSE`, `frozen`, `pauseGame`, `unpauseGame` |
| 3319–3520 | per-level music tables: `PROG`, `ARPL`, `RIFFL`, `SOLOL`, `PROGB`, `CHOFF`, `CHOR_HOLD`, `SEVB`, `ARPBL`, `applySect`, `applyLevelMusic` |
| 3521–3591 | `braam`, `soundImpact`, `cueUnlock`, `cueLesson`, `cueState` |
| 3592–3642 | `levelComplete()` |
| 3643–3751 | persistence: `readLocal`, `loadPrefs`, `savePref` |
| 3752–3993 | cloud accounts, sync and leaderboard |
| 3994–4247 | the DOM account panel (the only real-DOM surface in the file) |
| 4248–4314 | telemetry: PostHog constants and `track()` |
| 4315–4357 | swipe rule: `SWIPE_MODE`, `swipeWords`, `swipeOut`, `swipeLean` |
| 4358–4398 | one-voice announcement queue (`say`, `sayNow`, `annPump`) and `flashHit` |
| 4399–4565 | the difficulty clock: `dl`, `speedAt`, `warnTime`, `shardCap`, `spawnGap`, `rookie`, `firstShardAt`, `emberCap`, `emberGap` |
| 4566–4791 | `TIERS`, `T_VOICE`, `T_SKY`, `SHAPE_RANK`, `tierIndex`, `featuredTier` |
| 4792–4910 | `pickType()` and `shieldMax()` |
| 4911–5000 | the upgrade draft: `UPG`, `starPath`, `upgOn`, `rollOffer` |
| 5001–5079 | `G` — the single mutable game-state record |
| 5080–5140 | player geometry and the magnet: `curR`, `posPlayer`, `effRing`, `starVisualPos`, `updateMagnetStar`, `starTouchesPlayer`, `sweptHit` |
| 5141–5179 | particle/FX primitives: `burst`, `ripple`, `arcFlash`, `popup` |
| 5180–5256 | nova: `NOVA_SP`, `novaBlast`, `novaConvert`, `ignite` |
| 5257–5281 | `checkMile()` |
| 5282–5339 | placement clearance: `hitTol`, `sep`, `BEHIND_MIN`, `behindPad`, `farFromAll` |
| 5340–5437 | `spawnStar`, `mkSpike`, `GATE_ESCAPE`, saucer constants, `saucerOK`, `reverseEscape` |
| 5438–5634 | `MEET` (the lesson table) and `firstMeet()` |
| 5635–5845 | `spawnSpike()` — every formation's placement |
| 5846–5932 | mirror/scorch/slipstream/star-trail constants and `updateOrbMotion` |
| 5933–6087 | `POW_INTRO`, `POW_LESSON`, `spawnPow()` |
| 6088–6314 | `startGame()` |
| 6315–6540 | `die()` |
| 6541–6618 | `reverseFX`, `reverse`, `commitReverseFX`, `retry` |
| 6619–6866 | front-of-game states: swipe chooser, menu, lab picker, level picker, the first-flight intro |
| 6867–6896 | `cardDone`, `flushLesson`, `bump` |
| 6897–6981 | `hop()` |
| 6982–7071 | `runTime`, `tierLabel`, `levelName`, `runSummary`, `doShare` |
| 7072–7126 | hit rectangles: mute, pause, shield readout, share, `deadSeqDone` |
| 7127–7376 | pointer input: `pointerDown`, `pointerMove`, `pdEnd` |
| 7377–7466 | `keyDown` and the canvas/window listener registration |
| 7467–7521 | `trailCap`, `pushTrail`, `menuDemo`, blink phase helpers |
| 7522–7698 | `updateSpikes()` — threat state machine, collision, near miss |
| 7699–8730 | `update()` — the whole simulation step |
| 8731–9026 | faceted artifact sprites and object drawing |
| 9027–9095 | `F` font stack, `text`, `fitSz`, `textFx` |
| 9096–9268 | bloom + halo buffers and `drawBloom()` |
| 9269–9420 | `drawRingGlow`, `tailRibbon`, `drawTail` |
| 9421–9504 | `beatPhase`, `drawBeat`, `musPos` |
| 9505–9698 | the backdrop WebGL shader, `glInit`, `glResize`, retired `glRipple`/`glShear` |
| 9699–9968 | the sky director: `SKY`, `skyMix`, `scenePulse`, `sceneAccent`, `skyWake`, `skyStep`, `SKY_ART_WORLDS`, `drawGeminiSky`, `drawCalmSky` |
| 9969–10002 | `glRender` and the context-loss listeners |
| 10003–10368 | the GPU halo chain: `FX_*`, `fxInit`, `fxTarget`, `fxResize`, `fxBlur`, `fxRender` |
| 10369–10554 | impact events and arena decor: `impactColor/Halo/Record`, `drawOrbitalRails`, `drawPowerAtmosphere`, `drawImpactEvents`, `drawSingularity`, `drawCometFins` |
| 10555–11218 | `draw()` — the world pass |
| 11219–11364 | the four screen buttons: shield readout, share, pause, mute |
| 11365–11824 | HUD helpers: `hintGlyph`, `hintText`, `drawLadder`, `runMessage`, `hudLines`, `drawMessageCard`, `drawPowerStatus`, `drawRunHUD`, `drawFinalePath`, and the `front*` panel kit |
| 11825–12153 | `drawHUD()` — every screen's text layer |
| 12154–12264 | host-controlled lifecycle: `runtimeStep`, `runtimeRender`, `frame`, `runtimePause/Resume/Back`, `runtimeSnapshot`, `runtimeDisposeGpu`, `runtimeDestroy` |

## Two facts that shape everything above

**One mutable state record.** `G` (5003) holds the run. `BH`, `MU`, `PLAY`,
`FIN`, `LAB`, `PAUSE`, `CLOUD` and `SKY` are the other long-lived records; every
other value is a module-scope constant or a per-frame local. There is no class
hierarchy and no event bus — call order in `update()` and `draw()` *is* the
architecture.

**One writer per shared thing.** The file states this rule in several places and
mostly keeps it: `bedTick` is the only writer of `BED.g`; `applySect` is the only
writer of `CH`/`ARP`; `enterMenu` is the only place `LAB.on` is cleared;
`swipeOut` is the only expression of the swipe rule; `tierIndex` is clamped in one
place so `pickType` and the banner cannot disagree. When adding a second writer,
expect the class of bug the comments keep describing: the scheduler is silenced
but the sustained layer keeps playing.
