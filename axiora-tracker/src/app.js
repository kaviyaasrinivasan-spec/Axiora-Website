import path from 'node:path';
import express from 'express';
import { loadUser } from './auth.js';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';
import { HttpError } from './util.js';

const PUBLIC = path.join(config.root, 'public');

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
    "object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

// State-changing API calls must carry a custom header. Browsers cannot add it to a
// cross-site request without a CORS preflight (which we never grant), so this blocks CSRF.
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'axiora-tracker') return next(new HttpError(403, 'Missing request header.'));
  next();
}

function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body.'; }
  else if (err.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint/.test(err.message)) { status = 409; message = 'This record already exists.'; }
  else if (!(err instanceof HttpError) && status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    message = 'Something went wrong. Please try again.';
  }
  res.status(status).json({ error: message, ...(err.fields ? { fields: err.fields } : {}) });
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(loadUser(db));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, csrfGuard, apiRouter(db));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use(express.static(PUBLIC, { index: false, maxAge: config.isProduction ? '1h' : 0 }));
  // Single-page app: every other GET serves the shell; the client-side router takes over.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(PUBLIC, 'index.html'));
  });
  app.use(errorHandler);
  return app;
}
