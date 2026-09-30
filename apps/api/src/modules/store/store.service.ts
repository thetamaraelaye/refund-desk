import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrderStatus, PaymentKind, ShipmentStatus } from '@prisma/client';
import type { CustomerSession } from '@common';
import { PrismaConfig, env } from '@configs';
import { isUniqueViolation } from '@modules/requests/refund-ledger';
import type { TestDelivery } from './dto/store.dto';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STORE_CURRENCY = 'USD';
const DEFAULT_CARD = 'Visa •••• 4242';

// When a test order was placed and delivered, in hours before now, for each state a tester can pick.
const TIMELINES: Record<
  TestDelivery,
  { placedHoursAgo: number; deliveredHoursAgo: number | null }
> = {
  // Inside the 30-day refund window.
  DELIVERED_TODAY: { placedHoursAgo: 3 * 24, deliveredHoursAgo: 2 },
  // Outside it.
  DELIVERED_45_DAYS_AGO: { placedHoursAgo: 49 * 24, deliveredHoursAgo: 45 * 24 },
  // Not delivered yet, so the window hasn't started.
  IN_TRANSIT: { placedHoursAgo: 24, deliveredHoursAgo: null },
};

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaConfig) {}

  // The synthetic store has no product table: its catalogue is every SKU that has been sold, at the
  // price it sold for, and whether it was sold as final sale.
  async products() {
    const items = await this.prisma.orderItem.findMany({
      distinct: ['sku'],
      select: { sku: true, name: true, unitPriceMinor: true, finalSale: true },
      orderBy: { sku: 'asc' },
    });
    return items.map((item) => ({
      sku: item.sku,
      name: item.name,
      priceMinor: item.unitPriceMinor,
      finalSale: item.finalSale,
      currency: STORE_CURRENCY,
    }));
  }

  // Demo shop: a real order for the signed-in customer, with its charge and carrier tracking, as if it
  // had been placed and shipped. Prices come from the catalogue, never from the request.
  async placeTestOrder(customer: CustomerSession, skus: string[], delivery: TestDelivery) {
    if (!env.DEMO_MODE) throw new NotFoundException();
    const catalogue = new Map((await this.products()).map((p) => [p.sku, p]));
    const lines = skus.map((sku) => catalogue.get(sku));
    if (lines.some((line) => line === undefined)) {
      throw new UnprocessableEntityException('One of those products is not in the catalogue');
    }

    const timeline = TIMELINES[delivery];
    const now = Date.now();
    const placedAt = new Date(now - timeline.placedHoursAgo * HOUR_MS);
    const deliveredAt =
      timeline.deliveredHoursAgo === null
        ? null
        : new Date(now - timeline.deliveredHoursAgo * HOUR_MS);
    const card = await this.prisma.payment.findFirst({
      where: { customerId: customer.customerId, kind: PaymentKind.CHARGE },
      select: { method: true },
      orderBy: { occurredAt: 'desc' },
    });

    // Two tries: another test order may take the same number between reading and writing it.
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const latest = await tx.order.findFirst({
            where: { orderNumber: { startsWith: 'ORD-2' } },
            select: { orderNumber: true },
            orderBy: { orderNumber: 'desc' },
          });
          const next = latest ? Number(latest.orderNumber.slice(4)) + 1 : 2001;
          const order = await tx.order.create({
            data: {
              orderNumber: `ORD-${next}`,
              customerId: customer.customerId,
              status: deliveredAt ? OrderStatus.DELIVERED : OrderStatus.SHIPPED,
              currency: STORE_CURRENCY,
              placedAt,
              deliveredAt,
              items: {
                create: lines.map((line) => ({
                  sku: line!.sku,
                  name: line!.name,
                  quantity: 1,
                  unitPriceMinor: line!.priceMinor,
                  finalSale: line!.finalSale,
                })),
              },
            },
            select: { id: true, orderNumber: true },
          });
          await tx.payment.create({
            data: {
              orderId: order.id,
              customerId: customer.customerId,
              kind: PaymentKind.CHARGE,
              amountMinor: lines.reduce((sum, line) => sum + line!.priceMinor, 0),
              currency: STORE_CURRENCY,
              method: card?.method ?? DEFAULT_CARD,
              reference: `ch_${order.id}`,
              occurredAt: placedAt,
            },
          });
          await tx.shipmentEvent.createMany({
            data: trackingFor(placedAt, deliveredAt, now).map((event) => ({
              orderId: order.id,
              carrier: 'UPS',
              ...event,
            })),
          });
          return { orderNumber: order.orderNumber };
        });
      } catch (error) {
        if (attempt === 1 && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }
}

// A believable carrier history between placing and delivery (or up to now, if still on its way).
function trackingFor(placedAt: Date, deliveredAt: Date | null, now: number) {
  const events: { status: ShipmentStatus; detail: string; occurredAt: Date }[] = [
    {
      status: ShipmentStatus.LABEL_CREATED,
      detail: 'Label created, awaiting pickup',
      occurredAt: new Date(placedAt.getTime() + 4 * HOUR_MS),
    },
    {
      status: ShipmentStatus.IN_TRANSIT,
      detail: 'Departed carrier facility',
      occurredAt: new Date(Math.min(placedAt.getTime() + DAY_MS * 0.6, now - HOUR_MS)),
    },
  ];
  if (deliveredAt) {
    events.push(
      {
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        detail: 'Out for delivery',
        occurredAt: new Date(deliveredAt.getTime() - 5 * HOUR_MS),
      },
      {
        status: ShipmentStatus.DELIVERED,
        detail: 'Delivered, left at front door',
        occurredAt: deliveredAt,
      },
    );
  }
  return events;
}
