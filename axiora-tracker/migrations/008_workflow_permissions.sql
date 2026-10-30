-- Admin-configurable workflow permissions: which roles may perform each workflow step.
-- Only permissions an admin has changed are stored; the rest use the defaults in workflow.js / workflow.php.
CREATE TABLE workflow_permissions (
  permission TEXT PRIMARY KEY,
  roles      TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL
);
