import type { RequestOutcome } from '../refund-policy/types';
import type { ReplyBrief } from './reply-brief';

export interface ReplyDraft {
  message: string;
  statedOutcome: RequestOutcome;
}

// Words that would tell the customer something the decision did not say, or reveal how the message was
// checked. The model writes the words; this decides whether they may be sent (D11's deterministic guard).
const INTERNAL_TERMS =
  /\b(manipulat\w*|inject\w*|prompts?|jailbreak|fraud\w*|suspicious|flag(ged|s)?|trace|polic(y|ies) engine)\b/i;
const APPROVAL_TERMS =
  /\b(approved|approve|refund (has been|is being|will be) (issued|processed|sent)|we('ve| have) (issued|processed) (a|your|the) refund)\b/i;
const REFUSAL_TERMS =
  /\b(denied|declined|not eligible|ineligible|(can't|cannot|unable to) (be )?refund)/i;
const MONEY =
  /(?:[$€£₦]\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP|NGN)\b)/g;

export type GuardResult = { ok: true } | { ok: false; reason: string };

const normaliseMoney = (text: string) => text.replace(/[\s,]/g, '').replace(/\.00$/, '');

export function checkReply(draft: ReplyDraft, brief: ReplyBrief): GuardResult {
  const text = draft.message.trim();
  if (draft.statedOutcome !== brief.outcome) {
    return { ok: false, reason: `states ${draft.statedOutcome}, decision is ${brief.outcome}` };
  }
  if (text.length < 20 || text.length > 900) return { ok: false, reason: 'length out of range' };
  if (INTERNAL_TERMS.test(text)) return { ok: false, reason: 'mentions internal checks' };
  if (brief.outcome === 'APPROVED' && REFUSAL_TERMS.test(text)) {
    return { ok: false, reason: 'refusal wording on an approval' };
  }
  if (brief.outcome !== 'APPROVED' && APPROVAL_TERMS.test(text)) {
    return { ok: false, reason: 'approval wording without an approval' };
  }
  const allowed = new Set(brief.allowedAmounts.map(normaliseMoney));
  const invented = (text.match(MONEY) ?? []).find((amount) => !allowed.has(normaliseMoney(amount)));
  if (invented) return { ok: false, reason: `mentions an amount not in the brief: ${invented}` };
  return { ok: true };
}
