# Native Cosmo port status

This is a native Godot implementation of Cosmo. The tunnel and singularity
are visual additions to the existing orbital game: tap reverses travel,
swipe changes ring, ring zero is outermost. They do not replace its controls,
scoring, difficulty clock, curriculum or powers with a different game.

## Source and extracted content

The content and profile subsystem was read against the actual runtime at
commit `01a3a25693e1bcbcac1a4d2391efb3e2e6d1ff51`, in the prior checkpoint
checkout. The older `C:/COSMO` web checkout was three commits behind when this
port began. Source comments can describe retired behavior; the executable
tables, active functions and current effects audit take precedence.

`scripts/cosmo_content.gd` carries six authentic level names, keys, world
homes, instructions, thirteen tier entries, ten lab powers and all eleven
run-draft upgrades. Exact historic IDs remain intact, including `warp` for
Slow-mo, `spot` for Magnet and `stagelight` for Long Magnet. The eleven IDs
are `longstar`, `deepbank`, `slowworld`, `richnova`, `hairtrig`, `stagelight`,
`longmirror`, `deepburn`, `steadyhand`, `longslip` and `longtrail`.

| Level | Difficulty span | Key | World home |
| --- | --- | --- | --- |
| LIFT OFF | 0–90 | A minor | DRIFT |
| INTO THE RINGS | 90–215 | G minor | TIDE |
| THE STORM | 215–340 | F minor | DUSTLANE |
| EVENT HORIZON | 340–470 | Eb minor | GLASS |
| REDSHIFT | 470–610 | Db minor | EMBERFALL |
| HEAT DEATH | 610–760, native ending | B minor | DEEPFIELD |

HEAT DEATH had an infinite frontier in the source. Its finite difficulty-760
ending is the explicit native adaptation; it is not represented as an
extracted legacy finish line. Content `duration` means difficulty seconds,
not a wall-clock timer. The source clock is `a = active_age + min(diff*0.22,
40)`, followed by `a*0.55` before 80 and `44+(a-80)` afterward, added to the
level floor. Pause and teaching ownership remain the runtime's responsibility.

The content module includes exact source arithmetic for difficulty, angular
speed, warning time, spawn gap and caps, ring/shield thresholds, star and orbit
payouts, Starfall cost and black-hole payout. Source melody contour and chord
degree metadata preserve each level's harmonic identity. This extracted data
alone does not establish equivalent gameplay, collision handling or audio.

## Native records and drafts

`scripts/cosmo_profile.gd` stores local records and settings in
`user://cosmo_profile_v1.json`. Loading does not create a save file. Writes
first complete a temporary JSON file and then replace the destination;
failure reports `last_error`. The reader sanitizes types, values and unknown
fields. A selected later start may record its score, matching the source,
but only a run that started at level 1 can advance the climb record or record
a full six-level completion.

Upgrade choices and offer history are in memory for the active run, not a
permanent inventory. Drafts prefer fresh unchosen cards, then permit declined
cards to return; selected cards never repeat. There is no added currency,
shop, purchase price or meta progression. Lab entry snapshots profile data;
all record, preference and file writers reject lab activity, and lab exit
restores the snapshot, including accidental in-memory changes.

## Fidelity and release boundary

The playable simulation retains first-encounter teaching, once-per-run
guaranteed power homes, shield pity, star-fed automatic Starfall, the temporary
fourth black-hole ring, suspended ordinary rewards during that event, and the
existing star-dive finale. Permanent native tests exercise these integrated
paths, all eleven upgrade effects, moving collisions and one-award grazes.
Visual responses follow the current default no-flash baseline. Reduced
motion is additional to that baseline and cannot be required to obtain it.

Cloud sign-in, account recovery, cross-device synchronization, leaderboards
and the Netlify account service have not been ported by this subsystem.
Native local records do not silently import or overwrite browser saves.
No WebView or Capacitor wrapper is implied by a Godot project. Project
source, a desktop run, Android export, signed device release and iOS release
are distinct deliverables. Build and device verification must be recorded
by the integration pass before this is described as a shipped native app.

## Integration verification

Validated with the official Godot 4.7.2 Windows engine
`4.7.2.stable.official.ed1daf0bf`:

- `tests/fidelity_check.gd`: source-derived scoring and clocks, all upgrades,
  hazard fairness, swept collisions, actual hop contact, once-only grazes,
  black-hole suspension/escape cleanup, world travel and the star-dive finale.
