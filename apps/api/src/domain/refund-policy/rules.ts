import { formatMoney } from '../money';
import {
  CURRENCY_RULES,
  FAIR_USE_REFUND_LIMIT,
  FAIR_USE_WINDOW_DAYS,
  REFUND_WINDOW_DAYS,
} from './policy-config';
import type {
  ItemFacts,
  MissingDetail,
  OrderFacts,
  PolicyClause,
  PolicyInput,
  ReasonCategory,
  RequestFlag,
  RequestOutcome,
  RuleId,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RuleContext {
  input: PolicyInput;
  // The named order, only when it is on the customer's account.
  order: OrderFacts | null;
  item: ItemFacts | null;
}

export type Verdict =
  | { result: 'PASS' | 'SKIPPED'; detail: string }
  | {
      result: 'FAIL';
      outcome: Exclude<RequestOutcome, 'APPROVED'>;
      detail: string;
      flag?: RequestFlag;
      missing?: MissingDetail;
    };

export interface PolicyRule {
  id: RuleId;
  clause: PolicyClause;
  title: string;
  evaluate(context: RuleContext): Verdict;
}

const pass = (detail: string): Verdict => ({ result: 'PASS', detail });
const skip = (detail: string): Verdict => ({ result: 'SKIPPED', detail });
const fail = (
  outcome: Exclude<RequestOutcome, 'APPROVED'>,
  detail: string,
  extra: { flag?: RequestFlag; missing?: MissingDetail } = {},
): Verdict => ({ result: 'FAIL', outcome, detail, ...extra });

const REASON_LABELS: Record<ReasonCategory, string> = {
  DAMAGED: 'damaged or defective',
  WRONG_ITEM: 'wrong item sent',
  NOT_RECEIVED: 'never arrived',
  CHANGED_MIND: 'change of mind',
  OTHER: 'another reason',
  UNSPECIFIED: 'not given',
};

// Reasons about the item as it arrived; they only make sense on a delivered order.
const ARRIVAL_REASONS: ReadonlySet<ReasonCategory> = new Set(['DAMAGED', 'WRONG_ITEM']);

export const itemAmountMinor = (item: ItemFacts) => item.unitPriceMinor * item.quantity;

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// UTC, so the same facts always produce the same trace text.
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDate = (date: Date) => dateFormatter.format(date);

// Rules that decide the refund itself wait until the item and the reason are known.
function awaitingItemOrReason({ item, input }: RuleContext): Verdict | null {
  if (!item) return skip('Waits until the item is identified.');
  if (input.claim.reason === 'UNSPECIFIED') return skip('Waits until the customer gives a reason.');
  return null;
}

// Evaluation order is precedence: the first rule that fails decides the outcome (see decisions D5, D8, D9).
// 1. Safety signals escalate whatever else is true.
// 2. Identification: which order, which item, and why, asking the customer when it is missing.
// 3. Facts the records settle: the window and one refund per item deny outright.
// 4. Claims that contradict the records go to a person.
// 5. The refund decision: final sale, the reason, fair use and the review threshold.
export const POLICY_RULES: readonly PolicyRule[] = [
  {
    id: 'manipulation',
    clause: '§5b',
    title: 'No attempt to instruct the system',
    evaluate: ({ input }) =>
      input.signals.manipulation
        ? fail('ESCALATED', 'The message tries to give the automated system instructions.', {
            flag: 'MANIPULATION',
          })
        : pass('No instructions aimed at the system.'),
  },
  {
    id: 'extraction',
    clause: '§5d',
    title: 'Message read reliably',
    evaluate: ({ input }) =>
      input.signals.extractionFailed
        ? fail('ESCALATED', 'The message could not be read into validated fields.', {
            flag: 'EXTRACTION_FAILED',
          })
        : pass('Read into validated fields.'),
  },
  {
    id: 'human-handoff',
    clause: '§7',
    title: 'No request for a person',
    evaluate: ({ input }) =>
      input.signals.humanRequested
        ? fail('ESCALATED', 'The customer asked for a person.', { flag: 'HUMAN_REQUESTED' })
        : pass('The customer did not ask for a person.'),
  },
  {
    id: 'order-identified',
    clause: '§5a',
    title: 'Order number given',
    evaluate: ({ input }) =>
      input.claim.orderNumber === null
        ? fail('NEEDS_INFO', 'The message has no order number.', { missing: 'order' })
        : pass(`Names ${input.claim.orderNumber}.`),
  },
  {
    id: 'order-on-account',
    clause: '§5a',
    title: "Order is on the customer's account",
    evaluate: ({ input }) => {
      const { orderNumber } = input.claim;
      if (orderNumber === null) return skip('No order number to look up.');
      if (!input.order) {
        return fail('NEEDS_INFO', `No order ${orderNumber} exists.`, { missing: 'order' });
      }
      if (input.order.customerId !== input.customerId) {
        return fail('NEEDS_INFO', `${input.order.orderNumber} belongs to a different customer.`, {
          missing: 'order',
          flag: 'CROSS_ACCOUNT',
        });
      }
      return pass(`${input.order.orderNumber} is on the customer's account.`);
    },
  },
  {
    // A cancelled order is settled from its payment ledger: nothing owed is declined, money still held
    // goes to a specialist (D17, revisited once payment records existed).
    id: 'order-status',
    clause: '§6',
    title: 'A cancelled order has nothing left to refund',
    evaluate: ({ order }) => {
      if (!order) return skip('No order on the account to check.');
      if (order.status !== 'CANCELLED') {
        return pass(`${order.orderNumber} is ${order.status.toLowerCase()}.`);
      }
      const money = (minor: number) => formatMoney(minor, order.currency);
      const { chargedMinor, refundedMinor, lastRefundAt } = order.payments;
      const outstanding = chargedMinor - refundedMinor;
      if (outstanding > 0) {
        return fail(
          'ESCALATED',
          `${order.orderNumber} was cancelled, but ${money(outstanding)} of its ${money(chargedMinor)} charge has not been refunded.`,
        );
      }
      if (chargedMinor === 0) {
        return fail('DENIED', `${order.orderNumber} was cancelled before it was charged.`);
      }
      const when = lastRefundAt ? ` on ${formatDate(lastRefundAt)}` : '';
      return fail(
        'DENIED',
        `${order.orderNumber} was cancelled and its ${money(chargedMinor)} charge was refunded${when}.`,
      );
    },
  },
  {
    id: 'refund-window',
    clause: '§2',
    title: `Within ${REFUND_WINDOW_DAYS} days of delivery`,
    evaluate: ({ input, order }) => {
      if (!order) return skip('No order on the account to check.');
      if (!order.deliveredAt) {
        return pass(`Not delivered yet, so the ${REFUND_WINDOW_DAYS}-day window has not started.`);
      }
      const elapsedMs = input.now.getTime() - order.deliveredAt.getTime();
      const days = plural(Math.floor(elapsedMs / DAY_MS), 'day');
      if (elapsedMs > REFUND_WINDOW_DAYS * DAY_MS) {
        return fail(
          'DENIED',
          `Delivered ${days} ago; the ${REFUND_WINDOW_DAYS}-day window has closed.`,
        );
      }
      return pass(`Delivered ${days} ago, within the ${REFUND_WINDOW_DAYS}-day window.`);
    },
  },
  {
    id: 'item-identified',
    clause: '§5a',
    title: 'Item is in the order',
    evaluate: ({ input, order, item }) => {
      if (!order) return skip('No order on the account to search.');
      if (item) return pass(`${item.name} (${item.sku}).`);
      if (input.claim.itemSku !== null || input.claim.itemMentioned) {
        return fail('ESCALATED', `The item named is not in ${order.orderNumber}.`, {
          flag: 'CLAIM_MISMATCH',
        });
      }
      return fail(
        'NEEDS_INFO',
        `${order.orderNumber} has ${plural(order.items.length, 'item')} and the message does not say which.`,
        { missing: 'item' },
      );
    },
  },
  {
    id: 'already-refunded',
    clause: '§6',
    title: 'Item not already refunded',
    evaluate: ({ item }) => {
      if (!item) return skip('Waits until the item is identified.');
      return item.alreadyRefunded
        ? fail('DENIED', `${item.name} has already been refunded.`)
        : pass('Not refunded before.');
    },
  },
  {
    id: 'reason-given',
    clause: '§4',
    title: 'Reason given',
    evaluate: ({ input }) =>
      input.claim.reason === 'UNSPECIFIED'
        ? fail('NEEDS_INFO', 'The message does not say what went wrong.', { missing: 'reason' })
        : pass(`Reason: ${REASON_LABELS[input.claim.reason]}.`),
  },
  {
    id: 'delivery-matches-claim',
    clause: '§5a',
    title: 'Claim is consistent with delivery',
    evaluate: ({ input, order }) => {
      if (!order) return skip('No order on the account to check.');
      const { reason } = input.claim;
      if (!ARRIVAL_REASONS.has(reason)) return pass('The reason does not depend on delivery.');
      if (!order.deliveredAt) {
        return fail(
          'ESCALATED',
          `Claims ${REASON_LABELS[reason]}, but ${order.orderNumber} has not been delivered.`,
          { flag: 'CLAIM_MISMATCH' },
        );
      }
      return pass(`${order.orderNumber} was delivered, consistent with the claim.`);
    },
  },
  {
    id: 'amount-matches',
    clause: '§5a',
    title: 'Claimed amount matches what was paid',
    evaluate: ({ input, order, item }) => {
      if (!order || !item) return skip('Waits until the item is identified.');
      const { claimedAmountMinor, claimedCurrency } = input.claim;
      if (claimedAmountMinor === null) return pass('No amount claimed.');
      if (claimedCurrency !== null && claimedCurrency !== order.currency) {
        return fail(
          'ESCALATED',
          `Claims an amount in ${claimedCurrency}; the order was paid in ${order.currency}.`,
          { flag: 'CLAIM_MISMATCH' },
        );
      }
      const paid = itemAmountMinor(item);
      const tolerance = CURRENCY_RULES[order.currency]?.amountToleranceMinor ?? 0;
      const claimed = formatMoney(claimedAmountMinor, order.currency);
      if (Math.abs(claimedAmountMinor - paid) > tolerance) {
        return fail(
          'ESCALATED',
          `Claims ${claimed}; ${item.name} cost ${formatMoney(paid, order.currency)}.`,
          { flag: 'CLAIM_MISMATCH' },
        );
      }
      return pass(`Claims ${claimed}, matching the ${formatMoney(paid, order.currency)} paid.`);
    },
  },
  {
    id: 'final-sale',
    clause: '§1',
    title: 'Final-sale items are never approved automatically',
    evaluate: (context) => {
      const waiting = awaitingItemOrReason(context);
      if (waiting) return waiting;
      const item = context.item!;
      const { reason } = context.input.claim;
      if (!item.finalSale) return pass('Not a final-sale item.');
      if (reason === 'CHANGED_MIND') {
        return fail(
          'DENIED',
          `${item.name} was sold as final sale; change of mind is not refunded.`,
        );
      }
      return fail(
        'ESCALATED',
        `${item.name} was sold as final sale; a specialist reviews the "${REASON_LABELS[reason]}" claim.`,
      );
    },
  },
  {
    id: 'reason-eligible',
    clause: '§4',
    title: 'Reason qualifies for a refund',
    evaluate: (context) => {
      const waiting = awaitingItemOrReason(context);
      if (waiting) return waiting;
      switch (context.input.claim.reason) {
        case 'DAMAGED':
        case 'WRONG_ITEM':
          return pass(`"${REASON_LABELS[context.input.claim.reason]}" qualifies.`);
        case 'CHANGED_MIND':
          return fail('DENIED', 'Change of mind is not refunded; the returns process applies.');
        case 'NOT_RECEIVED':
          return fail('ESCALATED', 'Non-receipt goes to a specialist to check with the carrier.');
        default:
          return fail('ESCALATED', 'The automated checks cannot settle this reason.');
      }
    },
  },
  {
    id: 'fair-use',
    clause: '§5c',
    title: `Fewer than ${FAIR_USE_REFUND_LIMIT} refunds in ${FAIR_USE_WINDOW_DAYS} days`,
    evaluate: (context) => {
      const waiting = awaitingItemOrReason(context);
      if (waiting) return waiting;
      const count = context.input.recentRefundCount;
      const summary = `${plural(count, 'refund')} in the last ${FAIR_USE_WINDOW_DAYS} days`;
      return count >= FAIR_USE_REFUND_LIMIT
        ? fail('ESCALATED', `${summary}.`, { flag: 'FAIR_USE' })
        : pass(`${summary}.`);
    },
  },
  {
    id: 'review-threshold',
    clause: '§3',
    title: 'Order refund total within the review threshold',
    evaluate: (context) => {
      const waiting = awaitingItemOrReason(context);
      if (waiting) return waiting;
      const order = context.order!;
      const item = context.item!;
      const rule = CURRENCY_RULES[order.currency];
      if (!rule) {
        return fail('ESCALATED', `No review threshold is set for ${order.currency}.`, {
          flag: 'UNCONFIGURED_CURRENCY',
        });
      }
      const money = (minor: number) => formatMoney(minor, order.currency);
      const amount = itemAmountMinor(item);
      const total = order.refundedTotalMinor + amount;
      const limit = money(rule.reviewThresholdMinor);
      const described =
        order.refundedTotalMinor > 0
          ? `${money(amount)} plus ${money(order.refundedTotalMinor)} already refunded on ${order.orderNumber} is ${money(total)}`
          : `${money(amount)} on ${order.orderNumber}`;
      return total > rule.reviewThresholdMinor
        ? fail('ESCALATED', `${described}, over ${limit}.`, { flag: 'HIGH_VALUE' })
        : pass(`${described}, within ${limit}.`);
    },
  },
  {
    // Not a customer rule: an operational limit on money leaving without a person looking.
    id: 'automation-limit',
    clause: '§7',
    title: "Within today's automatic refund limit",
    evaluate: (context) => {
      const waiting = awaitingItemOrReason(context);
      if (waiting) return waiting;
      const { refundsEnabled, remainingTodayMinor } = context.input.automation;
      const order = context.order!;
      if (!refundsEnabled) return fail('ESCALATED', 'Automatic refunds are switched off.');
      if (remainingTodayMinor === null) {
        return fail('ESCALATED', `No automatic refund limit is set for ${order.currency}.`);
      }
      const money = (minor: number) => formatMoney(minor, order.currency);
      const amount = itemAmountMinor(context.item!);
      const left = `${money(Math.max(remainingTodayMinor, 0))} left today`;
      return amount > remainingTodayMinor
        ? fail('ESCALATED', `${money(amount)} is over the automatic refund limit (${left}).`)
        : pass(`${money(amount)} is within the automatic refund limit (${left}).`);
    },
  },
];
