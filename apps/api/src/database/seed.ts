import { Prisma, PrismaClient, RefundSource } from '@prisma/client';
import {
  SEED_CURRENCY,
  SEED_CUSTOMERS,
  SEED_REFERENCE_PREFIX,
  seedCardFor,
  seedLineMinor,
  seedPayments,
  seedShipmentEvents,
} from './seed-data';

const DAY_MS = 24 * 60 * 60 * 1000;

// Idempotent: runs on every container start and re-anchors dates, without touching reviewer data.
async function seed(tx: Prisma.TransactionClient, reset: boolean) {
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * DAY_MS);

  if (reset) {
    await tx.decisionAudit.deleteMany();
    await tx.requestMessage.deleteMany();
    // Payments the app wrote for approved refunds; the seeded ledger is restored below.
    await tx.payment.deleteMany({
      where: { NOT: { reference: { startsWith: SEED_REFERENCE_PREFIX } } },
    });
    await tx.refund.deleteMany();
    await tx.refundRequest.deleteMany();
  }

  for (const [customerIndex, seedCustomer] of SEED_CUSTOMERS.entries()) {
    const since = daysAgo(seedCustomer.customerSinceDaysAgo);
    const customer = await tx.customer.upsert({
      where: { email: seedCustomer.email },
      update: { name: seedCustomer.name, createdAt: since },
      create: { name: seedCustomer.name, email: seedCustomer.email, createdAt: since },
    });
    const method = seedCardFor(customerIndex);

    for (const seedOrder of seedCustomer.orders) {
      const at = (days: number | undefined) => (days === undefined ? null : daysAgo(days));
      const fields = {
        customerId: customer.id,
        status: seedOrder.status,
        currency: SEED_CURRENCY,
        placedAt: daysAgo(seedOrder.placedDaysAgo),
        deliveredAt: at(seedOrder.deliveredDaysAgo),
        cancelledAt: at(seedOrder.cancelledDaysAgo),
      };
      const order = await tx.order.upsert({
        where: { orderNumber: seedOrder.orderNumber },
        update: fields,
        create: { orderNumber: seedOrder.orderNumber, ...fields },
      });

      const refundIdBySku = new Map<string, string>();
      for (const seedItem of seedOrder.items) {
        const itemFields = {
          name: seedItem.name,
          quantity: seedItem.quantity ?? 1,
          unitPriceMinor: seedItem.unitPriceMinor,
          finalSale: seedItem.finalSale ?? false,
        };
        const item = await tx.orderItem.upsert({
          where: { orderId_sku: { orderId: order.id, sku: seedItem.sku } },
          update: itemFields,
          create: { orderId: order.id, sku: seedItem.sku, ...itemFields },
        });

        if (seedItem.refundedDaysAgo !== undefined) {
          const refundFields = {
            amountMinor: seedLineMinor(seedItem),
            currency: SEED_CURRENCY,
            issuedAt: daysAgo(seedItem.refundedDaysAgo),
          };
          const refund = await tx.refund.upsert({
            where: { orderItemId: item.id },
            update: refundFields,
            create: {
              orderItemId: item.id,
              customerId: customer.id,
              source: RefundSource.HISTORICAL,
              ...refundFields,
            },
          });
          refundIdBySku.set(seedItem.sku, refund.id);
        }
      }

      for (const payment of seedPayments(seedOrder)) {
        const paymentFields = {
          orderId: order.id,
          customerId: customer.id,
          kind: payment.kind,
          amountMinor: payment.amountMinor,
          currency: SEED_CURRENCY,
          method,
          refundId: payment.sku ? (refundIdBySku.get(payment.sku) ?? null) : null,
          occurredAt: daysAgo(payment.daysAgo),
        };
        await tx.payment.upsert({
          where: { reference: payment.reference },
          update: paymentFields,
          create: { reference: payment.reference, ...paymentFields },
        });
      }

      // The app never writes tracking events, so the seed owns them outright.
      await tx.shipmentEvent.deleteMany({ where: { orderId: order.id } });
      await tx.shipmentEvent.createMany({
        data: seedShipmentEvents(seedOrder).map((event) => ({
          orderId: order.id,
          status: event.status,
          carrier: event.carrier,
          detail: event.detail,
          occurredAt: daysAgo(event.daysAgo),
        })),
      });
    }
  }
}

async function main() {
  const reset = process.argv.includes('--reset');
  const prisma = new PrismaClient();
  try {
    // One transaction, so a failed boot never leaves a half-seeded catalogue behind.
    await prisma.$transaction((tx) => seed(tx, reset), { timeout: 30_000, maxWait: 10_000 });
    const [customers, orders, payments] = await Promise.all([
      prisma.customer.count(),
      prisma.order.count(),
      prisma.payment.count(),
    ]);
    console.log(
      `Seed complete${reset ? ' (reset)' : ''}: ${customers} customers, ${orders} orders, ${payments} payments`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
