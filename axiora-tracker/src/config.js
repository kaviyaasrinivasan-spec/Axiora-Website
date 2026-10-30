import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // No .env file: rely on the real environment.
}

const env = process.env;
const dataDir = path.resolve(ROOT, env.DATA_DIR || 'data');

export const config = {
  root: ROOT,
  env: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  host: env.HOST || '127.0.0.1',
  port: Number(env.PORT || 3000),
  dataDir,
  dbFile: path.resolve(dataDir, env.DB_FILE || 'tracker.db'),
  uploadDir: path.resolve(dataDir, env.UPLOAD_DIR || 'uploads'),
  // Normal sign-ins end after this many minutes without activity, and never last longer than SESSION_TTL_HOURS.
  sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES || 30),
  sessionTtlHours: Number(env.SESSION_TTL_HOURS || 12),
  // "Remember me" sign-ins last this long instead of SESSION_TTL_HOURS.
  rememberDays: Number(env.REMEMBER_DAYS || 30),
  // 'auto' sets the Secure flag when the request arrived over HTTPS.
  cookieSecure: (env.COOKIE_SECURE || 'auto').toLowerCase(),
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 10),
  maxFilesPerUpload: Number(env.MAX_FILES_PER_UPLOAD || 50),
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  adminName: env.ADMIN_NAME || 'Administrator',
};