- `tests/profile_check.gd`: actual save/reload/replacement, selected-start
  isolation, lab immutability and all five three-card draft rounds.
- `tests/tidal_check.gd`: exact shared lane intersections, real star collection,
  material powers, bounded boost, warning/lifetime, pause/BH and reset/finale.
- `tests/host_check.gd`: actual Godot input dispatch, immediate pointer-down
  turn with deferred feedback, exact swipe rollback and comet-relative radial
  mapping, source motion/lift thresholds and hop lockout,
  canceled/second-finger isolation, depth separation, frozen pause/count-in,
  pause cooldown with forced focus-loss override, and native Power Lab exit.
- `tests/overdrive_check.gd`: authentic movement heat, eight-quarter-note
  eligibility hold, scheduler exclusions, 64 audio eighths and 45-second cooldown.
  Starfall now releases on the next quarter-note boundary.
- Actual non-headless main-scene captures at 540×960 and 768×1024 show the
  planet, tidal bridge, pickups, comet and HUD without clipping. Rendering
  uses the Compatibility backend on an AMD Radeon RX 7900 XTX. Both captures
  exited successfully without script/render errors or leaked-object warnings.
- Generated harmonic audio passed seam, clipping and lifecycle checks. Each
  of six keys has its own source chord walk and melody contour. This native
  stem/bus arrangement is not a sample-identical recreation of WebAudio.

`tools/check_native.ps1` runs the five permanent checks in an isolated profile.
The procedural background and planet remain live shaders; actual 3D meshes
share projection with encounter contact and tidal star trajectories. Near-plane
camera/geometry agreement was measured within 0.000031 pixels on the desktop
capture, not claimed as physical device touch precision.

Tidal bridges are a new addition: three-second anticipation, eight-second
current, at most 1.35× sector speed, twelve actual stars, and a short existing
elemental power. They do not directly write score, shields or Starfall charge.
The visual source body holds during extraction and gently catches up with the
continuous journey afterward. Six native levels are selectable for playtesting.

Phone/iPad rendering, thermal behavior, audio latency and touch feel have not
been verified on hardware. No native iOS artifact has been signed or installed.

## Browser playtest

Published 2026-09-07:
https://cosmo-godot-playtest.ats314.chatgpt.site (owner-private playtest).
Sites reported deployment succeeded for version 1. The isolated deployment
checkout is `work/cosmo-phone-playtest`; source commit
`4a6f26ec69179cba9caccc83407d971c3402874a` contains the exact tested export.
The published URL was opened in a browser, its actual rendered title inspected,
and Launch verified to enter the tap-to-turn lesson. No browser errors or
warnings were reported during that check.

The single-thread Godot Web export also runs the same game in a browser.
`web/phone-shell.html` owns safe-area canvas sizing, limits rendering to a
1.5 device-pixel ratio and 1.1 million pixels, and preserves native input
coordinate scaling. Music uses Stream playback so the synchronized mixer and
bus effects operate on Web. Actual hardware audio latency remains unmeasured.

The final Web game pack SHA256 is
`2eebb86ffca2e1ce23794e4971e3a20e39bd5c5fe1f46fb34792af9338f27847`.
Its compressed game/engine downloads total approximately 21.7 MB. A desktop
browser at 390×844 was checked through title, touch-target Launch, teaching,
passage selection and drag-to-hop, with no reported browser warnings/errors.
This is a browser compatibility check, not an iPhone hardware claim.

The original Phaser pre-push suite was also attempted. Its build succeeded,
but `tools/all.mjs` stopped because four untracked diagnostic harnesses were
not registered in CI/docs. Those other-agent files were preserved. Running
the eight registered checks separately passed seven; `smoke.mjs` failed its
unattended-death assertion after ten simulated minutes. The existing Phaser
site was not redeployed as part of this Godot playtest.

The optional Windows package is complete at `builds/Cosmo-Windows/` with
`Cosmo.exe`, its 13,873,892-byte sibling `Cosmo.pck`, launcher and license notices.
An actual four-second executable smoke run from another directory found the
pack, scored 47, completed an orbit and exited successfully without game errors
or leaked-object warnings. This uses the official combined editor/playback
runtime and is not a signed production Windows export.
