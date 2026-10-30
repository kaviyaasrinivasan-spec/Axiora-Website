// Loads demo users, products and items for local evaluation. Never runs in production.
// Every item is driven through the real workflow functions, so its audit trail is genuine.
import { config } from '../src/config.js';
import { migrate, openDb } from '../src/db.js';
import { createUser, saveModule, saveProduct } from '../src/services/admin.js';
import { createItem, performAction } from '../src/services/items.js';

if (config.isProduction) {
  console.error('Refusing to load demo data: NODE_ENV is production.');
  process.exit(1);
}

const db = openDb();
migrate(db);
if (db.prepare('SELECT COUNT(*) AS n FROM items').get().n > 0) {
  console.error(`The database at ${config.dbFile} already has items. Demo data is only loaded into an empty database.`);
  process.exit(1);
}

const PASSWORD = 'Demo-Password-2026';
const people = [
  ['Senthil', 'admin@demo.axiora.local', 'admin'],
  ['Magesh', 'magesh@demo.axiora.local', 'developer'],
  ['Ashraf', 'ashraf@demo.axiora.local', 'developer'],
  ['Kaviya', 'kaviya@demo.axiora.local', 'developer'],
  ['Priya', 'qa@demo.axiora.local', 'qa'],
  ['Suresh', 'qa2@demo.axiora.local', 'qa'],
  ['Arun', 'release@demo.axiora.local', 'release_manager'],
];
const u = {};
for (const [name, email, role] of people) {
  const existing = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email);
  u[name] = existing ?? { id: createUser(db, null, { name, email, role, password: PASSWORD }), name, role };
  u[name].role = role;
}
const admin = u.Senthil;

const productId = (name) => db.prepare('SELECT id FROM products WHERE name = ?').get(name)?.id ?? saveProduct(db, admin, null, { name });
const cargora = productId('CARGORA');
const iclinical = productId('iClinical.ai');
for (const m of ['New Jobs', 'ERP Integration', 'Invoicing', 'Consignee', 'Container Tracking']) saveModule(db, admin, null, { product_id: cargora, name: m });
for (const m of ['Login', 'Patient Records', 'Scheduling']) saveModule(db, admin, null, { product_id: iclinical, name: m });

const today = new Date().toISOString().slice(0, 10);
const act = (who, id, action, input = {}) => performAction(db, who, id, action, input);

function item(spec) {
  const base = spec.category === 'defect'
    ? { steps_to_reproduce: spec.steps || '1. Open the screen\n2. Perform the action\n3. Observe the result', expected_behaviour: spec.expected || 'Works as designed', actual_behaviour: spec.actual || 'Does not work', environment: 'Production' }
    : { business_requirement: spec.business || 'Requested by operations to save time.', acceptance_criteria: spec.criteria || 'Feature works for all user roles.\nNo regressions in related screens.' };
  return createItem(db, spec.by || admin, { requested_by: spec.requester || 'Senthil', module: spec.module, description: spec.description || spec.title, ...base, ...spec, product_id: spec.product || cargora }, []);
}

/** Moves an item forward until it reaches `target`. */
function advance(id, dev, target, { reject = false, qa = u.Priya } = {}) {
  const order = ['assigned', 'in_development', 'self_test', 'ready_for_qa', 'qa_in_progress', 'qa_approved', 'ready_for_production'];
  const stop = order.indexOf(target);
  act(admin, id, 'assign', { assigned_to: dev.id });
  if (stop >= 1) act(dev, id, 'start_development');
  if (stop >= 2) act(dev, id, 'start_self_test', { implementation_notes: 'Implemented the change and updated validation.' });
  if (stop >= 3) act(dev, id, 'record_self_test', { result: 'passed', tested_on: today, notes: 'Tested main flow and edge cases.', submit: 'true' });
  if (stop >= 4) act(qa, id, 'start_qa');
  if (reject) {
    act(qa, id, 'qa_reject', { tested_on: today, notes: 'Validation message missing for empty input.', observed: 'Form submits with empty field.' });
    return;
  }
  if (stop >= 5) act(qa, id, 'qa_approve', { tested_on: today, notes: 'Tested with multiple scenarios. Working as expected.' });
  if (stop >= 6) act(u.Arun, id, 'queue_for_production');
}

// Moved to production: one straight from QA Approved, one through the production queue.
const d1 = item({ category: 'requirement', title: 'Container number optional', module: 'Container Tracking', priority: 'low' });
const d2 = item({ category: 'defect', title: 'iClinical login issue', product: iclinical, module: 'Login', priority: 'high' });
advance(d1, u.Kaviya, 'qa_approved');
advance(d2, u.Ashraf, 'ready_for_production', { qa: u.Suresh });
act(u.Arun, d1, 'move_to_production', { notes: 'Deployed with the September fixes.' });
act(u.Arun, d2, 'move_to_production');

// Waiting in the production queue.
const p1 = item({ category: 'requirement', title: 'Consignee field validation', module: 'Consignee', priority: 'medium' });
advance(p1, u.Magesh, 'ready_for_production');

// Spread across the remaining workflow stages.
const a1 = item({ category: 'requirement', title: 'Add filter in New Jobs', module: 'New Jobs', priority: 'high' });
advance(a1, u.Magesh, 'in_development');
const a2 = item({ category: 'defect', title: 'ERP submission error', module: 'ERP Integration', priority: 'critical',
  description: 'ERP submission shows success even though no ERP job number is generated.',
  steps: '1. Go to ERP Submission page\n2. Select a job and click Submit\n3. Observe the status', expected: 'ERP job number should be generated and shown in the success message.', actual: 'Status shows success but no job number is generated.' });
advance(a2, u.Ashraf, 'ready_for_qa');
const a3 = item({ category: 'requirement', title: 'Missing documents list', module: 'New Jobs', priority: 'medium' });
advance(a3, u.Kaviya, 'qa_in_progress');
const a4 = item({ category: 'defect', title: 'Invoice number grouping', module: 'Invoicing', priority: 'high', requester: 'Suresh' });
advance(a4, u.Ashraf, 'qa_in_progress', { reject: true });
const a5 = item({ category: 'requirement', title: 'Bulk upload of consignees', module: 'Consignee', priority: 'low', due_date: '2026-10-01' });
advance(a5, u.Magesh, 'assigned');
item({ category: 'defect', title: 'Appointment time shows in UTC', product: iclinical, module: 'Scheduling', priority: 'critical', by: u.Priya, requester: 'Priya' });
const a7 = item({ category: 'defect', title: 'Patient search slow for long names', product: iclinical, module: 'Patient Records', priority: 'medium', by: u.Priya, requester: 'Priya' });
advance(a7, u.Kaviya, 'self_test');
const a8 = item({ category: 'requirement', title: 'Export job list to Excel', module: 'New Jobs', priority: 'medium' });
advance(a8, u.Magesh, 'qa_approved', { qa: u.Suresh });

// Spread creation dates over the past weeks so dashboards and cycle times look realistic.
const ids = db.prepare('SELECT id FROM items ORDER BY id').all().map((r) => r.id);
ids.forEach((id, n) => {
  const days = 24 - n * 2;
  db.prepare("UPDATE items SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?) WHERE id = ?").run(`-${days} days`, id);
  db.prepare("UPDATE activity SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?) WHERE item_id = ? AND action = 'created'").run(`-${days} days`, id);
});

console.log(`Demo data loaded into ${config.dbFile}`);
console.log(`Sign in with any of these accounts (password: ${PASSWORD}):`);
for (const [name, email, role] of people) console.log(`  ${email.padEnd(28)} ${role.padEnd(16)} ${name}`);
db.close();
