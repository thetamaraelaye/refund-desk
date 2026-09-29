import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditKind,
  MessageRole,
  Prisma,
  RefundSource,
  RequestStatus,
  type RefundRequest,
} from '@prisma/client';
import { evaluateRefundPolicy, type PolicyDecision, type ReplyFacts } from '@domain';
import type { CustomerSession } from '@common';
import { PrismaConfig } from '@configs';
import { AssistantService, type Reading, type Reply } from '@modules/assistant/assistant.service';
import { PolicyFactsService, type LoadedFacts, type OrderContext } from './policy-facts.service';
import { isUniqueViolation, issueRefund, toJson } from './refund-ledger';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR = 'Refund Desk (automated)';

// What a customer may see of their own request: the conversation and its status. Never the trace,
// the flags or the model's reading.
const CUSTOMER_VIEW_SELECT = {
  id: true,
  reference: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  messages: {
    select: { id: true, role: true, body: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.RefundRequestSelect;

type CustomerView = Prisma.RefundRequestGetPayload<{ select: typeof CUSTOMER_VIEW_SELECT }>;

const toCustomerView = (request: CustomerView) => ({
  ...request,
  // Only a request waiting on the customer takes more messages; anything else starts a new one.
  open: request.status === RequestStatus.NEEDS_INFO,
});

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaConfig,
    private readonly assistant: AssistantService,
    private readonly facts: PolicyFactsService,
  ) {}

  async sendMessage(customer: CustomerSession, requestId: string | undefined, message: string) {
    const request = requestId
      ? await this.findOwn(customer, requestId)
      : await this.prisma.refundRequest.create({
          data: { customerId: customer.customerId, status: RequestStatus.NEEDS_INFO },
        });
    if (request.status !== RequestStatus.NEEDS_INFO) {
      throw new ConflictException('This request is closed. Start a new request to continue.');
    }
    await this.prisma.requestMessage.create({
      data: { requestId: request.id, role: MessageRole.CUSTOMER, body: message.trim() },
    });
    await this.decide(customer, request.id, { handoffRequested: false });
    return this.view(customer, request.id);
  }

  // The always-visible "talk to a person" button (D10). Works before the first message, too.
  async handoff(customer: CustomerSession, requestId: string | undefined) {
    const request = requestId
      ? await this.findOwn(customer, requestId)
      : await this.prisma.refundRequest.create({
          data: { customerId: customer.customerId, status: RequestStatus.NEEDS_INFO },
        });
    if (request.status === RequestStatus.ESCALATED) return this.view(customer, request.id);
    if (request.status === RequestStatus.APPROVED) {
      throw new ConflictException('This refund is already approved.');
    }
    await this.decide(customer, request.id, { handoffRequested: true });
    return this.view(customer, request.id);
  }

  async listOwn(customer: CustomerSession) {
    const requests = await this.prisma.refundRequest.findMany({
      where: { customerId: customer.customerId },
      select: CUSTOMER_VIEW_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return requests.map(toCustomerView);
  }

  async view(customer: CustomerSession, requestId: string) {
    const request = await this.prisma.refundRequest.findFirst({
      where: { id: requestId, customerId: customer.customerId },
      select: CUSTOMER_VIEW_SELECT,
    });
    if (!request) throw new NotFoundException('Request not found');
    return toCustomerView(request);
  }

  private async findOwn(customer: CustomerSession, requestId: string): Promise<RefundRequest> {
    // Scoped by owner: another customer's request id reads as not found, not forbidden.
    const request = await this.prisma.refundRequest.findFirst({
      where: { id: requestId, customerId: customer.customerId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  // Read the conversation, decide from the records, write the reply, and record all of it at once.
  private async decide(
    customer: CustomerSession,
    requestId: string,
    options: { handoffRequested: boolean },
  ) {
    const messages = await this.prisma.requestMessage.findMany({
      where: { requestId, role: MessageRole.CUSTOMER },
      select: { body: true },
      orderBy: { createdAt: 'asc' },
    });
    const customerMessages = messages.map((m) => m.body);
    const catalog = await this.facts.catalog(customer.customerId);
    const reading = await this.assistant.read({ customerMessages, catalog }, options);

    // At most twice: if the item was refunded between deciding and writing, decide again from the
    // fresh records instead of failing the customer's message.
    for (let attempt = 1; ; attempt += 1) {
      const now = new Date();
      const loaded = await this.facts.load(
        customer.customerId,
        reading.claim,
        reading.signals,
        now,
      );
      const decision = evaluateRefundPolicy(loaded.input);
      const reply = await this.assistant.reply(
        decision,
        replyFacts(customer.name, decision, loaded.order, now),
      );
      try {
        await this.prisma.$transaction((tx) =>
          this.record(tx, {
            requestId,
            customer,
            reading,
            loaded,
            decision,
            reply,
            kind: options.handoffRequested ? AuditKind.HANDOFF : AuditKind.AUTOMATED,
            inputText: customerMessages.at(-1) ?? null,
          }),
        );
        return;
      } catch (error) {
        if (attempt === 1 && isUniqueViolation(error)) {
          this.logger.warn(`Item refunded concurrently on request ${requestId}; deciding again`);
          continue;
        }
        throw error;
      }
    }
  }

  private async record(
    tx: Prisma.TransactionClient,
    step: {
      requestId: string;
      customer: CustomerSession;
      reading: Reading;
      loaded: LoadedFacts;
      decision: PolicyDecision;
      reply: Reply;
      kind: AuditKind;
      inputText: string | null;
    },
  ) {
    const { requestId, customer, reading, loaded, decision, reply } = step;
    const subject = decision.subject;

    if (decision.outcome === RequestStatus.APPROVED) {
      // The engine only approves with an identified item and its recorded price.
      await issueRefund(tx, {
        requestId,
        customerId: customer.customerId,
        orderId: subject!.orderId,
        orderItemId: subject!.orderItemId!,
        amountMinor: subject!.amountMinor!,
        currency: subject!.currency,
        source: RefundSource.AUTOMATED,
        issuedByName: null,
      });
    }

    await tx.refundRequest.update({
      where: { id: requestId },
      data: {
        status: decision.outcome,
        orderId: subject?.orderId ?? null,
        orderItemId: subject?.orderItemId ?? null,
        amountMinor: subject?.amountMinor ?? null,
        currency: subject?.currency ?? null,
        reasonCategory: reading.claim.reason,
        flags: decision.flags,
        decisiveRule: decision.decisiveRule,
        summary: reading.summary || null,
      },
    });
    await tx.requestMessage.create({
      data: { requestId, role: MessageRole.ASSISTANT, body: reply.text },
    });

    const calls = [reading.call, reply.call].filter((c) => c !== null);
    await tx.decisionAudit.create({
      data: {
        requestId,
        kind: step.kind,
        actorName: SYSTEM_ACTOR,
        inputText: step.inputText,
        signals: toJson(reading.signals),
        extraction: toJson(reading.extraction),
        extractionError: reading.extractionError,
        facts: toJson(loaded.input),
        ruleTrace: toJson(decision.trace),
        outcome: decision.outcome,
        decisiveRule: decision.decisiveRule,
        reply: reply.text,
        replySource: reply.source,
        llmMode: this.assistant.mode,
        model: calls[0]?.model ?? null,
        latencyMs: calls.reduce((sum, c) => sum + c.latencyMs, 0),
        usage: toJson({
          extraction: reading.call?.usage ?? null,
          reply: reply.call?.usage ?? null,
        }),
        policyVersion: decision.policyVersion,
        note: reply.rejected ? `Model reply not sent: ${reply.rejected}` : null,
      },
    });
  }
}

// Facts the reply may use: only the customer's own order, and only once the engine placed it on
// their account (decision.subject).
function replyFacts(
  customerName: string,
  decision: PolicyDecision,
  order: OrderContext | null,
  now: Date,
): ReplyFacts {
  const own = decision.subject && order?.id === decision.subject.orderId ? order : null;
  const item = own?.items.find((i) => i.id === decision.subject?.orderItemId);
  return {
    customerName,
    orderNumber: own?.orderNumber ?? null,
    itemName: item?.name ?? null,
    itemChoices: own?.items.map((i) => i.name) ?? [],
    paymentMethod: own?.chargeMethod ?? null,
    lastRefundAt: own?.payments.lastRefundAt ?? null,
    itemRefundedAt: (item && own?.itemRefundedAt[item.id]) ?? null,
    deliveredDaysAgo: own?.deliveredAt
      ? Math.floor((now.getTime() - own.deliveredAt.getTime()) / DAY_MS)
      : null,
  };
}
