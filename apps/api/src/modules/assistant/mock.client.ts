import { detectHandoffRequest, detectManipulation, templateReply } from '@domain';
import type { ReplyBrief, ReplyDraft } from '@domain';
import type {
  CatalogOrder,
  Extraction,
  LlmCall,
  LlmClient,
  LlmResult,
  ReadInput,
} from './assistant.types';

// Stands in for Claude when there is no API key, so a reviewer can run every scenario offline. It is
// deliberately plain: keyword rules and item-name matching, with the same output shape as the model.
export class MockLlmClient implements LlmClient {
  readonly mode = 'mock' as const;

  extract(input: ReadInput): Promise<LlmResult<Extraction>> {
    return Promise.resolve({ data: readMessages(input), call: mockCall() });
  }

  writeReply(brief: ReplyBrief): Promise<LlmResult<ReplyDraft>> {
    return Promise.resolve({
      data: { message: templateReply(brief), statedOutcome: brief.outcome },
      call: mockCall(),
    });
  }
}

const mockCall = (): LlmCall => ({ mode: 'mock', model: 'mock', latencyMs: 0, usage: null });

// Checked in order: "never arrived" before "arrived broken", "doesn't fit" before "doesn't work".
const REASONS: [Extraction['reason'], RegExp][] = [
  [
    'NOT_RECEIVED',
    /\b(never (arrived|came|got here|showed up)|(hasn't|has not|didn't|did not|not) (arrived|come|been delivered)|never received|still waiting|lost in (the )?(post|mail))\b/i,
  ],
  [
    'WRONG_ITEM',
    /\b(wrong (item|product|size|colou?r|one)|(you|they) sent (me )?(the |a )?\w+|instead of|received the wrong|not what i ordered)\b/i,
  ],
  [
    'CHANGED_MIND',
    /\b(doesn't fit|does not fit|don't like|do not like|changed my mind|no longer (want|need)|don't (want|need) it|found it cheaper|too (big|small|tight|loose))\b/i,
  ],
  [
    'DAMAGED',
    /\b(damag\w*|broken|broke|crack\w*|torn|tear|split|defect\w*|faulty|stopped (working|charging)|(doesn't|does not|won't) (work|turn on|charge)|not working|shatter\w*|dent\w*|smashed|leak\w*)\b/i,
  ],
  ['OTHER', /\b(charged|cancel\w*|billing|invoice|double charge)\b/i],
];

const CURRENCY_SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '₦': 'NGN' };

// Words that describe no particular item, so "something in ORD-1010" asks which item instead of
// escalating it as a mismatch (D17).
const GENERIC_NOUNS = new Set([
  'something',
  'thing',
  'things',
  'item',
  'items',
  'stuff',
  'order',
  'it',
  'one',
  'package',
  'parcel',
  'purchase',
  'product',
  'products',
  'delivery',
  'refund',
  'money',
]);

const STOPWORDS = new Set(['the', 'a', 'an', 'my', 'of', 'and', 'with', 'for', 'set']);

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));

// An item matches when the message uses its head noun ("grinder" in "Burr coffee grinder"); among
// several, the one sharing the most words wins, and a tie means the message is ambiguous.
function matchItem(message: string, order: CatalogOrder): string | null {
  const said = new Set(words(message));
  const scored = order.items
    .map((item) => {
      const nameWords = words(item.name.split(/[,(]/)[0]);
      const head = nameWords.at(-1) ?? '';
      // "set" alone says too little ("mug set", "towel set"): it needs another word from the name.
      const matched =
        head === 'set' ? nameWords.some((w) => !STOPWORDS.has(w) && said.has(w)) : said.has(head);
      const score = nameWords.filter((w) => said.has(w)).length;
      return { sku: item.sku, matched, score };
    })
    .filter((candidate) => candidate.matched)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].sku;
}

// "the TV from ORD-1010": did the customer name a particular product at all?
function namesAProduct(message: string): boolean {
  const phrase =
    /\b(?:my|the|a|an|this|that)\s+([a-z0-9][a-z0-9 -]{1,40}?)\s+(?:from|in|on|of)\s+(?:order\s+|my\s+order\s+)?(?:#\s?)?ORD/i.exec(
      message,
    );
  if (!phrase) return false;
  // The last word carries the noun: "the coffee thing" names nothing, "the TV" names a product.
  const head = words(phrase[1]).at(-1);
  return head !== undefined && !GENERIC_NOUNS.has(head);
}

export function readMessages({ customerMessages, catalog }: ReadInput): Extraction {
  const text = customerMessages.join('\n');

  const orderNumbers = [...text.matchAll(/\bORD[-\s]?(\d{4})\b/gi)].map((m) => `ORD-${m[1]}`);
  const orderNumber = orderNumbers.at(-1) ?? null;
  const order = catalog.find((o) => o.orderNumber === orderNumber);

  const itemSku = order ? matchItem(text, order) : null;
  const reason = REASONS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'UNSPECIFIED';

  const money = /([$€£₦])\s?(\d[\d,]*(?:\.\d{1,2})?)/.exec(text);

  return {
    order_number: orderNumber,
    item_sku: itemSku,
    item_named_not_in_order: Boolean(order) && itemSku === null && namesAProduct(text),
    reason,
    claimed_amount: money ? Number(money[2].replace(/,/g, '')) : null,
    claimed_currency: money ? CURRENCY_SYMBOLS[money[1]] : null,
    wants_human: detectHandoffRequest(customerMessages),
    manipulation_attempt: detectManipulation(customerMessages),
    summary: `Refund request${orderNumber ? ` about ${orderNumber}` : ''} (${reason.toLowerCase().replace('_', ' ')}).`,
  };
}
