/* WHO SOMEBODY IS, WITHOUT A PASSWORD.

   The owner's call, and it is the right one for what this is: a handful of
   friends testing a game. "We don't even need passwords." So there are none.
   You type a name, the server mints an account and hands back a long random
   key, and that key living in your browser IS the login. No email, no
   password, no reset flow, no confirmation round trip, nothing to forget and
   nothing standing between a friend and their first run.

   WHAT THIS IS AND IS NOT. It is a stable personal identity: the same person
   across sessions and across devices, which is all that per-player records, a
   leaderboard and a PostHog join actually need. It is NOT proof of who anyone
   is — the key is a bearer token, so whoever holds it is the account, and
   there is no second factor behind it. That trade is deliberate and it is
   sized to the situation: the thing being protected is a score on a board
   among people who know each other. It should be revisited before this is
   handed to strangers, and the note in scores.mjs about replay validation is
   the other half of that same conversation.

   THE KEY IS 32 RANDOM BYTES, which is the one place not to economise. It is
   the entire credential, so it has to be unguessable even though nothing else
   here is trying hard; a short code would make account takeover a matter of
   counting. Transfer codes are short — six characters — but they are
   single-use and expire in ten minutes, which is what makes short safe. */
import { getStore } from '@netlify/blobs';

export const ACCOUNTS = 'cosmo-accounts';
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   /* no O/0, no I/1/L */

export const store = () => getStore({ name: ACCOUNTS, consistency: 'strong' });

export const rand = n => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
};

export function makeCode() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map(x => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

/* Names are shown to other players on the board, so they are bounded here and
   escaped again at the point of display. Both, because either one alone is a
   single point of failure for the same bug. */
export function cleanName(s) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 12);
  return /^[A-Za-z0-9 _.\-]{1,12}$/.test(t) ? t : '';
}

/* Constant-time-ish compare. The threat here is nil and the cost is nil, and
   writing `a === b` in an auth path is the kind of line that gets copied into
   somewhere it matters. */
export function keyMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const CODE_EXPIRY = CODE_TTL_MS;
