import { PrismaClient } from '@prisma/client';
import { runSeed } from './seed-runner';

async function main() {
  const reset = process.argv.includes('--reset');
  const prisma = new PrismaClient();
  try {
    // One transaction, so a failed boot never leaves a half-seeded catalogue behind.
    await prisma.$transaction((tx) => runSeed(tx, reset), { timeout: 30_000, maxWait: 10_000 });
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
