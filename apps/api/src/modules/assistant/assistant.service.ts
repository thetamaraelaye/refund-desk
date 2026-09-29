import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  buildReplyBrief,
  checkReply,
  detectHandoffRequest,
  detectManipulation,
  templateReply,
  toMinorUnits,
  type CustomerClaim,
  type PolicyDecision,
  type ReplyBrief,
  type ReplyFacts,
  type RequestSignals,
} from '@domain';
import {
  LLM_CLIENT,
  LlmFailure,
  type CatalogOrder,
  type Extraction,
  type LlmCall,
  type LlmClient,
  type ReadInput,
} from './assistant.types';
import { readMessages } from './mock.client';

// Store currency (D13): a claimed amount with no currency named is read in it.
const DEFAULT_CURRENCY = 'USD';

export interface Reading {
  claim: CustomerClaim;
  signals: RequestSignals;
  summary: string;
  extraction: Extraction;
  extractionError: string | null;
  call: LlmCall | null;
}

export interface Reply {
  text: string;
  source: 'MODEL' | 'TEMPLATE';
  brief: ReplyBrief;
  call: LlmCall | null;
  // Why a model draft was not sent, when it wasn't.
  rejected: string | null;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(@Inject(LLM_CLIENT) private readonly llm: LlmClient) {}

  get mode() {
    return this.llm.mode;
  }

  // Turns the conversation into a claim and signals for the policy engine. Never throws: a model
  // failure is recorded and raises extractionFailed, which escalates (D9).
  async read(input: ReadInput, options: { handoffRequested?: boolean } = {}): Promise<Reading> {
    let extraction: Extraction;
    let call: LlmCall | null;
    let extractionError: string | null = null;
    try {
      // Nothing to read yet (a handoff before the first message): no model call.
      ({ data: extraction, call } =
        input.customerMessages.length === 0
          ? { data: readMessages(input), call: null }
          : await this.llm.extract(input));
    } catch (error) {
      extractionError = error instanceof LlmFailure ? error.message : 'The model call failed';
      call = error instanceof LlmFailure ? error.call : null;
      this.logger.warn(`Extraction failed, escalating: ${extractionError}`);
      // Best-effort fields so the dashboard still shows what was asked; the decision escalates anyway.
      extraction = readMessages(input);
    }

    const { customerMessages } = input;
    return {
      claim: toClaim(extraction, input.catalog, customerMessages),
      signals: {
        // Either the model or the deterministic check is enough.
        manipulation: extraction.manipulation_attempt || detectManipulation(customerMessages),
        humanRequested:
          Boolean(options.handoffRequested) ||
          extraction.wants_human ||
          detectHandoffRequest(customerMessages),
        extractionFailed: extractionError !== null,
      },
      summary: extraction.summary.replace(/\s+/g, ' ').trim().slice(0, 240),
      extraction,
      extractionError,
      call,
    };
  }

  // Writes the customer's reply from a brief built by code. A draft that fails the guard, or a model
  // failure, falls back to the deterministic template, so a reply always goes out and never contradicts
  // the decision.
  async reply(decision: PolicyDecision, facts: ReplyFacts): Promise<Reply> {
    const brief = buildReplyBrief(decision, facts);
    const fallback = (call: LlmCall | null, rejected: string | null): Reply => ({
      text: templateReply(brief),
      source: 'TEMPLATE',
      brief,
      call,
      rejected,
    });

    try {
      const { data, call } = await this.llm.writeReply(brief);
      if (this.llm.mode === 'mock') return fallback(call, null);
      const verdict = checkReply(data, brief);
      if (!verdict.ok) {
        this.logger.warn(`Reply draft rejected: ${verdict.reason}`);
        return fallback(call, verdict.reason);
      }
      return { text: data.message.trim(), source: 'MODEL', brief, call, rejected: null };
    } catch (error) {
      const reason = error instanceof LlmFailure ? error.message : 'The model call failed';
      this.logger.warn(`Reply model failed, using the template: ${reason}`);
      return fallback(error instanceof LlmFailure ? error.call : null, reason);
    }
  }
}

// The model's fields, checked and normalised. Nothing here is trusted to be well-formed.
export function toClaim(
  extraction: Extraction,
  catalog: CatalogOrder[],
  customerMessages: string[] = [],
): CustomerClaim {
  const digits = /^ORD[-\s]?(\d{4})$/i.exec(extraction.order_number?.trim() ?? '');
  let orderNumber = digits ? `ORD-${digits[1]}` : null;

  // An order the customer never typed was inferred from the item they described. Inference may only
  // land on one of their own orders; anything else is dropped, so the customer is asked instead.
  const typed = digits && new RegExp(`\\b(?:ORD[-\\s#]?)?${digits[1]}\\b`, 'i');
  const orderInferred = orderNumber !== null && !customerMessages.some((m) => typed!.test(m));
  if (orderInferred && !catalog.some((o) => o.orderNumber === orderNumber)) orderNumber = null;

  // A SKU must exist somewhere in the customer's own orders; an invented one counts as an item named
  // that isn't in the order, which escalates.
  const knownSkus = new Set(catalog.flatMap((o) => o.items.map((i) => i.sku)));
  const rawSku = extraction.item_sku?.trim() || null;
  const itemSku = rawSku && knownSkus.has(rawSku) ? rawSku : null;

  const currency = /^[A-Za-z]{3}$/.test(extraction.claimed_currency ?? '')
    ? extraction.claimed_currency!.toUpperCase()
    : null;
  const claimedAmountMinor =
    extraction.claimed_amount === null
      ? null
      : toMinorUnits(extraction.claimed_amount, currency ?? DEFAULT_CURRENCY);

  return {
    orderNumber,
    orderInferred: orderInferred && orderNumber !== null,
    itemSku,
    itemMentioned: itemSku !== null || rawSku !== null || extraction.item_named_not_in_order,
    reason: extraction.reason,
    claimedAmountMinor,
    claimedCurrency: claimedAmountMinor === null ? null : currency,
  };
}
