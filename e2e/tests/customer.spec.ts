import { expect, test } from '@playwright/test';
import {
  badge,
  chatPanel,
  expectNoSeriousA11yIssues,
  send,
  signInAs,
  startScenario,
} from './helpers';

// The brief's six cases, as a customer sees them.
const BRIEF_CASES = [
  { scenario: 'Damaged item', status: 'Refund approved', reply: /Your refund of \$48\.00/ },
  { scenario: 'Final sale item', status: 'Not refunded', reply: /sold as final sale/ },
  {
    scenario: 'Past the 30-day window',
    status: 'Not refunded',
    reply: /within 30 days of delivery/,
  },
  {
    scenario: '$650 order',
    status: 'With our support team',
    reply: /Refunds over \$500\.00/,
  },
  {
    scenario: 'Prompt injection attempt',
    status: 'With our support team',
    reply: /passed your request to our support team/,
  },
  {
    scenario: 'Claimed amount does not match',
    status: 'With our support team',
    reply: /doesn't match our records/,
  },
];

test.describe("the brief's six cases", () => {
  for (const { scenario, status, reply } of BRIEF_CASES) {
    test(`${scenario}: ${status}`, async ({ page }) => {
      await startScenario(page, scenario);
      await send(page);

      const chat = chatPanel(page);
      await expect(badge(chat, status)).toBeVisible();
      await expect(chat.getByText(reply)).toBeVisible();
    });
  }

  test('a prompt injection gets a neutral reply that reveals nothing', async ({ page }) => {
    await startScenario(page, 'Prompt injection attempt');
    await send(page);

    const chat = chatPanel(page);
    await expect(badge(chat, 'With our support team')).toBeVisible();
    const replies = await chat.getByText(/^Hi Priya/).allInnerTexts();
    expect(replies.join(' ')).not.toMatch(/manipulat|instruction|override|suspicious|inject/i);
  });
});

test(
  'says it is an AI and offers a person before anything is typed',
  { tag: '@phone' },
  async ({ page }) => {
    await signInAs(page, 'Kwame Mensah');
    await expect(page.getByText(/talking to an AI assistant/)).toBeVisible();

    await page.getByRole('button', { name: 'Talk to a person' }).click();

    const chat = chatPanel(page);
    await expect(badge(chat, 'With our support team')).toBeVisible();
    await expect(chat.getByText(/You asked to speak with a person/)).toBeVisible();
    await expect(page.getByLabel('Your message', { exact: true })).toHaveCount(0);
  },
);

test('asks which item on a multi-item order, then approves the answer', async ({ page }) => {
  await startScenario(page, 'Multi-item order, unclear item');
  await send(page);

  const chat = chatPanel(page);
  await expect(badge(chat, 'Waiting for your reply')).toBeVisible();
  await expect(
    chat.getByText(/Burr coffee grinder, Ceramic mug set \(4\) or French press/),
  ).toBeVisible();

  await page
    .getByLabel('Your message', { exact: true })
    .fill('It was the French press. The glass is cracked.');
  await page.keyboard.press('Enter');

  await expect(badge(chat, 'Refund approved')).toBeVisible();
  await expect(chat.getByText(/Your refund of \$42\.00 for the French press/)).toBeVisible();
  const orders = page.getByRole('region', { name: 'Your orders' });
  await expect(
    orders.getByRole('listitem').filter({ hasText: 'French press' }).getByText('Refunded'),
  ).toBeVisible();
  await expect(page.getByText('Your refund is on its way.')).toBeVisible();
});

test(
  'adds an order number to the message from the orders panel',
  { tag: '@phone' },
  async ({ page }) => {
    await signInAs(page, 'Grace Kim');
    await page.getByRole('button', { name: 'Add ORD-1003 to your message' }).click();
    await expect(page.getByLabel('Your message', { exact: true })).toHaveValue('ORD-1003');
  },
);

test('shows what it is doing while it works on a reply', { tag: '@phone' }, async ({ page }) => {
  await startScenario(page, 'Final sale item');
  // The mock answers in milliseconds; hold the request so the working steps are visible.
  await page.route('**/api/v1/requests/messages', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_500));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Send' }).click();

  // Exact matches pick the visible step, not its screen-reader announcement ("Reading your message…").
  const firstStep = page.getByText('Reading your message', { exact: true });
  await expect(firstStep).toBeVisible();
  await expect(page.getByText('Checking our refund policy', { exact: true })).toBeVisible();
  await expect(badge(chatPanel(page), 'Not refunded')).toBeVisible();
  await expect(firstStep).toHaveCount(0);
});

test('sends signed-out visitors to sign in', { tag: '@phone' }, async ({ page }) => {
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/$/);
});

test(
  'the sign-in page and chat have no serious accessibility issues',
  { tag: '@phone' },
  async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Try it as a customer' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Damaged item/ })).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    await startScenario(page, 'Change of mind');
    await send(page);
    await expect(badge(chatPanel(page), 'Not refunded')).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  },
);
