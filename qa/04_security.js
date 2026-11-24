// QA artifact - tenant isolation and role guard matrix (T8-T11, R1/R2/R20/R25).
// Usage: node qa/04_security.js
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const f = readEvidence('fixtures.json');
const a = f.tenants.usa825;   // tenant A
const b = f.tenants.uae;      // tenant B (cross-tenant caller)
const output = { probes: [], crossTenant: [], masking: {} };

// GET-only probes so nothing is mutated; POST/PATCH probes use invalid payloads.
// [method, route, roles allowed to succeed]. The catalog is authenticated and
// tenant-scoped; inventory mutations are owner-only after remediation.
// OTHER_TENANT_OWNER is treated like BUSINESS_OWNER (it must only see its own tenant).
const probes = [
  ['GET', '/medicines', ['STAFF', 'CUSTOMER', 'BUSINESS_OWNER']],
  ['GET', '/categories', ['STAFF', 'CUSTOMER', 'BUSINESS_OWNER']],
  ['GET', '/admin/dashboard', ['STAFF', 'BUSINESS_OWNER']],
  ['GET', '/admin/dashboard/analytics', ['BUSINESS_OWNER']],
  ['GET', '/admin/users', ['STAFF', 'BUSINESS_OWNER']],
  ['GET', '/admin/inventory', ['STAFF', 'BUSINESS_OWNER']],
  ['GET', '/admin/reports/sales', ['BUSINESS_OWNER']],
  ['GET', '/admin/settings', ['BUSINESS_OWNER']],
  ['GET', '/admin/compliance/controlled-logs', ['BUSINESS_OWNER']],
  ['GET', '/vendors', ['BUSINESS_OWNER']],
  ['GET', '/purchase-orders', ['BUSINESS_OWNER']],
  ['GET', '/hrms/employees', ['BUSINESS_OWNER']],
  ['GET', '/hrms/salaries', ['BUSINESS_OWNER']],
  ['GET', '/orders/admin/all', ['STAFF', 'BUSINESS_OWNER']],
  ['GET', '/orders/my-orders', ['CUSTOMER', 'STAFF', 'BUSINESS_OWNER']],
  ['GET', '/prescriptions/admin/all', ['STAFF', 'BUSINESS_OWNER']],
  ['GET', '/prescriptions/my-prescriptions', ['CUSTOMER', 'STAFF', 'BUSINESS_OWNER']],
  ['GET', '/users/profile', ['CUSTOMER', 'STAFF', 'BUSINESS_OWNER']],
  ['GET', '/super-admin/businesses', ['SUPER_ADMIN']],
  ['POST', '/admin/inventory/adjust', ['BUSINESS_OWNER']],
  ['POST', '/orders/pos', ['STAFF', 'BUSINESS_OWNER']],
  ['POST', '/vendors', ['BUSINESS_OWNER']],
  ['POST', '/purchase-orders', ['BUSINESS_OWNER']],
  ['POST', '/hrms/employees', ['BUSINESS_OWNER']],
  ['PATCH', '/orders/999999/status', ['STAFF', 'BUSINESS_OWNER']],
  ['PATCH', '/orders/999999/cancel', ['CUSTOMER', 'STAFF', 'BUSINESS_OWNER']]
];

const tokens = {
  NONE: null,
  STAFF: a.staffToken,
  CUSTOMER: a.customers.c1.token,
  BUSINESS_OWNER: a.ownerToken,
  OTHER_TENANT_OWNER: b.ownerToken,
  SUPER_ADMIN: f.superToken
};

function hasKeyDeep(value, targets) {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, val] of Object.entries(value)) {
    if (targets.some(t => key.toLowerCase() === t)) found.push(key);
    if (val && typeof val === 'object') found.push(...hasKeyDeep(val, targets));
  }
  return found;
}

