// The facts the refund service loads from Postgres, built from the seed data instead, so tests and the
// scenario script can run the whole pipeline without a database.
import type { CustomerClaim, OrderFacts, PolicyInput, RequestSignals } from '@domain';
import { FAIR_USE_WINDOW_DAYS } from '@domain';
import {
  SEED_CURRENCY,
  SEED_CUSTOMERS,
  seedLineMinor,
  seedPayments,
  type SeedCustomer,
  type SeedOrder,
} from './seed-data';

const DAY_MS = 24 * 60 * 60 * 1000;

export function seedCustomer(email: string): SeedCustomer {
  const customer = SEED_CUSTOMERS.find((c) => c.email === email);
  if (!customer) throw new Error(`No seed customer ${email}`);
  return customer;
}

export function seedCatalog(email: string) {
  return seedCustomer(email).orders.map((o) => ({
    orderNumber: o.orderNumber,
    items: o.items.map((i) => ({ sku: i.sku, name: i.name })),
  }));
}

function findOrder(orderNumber: string) {
  for (const customer of SEED_CUSTOMERS) {
    const order = customer.orders.find((o) => o.orderNumber === orderNumber);
    if (order) return { owner: customer, order };
  }
  return null;
}

export function seedOrderFacts(orderNumber: string, now: Date): OrderFacts | null {
  const found = findOrder(orderNumber);
  if (!found) return null;
  const { owner, order } = found;
  const at = (days: number | undefined) =>
    days === undefined ? null : new Date(now.getTime() - days * DAY_MS);
  const payments = seedPayments(order);
  const refunds = payments.filter((p) => p.kind === 'REFUND');
  const sum = (list: typeof payments) => list.reduce((total, p) => total + p.amountMinor, 0);
  const refundedItems = (o: SeedOrder) => o.items.filter((i) => i.refundedDaysAgo !== undefined);

  return {
    id: order.orderNumber,
    orderNumber: order.orderNumber,
    customerId: owner.email,
    status: order.status,
    currency: SEED_CURRENCY,
    deliveredAt: at(order.deliveredDaysAgo),
    cancelledAt: at(order.cancelledDaysAgo),
    refundedTotalMinor: refundedItems(order).reduce((total, i) => total + seedLineMinor(i), 0),
    payments: {
      chargedMinor: sum(payments.filter((p) => p.kind === 'CHARGE')),
      refundedMinor: sum(refunds),
      lastRefundAt: at(refunds.length ? Math.min(...refunds.map((p) => p.daysAgo)) : undefined),
    },
    items: order.items.map((i) => ({
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

export function seedPolicyInput(
  email: string,
  claim: CustomerClaim,
  signals: RequestSignals,
  now: Date,
): PolicyInput {
  const customer = seedCustomer(email);
  return {
    now,
    automation: { refundsEnabled: true, remainingTodayMinor: 250_000 },
    customerId: customer.email,
    claim,
    signals,
    order: claim.orderNumber ? seedOrderFacts(claim.orderNumber, now) : null,
    recentRefundCount: customer.orders
      .flatMap((o) => o.items)
      .filter((i) => i.refundedDaysAgo !== undefined && i.refundedDaysAgo <= FAIR_USE_WINDOW_DAYS)
      .length,
  };
}
