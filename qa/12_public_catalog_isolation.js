// QA artifact - catalog tenant-isolation probes after remediation.
// Usage: node qa/12_public_catalog_isolation.js
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const f = readEvidence('fixtures.json');
const caller = f.tenants.uae.ownerToken; // tenant B
const otherBusinessId = f.tenants.usa825.businessId;

async function main() {
  const out = { unauthenticated: {}, authenticated: {} };
  for (const route of ['/medicines', '/categories']) {
    const unauth = await request('GET', route);
    const r = await request('GET', route, { token: caller });
    const rows = r.data?.data?.medicines || r.data?.data?.categories || [];
    const ids = [...new Set(rows.map(row => Number(row.businessId ?? row.BusinessId)))];
    out.unauthenticated[route] = { status: unauth.status, message: unauth.data?.message };
    out.authenticated[route] = {
      status: r.status,
      callerBusinessId: f.tenants.uae.businessId,
      rowCount: rows.length,
      businessIds: ids,
      foreignRows: rows.filter(row => Number(row.businessId ?? row.BusinessId) !== f.tenants.uae.businessId).length
    };
  }
  const cross = await request('GET', `/medicines?businessId=${otherBusinessId}`, { token: caller });
  const crossRows = cross.data?.data?.medicines || [];
  out.forcedBusinessId = {
    status: cross.status,
    businessIds: [...new Set(crossRows.map(row => Number(row.businessId ?? row.BusinessId)))]
  };

  writeEvidence('public_catalog_isolation.json', out);
  const locked = Object.values(out.unauthenticated).every(o => o.status === 401);
  const isolated = Object.values(out.authenticated).every(o => o.status === 200 && o.foreignRows === 0) &&
    out.forcedBusinessId.businessIds.every(id => id === f.tenants.uae.businessId);
  recordResult('R1', locked && isolated ? 'PASS' : 'FAIL', out);
  recordResult('N6', locked && isolated ? 'REFUTED' : 'CONFIRMED', out);
  console.log('PUBLIC_CATALOG_ISOLATION_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
