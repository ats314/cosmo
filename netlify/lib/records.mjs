/* THE MERGE IS SERVER-SIDE, AND THAT IS THE WHOLE POINT.

   Two devices and one account means two writers, and the naive design — the
   client sends its document, the server stores it — makes the last device to
   close the tab the winner. A phone that has not synced since Tuesday would
   overwrite Thursday's best score with Tuesday's, and the player would watch a
   record they actually set disappear. So the client never replaces the stored
   document; it proposes one, and the server folds it in.

   The rules below are the same ones the game already applies locally in
   loadPrefs(): a record takes the MAX of what it has and what it is told,
   because the value means "the best this human has ever done" and that is
   monotonic by definition. Once that is the rule, order stops mattering and
   the two devices commute — which is what makes an offline device safe to
   sync days later.

   It also removes a whole class of tampering for free. A client that posts
   best:0 cannot lower anything; the only direction a record moves is up, and
   the ceiling below is what stops "up" meaning 9e9. */

export const LEVEL_MAX = 6;

/* Generous on purpose — see scores.mjs. This bound exists to reject impossible
   numbers, not to adjudicate good play. */
export const SCORE_CEILING = 5_000_000;

const asInt = v => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/* max: a record only ever climbs. clamp keeps a hostile or corrupt value from
   becoming the new floor for every future merge. */
const max = (lo, hi) => (mine, theirs) => {
  const a = asInt(mine), b = asInt(theirs);
  const best = Math.max(a === null ? -Infinity : a, b === null ? -Infinity : b);
  if (!Number.isFinite(best)) return undefined;
  return String(Math.min(hi, Math.max(lo, best)));
};

/* sticky: "this human has once done X". It can never become false again —
   forgetting it would replay a once-ever tutorial at somebody who has already
   been taught, which is worse than remembering it wrongly. */
const sticky = (mine, theirs) => (mine === '1' || theirs === '1') ? '1' : undefined;

/* union: the set of things already introduced. Same argument as sticky, over a
   list. Bounded because it is client-supplied and would otherwise grow without
   limit in a document that is read on every page load. */
const union = (mine, theirs) => {
  const s = new Set();
  for (const src of [mine, theirs]) {
    if (typeof src !== 'string') continue;
    for (const k of src.split(',')) {
      const t = k.trim();
      if (t && /^[a-z0-9_]{1,24}$/i.test(t)) s.add(t);
    }
  }
  if (!s.size) return undefined;
  return [...s].slice(0, 64).join(',');
};

/* last: a PREFERENCE, not a record. Muting is a statement about right now, and
   the most recent statement is the true one. Applying max to a preference is
   how you build a mute that cannot be undone. */
const last = (mine, theirs) => (theirs === undefined || theirs === null ? mine : String(theirs));

const oneOf = (...allowed) => (mine, theirs) =>
  allowed.includes(theirs) ? theirs : (allowed.includes(mine) ? mine : undefined);

const name = (mine, theirs) => {
  const clean = v => (typeof v === 'string' ? v.trim().slice(0, 12) : '');
  const t = clean(theirs);
  if (t && /^[\x20-\x7E]+$/.test(t)) return t;
  return clean(mine) || undefined;
};

/* Keyed on the bare key — the game stores everything under `cometloop:<k>`.
   A key that is not listed here is NOT synced, deliberately: an unknown key is
   an unbounded write into a document this server hands back to every device on
   the account, and "store whatever the client sends" is how a save file
   becomes an injection vector. Adding a synced key is a decision. */
export const RULES = {
  best:     max(0, SCORE_CEILING),
  gl:       max(1, LEVEL_MAX),
  runs:     max(0, 1_000_000),
  struggle: max(0, 1_000),
  groove:   sticky,
  hopped:   sticky,
  landed:   sticky,
  seen:     union,
  seen2:    union,
  muted:    oneOf('0', '1'),
  swipe:    oneOf('radial', 'screen'),
  name,
};

export const SYNCED_KEYS = Object.keys(RULES);

/* Fold a proposed document into the stored one. Neither argument is trusted;
   `stored` is only more trustworthy because it already went through here. */
export function merge(stored, proposed) {
  const out = {};
  const a = stored && typeof stored === 'object' ? stored : {};
  const b = proposed && typeof proposed === 'object' ? proposed : {};
  for (const k of SYNCED_KEYS) {
    const v = RULES[k](a[k], b[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
