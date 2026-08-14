# Reviewing this repository

A review here has two halves. Earlier reviews did only the first, and missed a
public repository sitting with no licence for its whole life as a result.

**1. Correctness and clarity** — bugs, dead code, drift between the code and
`README.md` / `MECHANICS.md`, invariants above.

**2. Repository and product hygiene** — do this half explicitly, every time:

- Licence present, correct, and carried into `index.html`.
- Secrets and keys: what is embedded in the distributed file, and is it
  genuinely safe there. The PostHog project token is deliberately embedded and
  documented as write-only — re-confirm rather than assume.
- Telemetry and privacy: what is collected, whether it stays anonymous, and what
  obligations attach once there are paying users.
- Repository settings: branch protection on `main`, fork policy, visibility.
- Public/private posture: what belongs in a public playtest build versus the
  private source. Note that the published page hands every visitor the complete
  readable source — repository visibility does not change that.
- Third-party provenance for any code, audio, or art.
- Name and trade-dress exposure.

Report hygiene findings even when the session was asked only about code. If a
finding is out of scope to fix, say it exists and let the owner decide.
