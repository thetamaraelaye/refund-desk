import { expect, test, type Page } from '@playwright/test';
import {
  badge,
  chatPanel,
  expectNoSeriousA11yIssues,
  send,
  startScenario,
  STAFF_PASSWORD,
  STAFF_STATE,
} from './helpers';

// Tab buttons live in the status bar; cards are buttons too and their names start with a status.
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Requests by status' });

test('a wrong password is refused inline', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Your name').fill('Ada Obi');
  await page.getByLabel('Password').fill(`${STAFF_PASSWORD}-wrong`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('That password is not correct')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test('a specialist approves an escalated refund and the customer is told', async ({
  page,
  browser,
}) => {
  // The customer: a $650 TV, escalated under §3.
  await startScenario(page, '$650 order');
  await send(page);
  const chat = chatPanel(page);
  await expect(badge(chat, 'With our support team')).toBeVisible();
  const heading = await chat.getByRole('heading').first().innerText();
  const reference = heading.replace('Request ', '');

  // The specialist, in a separate browser session that is already signed in.
  const staffContext = await browser.newContext({ storageState: STAFF_STATE });
  const staff = await staffContext.newPage();
  await staff.goto('/admin');
  await tabs(staff)
    .getByRole('button', { name: /^Escalated/ })
    .click();
  await staff
    .getByRole('region', { name: 'Request list' })
    .getByRole('button', { name: new RegExp(`${reference}\\b`) })
    .click();

  // The receipt marks the rule that decided it.
  const receipt = staff.getByRole('list', { name: 'Rules checked, in order' });
  await expect(receipt.locator('li[aria-current="true"]')).toContainText('§3');
  await expect(receipt.locator('li[aria-current="true"]')).toContainText('over $500.00');

  // Approve sits in the detail's header. The dialog states the amount and requires a note.
  const approveInHeader = staff
    .getByRole('region', { name: 'Request detail' })
    .getByRole('button', { name: 'Approve refund of $650.00' });
  await approveInHeader.click();
  // Headless UI puts role="dialog" on a zero-size wrapper, so check what the specialist actually sees.
  const dialog = staff.getByRole('dialog', { name: 'Approve a refund of $650.00?' });
  const dialogTitle = dialog.getByRole('heading', { name: 'Approve a refund of $650.00?' });
  await expect(dialogTitle).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve refund of $650.00' }).click();
  await expect(dialog.getByText('Add a short note for the audit trail.')).toBeVisible();

  // Escape backs out without recording anything.
  await staff.keyboard.press('Escape');
  await expect(dialogTitle).toBeHidden();

  await approveInHeader.click();
  await dialog
    .getByLabel('Note for the audit trail')
    .fill('Photos of the cracked screen check out.');
  await dialog.getByRole('button', { name: 'Approve refund of $650.00' }).click();
  await expect(staff.getByText(/Ada Obi\s+approved this on/)).toBeVisible();
  await expect(staff.getByText('Refunded to Amex •••• 0005')).toBeVisible();

  // The customer's chat updates without a reload.
  await expect(badge(chat, 'Refund approved')).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByText(/has approved your refund of \$650\.00/)).toBeVisible();

  await staffContext.close();
});

test('requests open from the keyboard, and the dashboard has no serious accessibility issues', async ({
  page,
  browser,
}) => {
  // Make sure there is at least one request to open.
  await startScenario(page, 'Item not received');
  await send(page);
  await expect(badge(chatPanel(page), 'With our support team')).toBeVisible();

  const staffContext = await browser.newContext({ storageState: STAFF_STATE });
  const staff = await staffContext.newPage();
  await staff.goto('/admin');
  const firstCard = staff.getByRole('region', { name: 'Request list' }).getByRole('button').first();
  await firstCard.focus();
  await staff.keyboard.press('Enter');
  await expect(staff).toHaveURL(/request=/);
  await expect(staff.getByRole('heading', { name: 'How the policy decided' })).toBeVisible();

  await expectNoSeriousA11yIssues(staff);
  await staffContext.close();
});

test('a specialist can rule on a request that is still waiting for the customer', async ({
  page,
  browser,
}) => {
  await startScenario(page, 'No reason given');
  await send(page);
  const chat = chatPanel(page);
  await expect(badge(chat, 'Waiting for your reply')).toBeVisible();
  const reference = (await chat.getByRole('heading').first().innerText()).replace('Request ', '');

  const staffContext = await browser.newContext({ storageState: STAFF_STATE });
  const staff = await staffContext.newPage();
  await staff.goto('/admin?status=NEEDS_INFO');
  await staff
    .getByRole('region', { name: 'Request list' })
    .getByRole('button', { name: new RegExp(`${reference}\\b`) })
    .click();
  await expect(staff.getByText(/waiting for the customer to reply/)).toBeVisible();

  await staff
    .getByRole('region', { name: 'Request detail' })
    .getByRole('button', { name: 'Deny', exact: true })
    .click();
  const dialog = staff.getByRole('dialog', { name: `Deny request ${reference}?` });
  await dialog.getByLabel('Note for the audit trail').fill('No reply from the customer.');
  await dialog.getByRole('button', { name: 'Deny request' }).click();
  await expect(staff.getByText(/Ada Obi\s+denied this on/)).toBeVisible();

  // The waiting customer's chat picks up the ruling on its own.
  await expect(badge(chat, 'Not refunded')).toBeVisible({ timeout: 20_000 });
  await staffContext.close();
});

test('the console has its own door, and opens on the requests that need a person', async ({
  page,
  browser,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);

  const staffContext = await browser.newContext({ storageState: STAFF_STATE });
  const staff = await staffContext.newPage();
  await staff.goto('/admin');
  await expect(tabs(staff).getByRole('button', { name: /^Needs attention/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await staffContext.close();
});

test('a specialist can approve straight from a card in the queue', async ({ page, browser }) => {
  await startScenario(page, 'Damaged final-sale item');
  await send(page);
  const chat = chatPanel(page);
  await expect(badge(chat, 'With our support team')).toBeVisible();
  const reference = (await chat.getByRole('heading').first().innerText()).replace('Request #', '');

  const staffContext = await browser.newContext({ storageState: STAFF_STATE });
  const staff = await staffContext.newPage();
  await staff.goto('/admin');
  await staff.getByRole('button', { name: `Approve refund for request ${reference}` }).click();
  const dialog = staff.getByRole('dialog', { name: 'Approve a refund of $65.00?' });
  await dialog.getByLabel('Note for the audit trail').fill('Tear visible in the photos.');
  await dialog.getByRole('button', { name: 'Approve refund of $65.00' }).click();

  // It leaves the queue, and the customer is told.
  await expect(
    staff.getByRole('button', { name: `Approve refund for request ${reference}` }),
  ).toHaveCount(0);
  await expect(badge(chat, 'Refund approved')).toBeVisible({ timeout: 20_000 });
  await staffContext.close();
});
