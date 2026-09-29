import { formatMoney } from '../money';
import { CURRENCY_RULES, REFUND_WINDOW_DAYS } from '../refund-policy/policy-config';
import type { MissingDetail, PolicyDecision, RequestOutcome } from '../refund-policy/types';

// Facts the customer is allowed to see: their own order only. The service passes nulls for anything
// about an order that is not on their account, so a reply can never describe someone else's order.
export interface ReplyFacts {
  customerName: string;
  orderNumber: string | null;
  itemName: string | null;
  // Names of the order's items, offered when the customer must say which one.
  itemChoices: string[];
  paymentMethod: string | null;
  lastRefundAt: Date | null;
  deliveredDaysAgo: number | null;
}

// Everything the reply writer sees. It is built by code from the decision; the raw message and the
// rule trace never reach it (D11, D17).
export interface ReplyBrief {
  customerFirstName: string;
  outcome: RequestOutcome;
  explanation: string;
  nextStep: string | null;
  missing: string[];
  // The customer's own items to choose from, when they must say which one.
  itemChoices: string[];
  // The only money amounts a reply may mention.
  allowedAmounts: string[];
}

const MISSING_PHRASES: Record<MissingDetail, string> = {
  order: 'your order number (it starts with ORD-)',
  item: 'which item the request is about',
  reason: 'what went wrong with it',
};

const SPECIALIST = 'A member of our support team will review it and reply within one business day.';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function buildReplyBrief(decision: PolicyDecision, facts: ReplyFacts): ReplyBrief {
  const subject = decision.subject;
  const amount =
    subject?.amountMinor != null ? formatMoney(subject.amountMinor, subject.currency) : null;
  const threshold = subject ? CURRENCY_RULES[subject.currency]?.reviewThresholdMinor : undefined;
  const thresholdText =
    subject && threshold !== undefined ? formatMoney(threshold, subject.currency) : null;
  const item = facts.itemName ? `the ${facts.itemName}` : 'your item';
  const order = facts.orderNumber ?? 'your order';

  let explanation: string;
  let nextStep: string | null = SPECIALIST;

  switch (decision.outcome === 'APPROVED' ? 'approved' : decision.decisiveRule) {
    case 'approved':
      explanation = `Your refund of ${amount} for ${item} from ${order} is approved.`;
      nextStep = `It goes back to ${facts.paymentMethod ?? 'your original payment method'} within 5–10 business days.`;
      break;
    case 'human-handoff':
      explanation =
        "You asked to speak with a person, so I've passed your request to our support team.";
      break;
    case 'order-identified':
    case 'order-on-account':
      explanation = facts.orderNumber
        ? "I couldn't match that to an order on your account."
        : "I couldn't find that order on your account.";
      nextStep = null;
      break;
    case 'order-status':
      if (decision.outcome === 'DENIED') {
        const when = facts.lastRefundAt ? ` on ${dateFormatter.format(facts.lastRefundAt)}` : '';
        const where = facts.paymentMethod ? ` to ${facts.paymentMethod}` : '';
        explanation = `${order} was cancelled, and its charge was already refunded in full${when}${where}.`;
        nextStep = 'Banks can take 5–10 business days to show a refund on your statement.';
      } else {
        explanation = `${order} was cancelled, but our records show part of the charge hasn't been refunded yet.`;
        nextStep =
          'A member of our support team will sort out the refund and reply within one business day.';
      }
      break;
    case 'refund-window':
      explanation = `Refunds are available within ${REFUND_WINDOW_DAYS} days of delivery, and ${order} was delivered ${facts.deliveredDaysAgo ?? 'more than ' + REFUND_WINDOW_DAYS} days ago, so I can't refund it.`;
      nextStep = null;
      break;
    case 'item-identified':
      if (decision.outcome === 'NEEDS_INFO') {
        explanation = `${order} has more than one item.`;
        nextStep = null;
      } else {
        explanation = `The item you mentioned doesn't match what we have on ${order}, so I've passed this to our support team to check.`;
      }
      break;
    case 'already-refunded':
      explanation = `${capitalise(item)} from ${order} has already been refunded, so I can't refund it again.`;
      nextStep = null;
      break;
    case 'reason-given':
      explanation = 'I can look into this as soon as I know what happened.';
      nextStep = null;
      break;
    case 'delivery-matches-claim':
      explanation = `Our records show ${order} hasn't been delivered yet, so I've passed this to our support team to check with the carrier.`;
      break;
    case 'amount-matches':
      explanation = `The amount you mentioned doesn't match our records for ${item}, so I've passed this to our support team to check.`;
      break;
    case 'final-sale':
      if (decision.outcome === 'DENIED') {
        explanation = `${capitalise(item)} was sold as final sale, so it can't be refunded for a change of mind.`;
        nextStep = null;
      } else {
        explanation = `${capitalise(item)} was a final-sale item, so a specialist needs to review your report.`;
      }
      break;
    case 'reason-eligible':
      if (decision.outcome === 'DENIED') {
        explanation = "We don't refund items for a change of mind.";
        nextStep = 'You can still send it back through our returns process.';
      } else {
        explanation = "I've passed your request to our support team.";
      }
      break;
    case 'review-threshold':
      explanation = thresholdText
        ? `Refunds over ${thresholdText} are reviewed by a member of our support team.`
        : "I've passed your request to our support team.";
      break;
    default:
      // manipulation, extraction, fair use: neutral on purpose; the reply never says why (D8).
      explanation = "I've passed your request to our support team.";
  }

  return {
    customerFirstName: facts.customerName.split(' ')[0] ?? facts.customerName,
    outcome: decision.outcome,
    explanation,
    nextStep,
    missing: decision.missing.map((m) => MISSING_PHRASES[m]),
    itemChoices: decision.missing.includes('item') ? facts.itemChoices : [],
    allowedAmounts: [amount, thresholdText].filter((a): a is string => a !== null),
  };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const joinList = (parts: string[], conjunction = 'and') =>
  parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts.at(-1)}`;

// The deterministic reply: used by the mock model, and whenever a model draft fails the guard.
export function templateReply(brief: ReplyBrief): string {
  const parts = [`Hi ${brief.customerFirstName},`, brief.explanation];
  if (brief.missing.length > 0) {
    const choices = brief.itemChoices.length > 0 ? ` (${joinList(brief.itemChoices, 'or')})` : '';
    parts.push(`Could you tell me ${joinList(brief.missing)}${choices}?`);
  }
  if (brief.nextStep) parts.push(brief.nextStep);
  return parts.join(' ');
}
