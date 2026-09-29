import { DEMO_SCENARIOS, type DemoScenario } from '../../database/demo-scenarios';
import { SEED_CURRENCY, SEED_CUSTOMERS, type SeedOrder } from '../../database/seed-data';
import { evaluateRefundPolicy } from './evaluate';
import { FAIR_USE_WINDOW_DAYS } from './policy-config';
import type { CustomerClaim, OrderFacts, PolicyInput, RequestSignals } from './types';

const NOW = new Date('2026-09-29T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

type ScenarioReading = Pick<CustomerClaim, 'orderNumber' | 'reason'> &
  Partial<CustomerClaim> &
  Partial<RequestSignals>;

// What extraction should read from each demo message. The policy must then reach the scenario's
// expected outcome from the seeded records alone.
const READINGS: Record<string, ScenarioReading> = {
  'damaged-item': { orderNumber: 'ORD-1001', itemSku: 'KIT-POUR-01', reason: 'DAMAGED' },
  'final-sale': { orderNumber: 'ORD-1002', itemSku: 'APP-COAT-MW', reason: 'CHANGED_MIND' },
  'outside-window': { orderNumber: 'ORD-1003', itemSku: 'LGT-DESK-02', reason: 'DAMAGED' },
  'high-value': { orderNumber: 'ORD-1004', itemSku: 'ELC-TV-55', reason: 'DAMAGED' },
  'prompt-injection': {
    orderNumber: 'ORD-1005',
    itemSku: 'AUD-EARB-01',
    reason: 'DAMAGED',
    claimedAmountMinor: 12_900,
    manipulation: true,
  },
  'amount-mismatch': {
    orderNumber: 'ORD-1006',
    itemSku: 'AUD-HEAD-02',
    reason: 'DAMAGED',
    claimedAmountMinor: 30_000,
  },
  'fair-use': { orderNumber: 'ORD-1007', itemSku: 'AUD-SPKR-01', reason: 'DAMAGED' },
  'damage-before-delivery': { orderNumber: 'ORD-1008', itemSku: 'KIT-KETL-01', reason: 'DAMAGED' },
  'already-refunded': { orderNumber: 'ORD-1009', itemSku: 'KIT-BLND-01', reason: 'DAMAGED' },
  'split-refund': { orderNumber: 'ORD-1009', itemSku: 'KIT-MIXR-01', reason: 'DAMAGED' },
  'multi-item-match': { orderNumber: 'ORD-1010', itemSku: 'KIT-GRND-01', reason: 'DAMAGED' },
  'multi-item-vague': { orderNumber: 'ORD-1010', reason: 'DAMAGED' },
  'change-of-mind': { orderNumber: 'ORD-1011', itemSku: 'APP-SHOE-RN', reason: 'CHANGED_MIND' },
  'not-received': { orderNumber: 'ORD-1012', itemSku: 'BED-PILW-SK', reason: 'NOT_RECEIVED' },
  'final-sale-damaged': { orderNumber: 'ORD-1013', itemSku: 'APP-SCRF-SK', reason: 'DAMAGED' },
  'no-reason': { orderNumber: 'ORD-1014', reason: 'UNSPECIFIED' },
  'wrong-item': { orderNumber: 'ORD-1015', itemSku: 'BTH-TOWL-GR', reason: 'WRONG_ITEM' },
  // Extraction only sees the customer's own orders, so it cannot match the TV to a SKU.
  'cross-account': { orderNumber: 'ORD-1004', itemMentioned: true, reason: 'DAMAGED' },
};

const refunded = (seedOrder: SeedOrder) =>
  seedOrder.items.filter((i) => i.refundedDaysAgo !== undefined);

function orderFacts(customerEmail: string, seedOrder: SeedOrder): OrderFacts {
  return {
    id: seedOrder.orderNumber,
    orderNumber: seedOrder.orderNumber,
    customerId: customerEmail,
    status: seedOrder.status,
    currency: SEED_CURRENCY,
    deliveredAt:
      seedOrder.deliveredDaysAgo === undefined ? null : daysAgo(seedOrder.deliveredDaysAgo),
    refundedTotalMinor: refunded(seedOrder).reduce(
      (sum, i) => sum + i.unitPriceMinor * (i.quantity ?? 1),
      0,
    ),
    items: seedOrder.items.map((i) => ({
      id: i.sku,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity ?? 1,
      unitPriceMinor: i.unitPriceMinor,
      finalSale: i.finalSale ?? false,
      alreadyRefunded: i.refundedDaysAgo !== undefined,
    })),
  };
}

// The same facts the refund service will load from Postgres, built from the seed instead.
function inputFor(scenario: DemoScenario): PolicyInput {
  const reading = READINGS[scenario.key];
  const customer = SEED_CUSTOMERS.find((c) => c.email === scenario.customerEmail);
  if (!customer) throw new Error(`No seed customer ${scenario.customerEmail}`);

  const owner = SEED_CUSTOMERS.find((c) =>
    c.orders.some((o) => o.orderNumber === reading.orderNumber),
  );
  const seedOrder = owner?.orders.find((o) => o.orderNumber === reading.orderNumber);

  return {
    now: NOW,
    customerId: customer.email,
    claim: {
      orderNumber: reading.orderNumber,
      itemSku: reading.itemSku ?? null,
      itemMentioned: reading.itemMentioned ?? reading.itemSku !== undefined,
      reason: reading.reason,
      claimedAmountMinor: reading.claimedAmountMinor ?? null,
      claimedCurrency: reading.claimedCurrency ?? null,
    },
    signals: {
      manipulation: reading.manipulation ?? false,
      extractionFailed: reading.extractionFailed ?? false,
      humanRequested: reading.humanRequested ?? false,
    },
    order: owner && seedOrder ? orderFacts(owner.email, seedOrder) : null,
    recentRefundCount: customer.orders
      .flatMap(refunded)
      .filter((i) => (i.refundedDaysAgo ?? Infinity) <= FAIR_USE_WINDOW_DAYS).length,
  };
}

describe('demo scenarios against the seeded records', () => {
  it('has a reading for every scenario, and none left over', () => {
    expect(Object.keys(READINGS).sort()).toEqual(DEMO_SCENARIOS.map((s) => s.key).sort());
  });

  it.each(DEMO_SCENARIOS.map((s) => [s.key, s] as const))('%s', (_key, scenario: DemoScenario) => {
    const decision = evaluateRefundPolicy(inputFor(scenario));

    expect({ outcome: decision.outcome, clause: decision.decisiveClause }).toEqual({
      outcome: scenario.expected,
      clause: scenario.decisiveClause,
    });
  });
});
