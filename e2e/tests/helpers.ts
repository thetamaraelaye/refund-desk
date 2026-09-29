import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

export const STAFF_PASSWORD = process.env.ADMIN_PASSWORD ?? 'refund-desk-admin';

// The staff session saved by auth.setup.ts.
export const STAFF_STATE = path.join(__dirname, '..', '.auth', 'staff.json');

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Clicks a scenario on the sign-in page: signs in as its customer with its message ready to send.
export async function startScenario(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo scenarios' }).click();
  await page
    .getByRole('dialog', { name: 'Demo scenarios' })
    .getByRole('button', { name: new RegExp(`^${escape(title)}`) })
    .click();
  await expect(page).toHaveURL(/\/chat\?try=/);
  await expect(page.getByLabel('Your message', { exact: true })).not.toHaveValue('');
}

// Signs in the way a customer would: the help centre's email sign-in (demo accounts have no password).
export async function signInAs(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/chat$/);
}

export async function send(page: Page, message?: string) {
  if (message !== undefined) await page.getByLabel('Your message', { exact: true }).fill(message);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/request=/);
}

// A status badge reads "✓ Refund approved"; its glyph is hidden from assistive tech, so match the words.
export const badge = (scope: Locator, label: string) =>
  scope.getByText(new RegExp(`${escape(label)}$`)).first();

// The conversation panel is a region named after its heading ("Request #12").
export const chatPanel = (page: Page) => page.getByRole('region', { name: /^Request #\d+$/ });

export async function signInStaff(page: Page, name = 'Ada Obi') {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Password').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // The console itself, not /admin/sign-in: a refused or rate-limited sign-in must fail here.
  await expect(page).toHaveURL(/\/admin(\?.*)?$/);
}

// WCAG 2.1 A and AA; the build fails on anything axe rates serious or critical.
export async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`),
  ).toEqual([]);
}
