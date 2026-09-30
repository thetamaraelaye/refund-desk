// End-to-end check against a running API: every demo scenario over HTTP, plus sessions, ownership,
// the handoff button and a specialist's ruling. Run on freshly seeded data:
//   docker compose exec api node dist/database/seed.js --reset
//   API_URL=http://localhost:4000 ADMIN_PASSWORD=refund-desk-admin node apps/api/scripts/e2e.mjs
const API = `${process.env.API_URL ?? 'http://localhost:4000'}/v1`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'refund-desk-admin';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${label}${ok || !detail ? '' : `  (${detail})`}`);
};

// A tiny cookie jar per session, so customer and staff cookies never mix.
function client() {
  const jar = new Map();
  return async (method, path, body) => {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [name, value] = pair.split('=');
      jar.set(name, value);
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

const anonymous = client();
const customers = (await anonymous('GET', '/auth/demo-customers')).body.data;
const scenarios = customers.flatMap((c) => c.scenarios.map((s) => ({ ...s, customer: c })));
console.log(`\n${scenarios.length} demo scenarios, ${customers.length} customers\n`);

const sessions = new Map();
async function customerSession(customer) {
  if (!sessions.has(customer.id)) {
    const call = client();
    const res = await call('POST', '/auth/customer-session', { customerId: customer.id });
    if (res.status !== 201) throw new Error(`sign-in failed for ${customer.email}: ${res.status}`);
    sessions.set(customer.id, call);
  }
  return sessions.get(customer.id);
}

const requestIds = {};
for (const scenario of scenarios) {
  const call = await customerSession(scenario.customer);
  const res = await call('POST', '/requests/messages', { message: scenario.message });
  const request = res.body?.data;
  requestIds[scenario.key] = request?.id;
  const reply = request?.messages.at(-1)?.body ?? '';
  check(
    `${scenario.key.padEnd(24)} ${String(request?.status).padEnd(10)} "${reply.slice(0, 90)}${reply.length > 90 ? '…' : ''}"`,
    request?.status === scenario.expected,
    `expected ${scenario.expected}, got ${res.status} ${request?.status ?? JSON.stringify(res.body)}`,
  );
}

console.log('\nSessions and ownership');
check('no session → 401', (await anonymous('POST', '/requests/messages', { message: 'hi' })).status === 401);
const [first, second] = customers;
const firstCall = await customerSession(first);
const secondCall = await customerSession(second);
const firstRequestId = requestIds[first.scenarios[0].key];
check(
  "another customer's request reads as 404",
  (await secondCall('GET', `/requests/${firstRequestId}`)).status === 404,
);
const own = (await firstCall('GET', `/requests/${firstRequestId}`)).body.data;
check(
  'the customer view carries no trace, flags or model output',
  own && !('flags' in own) && !('audits' in own) && !('decisiveRule' in own),
);
check(
  'a closed request refuses more messages (409)',
  (await firstCall('POST', '/requests/messages', { requestId: firstRequestId, message: 'thanks' }))
    .status === 409,
);
check('customer cookie cannot open the dashboard', (await firstCall('GET', '/admin/requests')).status === 401);

console.log('\nConversation and handoff');
const kwame = customers.find((c) => c.email === 'kwame.mensah@example.com');
const kwameCall = await customerSession(kwame);
const opened = (await kwameCall('POST', '/requests/messages', { message: 'I need a refund please.' })).body.data;
check('a vague first message asks for details', opened.status === 'NEEDS_INFO');
const followed = (
  await kwameCall('POST', '/requests/messages', {
    requestId: opened.id,
    message: 'Sorry, ORD-1014. The laptop stand arrived bent.',
  })
).body.data;
check('the follow-up completes the claim', followed.status === 'APPROVED', followed.status);
const handed = (await kwameCall('POST', '/requests/handoff', {})).body.data;
check('"talk to a person" before any message escalates', handed.status === 'ESCALATED');
const ethan = customers.find((c) => c.email === 'ethan.brooks@example.com');
const inferred = (
  await (await customerSession(ethan))('POST', '/requests/messages', {
    message: 'My running shoes arrived with the sole split open.',
  })
).body.data;
check('finds the order from the item described, with no order number', inferred.status === 'APPROVED', inferred.status);

console.log('\nSupport dashboard');
const staff = client();
check(
  'wrong staff password → 401',
  (await staff('POST', '/auth/staff-session', { name: 'Ada Obi', password: 'nope' })).status === 401,
);
check(
  'staff sign-in',
  (await staff('POST', '/auth/staff-session', { name: 'Ada Obi', password: ADMIN_PASSWORD })).status === 201,
);
const list = (await staff('GET', '/admin/requests?status=ESCALATED&limit=50')).body.data;
check('lists escalated requests with counts', list.items.length > 0 && list.meta.counts.ESCALATED > 0);
const tvId = requestIds['high-value'];
const detail = (await staff('GET', `/admin/requests/${tvId}`)).body.data;
check(
  'detail has the trace, the payment ledger and tracking',
  detail.audits[0].ruleTrace.length > 10 && detail.order.payments.length > 0 && detail.order.shipmentEvents.length > 0,
);
const approved = await staff('POST', `/admin/requests/${tvId}/resolution`, {
  action: 'APPROVE',
  note: 'Photos of the cracked screen check out.',
});
check('a specialist approves the $650 TV', approved.body?.data?.status === 'APPROVED', approved.status);
check(
  'the refund is on the ledger under their name',
  approved.body?.data?.refund?.issuedByName === 'Ada Obi' &&
    approved.body.data.order.payments.some((p) => p.kind === 'REFUND' && p.amountMinor === 65000),
);
check(
  'resolving it again → 409',
  (await staff('POST', `/admin/requests/${tvId}/resolution`, { action: 'DENY', note: 'again' })).status === 409,
);
const waitingId = requestIds['multi-item-vague'];
const waiting = await staff('POST', `/admin/requests/${waitingId}/resolution`, {
  action: 'DENY',
  note: 'Customer did not say which item; closing.',
});
check('a specialist can rule on a request still waiting on the customer', waiting.body?.data?.status === 'DENIED', waiting.status);
const marcus = customers.find((c) => c.email === 'marcus.webb@example.com');
const marcusView = (await (await customerSession(marcus))('GET', `/requests/${tvId}`)).body.data;
check('the customer sees the specialist’s message', marcusView.messages.at(-1).role === 'STAFF');

console.log('\nDemo shop');
const julia = customers.find((c) => c.email === 'julia.santos@example.com');
const juliaCall = await customerSession(julia);
async function tryTestOrder(delivery, message, expected) {
  const placed = await juliaCall('POST', '/store/orders', { skus: ['KIT-KETL-01'], delivery });
  const orderNumber = placed.body?.data?.orderNumber;
  const reply = (
    await juliaCall('POST', '/requests/messages', { message: message.replace('{order}', orderNumber) })
  ).body.data;
  check(`test order ${delivery.toLowerCase()} → ${expected}`, reply?.status === expected, `${placed.status} ${reply?.status}`);
  return orderNumber;
}
const recent = await tryTestOrder('DELIVERED_TODAY', 'The kettle from {order} arrived cracked.', 'APPROVED');
await tryTestOrder('DELIVERED_45_DAYS_AGO', 'The kettle from {order} arrived cracked.', 'DENIED');
await tryTestOrder('IN_TRANSIT', 'My kettle from {order} never arrived.', 'ESCALATED');
check(
  'a price sent by the browser is rejected: prices come from the catalogue',
  (await juliaCall('POST', '/store/orders', { skus: ['KIT-KETL-01'], delivery: 'IN_TRANSIT', priceMinor: 1 })).status === 400,
);
check('the demo reset removes test orders', await (async () => {
  const reset = await anonymous('POST', '/demo/reset');
  const orders = (await juliaCall('GET', '/me/orders')).body.data;
  return reset.status === 204 && !orders.some((o) => o.orderNumber === recent);
})());

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
process.exit(failures === 0 ? 0 : 1);
