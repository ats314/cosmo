/* THE CLOUD SAVE. GET reads this account's document, PUT folds one in.

   The game already had the seam this plugs into. loadPrefs() has always read
   an optional async `window.storage` alongside localStorage and merged both
   with Math.max, because the file was first written against a host that
   supplied one. Nothing in the game had to be restructured to sync: the client
   installs a window.storage backed by this endpoint, and the records, the
   preferences and the taught-mechanics set travel on the path that was already
   there.

   localStorage remains the real store, and that is deliberate. A signed-out
   player, a blocked third-party context, a dead network — all of them play the
   whole game with every record intact, exactly as before. This is a copy that
   follows the account between devices, never the primary. */
import { getStore } from '@netlify/blobs';
import { authenticate, json, cors, preflight } from '../lib/auth.mjs';
import { merge } from '../lib/records.mjs';

const STORE = 'cosmo-progress';

export default async (req, context) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await authenticate(req, context);
  if (!user) return cors(req, json({ error: 'sign in required' }, 401));

  /* Strong consistency because this is a read-modify-write against a document
     two devices can touch at once. Eventual reads here would resurrect an old
     record as the base of the next merge. */
  const store = getStore({ name: STORE, consistency: 'strong' });
  const key = 'u/' + user.id;

  if (req.method === 'GET') {
    const doc = (await store.get(key, { type: 'json' })) || {};
    return cors(req, json({ ok: true, doc }));
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return cors(req, json({ error: 'bad json' }, 400)); }

    const stored = (await store.get(key, { type: 'json' })) || {};
    const doc = merge(stored, body && body.doc);
    await store.setJSON(key, doc);
    /* The merged document goes back, not an acknowledgement. The client that
       posted a lower record needs to learn the higher one it just lost to,
       and this is the round trip that tells it. */
    return cors(req, json({ ok: true, doc }));
  }

  return cors(req, json({ error: 'method not allowed' }, 405));
};

export const config = { path: '/api/progress' };
