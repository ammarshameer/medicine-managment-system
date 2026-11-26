// QA artifact - verify the hidden SUPPORT identity and cross-tenant switcher.
// Usage: node qa/17_support_access.js
const { request, login, readEvidence, writeEvidence, recordResult, brief } = require('./lib');

const SUPPORT_EMAIL = 'support@mms.com';
const SUPPORT_PASSWORD = 'Support@2026!';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// QA evidence is committed; strip JWTs before writing it.
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = /token/i.test(key) ? '<redacted>' : redact(item);
    }
    return out;
  }
  return value;
}

const safeBrief = (res) => redact(brief(res));

async function main() {
  const fixtures = readEvidence('fixtures.json');
  const password = fixtures.password || 'QaPass123';
  const tenants = Object.values(fixtures.tenants);
  const first = tenants[0];
  const second = tenants[1];
  assert(first && second, 'fixtures.json must contain at least two tenants');

  const evidence = { supportEmail: SUPPORT_EMAIL, checks: {} };

  // SUP1 - the hidden account logs in with the SUPPORT role.
  const supportLogin = await request('POST', '/auth/login', {
    body: { email: SUPPORT_EMAIL, password: SUPPORT_PASSWORD }
  });
  const supportOk = supportLogin.status === 200 && supportLogin.data?.data?.user?.role === 'SUPPORT';
  evidence.checks.SUP1 = safeBrief(supportLogin);
  recordResult('SUP1', supportOk ? 'PASS' : 'FAIL', 'support login returns SUPPORT role');
  assert(supportOk, `support login failed: ${supportLogin.raw}`);
  const supportToken = supportLogin.data.data.token;

  // SUP2 - platform admin endpoints accept the SUPPORT token.
  const businesses = await request('GET', '/super-admin/businesses?limit=100', { token: supportToken });
  const listOk = businesses.status === 200 &&
    businesses.data?.data?.businesses?.some((b) => b.BusinessId === first.businessId);
  evidence.checks.SUP2 = safeBrief(businesses);
  recordResult('SUP2', listOk ? 'PASS' : 'FAIL', 'SUPPORT can list platform businesses');
  assert(listOk, `support business list failed: ${businesses.raw}`);

  // SUP3 - X-Business-Id scopes catalog reads to the selected tenant.
  const scopedRead = await request('GET', '/medicines?limit=5', {
    token: supportToken,
    headers: { 'X-Business-Id': String(first.businessId) }
  });
  const rows = scopedRead.data?.data?.medicines || scopedRead.data?.data?.data || [];
  const scopedOk = scopedRead.status === 200 && rows.length > 0 &&
    rows.every((row) => Number(row.businessId || row.BusinessId) === Number(first.businessId));
  evidence.checks.SUP3 = { ...safeBrief(scopedRead), selectedBusinessId: first.businessId, rows: rows.length };
  recordResult('SUP3', scopedOk ? 'PASS' : 'FAIL', 'X-Business-Id scopes SUPPORT catalog reads');
  assert(scopedOk, `support scoped read failed: ${scopedRead.raw}`);

  // SUP4 - SUPPORT creates a category in the selected tenant, not their own.
  const categoryName = `QA Support Category ${Date.now()}`;
  const createCategory = await request('POST', '/categories', {
    token: supportToken,
    headers: { 'X-Business-Id': String(second.businessId) },
    body: { name: categoryName, description: 'QA support role check' }
  });
  const created = createCategory.data?.data?.category || createCategory.data?.data || {};
  const createOk = createCategory.status === 201 &&
    Number(created.businessId || created.BusinessId) === Number(second.businessId);
  evidence.checks.SUP4 = safeBrief(createCategory);
  recordResult('SUP4', createOk ? 'PASS' : 'FAIL', 'SUPPORT writes land in the selected tenant');
  assert(createOk, `support category create failed: ${createCategory.raw}`);

  // SUP5 - business owners never see the SUPPORT account or grant that role.
  const ownerToken = await login(first.ownerEmail || first.spec.email, password);
  const ownerUsers = await request('GET', '/admin/users?page=1&limit=100', { token: ownerToken });
  const visibleRoles = (ownerUsers.data?.data?.users || []).map((u) => u.role);
  const hiddenOk = ownerUsers.status === 200 && !visibleRoles.includes('SUPPORT');
  evidence.checks.SUP5a = { status: ownerUsers.status, roles: [...new Set(visibleRoles)] };
  recordResult('SUP5a', hiddenOk ? 'PASS' : 'FAIL', 'SUPPORT hidden from business user list');
  assert(hiddenOk, 'SUPPORT role leaked into business user list');

  const forbiddenCreate = await request('POST', '/admin/users', {
    token: ownerToken,
    body: {
      name: 'QA Should Not Exist',
      email: `qa.support.escape.${Date.now()}@qa.local`,
      phone: first.spec.phone,
      password,
      role: 'SUPPORT'
    }
  });
  const createBlocked = forbiddenCreate.status === 400 || forbiddenCreate.status === 403;
  evidence.checks.SUP5b = safeBrief(forbiddenCreate);
  recordResult('SUP5b', createBlocked ? 'PASS' : 'FAIL', 'business owner cannot create SUPPORT users');
  assert(createBlocked, `owner created a SUPPORT user: ${forbiddenCreate.raw}`);

  // SUP6 - the switcher header is ignored for ordinary business users.
  const ownerRead = await request('GET', '/medicines?limit=5', {
    token: ownerToken,
    headers: { 'X-Business-Id': String(second.businessId) }
  });
  const ownerRows = ownerRead.data?.data?.medicines || ownerRead.data?.data?.data || [];
  const ownerScopedOk = ownerRead.status === 200 && ownerRows.length > 0 &&
    ownerRows.every((row) => Number(row.businessId || row.BusinessId) === Number(first.businessId));
  evidence.checks.SUP6 = { ...safeBrief(ownerRead), rows: ownerRows.length };
  recordResult('SUP6', ownerScopedOk ? 'PASS' : 'FAIL', 'X-Business-Id cannot escalate a business owner');
  assert(ownerScopedOk, `owner header isolation failed: ${ownerRead.raw}`);

  evidence.checkedAt = new Date().toISOString();
  writeEvidence('support_access.json', evidence);
  console.log('[qa] support access evidence: qa/evidence/support_access.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
