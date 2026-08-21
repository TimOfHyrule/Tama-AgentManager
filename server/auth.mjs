// Signing in as the person, which is the only thing on this server that a
// person does at all.
//
// The agents never come through here. They hold a fleet secret and call an
// API, so a login screen is not on their path -- which is exactly why the
// approvals live behind one. docs/BOUNDARIES.md has the argument.
//
// Google issues the identity because the alternative is storing a password,
// and a password store is a thing to get wrong on a server whose whole job is
// being the place authority cannot be forged.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAIL,
  SESSION_SECRET, PUBLIC_URL,
} = process.env;

// Configured or not, said once at boot rather than discovered at the moment
// somebody needed to approve something.
export const configured = Boolean(
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && ADMIN_EMAIL && SESSION_SECRET && PUBLIC_URL,
);
export const missing = Object.entries({
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAIL, SESSION_SECRET, PUBLIC_URL,
}).filter(([, v]) => !v).map(([k]) => k);

const REDIRECT = () => `${PUBLIC_URL.replace(/\/$/, '')}/auth/callback`;

// ── The cookie ───────────────────────────────────────────────────────────
//
// __Host- is not decoration. The manager answers at a subdomain of the same
// name as the Tamarada it governs, and a browser treats those as one site --
// so a script on the parent name can write cookies that arrive here. The
// prefix makes the browser refuse any cookie carrying a Domain attribute at
// all, which is what stops that.
const COOKIE = '__Host-session';

const sign = (value) => createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');

export function issueCookie(email) {
  const body = Buffer.from(JSON.stringify({ email, at: Date.now() })).toString('base64url');
  const value = `${body}.${sign(body)}`;
  // 12 hours. Long enough for a day of approving, short enough that a laptop
  // left open somewhere is not a standing authorization.
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

export function readSession(req) {
  const raw = (req.headers.cookie ?? '').split(';')
    .map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const [body, mac] = raw.slice(COOKIE.length + 1).split('.');
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { email, at } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() - at > 12 * 3600 * 1000) return null;
    // The allowed account can be changed by changing the variable, and every
    // cookie signed for anybody else stops working the moment it does.
    if (email !== ADMIN_EMAIL) return null;
    return { email };
  } catch { return null; }
}

// ── CSRF ─────────────────────────────────────────────────────────────────
//
// SameSite is not enough here, for the same reason __Host- is needed: the
// manager and the Tamarada it governs are one site to a browser, so a request
// from the parent name is same-site. The token is what actually separates
// them.
export const csrfToken = (email) => sign(`csrf:${email}`);
export function csrfOk(email, given) {
  const a = Buffer.from(String(given ?? '')); const b = Buffer.from(csrfToken(email));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── The Google round trip ────────────────────────────────────────────────

export function authorizeUrl(state) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', REDIRECT());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email');
  u.searchParams.set('state', state);
  // Only ever one account should be able to get in, so offering the chooser
  // costs nothing and saves the "signed in as the wrong Google" confusion.
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

export const newState = () => randomBytes(16).toString('base64url');
export const stateCookie = (state) =>
  `__Host-oauth=${state}.${sign(state)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`;
export function stateOk(req, given) {
  const raw = (req.headers.cookie ?? '').split(';')
    .map((c) => c.trim()).find((c) => c.startsWith('__Host-oauth='));
  if (!raw || !given) return false;
  const [state, mac] = raw.slice('__Host-oauth='.length).split('.');
  return state === given && mac === sign(state);
}

// The email comes from Google's own userinfo endpoint over TLS rather than
// from a token this server decodes. There is no signature to verify and no
// library to keep current -- the answer arrives from the party that issued it.
export async function emailFromCode(code) {
  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT(), grant_type: 'authorization_code',
    }),
  });
  if (!token.ok) throw new Error(`google token exchange failed: ${token.status}`);
  const { access_token } = await token.json();

  const who = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!who.ok) throw new Error(`google userinfo failed: ${who.status}`);
  const { email, email_verified } = await who.json();
  if (!email || email_verified === false) throw new Error('google returned no verified email');
  return email;
}