async function main() {
  // T8: every route with no token, STAFF, CUSTOMER, another tenant's owner.
  for (const [method, route, allowed] of probes) {
    for (const [label, token] of Object.entries(tokens)) {
      if (label === 'SUPER_ADMIN' && !allowed.includes('SUPER_ADMIN')) continue;
      const res = await request(method, route, { token, body: method === 'GET' ? undefined : {} });
      const isPublic = allowed.includes('PUBLIC');
      const effectiveRole = label === 'OTHER_TENANT_OWNER' ? 'BUSINESS_OWNER' : label;
      const permitted = isPublic || allowed.includes(effectiveRole);
      const ok = label === 'NONE'
        ? (isPublic ? res.status === 200 : res.status === 401)
        : (permitted ? [200, 400, 404].includes(res.status) : [403].includes(res.status));
      output.probes.push({ method, route, caller: label, status: res.status,
        ok, message: res.data?.message, sample: JSON.stringify(res.data).slice(0, 160) });
      if (!ok) console.log(`UNEXPECTED ${method} ${route} as ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 100)}`);
    }
  }
  const unexpected = output.probes.filter(p => !p.ok);
  const unexpected200 = output.probes.filter(p => !p.ok && p.status === 200);
  recordResult('T8', unexpected200.length === 0 ? 'PASS' : 'FAIL',
    `${output.probes.length} probes, ${unexpected.length} unexpected statuses, ${unexpected200.length} unexpected 200s`);

  const staffAdjust = output.probes.find(p => p.method === 'POST' && p.route === '/admin/inventory/adjust' && p.caller === 'STAFF');
  const ownerAdjust = output.probes.find(p => p.method === 'POST' && p.route === '/admin/inventory/adjust' && p.caller === 'BUSINESS_OWNER');
  recordResult('D14', staffAdjust?.status === 403 && [200, 400].includes(ownerAdjust?.status) ? 'REFUTED' : 'CONFIRMED',
    { staffAdjust, ownerAdjust });

  // T10: owner-only endpoints must reject STAFF with 403.
  const ownerOnly = [
    '/hrms/employees', '/vendors', '/purchase-orders', '/admin/dashboard/analytics',
    '/admin/reports/sales', '/admin/settings', '/admin/compliance/controlled-logs'
  ];
  const staffResults = {};
  for (const route of ownerOnly) {
    const res = await request('GET', route, { token: a.staffToken });
    staffResults[route] = { status: res.status, message: res.data?.message };
  }
  output.staffOwnerOnly = staffResults;
  recordResult('T10', Object.values(staffResults).every(r => r.status === 403) ? 'PASS' : 'FAIL', staffResults);

  // T9: raw staff dashboard JSON must contain no financial fields.
  const staffDash = await request('GET', '/admin/dashboard', { token: a.staffToken });
  const ownerDash = await request('GET', '/admin/dashboard', { token: a.ownerToken });
  const financialKeys = hasKeyDeep(staffDash.data, ['revenue', 'cost', 'profit', 'totalrevenue', 'netrevenue', 'netprofit', 'cogs']);
  output.dashboard = {
    staffStatus: staffDash.status, ownerStatus: ownerDash.status,
    staffFinancialKeys: financialKeys,
    staffSample: JSON.stringify(staffDash.data).slice(0, 600),
    ownerFinancialKeys: hasKeyDeep(ownerDash.data, ['revenue', 'cost', 'profit', 'totalrevenue', 'netrevenue', 'netprofit', 'cogs'])
  };
  recordResult('T9', financialKeys.length === 0 ? 'PASS' : 'FAIL', output.dashboard);

  // T11: Emirates ID masked for STAFF, full for OWNER (UAE tenant has IDs).
  const staffUsers = await request('GET', '/admin/users', { token: b.staffToken });
  const ownerUsers = await request('GET', '/admin/users', { token: b.ownerToken });
  const collectIds = (res) => JSON.stringify(res.data).match(/784-[0-9*"-]+/g) || [];
  output.masking = {
    staffStatus: staffUsers.status, ownerStatus: ownerUsers.status,
    staffIds: collectIds(staffUsers), ownerIds: collectIds(ownerUsers),
    staffSample: JSON.stringify(staffUsers.data).slice(0, 500)
  };
  const masked = output.masking.staffIds.some(id => id.includes('****')) &&
    output.masking.ownerIds.some(id => id.includes('1234567'));
  recordResult('T11', masked ? 'PASS' : 'FAIL', output.masking);
  recordResult('R20', masked ? 'PASS' : 'FAIL', 'GET /api/admin/users staff vs owner EmiratesId comparison');

  // Cross-tenant probes: caller from tenant B supplies tenant A ids in query/body.
  const cross = [
    ['GET', `/orders/admin/all?businessId=${a.businessId}`],
    ['GET', `/admin/users?businessId=${a.businessId}`],
    ['GET', `/medicines?businessId=${a.businessId}`],
    ['GET', `/orders/${f.tenants.usa08.medicines ? 1 : 1}`],
    ['GET', `/orders/my-orders?businessId=${a.businessId}`]
  ];
  for (const [method, route] of cross) {
    const res = await request(method, route, { token: b.ownerToken });
    output.crossTenant.push({ method, route, status: res.status,
      leakedIds: JSON.stringify(res.data).match(/"businessId":\s*1\b/g)?.length || 0,
      sample: JSON.stringify(res.data).slice(0, 200) });
  }
  const leaks = output.crossTenant.filter(c => c.leakedIds > 0);
  recordResult('R1', leaks.length === 0 ? 'PASS' : 'FAIL', { note: 'Cross-tenant owner with tenant A ids', probes: output.crossTenant });
  recordResult('R2', unexpected.length === 0 && Object.values(staffResults).every(r => r.status === 403) ? 'PASS' : 'FAIL',
    'Role matrix from T8 + owner-only checks from T10');

  writeEvidence('security.json', output);
  console.log('SECURITY_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
