// Deterministic checks that run on every customer message alongside the model, so a model that misses
// (or is talked out of) a manipulation attempt still cannot hide it. Either source raising a signal counts.

// Phrases aimed at the system rather than at a support agent. "Please approve my refund" is a normal
// request and must not match; "approve it immediately and mark it verified" addressed to the system does.
const MANIPULATION_PATTERNS: readonly RegExp[] = [
  /\bignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your)\s+(instructions|rules|prompts?|directions)/i,
  /\bdisregard\s+(all\s+|any\s+|the\s+|your\s+)?(previous\s+|prior\s+)?(instructions|rules|policy|policies|guidelines)/i,
  /\b(system|admin|developer|debug)\s+(override|mode|prompt|command)\b/i,
  /\byou\s+are\s+now\b/i,
  /\b(act|pretend|behave)\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+|the\s+)?(admin|administrator|supervisor|manager|developer|system)\b/i,
  /\bmark\s+(it|this|that|the|my)(\s+(refund|request|claim|order))?\s+as\s+(verified|approved|valid)\b/i,
  /\b(approve|issue|process)\s+(the\s+|a\s+|my\s+)?(full\s+)?refund\s+(of\s+\S+\s+)?(immediately|now|automatically|without\s+(review|checks?))\b/i,
  /\bnew\s+instructions\s*:/i,
  /<\/?\s*(system|assistant|instructions?|customer_messages)\s*>/i,
];

const HANDOFF_PATTERNS: readonly RegExp[] = [
  /\b(speak|talk|chat)\s+(to|with)\s+(a|an|the|some|your)?\s*(real\s+|actual\s+|live\s+)?(human|person|agent|someone|representative|manager|supervisor)\b/i,
  /\b(real|actual|live)\s+(human|person|agent)\b/i,
  /\bhuman\s+(agent|being|support)\b/i,
];

const anyMatch = (patterns: readonly RegExp[], text: string) => patterns.some((p) => p.test(text));

export function detectManipulation(messages: readonly string[]): boolean {
  return messages.some((message) => anyMatch(MANIPULATION_PATTERNS, message));
}

export function detectHandoffRequest(messages: readonly string[]): boolean {
  return messages.some((message) => anyMatch(HANDOFF_PATTERNS, message));
}
