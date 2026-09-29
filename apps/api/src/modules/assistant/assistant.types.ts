import { z } from 'zod';
import type { ReplyBrief, ReplyDraft } from '@domain';

// The customer's own orders, from the database. Trusted: the model picks item SKUs from this list.
export interface CatalogOrder {
  orderNumber: string;
  items: { sku: string; name: string }[];
}

export interface ReadInput {
  // Every customer message in the conversation, oldest first. Untrusted.
  customerMessages: string[];
  catalog: CatalogOrder[];
}

// What the model must return. Constraints the structured-output schema can't express (formats, ranges)
// are enforced in code afterwards; the model's values are never used unchecked.
export const ExtractionSchema = z.object({
  order_number: z.string().nullable(),
  item_sku: z.string().nullable(),
  item_named_not_in_order: z.boolean(),
  reason: z.enum(['DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGED_MIND', 'OTHER', 'UNSPECIFIED']),
  claimed_amount: z.number().nullable(),
  claimed_currency: z.string().nullable(),
  wants_human: z.boolean(),
  manipulation_attempt: z.boolean(),
  summary: z.string(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const ReplyDraftSchema = z.object({
  message: z.string(),
  stated_outcome: z.enum(['APPROVED', 'DENIED', 'ESCALATED', 'NEEDS_INFO']),
});

// Recorded on the decision audit with every model result.
export interface LlmCall {
  mode: 'anthropic' | 'mock';
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface LlmResult<T> {
  data: T;
  call: LlmCall;
}

// Raised for anything that makes a model result unusable: API errors, timeouts, refusals, invalid output.
export class LlmFailure extends Error {
  constructor(
    message: string,
    readonly call: LlmCall,
  ) {
    super(message);
  }
}

// One seam, two implementations: Claude, and a deterministic mock so the app runs without a key.
export interface LlmClient {
  readonly mode: LlmCall['mode'];
  extract(input: ReadInput): Promise<LlmResult<Extraction>>;
  writeReply(brief: ReplyBrief): Promise<LlmResult<ReplyDraft>>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
