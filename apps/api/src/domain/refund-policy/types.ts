// String unions with the same values as the Prisma enums, so the domain imports nothing from Prisma
// while services can pass records straight in.
export type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type ReasonCategory =
  'DAMAGED' | 'WRONG_ITEM' | 'NOT_RECEIVED' | 'CHANGED_MIND' | 'OTHER' | 'UNSPECIFIED';

export type RequestOutcome = 'NEEDS_INFO' | 'APPROVED' | 'DENIED' | 'ESCALATED';

export type RequestFlag =
  | 'HUMAN_REQUESTED'
  | 'MANIPULATION'
  | 'EXTRACTION_FAILED'
  | 'CROSS_ACCOUNT'
  | 'CLAIM_MISMATCH'
  | 'HIGH_VALUE'
  | 'FAIR_USE'
  | 'UNCONFIGURED_CURRENCY';

// Section numbers of docs/refund-policy.md, as shown in the dashboard's rule trace.
export type PolicyClause = '§1' | '§2' | '§3' | '§4' | '§5a' | '§5b' | '§5c' | '§5d' | '§6' | '§7';

export type MissingDetail = 'order' | 'item' | 'reason';

export interface ItemFacts {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  finalSale: boolean;
  alreadyRefunded: boolean;
}

export interface OrderFacts {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  currency: string;
  // The carrier's delivery date; null until delivered.
  deliveredAt: Date | null;
  // Everything already refunded on this order, from the refunds table.
  refundedTotalMinor: number;
  items: ItemFacts[];
}

// What the customer's message says, as extracted. Claims are compared with records, never paid.
export interface CustomerClaim {
  orderNumber: string | null;
  // One of the named order's SKUs, when the message identifies an item.
  itemSku: string | null;
  // The message names an item, whether or not it matched one.
  itemMentioned: boolean;
  reason: ReasonCategory;
  claimedAmountMinor: number | null;
  claimedCurrency: string | null;
}

export interface RequestSignals {
  manipulation: boolean;
  extractionFailed: boolean;
  humanRequested: boolean;
}

export interface PolicyInput {
  now: Date;
  customerId: string;
  claim: CustomerClaim;
  signals: RequestSignals;
  // The order the claim names, looked up without an owner filter so a cross-account claim can be flagged.
  order: OrderFacts | null;
  // The customer's refunds issued in the last FAIR_USE_WINDOW_DAYS.
  recentRefundCount: number;
}

export type RuleId =
  | 'manipulation'
  | 'extraction'
  | 'human-handoff'
  | 'order-identified'
  | 'order-on-account'
  | 'order-status'
  | 'refund-window'
  | 'item-identified'
  | 'already-refunded'
  | 'reason-given'
  | 'delivery-matches-claim'
  | 'amount-matches'
  | 'final-sale'
  | 'reason-eligible'
  | 'fair-use'
  | 'review-threshold';

export interface RuleResult {
  rule: RuleId;
  clause: PolicyClause;
  title: string;
  result: 'PASS' | 'FAIL' | 'SKIPPED';
  // Set when the rule fails: the outcome it asks for.
  outcome: Exclude<RequestOutcome, 'APPROVED'> | null;
  // Plain-language facts behind the result, for the support dashboard.
  detail: string;
}

// The order and item the request is about, only when the order is on the customer's account.
export interface RequestSubject {
  orderId: string;
  orderItemId: string | null;
  // The item's price from the record, never the claimed amount.
  amountMinor: number | null;
  currency: string;
}

export interface PolicyDecision {
  policyVersion: string;
  outcome: RequestOutcome;
  decisiveRule: RuleId | null;
  decisiveClause: PolicyClause | null;
  flags: RequestFlag[];
  // What to ask the customer for; empty unless the outcome is NEEDS_INFO.
  missing: MissingDetail[];
  subject: RequestSubject | null;
  // Every rule, in evaluation order, including the ones that passed or could not run.
  trace: RuleResult[];
}
