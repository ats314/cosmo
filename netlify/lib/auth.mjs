/* WHO IS ASKING.

   A request carries `Authorization: Bearer <id>.<key>`. The id names an
   account, the key is the whole credential (see accounts.mjs for why there is
   no password behind it), and this compares the presented key against the
   stored one. That is the entire check.

   THE KEY IS NEVER TRUSTED AS A CLAIM. It is looked up, not decoded: nothing
   here reads an identity out of the token the caller supplied. That is worth
   keeping even in a system this relaxed, because the failure it prevents —
   believing a self-asserted id — is the one that stays invisible until
   somebody tries it. */
import { store, keyMatches } from './accounts.mjs';

export async function authenticate(req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+([0-9a-f-]{8,64})\.([0-9a-f]{32,128})$/i);
  if (!m) return null;

  const id = m[1].toLowerCase(), key = m[2].toLowerCase();
  const acct = await store().get('a/' + id, { type: 'json' }).catch(() => null);
  if (!acct || !keyMatches(acct.key, key)) return null;

  return { id, name: acct.name || '' };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/* WHICH ORIGINS MAY CALL THIS. The game is published twice from one artifact —
   GitHub Pages keeps serving the play URL, Netlify serves the copy with these
   functions behind it — so the browser making these calls is not always on
   this origin. A named list rather than '*': these endpoints carry a bearer
   key, and '*' is the shape of an account any page on the internet can read.
   localhost is here for `netlify dev`. */
const ALLOWED = new Set([
  'https://cosmo-arcade.netlify.app',
  'https://ats314.github.io',
  'http://localhost:8000',
  'http://localhost:8888',
]);

export function cors(req, res) {
  const origin = req.headers.get('origin');
  if (origin && ALLOWED.has(origin)) {
    res.headers.set('access-control-allow-origin', origin);
    res.headers.set('vary', 'origin');
    res.headers.set('access-control-allow-headers', 'authorization, content-type');
    res.headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
    res.headers.set('access-control-max-age', '86400');
  }
  return res;
}

/* A preflight has to answer before any handler runs, and it must NOT require
   auth: the browser sends OPTIONS without the Authorization header by design,
   so an endpoint that 401s its own preflight is one no cross-origin page can
   ever reach. */
export function preflight(req) {
  if (req.method !== 'OPTIONS') return null;
  return cors(req, new Response(null, { status: 204 }));
}
