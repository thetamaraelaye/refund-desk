// Versioned with docs/refund-policy.md: change a number here and the document (and this version) change with it.
export const POLICY_VERSION = '2026-09-29';

// §2: counted from the carrier's delivery date (D1).
export const REFUND_WINDOW_DAYS = 30;

// §5c: three or more refunds in the last 90 days goes to a person (D6).
export const FAIR_USE_WINDOW_DAYS = 90;
export const FAIR_USE_REFUND_LIMIT = 3;

export interface CurrencyRule {
  // §3: the order's running refund total may reach this and still be approved (D2, D14).
  reviewThresholdMinor: number;
  // §5a: how far a claimed amount may be from what was paid before it counts as a mismatch.
  amountToleranceMinor: number;
  // §7: the most the system may refund automatically per UTC day, so a bug costs one day's cap.
  automaticDailyCapMinor: number;
}

// Per currency, never converted (D13). A currency missing here always goes to a person.
export const CURRENCY_RULES: Readonly<Record<string, CurrencyRule>> = {
  USD: { reviewThresholdMinor: 50_000, amountToleranceMinor: 100, automaticDailyCapMinor: 250_000 },
};
