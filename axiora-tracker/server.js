import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { migrate, openDb } from './src/db.js';
import { bootstrapAdmin } from './src/bootstrap.js';

const db = openDb();
const applied = migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
bootstrapAdmin(db);

const server = createApp(db).listen(config.port, config.host, () => {
  console.log(`Axiora Change & Defect Tracker running at http://${config.host}:${config.port} (${config.env})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
