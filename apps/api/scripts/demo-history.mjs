// Fills the support dashboard with real decisions: sends demo scenarios through the running API as
// their customers, so every request has a genuine trace, reply and audit trail.
// Scenarios that approve a refund are skipped by default, so they stay available to demo live
// (a second run would find the item already refunded). Pass --all to send those too.
//   API_URL=http://localhost:4000 node apps/api/scripts/demo-history.mjs
const API = `${process.env.API_URL ?? 'http://localhost:4000'}/v1`;
const includeApprovals = process.argv.includes('--all');

async function call(cookie, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie()[0]?.split(';')[0];
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${json?.message ?? ''}`);
  return { data: json?.data, cookie: setCookie };
}

const customers = (await call(null, 'GET', '/auth/demo-customers')).data;
const scenarios = customers
  .flatMap((customer) => customer.scenarios.map((scenario) => ({ customer, scenario })))
  .filter(({ scenario }) => includeApprovals || scenario.expected !== 'APPROVED');

console.log(`Sending ${scenarios.length} scenarios${includeApprovals ? '' : ' (approvals skipped; --all to include)'}…`);
const cookies = new Map();
for (const { customer, scenario } of scenarios) {
  if (!cookies.has(customer.id)) {
    const { cookie } = await call(null, 'POST', '/auth/customer-session', { customerId: customer.id });
    cookies.set(customer.id, cookie);
  }
  const { data } = await call(cookies.get(customer.id), 'POST', '/requests/messages', {
    message: scenario.message,
  });
  console.log(`  #${data.reference}  ${data.status.padEnd(10)} ${customer.name}: ${scenario.title}`);
}
console.log('Done. Open the support dashboard to see them.');
