-- Planning Status: a planning label (Backlog / Planned / Active / On Hold) kept separate from the
-- workflow status. Existing items start in the backlog.
ALTER TABLE items ADD COLUMN planning_status TEXT NOT NULL DEFAULT 'backlog'
  CHECK (planning_status IN ('backlog', 'planned', 'active', 'on_hold'));
CREATE INDEX items_planning ON items(planning_status);
