-- Adds "blocker" as the highest priority. SQLite cannot change a CHECK constraint in place,
-- so the items table is rebuilt (SQLite's documented 12-step procedure; the migration runner
-- disables foreign-key enforcement around it and verifies integrity afterwards).

CREATE TABLE items_new (
  id                   INTEGER PRIMARY KEY,
  item_key             TEXT UNIQUE,
  category             TEXT NOT NULL CHECK (category IN ('requirement', 'defect')),
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  product_id           INTEGER NOT NULL REFERENCES products(id),
  module               TEXT,
  priority             TEXT NOT NULL CHECK (priority IN ('blocker', 'critical', 'high', 'medium', 'low')),
  requested_by         TEXT NOT NULL,
  assigned_to          INTEGER REFERENCES users(id),
  status               TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                         'new', 'assigned', 'in_development', 'self_test', 'ready_for_qa',
                         'qa_in_progress', 'qa_rejected', 'qa_approved', 'ready_for_production', 'deployed')),
  due_date             TEXT,
  steps_to_reproduce   TEXT,
  actual_behaviour     TEXT,
  environment          TEXT,
  business_requirement TEXT,
  acceptance_criteria  TEXT,
  expected_behaviour   TEXT,
  implementation_notes TEXT,
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

INSERT INTO items_new (
  id, item_key, category, title, description, product_id, module, priority, requested_by, assigned_to, status, due_date,
  steps_to_reproduce, actual_behaviour, environment, business_requirement, acceptance_criteria, expected_behaviour,
  implementation_notes, dev_cycle, current_self_test_id, qa_by, release_id, deployed_at, deployed_version, deployed_by,
  created_by, created_at, updated_at)
SELECT
  id, item_key, category, title, description, product_id, module, priority, requested_by, assigned_to, status, due_date,
  steps_to_reproduce, actual_behaviour, environment, business_requirement, acceptance_criteria, expected_behaviour,
  implementation_notes, dev_cycle, current_self_test_id, qa_by, release_id, deployed_at, deployed_version, deployed_by,
  created_by, created_at, updated_at
FROM items;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

CREATE INDEX items_status   ON items(status);
CREATE INDEX items_product  ON items(product_id);
CREATE INDEX items_assigned ON items(assigned_to);
CREATE INDEX items_category ON items(category);
CREATE INDEX items_priority ON items(priority);
CREATE INDEX items_updated  ON items(updated_at);
CREATE INDEX items_created  ON items(created_at);
CREATE INDEX items_release  ON items(release_id);
