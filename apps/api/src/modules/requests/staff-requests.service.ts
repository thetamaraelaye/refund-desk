import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditKind, MessageRole, Prisma, RefundSource, RequestStatus } from '@prisma/client';
import { FAIR_USE_WINDOW_DAYS, POLICY_VERSION, formatMoney } from '@domain';
import type { StaffSession } from '@common';
import { PrismaConfig } from '@configs';
import type { ListRequestsQuery, ResolveRequestDto } from './dto/requests.dto';
import { isUniqueViolation, issueRefund } from './refund-ledger';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_CURRENCY = 'USD';

// Open requests a specialist can rule on; approved and denied ones are final.
const RESOLVABLE: ReadonlySet<RequestStatus> = new Set([
  RequestStatus.ESCALATED,
  RequestStatus.NEEDS_INFO,
]);

const LIST_SELECT = {
  id: true,
  reference: true,
  status: true,
  flags: true,
  decisiveRule: true,
  summary: true,
  reasonCategory: true,
  orderItem: { select: { name: true } },
  amountMinor: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true, email: true } },
  order: { select: { orderNumber: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.RefundRequestSelect;

const DETAIL_SELECT = {
  id: true,
  reference: true,
  status: true,
  flags: true,
  decisiveRule: true,
  summary: true,
  reasonCategory: true,
  amountMinor: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  resolvedByName: true,
  resolvedAt: true,
  resolutionNote: true,
  customer: { select: { id: true, name: true, email: true, createdAt: true } },
  orderItem: { select: { sku: true, name: true, finalSale: true } },
  refund: {
    select: { amountMinor: true, currency: true, source: true, issuedByName: true, issuedAt: true },
  },
  order: {
    select: {
      orderNumber: true,
      status: true,
      currency: true,
      placedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      items: {
        select: {
          sku: true,
          name: true,
          quantity: true,
          unitPriceMinor: true,
          finalSale: true,
          refund: { select: { issuedAt: true } },
        },
        orderBy: { sku: 'asc' },
      },
      payments: {
        select: {
          kind: true,
          amountMinor: true,
          currency: true,
          method: true,
          reference: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: 'asc' },
      },
      shipmentEvents: {
        select: { status: true, carrier: true, detail: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
  },
  messages: {
    select: { id: true, role: true, body: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
  audits: {
    select: {
      id: true,
      kind: true,
      actorName: true,
      inputText: true,
      signals: true,
      extraction: true,
      extractionError: true,
      facts: true,
      ruleTrace: true,
      outcome: true,
      decisiveRule: true,
      reply: true,
      replySource: true,
      llmMode: true,
      model: true,
      latencyMs: true,
      usage: true,
      policyVersion: true,
      note: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.RefundRequestSelect;

@Injectable()
export class StaffRequestsService {
  constructor(private readonly prisma: PrismaConfig) {}

  async list(query: ListRequestsQuery) {
    const attention = !query.status && query.view === 'attention';
    const where: Prisma.RefundRequestWhereInput = query.status
      ? { status: query.status }
      : attention
        ? { status: { in: [...RESOLVABLE] } }
        : {};
    const [items, total, byStatus] = await Promise.all([
      this.prisma.refundRequest.findMany({
        where,
        select: LIST_SELECT,
        // The queue serves whoever has waited longest; every other view shows newest activity first.
        orderBy: attention ? { createdAt: 'asc' } : { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.refundRequest.count({ where }),
      this.prisma.refundRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(
      Object.values(RequestStatus).map((status) => [
        status,
        byStatus.find((row) => row.status === status)?._count._all ?? 0,
      ]),
    ) as Record<RequestStatus, number>;
    return {
      items: items.map(({ _count, order, ...item }) => ({
        ...item,
        orderNumber: order?.orderNumber ?? null,
        messageCount: _count.messages,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        counts,
      },
    };
  }

  // The console's headline numbers. Today is the UTC day; money is the store currency (D13).
  async metrics() {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const open = { status: { in: [...RESOLVABLE] } };
    const [needsAttention, oldest, today] = await Promise.all([
      this.prisma.refundRequest.count({ where: open }),
      this.prisma.refundRequest.findFirst({
        where: open,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.refund.aggregate({
        where: {
          issuedAt: { gte: midnight },
          source: { in: [RefundSource.AUTOMATED, RefundSource.AGENT] },
          currency: STORE_CURRENCY,
        },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
    ]);
    return {
      needsAttention,
      oldestWaitingSince: oldest?.createdAt ?? null,
      approvedToday: today._count._all,
      refundedTodayMinor: today._sum.amountMinor ?? 0,
      currency: STORE_CURRENCY,
    };
  }

  async detail(id: string) {
    const request = await this.prisma.refundRequest.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!request) throw new NotFoundException('Request not found');
    const recentRefunds = await this.prisma.refund.count({
      where: {
        customerId: request.customer.id,
        issuedAt: { gte: new Date(Date.now() - FAIR_USE_WINDOW_DAYS * DAY_MS) },
      },
    });
    return { ...request, customer: { ...request.customer, recentRefunds } };
  }

  // A specialist's ruling on a request that is open: escalated to a person, or still waiting on the
  // customer (who may never come back). Approval pays from the recorded price of the item the engine
  // identified; the specialist cannot type an amount.
  async resolve(staff: StaffSession, id: string, body: ResolveRequestDto) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.refundRequest.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            customerId: true,
            orderId: true,
            orderItemId: true,
            amountMinor: true,
            currency: true,
            customer: { select: { name: true } },
            orderItem: { select: { name: true } },
          },
        });
        if (!request) throw new NotFoundException('Request not found');
        if (!RESOLVABLE.has(request.status)) {
          throw new ConflictException(
            'This request has already been decided. Only escalated or waiting requests can be resolved.',
          );
        }

        const approve = body.action === 'APPROVE';
        const firstName = request.customer.name.split(' ')[0];
        let message = `Hi ${firstName}, a member of our support team has reviewed your request and can't approve a refund this time. If anything has changed, you can start a new request.`;

        if (approve) {
          const { orderId, orderItemId, amountMinor, currency } = request;
          if (!orderId || !orderItemId || amountMinor === null || !currency) {
            throw new UnprocessableEntityException(
              'This request has no identified item to refund. Deny it with a note, or ask the customer to start a new request with the order and item.',
            );
          }
          const { method } = await issueRefund(tx, {
            requestId: request.id,
            customerId: request.customerId,
            orderId,
            orderItemId,
            amountMinor,
            currency,
            source: RefundSource.AGENT,
            issuedByName: staff.name,
          });
          message = `Hi ${firstName}, a member of our support team has approved your refund of ${formatMoney(amountMinor, currency)} for the ${request.orderItem?.name ?? 'item'}. It goes back to ${method ?? 'your original payment method'} within 5–10 business days.`;
        }

        const outcome = approve ? RequestStatus.APPROVED : RequestStatus.DENIED;
        await tx.refundRequest.update({
          where: { id },
          data: {
            status: outcome,
            resolvedByName: staff.name,
            resolvedAt: new Date(),
            resolutionNote: body.note.trim(),
          },
        });
        await tx.requestMessage.create({
          data: { requestId: id, role: MessageRole.STAFF, body: message },
        });
        await tx.decisionAudit.create({
          data: {
            requestId: id,
            kind: AuditKind.STAFF_RESOLUTION,
            actorName: staff.name,
            outcome,
            reply: message,
            policyVersion: POLICY_VERSION,
            note: body.note.trim(),
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This item has already been refunded');
      }
      throw error;
    }
    return this.detail(id);
  }
}
