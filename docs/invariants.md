# Invariants that are load-bearing

Read the group affected by a change. These are behavioral and ownership
contracts; historical implementations are not permanent design restrictions.

## Curriculum, teaching and the ledger

- Content can grow beyond the six currently authored levels. Keep thresholds
  ordered, geometry playable, rewards reachable and lessons honest.
- Derive unlock ordinals from the tier table. Player-facing level names come
  from the level table; a tier is not a level.
- Introduction flags and guaranteed first orb placements are per run. A level
  advance must not replay earlier ceremonies. A selected later start does not
  owe the introductions belonging to earlier levels.
- Tap turns and swipe changes ring. Neither requires an aimed target. Never
  temporarily remap them to a melody, drum fill or echo task.
- Three star-fed orbits earn Starfall; its upgrade lowers that to two. It
  releases automatically, provides three waves over about 9.23 seconds, clears
  red and doubles collected stars. Passive waiting or tapping cannot earn it.
- One name per mechanic and one instruction card at a time. Immediate danger
  and a playable introduction outrank ambient announcements. Status appears
  only when it has a useful reading; avoid competing center-screen messages.
- Change MECHANICS.md and relevant cards when behavior changes. Every shipped
  tier and lab orb must appear in the ledger. A lesson names only an action
  the player can perform and the result they can observe.
- The title screen prioritizes Cosmo's art and launch action. Secondary doors,
  including Learn to play and the powerup lab, remain reachable on small phones.

## Modes, records and the powerup lab

- One identity mode ships. Keep MODES as the shared tuning table; a future
  difficulty is a derivative, not a second implementation. Every knob is read,
  and modes do not silently change curriculum, music or score rules.
- Preserve historical cometloop: keys. Skill records keep their unsuffixed
  keys; retired mode records may remain untouched on disk.
- A picked starting level cannot record a climb from level 1. Preserve
  G.startLevel when carrying a legitimate run between levels.
- The lab must not create or alter save keys, best records, lifetime counters,
  lesson flags or normal gameplay telemetry. Guard gameplay writers as well
  as menu writers. A laboratory hop must not spend the first-hop lesson.
- The lab pins difficulty, so deadlines based on advancing difficulty need an
  explicit lab policy. Leaving it resets black-hole geometry and timed state.

## Simulation, state and telemetry

- Phaser owns live frame scheduling and input. The runtime's standalone loop
  exists for harnesses; it must not run beside the Phaser loop.
- Typed host/scene contracts are in src/game/contracts.ts. The simulation in
  src/game/runtime.js remains JavaScript; do not claim complete type coverage.
- Pause freezes before G.t advances. The pause screen does not become a new
  gameplay state. Held input is released; scheduled sound and continuous pads
  are silenced. Native/background resume does not silently resume a live run.
- Count-in animation uses frame time; paused duration uses performance.now().
  A locked phone may produce no frames. Clamping a stalled frame must not
  erase measured wall-clock pause time.
- Ring index 0 is OUTERMOST. Increasing the index moves inward. Test gravity
  and rewards against actual radius, not an ambiguous ordinal.
- G.t governs undilated run deadlines; G.vt governs presentation under slow
  motion. New effects choose their clock deliberately.
- Ordinary timed powers and their effects suspend inside the black hole.
  Charge grows from settled inner-ring residence. Escape opens at 12 seconds;
  reaching stable ring 0 before 17 seconds pays the reward. Failure forfeits
  it and costs a shield, or the run without one. No duplicate banked payout.
- Starfall's actual reward timer and waves survive a black-hole interruption
  without being re-earned or paid twice. Death/retry clear abandoned state.
- Measure hazard pressure per ring. Adding a ring does not itself prove that
  a mode is harder.
- Telemetry uses game_level for levels, tier for unlocks and play_mode for
  difficulty. Do not redefine historical properties to mean another scale.

## Audio and the arrangement

- Audio is optional. Muted or unavailable WebAudio must not block progression
  or suppress an earned gameplay reward.
- Stopping the scheduler does not silence continuous oscillators. bedTick is
  the pad's gain owner; replacement arrangements and pause must control it.
- Immediate pickups need immediate keyed cues/overlays. A chorus that changes
  at a four-bar seam is not an immediate reward signal.
- Every pitched voice is an interval over the level's tonic and natural minor
  vocabulary. subF folds sub voices below 40Hz upward by octaves.
- applySect owns the live harmony tables; chI translates musical position.
  Chord zero remains the tonic. Chorus changes respect phrase boundaries and
  yield to Starfall, black hole and finale. Avoid doubling occupied drum slots.
- The movement instrument remains consistent. Authored melodies and drum fills
  play automatically; no capture/replay mode or musical instruction banners.
- End-of-run cleanup drains legacy queues and special scheduler state. Preserve
  real gameplay rewards separately from ephemeral audio scheduling.

## Graphics, shaders and the sky

- One composed procedural world owns the background: textured planet,
  atmosphere/rings, deep nebula and stable stars. Unmarked alpha art may add
  material detail through the Phaser cache; opaque plates must not replace the
  living scene. Preserve a coherent fallback.
- Current controls are SKY_ARENA_CALM = 0.62 and GL_MOTION = 1.0. Threats must
  remain readable in the arena. Hue is free; obscuring hazards is not.
- Coordinate scene responses through bounded event envelopes. Black hole and
  major releases outrank pickups and ordinary orbits. Reset across runs. Use
  motion and material response, not full-field flashes or beat-driven light
  gain; the default must not depend on a reduced-motion toggle. See
  [the effects audit](design/effects-audit.md).
- Match radiusOf, AY and camera transforms across backgrounds and gameplay.
  An accent cannot change collision geometry.
- Keep glow targets correctly sized, blur distances in physical pixels,
  normalized kernels and edge fades. Context loss must leave visible gameplay.
- Honor reduced motion. Gameplay cues and labels must still communicate state.
- Use drawcheck for valid canvas calls, fxcheck for GL calls/lifecycle and
  rendercheck for actual pixels. Inspect a real frame for visual changes.
  Neither a fake context nor a brightness average establishes visual quality.

## Delivery

- Publish dist/ only. public/ contains intentional released material; internal
  documentation, tooling and native source must never become site assets.
- Preserve proprietary notices for Cosmo and dependency licenses for their
  respective components. Approved dependencies do not relicense the game.
- A build stamp identifies source; a successful local build is not a live
  deployment. Check the published URL before reporting release success.
- Capacitor packages bundled assets with no release server.url. Exact native
  origins are https://localhost and capacitor://localhost; CORS stays exact.
- Synchronize after the final web build. Native source generation is not proof
  of an APK, Xcode build, device test or signing.
- Scene teardown removes input/lifecycle listeners, timers, audio and graphics
  resources. A reload must not accumulate another running game.
