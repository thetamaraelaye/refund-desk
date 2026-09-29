import {
  checkReply,
  evaluateRefundPolicy,
  type PolicyDecision,
  type ReplyBrief,
  type ReplyDraft,
  type ReplyFacts,
} from '@domain';
import { DEMO_SCENARIOS, type DemoScenario } from '../../database/demo-scenarios';
import {
  seedCatalog,
  seedCustomer,
  seedOrderFacts,
  seedPolicyInput,
} from '../../database/seed-facts';
import { AssistantService, toClaim } from './assistant.service';
import {
  LlmFailure,
  type Extraction,
  type LlmClient,
  type LlmResult,
  type ReadInput,
} from './assistant.types';
import { MockLlmClient, readMessages } from './mock.client';

const NOW = new Date('2026-09-29T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// What the refund service will pass: facts about the customer's own order only.
function replyFacts(email: string, decision: PolicyDecision): ReplyFacts {
  const order = decision.subject ? seedOrderFacts(decision.subject.orderId, NOW) : null;
  const item = order?.items.find((i) => i.id === decision.subject?.orderItemId);
  return {
    customerName: seedCustomer(email).name,
    orderNumber: order?.orderNumber ?? null,
    itemName: item?.name ?? null,
    itemChoices: order?.items.map((i) => i.name) ?? [],
    paymentMethod: 'Visa •••• 4242',
    lastRefundAt: order?.payments.lastRefundAt ?? null,
    itemRefundedAt: item?.alreadyRefunded ? new Date('2026-09-23T10:00:00Z') : null,
    deliveredDaysAgo: order?.deliveredAt
      ? Math.floor((NOW.getTime() - order.deliveredAt.getTime()) / DAY_MS)
      : null,
  };
}

async function run(service: AssistantService, email: string, messages: string[]) {
  const reading = await service.read({ customerMessages: messages, catalog: seedCatalog(email) });
  const decision = evaluateRefundPolicy(
    seedPolicyInput(email, reading.claim, reading.signals, NOW),
  );
  const reply = await service.reply(decision, replyFacts(email, decision));
  return { reading, decision, reply };
}

describe('the mock model, the policy engine and the reply guard, end to end', () => {
  const service = new AssistantService(new MockLlmClient());

  it.each(DEMO_SCENARIOS.map((s) => [s.key, s] as const))(
    '%s',
    async (_key, scenario: DemoScenario) => {
      const { decision, reply } = await run(service, scenario.customerEmail, [scenario.message]);

      expect({ outcome: decision.outcome, clause: decision.decisiveClause }).toEqual({
        outcome: scenario.expected,
        clause: scenario.decisiveClause,
      });
      expect(
        checkReply({ message: reply.text, statedOutcome: decision.outcome }, reply.brief),
      ).toEqual({ ok: true });
    },
  );

  it('keeps the reply to a manipulation attempt neutral (D8)', async () => {
    const injection = DEMO_SCENARIOS.find((s) => s.key === 'prompt-injection')!;
    const { reply } = await run(service, injection.customerEmail, [injection.message]);

    expect(reply.text).not.toMatch(/manipulat|instruction|override|suspicious/i);
    expect(reply.text).toMatch(/support team/);
  });

  it('asks which item for a vague description instead of escalating it (D17)', async () => {
    const { decision, reply } = await run(service, 'sofia.rossi@example.com', [
      'The coffee thing in ORD-1010 arrived broken.',
    ]);

    expect(decision.outcome).toBe('NEEDS_INFO');
    expect(decision.missing).toEqual(['item']);
    expect(reply.text).toContain('Burr coffee grinder');
  });

  it('escalates a named product that is not in the order', async () => {
    const { decision } = await run(service, 'sofia.rossi@example.com', [
      'The TV from ORD-1010 arrived broken.',
    ]);

    expect(decision.outcome).toBe('ESCALATED');
    expect(decision.decisiveRule).toBe('item-identified');
  });

  it('carries details across turns: the order number, then the reason', async () => {
    const first = await run(service, 'kwame.mensah@example.com', ['I want a refund please.']);
    expect(first.decision.missing).toEqual(['order', 'reason']);

    const second = await run(service, 'kwame.mensah@example.com', [
      'I want a refund please.',
      "It's ORD-1014, the laptop stand arrived bent and dented.",
    ]);
    expect(second.decision.outcome).toBe('APPROVED');
  });

  it('finds the order from the item described when the customer gives no order number', async () => {
    const { reading, decision } = await run(service, 'amara.okafor@example.com', [
      'My pour-over set arrived with a cracked carafe. Can I get a refund?',
    ]);

    expect(reading.claim).toMatchObject({ orderNumber: 'ORD-1001', orderInferred: true });
    expect(decision.outcome).toBe('APPROVED');
    expect(decision.trace.find((r) => r.rule === 'order-identified')?.detail).toBe(
      'Matched ORD-1001 from the item described; the customer gave no order number.',
    );
  });

  it('asks for the order when the item described matches none of their orders', async () => {
    const { decision } = await run(service, 'amara.okafor@example.com', [
      'My TV arrived with a cracked screen.',
    ]);

    expect(decision.outcome).toBe('NEEDS_INFO');
    expect(decision.missing).toContain('order');
  });

  it('never guesses between two orders that both match', () => {
    const mugs = { sku: 'KIT-MUGS-04', name: 'Ceramic mug set (4)' };
    const extraction = readMessages({
      customerMessages: ['The ceramic mug set arrived chipped.'],
      catalog: [
        { orderNumber: 'ORD-2001', items: [mugs] },
        { orderNumber: 'ORD-2002', items: [mugs] },
      ],
    });

    expect(extraction.order_number).toBeNull();
  });

  it("drops an 'inferred' order that is not one of the customer's own", () => {
    const claim = toClaim(
      {
        ...readMessages({ customerMessages: ['My TV is broken.'], catalog: [] }),
        order_number: 'ORD-1004',
      },
      seedCatalog('amara.okafor@example.com'),
      ['My TV is broken.'],
    );

    expect(claim.orderNumber).toBeNull();
  });

  it('tells the customer when and where an already-refunded item went', async () => {
    const { decision, reply } = await run(service, 'omar.haddad@example.com', [
      'The blender from ORD-1009 is broken, I want my money back.',
    ]);

    expect(decision.decisiveRule).toBe('already-refunded');
    expect(reply.text).toContain('was already refunded on 23 September to Visa •••• 4242');
    expect(reply.text).toContain('banks can take 5–10 business days');
  });

  it.each(['bent', 'scratched', 'chipped', 'ripped', 'stained', 'missing parts'])(
    'reads "arrived %s" as damage',
    async (word) => {
      const { decision } = await run(service, 'kwame.mensah@example.com', [
        `The laptop stand from ORD-1014 arrived ${word}.`,
      ]);
      expect(decision.outcome).toBe('APPROVED');
    },
  );

  it('hands off to a person when asked, even mid-claim', async () => {
    const { decision } = await run(service, 'amara.okafor@example.com', [
      'My pour-over set from ORD-1001 arrived cracked. Can I talk to a real person?',
    ]);

    expect(decision.outcome).toBe('ESCALATED');
    expect(decision.flags).toContain('HUMAN_REQUESTED');
  });
});

// A stand-in for Claude that misbehaves in chosen ways.
class ScriptedClient implements LlmClient {
  readonly mode = 'anthropic' as const;
  constructor(
    private readonly script: {
      extract?: (input: ReadInput) => Extraction;
      reply?: (brief: ReplyBrief) => ReplyDraft;
    },
  ) {}
  private call = { mode: 'anthropic' as const, model: 'test', latencyMs: 5, usage: null };
  extract(input: ReadInput): Promise<LlmResult<Extraction>> {
    if (!this.script.extract)
      return Promise.reject(new LlmFailure('The model timed out', this.call));
    return Promise.resolve({ data: this.script.extract(input), call: this.call });
  }
  writeReply(brief: ReplyBrief): Promise<LlmResult<ReplyDraft>> {
    if (!this.script.reply) return Promise.reject(new LlmFailure('The model timed out', this.call));
    return Promise.resolve({ data: this.script.reply(brief), call: this.call });
  }
}

describe('when the model fails or misbehaves', () => {
  const damaged = ['My pour-over set from ORD-1001 arrived with a cracked carafe.'];

  it('escalates when extraction fails, and still sends a reply (D9)', async () => {
    const service = new AssistantService(new ScriptedClient({}));
    const { reading, decision, reply } = await run(service, 'amara.okafor@example.com', damaged);

    expect(reading.extractionError).toBe('The model timed out');
    expect(decision.outcome).toBe('ESCALATED');
    expect(decision.flags).toContain('EXTRACTION_FAILED');
    expect(reply.source).toBe('TEMPLATE');
  });

  it('catches an injection the model missed, with the deterministic check', async () => {
    const service = new AssistantService(
      new ScriptedClient({
        extract: (input) => ({ ...readMessages(input), manipulation_attempt: false }),
        reply: (brief) => ({ message: 'x'.repeat(30), statedOutcome: brief.outcome }),
      }),
    );
    const injection = DEMO_SCENARIOS.find((s) => s.key === 'prompt-injection')!;
    const { decision } = await run(service, injection.customerEmail, [injection.message]);

    expect(decision.outcome).toBe('ESCALATED');
    expect(decision.flags).toContain('MANIPULATION');
  });

  it.each([
    [
      'claims a different outcome',
      { message: 'Good news, Amara: your refund is approved!', statedOutcome: 'APPROVED' },
    ],
    [
      'promises an approval it does not have',
      { message: 'Hi Amara, your refund is approved and on its way.', statedOutcome: 'ESCALATED' },
    ],
    [
      'invents an amount',
      {
        message: 'Hi Amara, a specialist will review your $129.00 refund within a day.',
        statedOutcome: 'ESCALATED',
      },
    ],
    [
      'reveals the manipulation check',
      {
        message:
          'Hi Amara, your message looked like a prompt injection attempt, so a person will check it.',
        statedOutcome: 'ESCALATED',
      },
    ],
  ] as const)('replaces a draft that %s with the template', async (_label, draft) => {
    const service = new AssistantService(
      new ScriptedClient({
        extract: (input) => ({ ...readMessages(input), wants_human: true }),
        reply: () => draft,
      }),
    );
    const { decision, reply } = await run(service, 'amara.okafor@example.com', damaged);

    expect(decision.outcome).toBe('ESCALATED');
    expect(reply.source).toBe('TEMPLATE');
    expect(reply.rejected).not.toBeNull();
  });

  it('sends a model draft that passes the guard', async () => {
    const service = new AssistantService(
      new ScriptedClient({
        extract: readMessages,
        reply: (brief) => ({
          message: `Hi ${brief.customerFirstName}, your refund of $48.00 for the pour-over set is approved. It will reach your card within 5–10 business days.`,
          statedOutcome: brief.outcome,
        }),
      }),
    );
    const { decision, reply } = await run(service, 'amara.okafor@example.com', damaged);

    expect(decision.outcome).toBe('APPROVED');
    expect(reply.source).toBe('MODEL');
  });
});
