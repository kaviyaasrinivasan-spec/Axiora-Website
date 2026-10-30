# Axiora Change & Defect Tracker

An internal web application for AXIORA LABS AI that tracks every **Requirement** and **Defect** from request to production. Each item follows one controlled path: development, developer self-test, QA verification, approval, and production deployment. The server enforces that path, and every step is recorded.

It is deliberately not a test-case management system. There are no test suites, test cases or execution runs.

**Live at https://axioralabs.ai/qa/** (PHP backend, alongside the WordPress site). There are two interchangeable backends behind the same frontend and API:

- **Node** (`src/`), used for local development.
- **PHP** (`php/`), used for the live site, because the Hostinger plan cannot run Node.

One test suite checks both: `npm test` and `npm run test:php`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Quick start (local)

Requirements: **Node.js 22.13 or newer** (Node 24 recommended). Nothing else is needed: the database is SQLite, built into Node.

```bash
cd axiora-tracker
npm install
npm run seed:demo      # optional: demo users, products and items (refuses to run in production)
npm start              # http://127.0.0.1:3000
```

Demo accounts (password `Demo-Password-2026`):

| Email | Role |
|---|---|
| admin@demo.axiora.local | Admin / Product Owner |
| magesh@demo.axiora.local, ashraf@…, kaviya@… | Developer |
| qa@demo.axiora.local, qa2@demo.axiora.local | QA Engineer |
| release@demo.axiora.local | Release Manager |

To start with an empty database and your own admin account instead:

```bash
cp .env.example .env    # set ADMIN_EMAIL and ADMIN_PASSWORD, then start once
npm start
# or, interactively:
npm run create-admin -- --email you@axioralabs.ai --name "Your Name"
```

Then sign in, open **Settings** to add products and modules (for example CARGORA and iClinical.ai), and add your team in **User Management**.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server (applies pending migrations on boot) |
| `npm run dev` | Run with auto-restart on file changes |
| `npm run migrate` | Apply pending database migrations without starting the server |
| `npm run create-admin` | Create an admin account |
| `npm run seed:demo` | Load demo data into an **empty** database. Blocked when `NODE_ENV=production` |
| `npm test` | Run the automated test suite (30 tests, about 3 seconds) |

---

## The workflow

```
New → Assigned → In Development → Self-Test → Ready for QA → QA In Progress ─┬→ QA Approved → (Ready for Production) → Deployed to Production → Verified in Production
                       ↑                                                     │
                       └──────── Start Fix ←── QA Rejected ←─────────────────┘
```

