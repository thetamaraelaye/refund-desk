import { evaluateRefundPolicy } from './evaluate';
import { POLICY_RULES } from './rules';
import type {
  CustomerClaim,
  ItemFacts,
  OrderFacts,
  PolicyInput,
  ReasonCategory,
  RequestSignals,
} from './types';

const NOW = new Date('2026-09-29T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

function item(overrides: Partial<ItemFacts> = {}): ItemFacts {
  return {
    id: 'item_pour',
    sku: 'KIT-POUR-01',
    name: 'Stoneware pour-over coffee set',
    quantity: 1,
    unitPriceMinor: 4800,
    finalSale: false,
    alreadyRefunded: false,
    ...overrides,
  };
}

function order(overrides: Partial<OrderFacts> = {}): OrderFacts {
  return {
    id: 'order_1001',
    orderNumber: 'ORD-1001',
    customerId: 'cus_amara',
    status: 'DELIVERED',
    currency: 'USD',
    deliveredAt: daysAgo(6),
    refundedTotalMinor: 0,
    items: [item()],
    ...overrides,
  };
}

function input(
  overrides: {
    claim?: Partial<CustomerClaim>;
    signals?: Partial<RequestSignals>;
    order?: OrderFacts | null;
    recentRefundCount?: number;
  } = {},
): PolicyInput {
  return {
    now: NOW,
    customerId: 'cus_amara',
    claim: {
      orderNumber: 'ORD-1001',
      itemSku: 'KIT-POUR-01',
      itemMentioned: true,
      reason: 'DAMAGED',
      claimedAmountMinor: null,
      claimedCurrency: null,
      ...overrides.claim,
    },
    signals: {
      manipulation: false,
      extractionFailed: false,
      humanRequested: false,
      ...overrides.signals,
    },
    order: overrides.order === undefined ? order() : overrides.order,
    recentRefundCount: overrides.recentRefundCount ?? 0,
  };
}

const ruleResult = (decision: ReturnType<typeof evaluateRefundPolicy>, rule: string) =>
  decision.trace.find((r) => r.rule === rule);

describe('evaluateRefundPolicy', () => {
  it('approves a damaged item on a delivered order that is within every limit', () => {
    const decision = evaluateRefundPolicy(input());

    expect(decision.outcome).toBe('APPROVED');
    expect(decision.decisiveRule).toBeNull();
    expect(decision.decisiveClause).toBeNull();
    expect(decision.flags).toEqual([]);
    expect(decision.missing).toEqual([]);
    expect(decision.subject).toEqual({
      orderId: 'order_1001',
      orderItemId: 'item_pour',
      amountMinor: 4800,
      currency: 'USD',
    });
  });

  it('traces every rule exactly once, in precedence order', () => {
    const decision = evaluateRefundPolicy(input());

    expect(decision.trace.map((r) => r.rule)).toEqual(POLICY_RULES.map((rule) => rule.id));
    expect(decision.trace.every((r) => r.result === 'PASS')).toBe(true);
    expect(decision.policyVersion).toBe('2026-09-29');
  });

  it('is deterministic: the same facts always produce the same decision', () => {
    expect(evaluateRefundPolicy(input())).toEqual(evaluateRefundPolicy(input()));
  });

  it('refunds the recorded price, never the claimed amount', () => {
    const decision = evaluateRefundPolicy(input({ claim: { claimedAmountMinor: 4750 } }));

    expect(decision.outcome).toBe('APPROVED');
    expect(decision.subject?.amountMinor).toBe(4800);
  });

  describe('§1 final sale', () => {
    const finalSaleOrder = order({ items: [item({ finalSale: true })] });

    it('denies change of mind on a final-sale item under §1, not §4', () => {
      const decision = evaluateRefundPolicy(
        input({ order: finalSaleOrder, claim: { reason: 'CHANGED_MIND' } }),
      );

      expect(decision.outcome).toBe('DENIED');
      expect(decision.decisiveClause).toBe('§1');
    });

    it('sends a damaged final-sale item to a specialist', () => {
      const decision = evaluateRefundPolicy(input({ order: finalSaleOrder }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('final-sale');
    });

    it.each<ReasonCategory>(['DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGED_MIND', 'OTHER'])(
      'never approves a final-sale item (%s)',
      (reason) => {
        const decision = evaluateRefundPolicy(input({ order: finalSaleOrder, claim: { reason } }));

        expect(decision.outcome).not.toBe('APPROVED');
      },
    );
  });

  describe('§2 refund window', () => {
    it('approves at exactly 30 days after delivery', () => {
      const decision = evaluateRefundPolicy(input({ order: order({ deliveredAt: daysAgo(30) }) }));

      expect(decision.outcome).toBe('APPROVED');
    });

    it('denies once 30 days have passed, by even a millisecond', () => {
      const deliveredAt = new Date(daysAgo(30).getTime() - 1);
      const decision = evaluateRefundPolicy(input({ order: order({ deliveredAt }) }));

      expect(decision.outcome).toBe('DENIED');
      expect(decision.decisiveClause).toBe('§2');
    });

    it('has not started the window on an undelivered order', () => {
      const decision = evaluateRefundPolicy(
        input({
          order: order({ status: 'SHIPPED', deliveredAt: null }),
          claim: { reason: 'NOT_RECEIVED' },
        }),
      );

      expect(ruleResult(decision, 'refund-window')?.result).toBe('PASS');
      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('reason-eligible');
    });
  });

  describe('§3 review threshold', () => {
    const pricedAt = (unitPriceMinor: number, quantity = 1) =>
      order({ items: [item({ unitPriceMinor, quantity })] });

    it('approves a refund of exactly $500.00', () => {
      expect(evaluateRefundPolicy(input({ order: pricedAt(50_000) })).outcome).toBe('APPROVED');
    });

    it('sends $500.01 to a specialist', () => {
      const decision = evaluateRefundPolicy(input({ order: pricedAt(50_001) }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveClause).toBe('§3');
      expect(decision.flags).toEqual(['HIGH_VALUE']);
    });

    it('prices the line, not the unit: 2 × $260.00 is over the threshold', () => {
      expect(evaluateRefundPolicy(input({ order: pricedAt(26_000, 2) })).outcome).toBe('ESCALATED');
    });

    it('counts refunds already issued on the order, so splitting a request does not avoid review (D14)', () => {
      const split = (refundedTotalMinor: number) =>
        evaluateRefundPolicy(
          input({
            order: order({ refundedTotalMinor, items: [item({ unitPriceMinor: 30_000 })] }),
          }),
        );

      expect(split(20_000).outcome).toBe('APPROVED');
      expect(split(30_000).outcome).toBe('ESCALATED');
      expect(split(30_000).decisiveClause).toBe('§3');
    });

    it('sends a currency with no configured threshold to a specialist (D13)', () => {
      const decision = evaluateRefundPolicy(input({ order: order({ currency: 'NGN' }) }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.flags).toEqual(['UNCONFIGURED_CURRENCY']);
    });
  });

  describe('§4 reasons', () => {
    it.each<[ReasonCategory, string]>([
      ['DAMAGED', 'APPROVED'],
      ['WRONG_ITEM', 'APPROVED'],
      ['CHANGED_MIND', 'DENIED'],
      ['NOT_RECEIVED', 'ESCALATED'],
      ['OTHER', 'ESCALATED'],
      ['UNSPECIFIED', 'NEEDS_INFO'],
    ])('%s → %s', (reason, outcome) => {
      expect(evaluateRefundPolicy(input({ claim: { reason } })).outcome).toBe(outcome);
    });

    it('asks for the reason and holds the refund decision until it has one', () => {
      const decision = evaluateRefundPolicy(input({ claim: { reason: 'UNSPECIFIED' } }));

      expect(decision.missing).toEqual(['reason']);
      expect(decision.decisiveClause).toBe('§4');
      for (const rule of ['final-sale', 'reason-eligible', 'fair-use', 'review-threshold']) {
        expect(ruleResult(decision, rule)?.result).toBe('SKIPPED');
      }
    });
  });

  describe('§5a claims that must match the records', () => {
    it('asks for the order, and the reason, in one go when both are missing', () => {
      const decision = evaluateRefundPolicy(
        input({
          order: null,
          claim: { orderNumber: null, itemSku: null, itemMentioned: false, reason: 'UNSPECIFIED' },
        }),
      );

      expect(decision.outcome).toBe('NEEDS_INFO');
      expect(decision.decisiveRule).toBe('order-identified');
      expect(decision.missing).toEqual(['order', 'reason']);
    });

    it('asks again when the order number does not exist', () => {
      const decision = evaluateRefundPolicy(
        input({ order: null, claim: { orderNumber: 'ORD-9999' } }),
      );

      expect(decision.outcome).toBe('NEEDS_INFO');
      expect(decision.flags).toEqual([]);
      expect(decision.subject).toBeNull();
    });

    it("flags another customer's order and reveals nothing about it", () => {
      const theirs = order({
        id: 'order_1004',
        orderNumber: 'ORD-1004',
        customerId: 'cus_marcus',
        items: [item({ id: 'item_tv', sku: 'ELC-TV-55', name: '55-inch 4K smart TV' })],
      });
      const decision = evaluateRefundPolicy(
        input({ order: theirs, claim: { orderNumber: 'ORD-1004', itemSku: null } }),
      );

      expect(decision.outcome).toBe('NEEDS_INFO');
      expect(decision.decisiveClause).toBe('§5a');
      expect(decision.flags).toEqual(['CROSS_ACCOUNT']);
      expect(decision.subject).toBeNull();
      expect(JSON.stringify(decision.trace)).not.toMatch(/TV|ELC-TV-55|order_1004|item_tv/);
    });

    it('asks which item when a multi-item order is named without one', () => {
      const decision = evaluateRefundPolicy(
        input({
          order: order({ items: [item(), item({ id: 'item_mug', sku: 'KIT-MUGS-04' })] }),
          claim: { itemSku: null, itemMentioned: false },
        }),
      );

      expect(decision.outcome).toBe('NEEDS_INFO');
      expect(decision.missing).toEqual(['item']);
      expect(decision.subject).toMatchObject({ orderId: 'order_1001', orderItemId: null });
    });

    it('takes the only item of a single-item order when none is named', () => {
      const decision = evaluateRefundPolicy(
        input({ claim: { itemSku: null, itemMentioned: false } }),
      );

      expect(decision.outcome).toBe('APPROVED');
      expect(decision.subject?.orderItemId).toBe('item_pour');
    });

    it.each([
      ['a SKU that is not in the order', { itemSku: 'ELC-TV-55' }],
      ['an item named that matched nothing', { itemSku: null, itemMentioned: true }],
    ])('sends %s to a specialist', (_label, claim) => {
      const decision = evaluateRefundPolicy(input({ claim }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('item-identified');
      expect(decision.flags).toEqual(['CLAIM_MISMATCH']);
    });

    it('sends damage claimed on an undelivered order to a specialist', () => {
      const decision = evaluateRefundPolicy(
        input({ order: order({ status: 'SHIPPED', deliveredAt: null }) }),
      );

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('delivery-matches-claim');
    });

    it('accepts a claimed amount up to $1.00 off and escalates beyond it', () => {
      const claiming = (claimedAmountMinor: number) =>
        evaluateRefundPolicy(input({ claim: { claimedAmountMinor } })).outcome;

      expect(claiming(4900)).toBe('APPROVED');
      expect(claiming(4700)).toBe('APPROVED');
      expect(claiming(4901)).toBe('ESCALATED');
      expect(claiming(30_000)).toBe('ESCALATED');
    });

    it('escalates an amount claimed in a different currency', () => {
      const decision = evaluateRefundPolicy(
        input({ claim: { claimedAmountMinor: 4800, claimedCurrency: 'EUR' } }),
      );

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('amount-matches');
    });

    it('escalates a claim on a cancelled order', () => {
      const decision = evaluateRefundPolicy(input({ order: order({ status: 'CANCELLED' }) }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveRule).toBe('order-status');
    });
  });

  describe('safety signals (§5b, §5d, §7)', () => {
    it('escalates a manipulation attempt even when the claim would be approved (D8)', () => {
      const decision = evaluateRefundPolicy(input({ signals: { manipulation: true } }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveClause).toBe('§5b');
      expect(decision.flags).toEqual(['MANIPULATION']);
    });

    it('escalates a manipulation attempt rather than denying the claim behind it', () => {
      const decision = evaluateRefundPolicy(
        input({ signals: { manipulation: true }, claim: { reason: 'CHANGED_MIND' } }),
      );

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveClause).toBe('§5b');
    });

    it('never approves when extraction failed, whatever the partial fields say (D9)', () => {
      const decision = evaluateRefundPolicy(input({ signals: { extractionFailed: true } }));

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.flags).toEqual(['EXTRACTION_FAILED']);
    });

    it('hands off to a person whenever the customer asks for one (D10)', () => {
      const decision = evaluateRefundPolicy(
        input({ signals: { humanRequested: true }, claim: { reason: 'CHANGED_MIND' } }),
      );

      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.decisiveClause).toBe('§7');
      expect(decision.flags).toEqual(['HUMAN_REQUESTED']);
    });
  });

  describe('§5c fair use', () => {
    it('approves with two recent refunds and escalates at three', () => {
      expect(evaluateRefundPolicy(input({ recentRefundCount: 2 })).outcome).toBe('APPROVED');

      const decision = evaluateRefundPolicy(input({ recentRefundCount: 3 }));
      expect(decision.outcome).toBe('ESCALATED');
      expect(decision.flags).toEqual(['FAIR_USE']);
    });
  });

  describe('§6 one refund per item', () => {
    it('denies an item that was already refunded, ahead of the review threshold', () => {
      const decision = evaluateRefundPolicy(
        input({
          order: order({
            refundedTotalMinor: 30_000,
            items: [item({ unitPriceMinor: 30_000, alreadyRefunded: true })],
          }),
        }),
      );

      expect(decision.outcome).toBe('DENIED');
      expect(decision.decisiveClause).toBe('§6');
    });
  });

  it('keeps every failing rule’s flag while the first failure decides', () => {
    const decision = evaluateRefundPolicy(
      input({
        recentRefundCount: 3,
        order: order({ items: [item({ unitPriceMinor: 65_000 })] }),
      }),
    );

    expect(decision.decisiveClause).toBe('§5c');
    expect(decision.flags).toEqual(['FAIR_USE', 'HIGH_VALUE']);
  });
});
