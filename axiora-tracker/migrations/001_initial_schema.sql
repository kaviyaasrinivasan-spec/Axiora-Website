-- Initial schema for the Change & Defect Tracker.
-- Timestamps are ISO-8601 UTC strings; dates (tested_on, due_date) are YYYY-MM-DD.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'developer', 'qa', 'release_manager')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE products (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE modules (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL COLLATE NOCASE,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (product_id, name)
);

CREATE TABLE releases (
  id           INTEGER PRIMARY KEY,
  release_key  TEXT NOT NULL UNIQUE,
  version      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title        TEXT,
  notes        TEXT,
  planned_date TEXT,
  status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'deploying', 'deployed', 'failed')),
  deployed_at  TEXT,
  deployed_by  INTEGER REFERENCES users(id),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE items (
  id                   INTEGER PRIMARY KEY,
  item_key             TEXT UNIQUE,
  category             TEXT NOT NULL CHECK (category IN ('requirement', 'defect')),
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  product_id           INTEGER NOT NULL REFERENCES products(id),
  module               TEXT,
  priority             TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  requested_by         TEXT NOT NULL,
  assigned_to          INTEGER REFERENCES users(id),
  status               TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                         'new', 'assigned', 'in_development', 'self_test', 'ready_for_qa',
                         'qa_in_progress', 'qa_rejected', 'qa_approved', 'ready_for_production', 'deployed')),
  due_date             TEXT,
  -- Defect-only fields
  steps_to_reproduce   TEXT,
  actual_behaviour     TEXT,
  environment          TEXT,
  -- Requirement-only fields
  business_requirement TEXT,
  acceptance_criteria  TEXT,
  -- Shared
  expected_behaviour   TEXT,
  implementation_notes TEXT,
  -- Workflow bookkeeping
  dev_cycle            INTEGER NOT NULL DEFAULT 1,
  current_self_test_id INTEGER REFERENCES self_tests(id),
  qa_by                INTEGER REFERENCES users(id),
  release_id           INTEGER REFERENCES releases(id),
  deployed_at          TEXT,
  deployed_version     TEXT,
  deployed_by          INTEGER REFERENCES users(id),
  created_by           INTEGER NOT NULL REFERENCES users(id),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX items_status     ON items(status);
CREATE INDEX items_product    ON items(product_id);
CREATE INDEX items_assigned   ON items(assigned_to);
CREATE INDEX items_category   ON items(category);
CREATE INDEX items_priority   ON items(priority);
CREATE INDEX items_updated    ON items(updated_at);
CREATE INDEX items_created    ON items(created_at);
CREATE INDEX items_release    ON items(release_id);

CREATE TABLE self_tests (
  id         INTEGER PRIMARY KEY,
  item_id    INTEGER NOT NULL REFERENCES items(id),
  cycle      INTEGER NOT NULL,
  result     TEXT NOT NULL CHECK (result IN ('passed', 'failed')),
  tested_on  TEXT NOT NULL,
  notes      TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX self_tests_item ON self_tests(item_id);

CREATE TABLE qa_verifications (
  id         INTEGER PRIMARY KEY,
  item_id    INTEGER NOT NULL REFERENCES items(id),
  cycle      INTEGER NOT NULL,
  result     TEXT NOT NULL CHECK (result IN ('approved', 'rejected')),
  tested_on  TEXT NOT NULL,
  notes      TEXT NOT NULL,
  observed   TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX qa_verifications_item ON qa_verifications(item_id);

CREATE TABLE comments (
  id         INTEGER PRIMARY KEY,
  item_id    INTEGER NOT NULL REFERENCES items(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comments_item ON comments(item_id);

CREATE TABLE attachments (
  id            INTEGER PRIMARY KEY,
  item_id       INTEGER REFERENCES items(id),
  release_id    INTEGER REFERENCES releases(id),
  context       TEXT NOT NULL CHECK (context IN ('item', 'self_test', 'qa', 'deployment', 'comment')),
  ref_id        INTEGER,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL UNIQUE,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL
);
CREATE INDEX attachments_item    ON attachments(item_id);
CREATE INDEX attachments_release ON attachments(release_id);

-- Audit trail: every status change and material edit lands here.
CREATE TABLE activity (
  id          INTEGER PRIMARY KEY,
  item_id     INTEGER REFERENCES items(id),
  release_id  INTEGER REFERENCES releases(id),
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  details     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX activity_item    ON activity(item_id);
CREATE INDEX activity_release ON activity(release_id);
CREATE INDEX activity_created ON activity(created_at);

CREATE TABLE release_items (
  id             INTEGER PRIMARY KEY,
  release_id     INTEGER NOT NULL REFERENCES releases(id),
  item_id        INTEGER NOT NULL REFERENCES items(id),
  added_by       INTEGER NOT NULL REFERENCES users(id),
  added_at       TEXT NOT NULL,
  removed_by     INTEGER REFERENCES users(id),
  removed_at     TEXT,
  removal_reason TEXT,
  outcome        TEXT CHECK (outcome IS NULL OR outcome = 'deployed')
);
CREATE INDEX release_items_release ON release_items(release_id);
-- An item can sit in at most one open (not removed, not yet deployed) release.
CREATE UNIQUE INDEX release_items_one_open ON release_items(item_id) WHERE removed_at IS NULL AND outcome IS NULL;

CREATE TABLE deployments (
  id           INTEGER PRIMARY KEY,
  release_id   INTEGER NOT NULL REFERENCES releases(id),
  started_by   INTEGER NOT NULL REFERENCES users(id),
  started_at   TEXT NOT NULL,
  completed_by INTEGER REFERENCES users(id),
  completed_at TEXT,
  outcome      TEXT CHECK (outcome IS NULL OR outcome IN ('success', 'failed')),
  notes        TEXT
);
CREATE INDEX deployments_release ON deployments(release_id);