| Step | Who | Rule enforced by the server |
|---|---|---|
| Assign | Admin, Developer or QA | Assignee must be an active Developer (or Admin). Reassigning is allowed while the item is New, Assigned, In Development or QA Rejected |
| Start Development | Any signed-in user, whatever their role or assignment | The item must be Assigned. The assigned developer stays the same and does the later development steps |
| Move to Self-Test | Assigned developer | Implementation notes are required |
| Record Self-Test | Assigned developer | Result, test date (not in the future) and details are required. **Failed** sends the item back to In Development |
| Submit to QA | Assigned developer | Only allowed when the **current** development attempt has a **Passed** self-test |
| Assign QA | QA Engineer or Admin | From Ready for QA or QA In Progress. The QA engineer must not have worked on the change. Only the assigned QA engineer can start QA; an unassigned item is claimed by whoever starts it. After a rejection the same QA engineer stays assigned for the re-test |
| Start QA / Approve / Reject | The assigned QA Engineer (or Admin) | Approve/Reject only by the QA engineer verifying the item. The person must **not** have worked on the change (assignee, or anyone who developed or self-tested it). Approval requires verification notes. Rejection requires a reason **and** evidence (observations or attached files) |
| Start Fix (after rejection) | Assigned developer | Starts a new development attempt. The earlier self-test no longer counts, so a new passed self-test is required |
| Add to Production Queue | Release Manager or Admin | Only from QA Approved |
| Move to Production | Release Manager or Admin | From QA Approved or Ready for Production. The item becomes **Deployed to Production**, recording who moved it and when, plus optional notes and files (shown on the item's Production tab) |
| Verify in Production | Anyone signed in | Only from Deployed to Production. The item becomes **Verified in Production** (the final stage), recording who verified it and when, plus optional notes and files. Listed under the **Verified in Production** menu; like deployed items it is locked against edits and deletion |
| Return for Investigation | Release Manager or Admin | From QA Approved or Ready for Production, with a reason. It must pass self-test and QA again |

Status can never be edited directly. The edit endpoint rejects `status`, `assignment` and `category`, and every transition goes through one function ([src/services/items.js](src/services/items.js) `performAction`). That function re-checks the rules in [src/workflow.js](src/workflow.js) inside a database transaction. Every change is written to the `activity` table with who did it, when, the old and new status, and any comment. Previous self-test results, QA verifications (including rejections) and deployment attempts are kept, never overwritten.

### Who can move items (open workflow)

**Any signed-in user can perform every workflow step**, whatever their role and whoever the item is assigned to. The "Who" column in the table above describes each role's usual job, not a restriction.

- **What the server still enforces:**
  - the stage order: an action is only possible from its listed statuses
  - required details: implementation notes, self-test details, QA notes, rejection reason and evidence, return reason
  - Submit to QA needs a passed self-test in the current attempt
  - sign-in and the CSRF header
- **Records:** every step is recorded under the person who did it. Starting QA makes that person the item's QA engineer.
- **Pickers:** in **Settings → Developer & QA pickers** (stored in `workflow_permissions`, audited), admins choose which roles appear in the Developer and QA engineer pickers.
- **Still role-based:** creating, editing and deleting items, and managing users and settings.

### Planning Status

Separately from the workflow, every item has a **Planning Status**: Backlog, Planned, Active or On Hold. New items default to Backlog. Any signed-in user can change it from the item page (`POST /api/items/:id/planning`). Changing it only updates that label and the item's last-updated time. Workflow status, assignee, QA engineer and self-tests are untouched, and the available workflow actions stay the same. Each change is logged in the item's History as "changed planning status", without workflow from/to statuses. Lists, the CSV export and the `planning` filter include it.

### Releases (removed)

The separate Releases section (grouping items into releases with deployment attempts) has been replaced by the **Move to Production** step. The old `releases`, `release_items` and `deployments` tables are kept untouched so earlier history stays intact, but nothing in the app reads or writes them any more.

### CEO Dashboard (admins only)

`#/ceo-dashboard` (`GET /api/ceo-dashboard`). It's admin-only on both the menu and the API ([src/services/ceo.js](src/services/ceo.js), PHP port in `php/lib/ceo.php`).

- **Filters:** a date range (Today / This Week / This Month / Custom, in the viewer's time zone) plus product, type, developer and priority filters.
- **Period figures come from the activity trail**, using the time each event was recorded:
  - new items count by creation time
  - "moved to" cards count the items that entered that status
  - deployments count when the item reached Deployed
- **KPI comparison:** each card compares with the same number of days immediately before.
- **Trend charts** cover the period, widened to at least 7 days, and group by month beyond 62 days.
- **Snapshots:** "Current Items by Status" and "Pending & Risks" are live snapshots that ignore the dates.

### Role permissions

| Capability | Admin | Developer | QA | Release Manager |
|---|:-:|:-:|:-:|:-:|
| View all items, dashboard and reports | ✔ | ✔ | ✔ | ✔ |
| Comment and attach files | ✔ | ✔ | ✔ | ✔ |
| Create items | ✔ | ✔ | ✔ | |
| Edit item details | ✔ (until deployed) | | creator, while New/Assigned | |
| Assign developers | ✔ | ✔ | ✔ | |
| Delete items (not once in production) | ✔ | | | |
| Start development (any assigned item) | ✔ | ✔ | ✔ | ✔ |
| Develop, self-test and submit (own assigned items) | ✔ if assigned | ✔ | | |
| QA verify (not own work) | ✔ | | ✔ | |
| Assign QA engineer | ✔ | | ✔ | |
| Production queue and Move to Production | ✔ | | | ✔ |
| Users and settings | ✔ | | | |

These rules are enforced in the API. The UI only shows the buttons that the API will accept for the signed-in user and the item's current status. To change who can create items, edit `CREATE_ROLES` in [src/workflow.js](src/workflow.js); the workflow steps are configured in Settings.

---

## Architecture

```
axiora-tracker/
├── server.js                 entry point: open DB → migrate → bootstrap admin → listen
├── migrations/               numbered SQL migrations, applied in order and tracked in schema_migrations
├── src/
│   ├── config.js             environment configuration (.env loaded via process.loadEnvFile)
│   ├── db.js                 SQLite connection (node:sqlite), migration runner, transaction helper
│   ├── auth.js               scrypt password hashing, DB-backed sessions, idle timeout
│   ├── workflow.js           statuses, transitions, role rules (single source of truth)
│   ├── app.js                Express app: security headers, CSRF guard, static files, error handler
│   ├── routes/api.js         REST API
│   └── services/             items, dashboard/reports, CEO dashboard, permissions, attachments, activity, admin
├── public/                   single-page frontend: plain ES modules, no build step
│   ├── js/app.js             router + layout
│   ├── js/lib.js             escaping HTML templates, API client, dialogs, form helpers
│   └── js/pages/*.js         one module per screen
├── scripts/                  migrate, create-admin, seed-demo
└── test/                     node:test suites driving the real HTTP API
```

**Why this stack.** The repository was empty, so this is a new application with as few moving parts as possible. It has two runtime dependencies (Express and Multer) and no build step. The database is a single SQLite file, comfortably sufficient for an internal team tool. Moving to PostgreSQL later means porting the SQL in `migrations/` and `src/services/`; the SQL is plain and uses no SQLite-specific features beyond `julianday` in one report.

**Security measures**

- Passwords are hashed with scrypt.
- Session tokens are random, 256-bit, stored only as SHA-256 hashes, and sent in an `HttpOnly`, `SameSite=Lax` cookie (also `Secure` over HTTPS).
- Sessions are revoked when a user is deactivated or their role or password changes.
- Every state-changing API call must carry an `X-Requested-With` header (CSRF protection).
- A strict Content Security Policy is set, with no inline scripts.
- All user text is HTML-escaped by the template helper.
- Attachments:
  - Allowed file types come from an extension allow-list.
  - Each file is stored under a random name, outside the web root.
  - Files are served only to signed-in users, with a sandboxing CSP and `nosniff`.
- CSV exports are protected against spreadsheet formula injection.
- `LIKE` search wildcards are escaped.
- Failed sign-ins are not locked out (removed at the owner's request); use strong passwords.

**Dashboard accuracy.** All counts come from SQL `COUNT` queries. The dashboard, item list, CSV export and reports share one filter builder (`buildFilter`), so a card's number always equals the row count of the list it links to. A test checks this.

## Configuration

See [.env.example](.env.example). The key settings:

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` blocks demo data |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | |
| `DATA_DIR` | `./data` | Holds `tracker.db` and `uploads/`. **Back this directory up** |
| `TRUST_PROXY` | `false` | Set `true` behind an HTTPS reverse proxy |
| `SESSION_IDLE_MINUTES` | `30` | Signed out after this many minutes without activity (normal sign-ins) |
| `SESSION_TTL_HOURS` | `12` | Maximum length of a normal sign-in, however active |
| `REMEMBER_DAYS` | `30` | Length of a "Remember me" sign-in (no idle timeout) |
| `COOKIE_SECURE` | `auto` | |
| `MAX_UPLOAD_MB` | `10` | Per file |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | | Creates the first admin when there are no users |

## Database migrations

Migrations are plain `.sql` files in [migrations/](migrations/), named `NNN_description.sql`. On startup (or `npm run migrate`), each file that is not yet listed in `schema_migrations` runs inside a transaction, in filename order. To change the schema, add a new file such as `002_add_due_reminders.sql`. Never edit a migration that has already run in production.

## Testing

`npm test` starts the real app on a random port with an in-memory database, then exercises it over HTTP. It covers:

- authentication, CSRF and role permissions
- item validation and attachments
- self-test gating, including a failed self-test and resubmission
- QA independence, so nobody can approve their own work
- rejection and re-test loops, with history preserved
- production gating: only QA-approved items can be queued or moved to production, by permitted roles
- audit trail completeness
- dashboard counts compared against direct SQL counts
- admin safety rules

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment.
