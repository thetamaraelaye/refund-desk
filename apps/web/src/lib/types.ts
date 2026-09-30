// The API's response shapes, as the web app uses them.
export type RequestStatus = 'NEEDS_INFO' | 'APPROVED' | 'DENIED' | 'ESCALATED';
export type MessageRole = 'CUSTOMER' | 'ASSISTANT' | 'STAFF';

export interface DemoScenario {
  key: string;
  title: string;
  message: string;
  expected: RequestStatus;
  decisiveClause: string | null;
  featured: boolean;
}

export interface DemoCustomer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  scenarios: DemoScenario[];
}

export interface Sessions {
  customer: { role: 'customer'; customerId: string; name: string } | null;
  staff: { role: 'staff'; name: string } | null;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  body: string;
  createdAt: string;
}

export interface CustomerRequest {
  id: string;
  reference: number;
  status: RequestStatus;
  open: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  finalSale: boolean;
  refund: { issuedAt: string } | null;
}

export type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface CustomerOrder {
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
  shipmentEvents: { status: string; occurredAt: string }[];
}

export interface Product {
  sku: string;
  name: string;
  priceMinor: number;
  finalSale: boolean;
  currency: string;
}

export type TestDelivery = 'DELIVERED_TODAY' | 'DELIVERED_45_DAYS_AGO' | 'IN_TRANSIT';

export interface ConsoleMetrics {
  needsAttention: number;
  oldestWaitingSince: string | null;
  approvedToday: number;
  refundedTodayMinor: number;
  currency: string;
}

export interface StaffListItem {
  id: string;
  reference: number;
  status: RequestStatus;
  flags: string[];
  decisiveRule: string | null;
  summary: string | null;
  reasonCategory: string | null;
  orderItem: { name: string } | null;
  amountMinor: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string; email: string };
  orderNumber: string | null;
  messageCount: number;
}

export interface Paged<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    counts: Record<RequestStatus, number>;
  };
}

export interface RuleResult {
  rule: string;
  clause: string;
  title: string;
  result: 'PASS' | 'FAIL' | 'SKIPPED';
  outcome: RequestStatus | null;
  detail: string;
}

export interface Audit {
  id: string;
  kind: 'AUTOMATED' | 'HANDOFF' | 'STAFF_RESOLUTION';
  actorName: string;
  inputText: string | null;
  signals: { manipulation: boolean; extractionFailed: boolean; humanRequested: boolean } | null;
  extraction: Record<string, unknown> | null;
  extractionError: string | null;
  ruleTrace: RuleResult[] | null;
  outcome: RequestStatus;
  decisiveRule: string | null;
  reply: string | null;
  replySource: 'MODEL' | 'TEMPLATE' | null;
  llmMode: 'anthropic' | 'mock' | null;
  model: string | null;
  latencyMs: number | null;
  policyVersion: string;
  note: string | null;
  createdAt: string;
}

export interface StaffRequestDetail {
  id: string;
  reference: number;
  status: RequestStatus;
  flags: string[];
  decisiveRule: string | null;
  summary: string | null;
  reasonCategory: string | null;
  amountMinor: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  customer: { id: string; name: string; email: string; createdAt: string; recentRefunds: number };
  orderItem: { sku: string; name: string; finalSale: boolean } | null;
  refund: {
    amountMinor: number;
    currency: string;
    source: string;
    issuedByName: string | null;
    issuedAt: string;
  } | null;
  order: {
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    placedAt: string;
    deliveredAt: string | null;
    cancelledAt: string | null;
    items: (Omit<OrderItem, 'refund'> & { refund: { issuedAt: string } | null })[];
    payments: {
      kind: 'CHARGE' | 'REFUND';
      amountMinor: number;
      currency: string;
      method: string;
      reference: string;
      occurredAt: string;
    }[];
    shipmentEvents: { status: string; carrier: string; detail: string; occurredAt: string }[];
  } | null;
  messages: ChatMessage[];
  audits: Audit[];
}
