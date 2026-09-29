import { PaymentKind, Prisma, RefundSource } from '@prisma/client';

export interface RefundToIssue {
  requestId: string;
  customerId: string;
  orderId: string;
  orderItemId: string;
  // From the order record, never from the claim.
  amountMinor: number;
  currency: string;
  source: RefundSource;
  issuedByName: string | null;
}

// The only place money leaves. Runs inside the caller's transaction: the item refund and its ledger
// payment are written together or not at all. A second refund for the same item fails on the unique
// index (P2002), even when two requests race (D7).
export async function issueRefund(tx: Prisma.TransactionClient, refund: RefundToIssue) {
  const charge = await tx.payment.findFirst({
    where: { orderId: refund.orderId, kind: PaymentKind.CHARGE },
    select: { method: true },
    orderBy: { occurredAt: 'asc' },
  });
  const issued = await tx.refund.create({
    data: {
      orderItemId: refund.orderItemId,
      customerId: refund.customerId,
      refundRequestId: refund.requestId,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      source: refund.source,
      issuedByName: refund.issuedByName,
    },
    select: { id: true, issuedAt: true },
  });
  await tx.payment.create({
    data: {
      orderId: refund.orderId,
      customerId: refund.customerId,
      kind: PaymentKind.REFUND,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      // Refunds go back to the card that paid.
      method: charge?.method ?? 'Original payment method',
      reference: `re_${issued.id}`,
      refundId: issued.id,
      occurredAt: issued.issuedAt,
    },
  });
  return { method: charge?.method ?? null };
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// Json columns take plain JSON: dates become ISO strings, undefined fields drop.
export const toJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
