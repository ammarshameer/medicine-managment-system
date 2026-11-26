// QA artifact - platform login URL, remembered session, and one-click support entry.
// Usage: node qa/18_platform_login_flow.js
const { request, login, readEvidence, writeEvidence, recordResult, brief } = require('./lib');

const PASSWORD = 'password';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

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
  const tenant = Object.values(fixtures.tenants)[0];
  assert(tenant, 'fixtures.json must contain a tenant');
  const evidence = { checks: {} };

  // PL1 - remembered platform login issues a longer-lived signed session.
  const rememberedLogin = await request('POST', '/auth/login', {
    body: { email: 'superadmin@mms.com', password: PASSWORD, remember: true }
  });
  const superToken = rememberedLogin.data?.data?.token;
  const claims = superToken ? decodeJwt(superToken) : {};
  const lifetimeDays = claims.exp && claims.iat ? (claims.exp - claims.iat) / 86400 : 0;
  const rememberedOk = rememberedLogin.status === 200 && claims.role === 'SUPER_ADMIN' &&
    lifetimeDays === 30;
  evidence.checks.PL1 = { ...safeBrief(rememberedLogin), lifetimeDays };
  recordResult('PL1', rememberedOk ? 'PASS' : 'FAIL', 'remembered platform login uses a 30-day signed token');
  assert(rememberedOk, `remembered platform login failed: ${rememberedLogin.raw}`);

  // PL2 - that token still authenticates, so no password re-entry is needed.
  const verify = await request('GET', '/auth/verify', { token: superToken });
  const verifyOk = verify.status === 200 && verify.data?.data?.user?.role === 'SUPER_ADMIN';
  evidence.checks.PL2 = safeBrief(verify);
  recordResult('PL2', verifyOk ? 'PASS' : 'FAIL', 'remembered token restores the platform session');
  assert(verifyOk, `remembered token verification failed: ${verify.raw}`);

  // PL3 - super admin opens a business as SUPPORT with no support password.
  const supportEntry = await request('POST', `/super-admin/businesses/${tenant.businessId}/support-login`, {
    token: superToken
  });
  const supportToken = supportEntry.data?.data?.token;
  const supportUser = supportEntry.data?.data?.user || {};
  const entryOk = supportEntry.status === 200 && supportUser.role === 'SUPPORT' &&
    Number(supportUser.businessId) === Number(tenant.businessId);
  evidence.checks.PL3 = safeBrief(supportEntry);
  recordResult('PL3', entryOk ? 'PASS' : 'FAIL', 'one-click support entry returns a tenant-scoped token');
  assert(entryOk, `support entry failed: ${supportEntry.raw}`);

  const scopedRead = await request('GET', '/medicines?limit=5', {
    token: supportToken,
    headers: { 'X-Business-Id': String(tenant.businessId) }
  });
  const rows = scopedRead.data?.data?.medicines || [];
  const scopedOk = scopedRead.status === 200 && rows.length > 0 &&
    rows.every((row) => Number(row.businessId) === Number(tenant.businessId));
  evidence.checks.PL3b = { ...safeBrief(scopedRead), rows: rows.length };
  recordResult('PL3b', scopedOk ? 'PASS' : 'FAIL', 'one-click support token reads only the selected business');
  assert(scopedOk, `support token scoping failed: ${scopedRead.raw}`);

  // PL4 - a business owner cannot mint a support session.
  const ownerToken = await login(tenant.ownerEmail || tenant.spec.email, fixtures.password || 'QaPass123');
  const ownerEntry = await request('POST', `/super-admin/businesses/${tenant.businessId}/support-login`, {
    token: ownerToken
  });
  const ownerBlocked = ownerEntry.status === 403;
  evidence.checks.PL4 = safeBrief(ownerEntry);
  recordResult('PL4', ownerBlocked ? 'PASS' : 'FAIL', 'business owner cannot mint a support session');
  assert(ownerBlocked, `owner was allowed to mint support token: ${ownerEntry.raw}`);

  // PL5 - support cannot mint another support session either.
  const supportMint = await request('POST', `/super-admin/businesses/${tenant.businessId}/support-login`, {
    token: supportToken
  });
  const supportBlocked = supportMint.status === 403;
  evidence.checks.PL5 = safeBrief(supportMint);
  recordResult('PL5', supportBlocked ? 'PASS' : 'FAIL', 'support token cannot mint further support sessions');
  assert(supportBlocked, `support was allowed to mint support token: ${supportMint.raw}`);

  // PL6 - remember is platform-only; business accounts keep the normal expiry.
  const ownerRemember = await request('POST', '/auth/login', {
    body: { email: tenant.ownerEmail || tenant.spec.email, password: fixtures.password || 'QaPass123', remember: true }
  });
  const ownerClaims = ownerRemember.data?.data?.token ? decodeJwt(ownerRemember.data.data.token) : {};
  const ownerLifetime = ownerClaims.exp && ownerClaims.iat ? (ownerClaims.exp - ownerClaims.iat) / 86400 : 0;
  const ownerExpiryOk = ownerRemember.status === 200 && ownerLifetime !== 30;
  evidence.checks.PL6 = { status: ownerRemember.status, lifetimeDays: ownerLifetime };
  recordResult('PL6', ownerExpiryOk ? 'PASS' : 'FAIL', 'remember flag does not extend business sessions');
  assert(ownerExpiryOk, `owner session expiry changed: ${ownerRemember.raw}`);

  evidence.checkedAt = new Date().toISOString();
  writeEvidence('platform_login.json', evidence);
  console.log('[qa] platform login evidence: qa/evidence/platform_login.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
