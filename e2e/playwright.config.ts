import { defineConfig, devices } from '@playwright/test';

// Runs against the stack started by `docker-compose up` (or scripts/test-everything.sh).
// E2E_BASE_URL points elsewhere; PW_CHANNEL=chrome uses an installed Chrome instead of downloading one.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // Each test signs in as its own customer, so tests can run side by side.
  fullyParallel: true,
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel }, dependencies: ['setup'] },
    {
      name: 'phone',
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], channel },
      // The customer's side at phone width. Only tests tagged @phone run here: they issue no refunds,
      // so they can't collide with the desktop run approving the same items.
      grep: /@phone/,
    },
  ],
});
