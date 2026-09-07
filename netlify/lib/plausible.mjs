import { SCORE_CEILING, LEVEL_MAX } from './records.mjs';

/* IS THIS RUN POSSIBLE? Not "is it good" — possible.

   Split out of scores.mjs so it can be tested without a network, a Netlify
   runtime or the blobs dependency. The bound below is the only judgement this
   service makes about a score, so it is the one piece that has to be checkable
   on a laptop.

   THE RATE BOUND IS DELIBERATELY LOOSE. The largest single payout in
   the game is a fed orbit at 86 plus a streak bonus up to 28, and the fastest
   possible lap at the 4.2 rad/s speed ceiling is about 1.5s — roughly 76/s
   from orbits. Embers pay a combo up to x6, doubled under overcharge, the
   spotlight or a hypernova; garnishes pay 8-16. Sustained perfect play lands a
   couple of hundred points a second, with bursts above it.
   1200/s is therefore around five times what the game can actually pay, which
   is the intent: this bound exists to reject 9e9, never to adjudicate a good
   run. A ceiling tuned close to real play would eventually call somebody's
   best run a forgery, and that is a far worse failure than letting an inflated
   one through. FLOOR covers short runs, where a single big finish dominates. */
const RATE = 1200;
const FLOOR = 5000;
export const COOLDOWN_MS = 10_000;
const MIN_RUN_S = 5;

export const int = v => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};

export function validate(body) {
  const score = int(body?.score);
  const level = int(body?.level);
  const secs = Math.round(Number(body?.runTime));

  if (score === null || score < 0) return 'score must be a non-negative integer';
  if (score > SCORE_CEILING) return 'score above the ceiling';
  if (level === null || level < 1 || level > LEVEL_MAX) return 'level out of range';
  if (!Number.isFinite(secs) || secs < MIN_RUN_S) return 'run too short to score';
  if (secs > 6 * 60 * 60) return 'run duration implausible';
  if (score > FLOOR + RATE * secs) return 'score implausible for the run duration';
  return null;
}

