import { config } from '../src/config.js';
import { migrate, openDb } from '../src/db.js';

const db = openDb();
const applied = migrate(db);
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
console.log(`Database: ${config.dbFile}`);
db.close();
