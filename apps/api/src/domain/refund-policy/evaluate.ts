import { POLICY_VERSION } from './policy-config';
import { POLICY_RULES, itemAmountMinor, type RuleContext } from './rules';
import type {
  CustomerClaim,
  ItemFacts,
  MissingDetail,
  OrderFacts,
  PolicyDecision,
  PolicyInput,
  RequestFlag,
  RuleResult,
} from './types';

// A claimed SKU must be in this order; with no item named, a single-item order means its only item.
function resolveItem(order: OrderFacts | null, claim: CustomerClaim): ItemFacts | null {
  if (!order) return null;
  if (claim.itemSku !== null) return order.items.find((i) => i.sku === claim.itemSku) ?? null;
  if (!claim.itemMentioned && order.items.length === 1) return order.items[0];
  return null;
}

// Pure and synchronous: every fact arrives in the input, so the same input always gets the same decision.
export function evaluateRefundPolicy(input: PolicyInput): PolicyDecision {
  const order = input.order?.customerId === input.customerId ? input.order : null;
  const item = resolveItem(order, input.claim);
  const context: RuleContext = { input, order, item };

  const trace: RuleResult[] = [];
  const flags: RequestFlag[] = [];
  const missing: MissingDetail[] = [];

  for (const rule of POLICY_RULES) {
    const verdict = rule.evaluate(context);
    const failed = verdict.result === 'FAIL';
    trace.push({
      rule: rule.id,
      clause: rule.clause,
      title: rule.title,
      result: verdict.result,
      outcome: failed ? verdict.outcome : null,
      detail: verdict.detail,
    });
    if (failed && verdict.flag && !flags.includes(verdict.flag)) flags.push(verdict.flag);
    if (failed && verdict.missing && !missing.includes(verdict.missing)) {
      missing.push(verdict.missing);
    }
  }

  const decisive = trace.find((result) => result.result === 'FAIL') ?? null;
  const outcome = decisive?.outcome ?? 'APPROVED';

  // Belt and braces: if a future rule change leaves a gap, fail loudly rather than approve.
  if (outcome === 'APPROVED' && (!order?.deliveredAt || !item || item.finalSale)) {
    throw new Error('Refund policy reached APPROVED without a delivered, refundable item');
  }

  return {
    policyVersion: POLICY_VERSION,
    outcome,
    decisiveRule: decisive?.rule ?? null,
    decisiveClause: decisive?.clause ?? null,
    flags,
    missing: outcome === 'NEEDS_INFO' ? missing : [],
    subject: order && {
      orderId: order.id,
      orderItemId: item?.id ?? null,
      amountMinor: item ? itemAmountMinor(item) : null,
      currency: order.currency,
    },
    trace,
  };
}
