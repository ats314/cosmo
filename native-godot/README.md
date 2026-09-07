# Cosmo in Godot

The existing orbital game, rebuilt natively with a traveling singularity,
depth, a persistent comet wake and living celestial matter. The controls,
six passages, powers, orbit rewards and run upgrades carry over.

## Play on a phone

[Open the Godot phone playtest](https://cosmo-godot-playtest.ats314.chatgpt.site).
The test site is private to the owner; use the same ChatGPT account if prompted.

Tap to reverse orbit. Swipe to change rings. The original immediate touch-down
turn, swipe rollback, comet-relative radial direction and gesture thresholds
are retained. `builds/web/` contains the Godot browser export for phone testing.

## Optional Windows playtest

Double-click `C:\COSMO\Play Cosmo.cmd` to run the current project. Godot 4.7.2
is already available in this workspace. Alternatively, open `project.godot`
in Godot 4.7.2 and press F5.

The portable playtest lives in `builds/Cosmo-Windows/`. Keep `Cosmo.exe` and
`Cosmo.pck` together; launch `Cosmo.exe`. This is an unsigned local playtest
using the official engine runtime, not a store release.

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Reverse orbit | Tap or click | Space or Enter |
| Change ring | Swipe | Up / Down, W / S |
| Pause | Pause button | P or Escape |

Automatic forward flight continues when turning. Settings offer screen
up/down or radial toward/away swipes. Resuming shows a frozen three-second
count-in. Losing focus always pauses. The game has sound and reduced-motion
settings, and local records; practice does not alter those records.

Use **Power lab → TIDAL BRIDGE** to try nebula, molten or ice currents without
waiting for one during a passage. A current warns for three seconds, then
flows for eight. Follow its arrows to receive a bounded speed boost and a
short Magnet, Scorch or Slow-mo power. Its stars are physical collectibles:
collecting them and completing clean orbits still earns Starfall normally.

## Verification and remaining work

The native fidelity, profile, tidal, host and Overdrive checks exercise actual scoring,
power upgrades, collision, black-hole suspension, finale, save/reload, touch
dispatch and pause behavior. Run them with:

```powershell
powershell -ExecutionPolicy Bypass -File native-godot/tools/check_native.ps1
```

Actual rendered captures were inspected at 540×960 and 768×1024 on Windows
with an AMD Radeon RX 7900 XTX. This establishes desktop rendering and layout;
phone performance, touch feel and hardware audio latency still need device
playtesting. See `PORT_STATUS.md` for precise fidelity and release boundaries.

iPhone/iPad packaging uses a cloud Mac with Xcode; owning a Mac is unnecessary.
Apple signing and a device build remain separate from this Windows playtest.
Cloud accounts, recovery, cross-device records and leaderboards have not yet
been rebuilt in Godot. Browser saves remain separate.

Cosmo remains proprietary. Original artwork and dependency notices accompany
the project and portable package.
