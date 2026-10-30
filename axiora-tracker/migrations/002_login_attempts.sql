-- Failed sign-in counters, used by the PHP backend (each PHP request is a fresh process,
-- so the limiter cannot live in memory as it does in the Node server).
CREATE TABLE login_attempts (
  attempt_key TEXT PRIMARY KEY,
  count       INTEGER NOT NULL,
  until       TEXT NOT NULL
);
