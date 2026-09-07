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
| THE STORM | 215–340 | F minor | VEIL |
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

The intended port retains first-encounter teaching, once-per-run guaranteed
power homes, shield pity, star-fed automatic Starfall, the temporary fourth
black-hole ring, suspended ordinary rewards during that event, and the
existing star-dive finale. Each requires gameplay integration and targeted
verification; the content/profile work does not certify those call sites.
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

Godot 4.7.2 `--headless --check-only` accepted both content and profile scripts.
A native headless probe at `work/cosmo-content-profile-probe.gd` passed content
counts and clock/scoring boundary cases, real save/reload and replacement,
selected-start record isolation, lab file/data immutability, and all five
three-card draft rounds with no already-taken cards. Upgrade inventory and
currency were confirmed absent from the saved JSON. This is subsystem
validation; gameplay integration and exported-platform checks remain for the
lead implementation agent to record with actual commands and observed results.
