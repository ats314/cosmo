/* THE LEADERBOARD. GET reads the board, POST offers a run to it.

   HOW HARD THIS TRIES, AND WHY IT STOPS THERE. The whole game is delivered to
   the browser; the repository is public. Anyone who wants to POST a number
   here can read exactly how, and no amount of client-side cleverness changes
   that — the signing key would ship inside the thing being signed. So this
   does not pretend to be unforgeable. It rejects the IMPOSSIBLE and the
   automated, which is what actually keeps a small board readable:

     - you must be signed in, so a forged entry costs an account
     - a score must be an integer inside a rate bound (see lib/plausible.mjs)
     - a run must have lasted long enough to have earned it
     - one submission per player per COOLDOWN, and only if it beats their own
       best — the board holds one row per person, so grinding it is pointless

   What it does NOT stop is a determined person editing G.score before dying.
   Closing that needs the run itself to be checkable — seed plus input log,
   replayed server-side — and the game cannot do that today: index.html calls
   Math.random 73 times with no seeded generator of its own (determinism is
   injected from outside by tools/lib/rng.mjs, for the harnesses only). Making
   the game self-seeding is the prerequisite, and it is a change to the game,
   not to this file. Written down here because the next person to look at this
   will otherwise rediscover it. */
import { getStore } from '@netlify/blobs';
import { authenticate, json, cors, preflight } from '../lib/auth.mjs';
import { validate, int, COOLDOWN_MS } from '../lib/plausible.mjs';

const STORE = 'cosmo-scores';
const BOARD = 'board';
const TOP = 100;
const PAGE = 25;

const clean = s => (typeof s === 'string' ? s.trim().slice(0, 12) : '');

export default async (req, context) => {
  const pre = preflight(req);
  if (pre) return pre;

  const store = getStore({ name: STORE, consistency: 'strong' });

  if (req.method === 'GET') {
    const board = (await store.get(BOARD, { type: 'json' })) || [];
    const limit = Math.min(PAGE, Math.max(1, int(new URL(req.url).searchParams.get('limit')) || PAGE));
    /* Rows are public, so they carry a display name and nothing else. No email
       and no account id ever leaves this function: a leaderboard is not a
       reason to publish who plays. */
    const rows = board.slice(0, limit).map((r, i) => ({
      rank: i + 1, name: r.name, score: r.score, level: r.level, at: r.at,
    }));

    /* A signed-in caller also gets their OWN standing, which is the thing a
       player actually wants to know and is usually not in the top 25. */
    let you = null;
    const user = await authenticate(req, context);
    if (user) {
      const i = board.findIndex(r => r.id === user.id);
      if (i >= 0) you = { rank: i + 1, name: board[i].name, score: board[i].score, level: board[i].level };
    }
    return cors(req, json({ ok: true, rows, you, total: board.length }));
  }

  if (req.method === 'POST') {
    const user = await authenticate(req, context);
    if (!user) return cors(req, json({ error: 'sign in required' }, 401));

    let body;
    try { body = await req.json(); } catch { return cors(req, json({ error: 'bad json' }, 400)); }

    const bad = validate(body);
    if (bad) return cors(req, json({ error: bad }, 400));

    const board = (await store.get(BOARD, { type: 'json' })) || [];
    const mine = board.find(r => r.id === user.id);

    if (mine && Date.now() - (mine.at || 0) < COOLDOWN_MS)
      return cors(req, json({ error: 'too many submissions' }, 429));

    const score = int(body.score);
    if (mine && mine.score >= score)
      return cors(req, json({ ok: true, improved: false, rank: board.indexOf(mine) + 1 }));

    /* THE ACCOUNT'S OWN NAME IS THE AUTHORITY, and it is consulted second
       rather than last. This read `user.email.split('@')[0]` until the day
       passwords were dropped and there stopped being an email — after which
       every submission that did not carry an explicit name landed on the board
       as the literal string PLAYER. The client does send one, so it looked
       fine from the game; it showed up the first time a request was made
       without one, which is exactly what an end-to-end pass is for.
       Order: what this run said, then who the account says it is, then what
       the row already had. */
    const name = clean(body.name) || clean(user.name) || clean(mine?.name) || 'PLAYER';

    const row = { id: user.id, name, score, level: int(body.level), at: Date.now() };
    const next = board.filter(r => r.id !== user.id);
    next.push(row);
    next.sort((a, b) => b.score - a.score || a.at - b.at);
    const trimmed = next.slice(0, TOP);

    /* ONE BLOB, LAST WRITE WINS. Two people finishing a run in the same second
       can drop one of the two entries. That is a real race and it is accepted
       rather than hidden: the fix is a row per player as its own blob with the
       board assembled on read, which costs a list plus N gets on every page
       load. At this game's scale the race is rarer than the cost, and the
       resubmit path is the next run. Revisit it if the board ever gets busy. */
    await store.setJSON(BOARD, trimmed);

    const rank = trimmed.findIndex(r => r.id === user.id) + 1;
    return cors(req, json({ ok: true, improved: true, rank: rank || null, name }));
  }

  return cors(req, json({ error: 'method not allowed' }, 405));
};

export const config = { path: '/api/scores' };
