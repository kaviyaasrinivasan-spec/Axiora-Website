// Runs the API test suite against the PHP backend (the version deployed at axioralabs.ai/qa/).
// Uses `php` from PATH, or the binary named in PHP_BIN.
import { spawnSync } from 'node:child_process';

const { status } = spawnSync(process.execPath, ['--test', 'test/**/*.test.js'], {
  stdio: 'inherit',
  env: { ...process.env, TARGET: 'php' },
});
process.exit(status ?? 1);
