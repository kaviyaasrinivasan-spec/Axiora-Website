import crypto from 'node:crypto';
import { config } from './config.js';
import { HttpError, nowIso } from './util.js';

export const ROLES = {
  admin: 'Admin / Product Owner',
  developer: 'Developer',
  qa: 'QA Engineer',
  release_manager: 'Release Manager',
};

const COOKIE = 'axt_session';
const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10) return 'Password must be at least 10 characters.';
  if (password.length > 200) return 'Password is too long.';
  return null;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Expiry for a normal (not remembered) session: SESSION_IDLE_MINUTES from now, capped at
 * SESSION_TTL_HOURS after sign-in.
 */
function idleExpiry(createdAtMs) {
  return new Date(Math.min(Date.now() + config.sessionIdleMinutes * 60000, createdAtMs + config.sessionTtlHours * 3600000)).toISOString();
}

export function createSession(db, userId, { remember = false } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expires = remember ? new Date(now + config.rememberDays * 86400000).toISOString() : idleExpiry(now);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, remember) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), userId, new Date(now).toISOString(), expires, remember ? 1 : 0);
  return { token, expires };
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return out;
}

export function sessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE];
}

/** A remembered sign-in gets a persistent cookie; otherwise it is a browser-session cookie. */
export function setSessionCookie(req, res, token, expires, persistent = false) {
  const secure = config.cookieSecure === 'true' || (config.cookieSecure === 'auto' && req.secure);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', ...(persistent ? { expires: new Date(expires) } : {}) });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches req.user when the session cookie maps to a live session of an active user. */
/**
 * Attaches req.user when the session cookie maps to a live session of an active user.
 * Normal sessions slide: each request pushes the idle expiry forward (written at most once a
 * minute). Requests marked X-Session-Check (the browser's idle probe) do not count as activity.
 */
export function loadUser(db) {
  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, s.token_hash, s.remember, s.created_at, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`);
  const touch = db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?');
  return (req, _res, next) => {
    const token = sessionToken(req);
    const row = token ? stmt.get(sha256(token), nowIso()) : null;
    if (row && !row.remember && req.get('X-Session-Check') !== '1') {
      const extended = idleExpiry(Date.parse(row.created_at));
      // Write at most about once a minute (sooner for very short idle times).
      if (Date.parse(extended) - Date.parse(row.expires_at) > Math.min(60000, config.sessionIdleMinutes * 6000)) touch.run(extended, row.token_hash);
    }
    req.user = row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
    req.session = row ? { remember: Boolean(row.remember) } : null;
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do this.'));
    next();
  };
}
