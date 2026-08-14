/* DETERMINISM, INJECTED AT THE SANDBOX BOUNDARY.

   The game calls Math.random 67 times and every harness handed its vm the real
   Math, so no two runs played the same game. `CLAUDE.md` recorded that as a
   known property with a ritual attached: "re-run the harness on the unmodified
   file — several times" before believing any result. That ritual is a tax on
   every session, and it is paid in the worst currency — an agent that cannot
   tell its own regression from noise either re-runs everything (slow) or
   assumes noise (wrong).

   It is also a correctness problem in CI. smoke.mjs failed once in ~34 runs
   with nothing to reproduce it: a red pull request on a green tree costs a
   whole round trip, and the seventh harness added to this repo would have
   multiplied that surface rather than helped.

   The fix does not touch index.html. Every harness builds its own sandbox and
   passes Math in; passing a Math whose `random` is seeded makes the whole game
   deterministic from outside, with the product unchanged.

   THE SEED ROTATES IN CI AND IS FIXED LOCALLY, which is the point. A fixed
   seed everywhere would make the suite reproducible and blind: it would play
   exactly one game forever, and the rare-path bugs that an unseeded run
   stumbles into once in thirty would never be found again. So CI passes the
   run number and coverage keeps moving, while every failure prints the seed
   that produced it and becomes a one-command reproduction. Reproducible AND
   varied, instead of choosing. */

/* Local runs default to one constant so an agent editing code sees a stable
   world and can attribute a changed number to its own diff — the whole point.
   CI overrides it per run. */
export const SEED = process.env.SEED ? (Number(process.env.SEED) >>> 0) || 1 : 20260814;

/* mulberry32: small, fast, and good enough for shard placement — this decides
   where a hazard spawns, not anything cryptographic. */
export function seededMath(seed = SEED) {
  let a = seed >>> 0 || 1;
  const random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /* ONLY `random` is replaced. sin, cos, PI and the rest must stay exactly
     themselves — the arrangement and the arena geometry are built out of them,
     and a harness that quietly changed Math.sin would be testing a different
     game than the one that ships. */
  return new Proxy(Math, { get: (t, k) => (k === 'random' ? random : t[k]) });
}

export function seedLine(name) {
  return `${name}: SEED=${SEED}` + (process.env.SEED
    ? '' : ' (default — CI rotates it; set SEED=n to reproduce a CI failure)');
}
