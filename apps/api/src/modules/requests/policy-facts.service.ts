import { Injectable } from '@nestjs/common';
import { PaymentKind, Prisma, RefundSource } from '@prisma/client';
import {
  CURRENCY_RULES,
  FAIR_USE_WINDOW_DAYS,
  type CustomerClaim,
  type OrderFacts,
  type PolicyInput,
  type RequestSignals,
} from '@domain';
import { PrismaConfig, env } from '@configs';
import type { CatalogOrder } from '@modules/assistant/assistant.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_CURRENCY = 'USD';

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  status: true,
  currency: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    select: {
      id: true,
      sku: true,
      name: true,
      quantity: true,
      unitPriceMinor: true,
      finalSale: true,
      refund: { select: { amountMinor: true } },
    },
    orderBy: { sku: 'asc' },
  },
} satisfies Prisma.OrderSelect;

// The facts the engine needs, plus the card the order was paid with, for the reply.
export interface OrderContext extends OrderFacts {
  chargeMethod: string | null;
}

export interface LoadedFacts {
  input: PolicyInput;
  // The order the claim named, whoever owns it. Only the engine sees another customer's order.
  order: OrderContext | null;
}

// Loads everything the policy engine decides from. Money and history come from the records, never from
// the claim; sums run in SQL.
@Injectable()
export class PolicyFactsService {
  constructor(private readonly prisma: PrismaConfig) {}

  // The customer's own orders, for the model to pick item SKUs from.
  async catalog(customerId: string): Promise<CatalogOrder[]> {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      select: { orderNumber: true, items: { select: { sku: true, name: true } } },
      orderBy: { placedAt: 'desc' },
    });
    return orders;
  }

  async load(
    customerId: string,
    claim: CustomerClaim,
    signals: RequestSignals,
    now: Date,
  ): Promise<LoadedFacts> {
    const order = claim.orderNumber ? await this.loadOrder(claim.orderNumber) : null;
    const currency = order?.currency ?? STORE_CURRENCY;
    const [recentRefundCount, remainingTodayMinor] = await Promise.all([
      this.prisma.refund.count({
        where: {
          customerId,
          issuedAt: { gte: new Date(now.getTime() - FAIR_USE_WINDOW_DAYS * DAY_MS) },
        },
      }),
      this.remainingAutomaticRefunds(currency, now),
    ]);
    return {
      order,
      input: {
        now,
        automation: { refundsEnabled: env.AUTO_REFUNDS_ENABLED, remainingTodayMinor },
        customerId,
        claim,
        signals,
        order,
        recentRefundCount,
      },
    };
  }

  private async loadOrder(orderNumber: string): Promise<OrderContext | null> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: ORDER_SELECT,
    });
    if (!order) return null;

    const [byKind, charge] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['kind'],
        where: { orderId: order.id },
        _sum: { amountMinor: true },
        _max: { occurredAt: true },
      }),
      this.prisma.payment.findFirst({
        where: { orderId: order.id, kind: PaymentKind.CHARGE },
        select: { method: true },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);
    const charged = byKind.find((row) => row.kind === PaymentKind.CHARGE);
    const refunded = byKind.find((row) => row.kind === PaymentKind.REFUND);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      status: order.status,
      currency: order.currency,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      refundedTotalMinor: order.items.reduce((sum, i) => sum + (i.refund?.amountMinor ?? 0), 0),
      payments: {
        chargedMinor: charged?._sum.amountMinor ?? 0,
        refundedMinor: refunded?._sum.amountMinor ?? 0,
        lastRefundAt: refunded?._max.occurredAt ?? null,
      },
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPriceMinor: i.unitPriceMinor,
        finalSale: i.finalSale,
        alreadyRefunded: i.refund !== null,
      })),
      chargeMethod: charge?.method ?? null,
    };
  }

  // Today's cap minus what was refunded automatically since midnight UTC, in that currency.
  private async remainingAutomaticRefunds(currency: string, now: Date): Promise<number | null> {
    const cap = CURRENCY_RULES[currency]?.automaticDailyCapMinor;
    if (cap === undefined) return null;
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = await this.prisma.refund.aggregate({
      where: { source: RefundSource.AUTOMATED, currency, issuedAt: { gte: midnight } },
      _sum: { amountMinor: true },
    });
    return cap - (today._sum.amountMinor ?? 0);
  }
}
