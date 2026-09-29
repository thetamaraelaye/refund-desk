// Plain-language names for the API's codes, for the support dashboard.
export const FLAG_LABELS: Record<string, string> = {
  HUMAN_REQUESTED: 'Asked for a person',
  MANIPULATION: 'Tried to instruct the system',
  EXTRACTION_FAILED: "Message couldn't be read",
  CROSS_ACCOUNT: "Named another customer's order",
  CLAIM_MISMATCH: "Doesn't match our records",
  HIGH_VALUE: 'Over the review threshold',
  FAIR_USE: 'Frequent refunds',
  UNCONFIGURED_CURRENCY: 'Currency not configured',
};

export const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Damaged or defective',
  WRONG_ITEM: 'Wrong item sent',
  NOT_RECEIVED: 'Never arrived',
  CHANGED_MIND: 'Change of mind',
  OTHER: 'Other',
  UNSPECIFIED: 'Not given',
};

export const AUDIT_KIND_LABELS: Record<string, string> = {
  AUTOMATED: 'Automated decision',
  HANDOFF: 'Handed to a person',
  STAFF_RESOLUTION: 'Specialist ruling',
};
