# Shared Godot repair handoff

Updated by Codex on 2026-09-07. The owner's latest direction is to finish the
Godot port together, preserving the original game and improving its flight
presentation. This supersedes the earlier engine competition and the initial
ownership proposal in `native-godot/COORDINATION.md`.

## Ownership acknowledged

- Claude owns native implementation and **all Godot engine execution**, including
  imports, tests, captures and exports. Codex will not launch another engine
  process or edit Claude's native files while that ownership remains in place.
- Gemini owns its announced asset repairs in `native-godot/assets/`, coordinated
  with Claude. Codex's asset audit remains available in
  `docs/design/gemini-asset-review.md`.
- Codex owns original-source comparison, reference generators, independent
  review, and focused candidate patches outside `native-godot/`.
- `src/game/runtime.js`, including `HOOKL` and `PENT`, remains unchanged.
- Stage explicit paths only. No `git add -A`, `git commit -a`, resets, or broad
  staging of a directory another agent may be changing.

## Ready for Claude now

1. **Three focused simulation fixes:**
   `work/godot-collaboration/simulation-fidelity-fixes.patch`.
   This patch fixes the reversed hop clocks, Slipstream clearing during its
   grace cooldown (including stars staying on the destination ring), and lab
   visits consuming real-run newcomer grace. It passed `git apply --check`
   against the audited source. Check it again immediately before applying.
2. **Behavioral regression script:**
   `work/godot-collaboration/simulation_fidelity_regression.gd`.
   Please place it in native tests, establish failures before the patch, then
   run it after the patch and run `tools/check_native.ps1` with isolated saves.
   Codex has not run this new GDScript script; it is prepared code, not a passed
   test. Source anchors are in `simulation-fidelity-handoff.md` beside it.
3. **Music corrections:**
   `work/godot-collaboration/audio-fidelity-audit.md`.
   The first five repair targets are ordinary `RIFFL` instead of payoff `HOOKL`,
   Starfall's `HOOKBL` alternates and `ANSWERL` final two bars, keyed snare body,
   authored `PROG`/`PROGB` chord registers, and the original high-note timing.
   It also records missing chorus form and altered bass/score-layer roles.
4. **Executable original-music reference:** run
   `node db/export-native-audio-reference.mjs`.
   It extracts source tables and executes the original `payoffStep`,
   `performerHit`, `chTone` and `chI` with recording sinks. Output is
   `work/godot-collaboration/original-audio-reference.json`: six worlds,
   18 Starfall scenarios and 432 movement scenarios, with pitches, durations,
   timestamps, voice parameters, source lines and hashes. These are symbolic
   reference events, not PCM or evidence of native sample accuracy.
5. **Visual verification bug and consistency fixes:**
   `work/godot-collaboration/visual-source-audit.md`.
   Fix capture argument ordering first: `--seconds` precedes `--capture`, so
   `_parse_test_arguments` resets requested long captures to about two seconds.
   Other source findings cover missing next-star finale guidance, bridge
   suspension during black hole, outdated wake ring radii, and hidden overlapping
   power statuses. Each item has a bounded fix and acceptance state.
6. **Frontier and teaching parity:**
   `work/godot-collaboration/frontier-and-teaching-recommendations.md`.
   The original last level remains open; the native difficulty-760 ending is
   an added adaptation. Original first-hop teaching holds the tier ladder for
   30 difficulty-seconds from engagement, not until absolute difficulty 30.
   These changes affect multiple consumers; keep them separate from patch 1.

## Verification record

- Before Claude's exclusive engine lock was relayed, Codex ran the existing
  five native checks once. All five passed their assertions. Godot also logged
  a Windows root-certificate-store access error. This was an isolated local
  gameplay baseline, not an account, TLS or device test.
- Since that message: no Codex Godot process, native source edit, audio
  regeneration or export. Reference generators execute Node only.
- The new reference exporter successfully generated all 450 scenarios from
  original runtime SHA256
  `90dda777639ba1d414077481314f452fd92ca6b3960892d122e7bb3043ae0e9f`.
- The three gameplay fixes are **prepared, not integrated or engine-tested**.
  Music/rendering findings are **identified, not fixed**. Update this record
  with actual results as Claude applies them.

## Reply from Claude

Please record which patches you applied, the exact checks/captures run and
their outcome, and any bounded file ownership you want Codex to take next.
Codex can prepare further source-derived patches without competing for the
native import cache. Both agents should report what remains unfinished before
calling a playtest a completed port.
