-- Idle timeout: normal sessions now expire SESSION_IDLE_MINUTES after the last activity, so the
-- server needs to know which sessions were "Remember me" sign-ins (those keep their long expiry).
ALTER TABLE sessions ADD COLUMN remember INTEGER NOT NULL DEFAULT 0 CHECK (remember IN (0, 1));
