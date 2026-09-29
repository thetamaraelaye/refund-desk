import { test as setup } from '@playwright/test';
import { STAFF_STATE, signInStaff } from './helpers';

// One staff sign-in per run, reused by every staff test. The API allows 5 staff sign-in attempts a
// minute per IP; signing in per test would trip that on back-to-back runs.
setup('sign in to the support dashboard', async ({ page }) => {
  await signInStaff(page);
  await page.context().storageState({ path: STAFF_STATE });
});
