/* THE DOOR. Three actions, no passwords.

     create  — a name goes in, an account and its key come out
     code    — an account asks for a six-character transfer code
     link    — another device spends that code and gets the same account

   That is the whole of "personal logins" here, and the transfer code is the
   part that makes it more than a per-device nickname: the same person on their
   phone and their laptop is the same row on the board and the same player in
   the telemetry, which is the join the whole feature exists for. */
import { cors, preflight, json, authenticate } from '../lib/auth.mjs';
import { store, rand, makeCode, cleanName, CODE_EXPIRY } from '../lib/accounts.mjs';

const bad = (req, msg, status = 400) => cors(req, json({ error: msg }, status));

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return bad(req, 'method not allowed', 405);

  let b;
  try { b = await req.json(); } catch { return bad(req, 'bad json'); }
  const action = String(b?.action || '');
  const s = store();

  if (action === 'create') {
    const name = cleanName(b?.name);
    if (!name) return bad(req, 'pick a name — letters, numbers, up to 12');

    /* NAMES ARE NOT UNIQUE AND THAT IS DELIBERATE. Uniqueness would mean
       telling a stranger which names are taken, a rejection on the one screen
       that has to be frictionless, and an index to keep consistent — all to
       solve a problem a group of friends does not have. The id is what is
       unique; the name is what is printed. */
    const id = crypto.randomUUID();
    const key = rand(32);
    await s.setJSON('a/' + id, { key, name, at: Date.now() });
    return cors(req, json({ ok: true, id, key, name }));
  }

  if (action === 'rename') {
    const me = await authenticate(req);
    if (!me) return bad(req, 'sign in required', 401);
    const name = cleanName(b?.name);
    if (!name) return bad(req, 'pick a name — letters, numbers, up to 12');
    const acct = await s.get('a/' + me.id, { type: 'json' });
    await s.setJSON('a/' + me.id, { ...acct, name });
    return cors(req, json({ ok: true, name }));
  }

  if (action === 'code') {
    const me = await authenticate(req);
    if (!me) return bad(req, 'sign in required', 401);
    const code = makeCode();
    /* The code stores the account it opens and nothing else; the key is read
       from the account when the code is spent, so a stolen code blob is not a
       stolen credential on its own. */
    await s.setJSON('c/' + code, { id: me.id, exp: Date.now() + CODE_EXPIRY });
    return cors(req, json({ ok: true, code, minutes: Math.round(CODE_EXPIRY / 60000) }));
  }

  if (action === 'link') {
    const code = String(b?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return bad(req, 'that code does not look right');

    const rec = await s.get('c/' + code, { type: 'json' }).catch(() => null);
    if (!rec) return bad(req, 'that code has been used or has expired', 404);
    /* SPENT ON SIGHT, before the expiry is even checked. A code that survives
       being presented is a code that can be presented again, and deleting only
       on the success path leaves the failure paths as a retry loop. */
    await s.delete('c/' + code).catch(() => {});
    if (Date.now() > rec.exp) return bad(req, 'that code has expired', 410);

    const acct = await s.get('a/' + rec.id, { type: 'json' }).catch(() => null);
    if (!acct) return bad(req, 'that account no longer exists', 404);
    return cors(req, json({ ok: true, id: rec.id, key: acct.key, name: acct.name || '' }));
  }

  return bad(req, 'unknown action');
};

export const config = { path: '/api/auth' };
