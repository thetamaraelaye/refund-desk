import { execSync } from 'node:child_process';
import path from 'node:path';

// Every run starts from the seeded demo data: requests, app-issued refunds and audits are cleared,
// the catalogue is kept. Set E2E_SKIP_RESET=1 to run against whatever data is there.
export default function globalSetup() {
  if (process.env.E2E_SKIP_RESET) return;
  const root = path.resolve(__dirname, '..');
  execSync('docker compose exec -T api node dist/database/seed.js --reset', {
    cwd: root,
    stdio: 'inherit',
  });
}
