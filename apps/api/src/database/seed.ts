import { Prisma, PrismaClient, RefundSource } from '@prisma/client';
import { SEED_CURRENCY, SEED_CUSTOMERS } from './seed-data';

const DAY_MS = 24 * 60 * 60 * 1000;

// Idempotent: runs on every container start and re-anchors dates, without touching reviewer data.
async function seed(tx: Prisma.TransactionClient, reset: boolean) {
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * DAY_MS);

  if (reset) {
    await tx.decisionAudit.deleteMany();
    await tx.requestMessage.deleteMany();
    await tx.refund.deleteMany();
    await tx.refundRequest.deleteMany();
  }

  for (const seedCustomer of SEED_CUSTOMERS) {
    const since = daysAgo(seedCustomer.customerSinceDaysAgo);
    const customer = await tx.customer.upsert({
      where: { email: seedCustomer.email },
      update: { name: seedCustomer.name, createdAt: since },
      create: { name: seedCustomer.name, email: seedCustomer.email, createdAt: since },
    });

    for (const seedOrder of seedCustomer.orders) {
      const fields = {
        customerId: customer.id,
        status: seedOrder.status,
        currency: SEED_CURRENCY,
        placedAt: daysAgo(seedOrder.placedDaysAgo),
        deliveredAt:
          seedOrder.deliveredDaysAgo === undefined ? null : daysAgo(seedOrder.deliveredDaysAgo),
      };
      const order = await tx.order.upsert({
        where: { orderNumber: seedOrder.orderNumber },
        update: fields,
        create: { orderNumber: seedOrder.orderNumber, ...fields },
      });

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
            amountMinor: itemFields.unitPriceMinor * itemFields.quantity,
            currency: SEED_CURRENCY,
            issuedAt: daysAgo(seedItem.refundedDaysAgo),
          };
          await tx.refund.upsert({
            where: { orderItemId: item.id },
            update: refundFields,
            create: {
              orderItemId: item.id,
              customerId: customer.id,
              source: RefundSource.HISTORICAL,
              ...refundFields,
            },
          });
        }
      }
    }
  }
}

async function main() {
  const reset = process.argv.includes('--reset');
  const prisma = new PrismaClient();
  try {
    // One transaction, so a failed boot never leaves a half-seeded catalogue behind.
    await prisma.$transaction((tx) => seed(tx, reset), { timeout: 30_000, maxWait: 10_000 });
    const [customers, orders] = await Promise.all([prisma.customer.count(), prisma.order.count()]);
    console.log(
      `Seed complete${reset ? ' (reset)' : ''}: ${customers} customers, ${orders} orders`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
