# Delivery

*The allowlist deploy, the build stamp, and the freshness contract.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

## The play link is the Netlify one now

**<https://cosmo-arcade.netlify.app/>** is the address to give somebody. It
serves the same artifact GitHub Pages does, and it is the only one of the two
with the functions behind it — so accounts, synced records and the leaderboard
work there and are inert anywhere else. See [`cloud.md`](cloud.md).

GitHub Pages still publishes on every push to `main` and the old address still
plays, deliberately: an address that has been handed out does not stop being
handed out because a newer one exists, and a bookmark that 404s is worse than a
bookmark that works. The Pages copy is a full copy, not a stub — `CLOUD_ORIGIN`
is absolute and the CORS allowlist names both origins, so a player who opens the
old link can still sign in. What it is not is the link anyone should be *given*.

The share card follows the canonical link rather than the host it was served
from: `og:url` and `og:image` in `index.html` name the Netlify address on both
copies. A preview card that advertises the address you are trying to retire is
how a retired address keeps circulating.

**Two hosts, one allowlist.** `netlify/build.mjs` stages the site by reading the
`cp … _site/` line out of `pages.yml` rather than restating it — one list, two
deploys. The failure a second copy invites is silent on whichever host got
forgotten: an internal document becomes a public URL on one and not the other.

## The GitHub Pages half

`.github/workflows/pages.yml` syntax-checks the game on every push and pull
request, and publishes `main` to GitHub Pages.

### The site is an allowlist, not the repository

The deploy stages
`index.html`, the icons, the manifest, `og.png` and `LICENSE` into `_site/` and
publishes that. It was `path: .` for most of the project's life, which served
the entire checkout from the Pages URL — `CLAUDE.md`, this file, `MECHANICS.md`
and every harness among them, each at its own public address. Repository
visibility never covered it: Pages serves the artifact rather than the repo, so
turning the repository private would have left every one of those documents
readable exactly where they were. `check.mjs` now fails the build on any file at
the repository root that is in neither the published list nor its internal one,
because both directions of that mistake are silent — an asset left out of the
list 404s on the live site, and a document left in becomes a URL.

Setting it up on a fresh clone takes one manual step: *Settings → Pages →
Build and deployment → Source: **GitHub Actions***. The workflow passes
`enablement: true` to `configure-pages`, which is meant to create the Pages
site automatically, but the default `GITHUB_TOKEN` is not permitted to and
fails with `Resource not accessible by integration`. The flag is left in
place because it costs nothing and works for anyone running with a token
that does have the rights.

Two things that bite when this is not yet working:

- The `deploy` job declares a `permissions:` block, and such a block
  *replaces* the defaults rather than adding to them. `contents: read` has to
  be listed explicitly or `actions/checkout` fails — reported as
  `Repository not found`, which reads like a missing repo rather than a
  permissions problem.
- Enabling Pages does not itself trigger a build. Push to `main`, or re-run
  the last workflow, before expecting the site to appear.


### The deployed page is stamped with its commit

The source says `const
BUILD='dev'`; the deploy rewrites it to the short sha before upload, so the game
itself stays a single hand-written file with no build step — the stamp is a
label on the box, not a compiler. Three deploys, three ways to learn the sha:
the Pages workflow reads `GITHUB_SHA`, a git-linked Netlify build reads
`COMMIT_REF`, and a deploy pushed from a laptop with the CLI has neither — so
`build.mjs` asks git directly. It did not at first, and the first Netlify deploy
published a page stamped `dev`: honest, and useless for the one job the stamp
has. It draws faintly at the bottom of
the title screen and is readable as `window.COSMO_BUILD`. It exists because a
day was lost to screenshots that could not say which build they came from: a
fix deployed at 1:01:42pm, a screenshot taken at 1:02pm, and GitHub Pages'
ten-minute cache between them. A stale cache can also be bypassed on demand by
adding any query string to the URL (`/cosmo/?fresh`) — the CDN keys on it.
