// QA artifact - mobile-facing API flows T22-T25 (R16/R17/R31/R32/R33, D1/D13).
// Usage: node qa/08_mobile_api.js
const { BASE, request, readEvidence, writeEvidence, recordResult } = require('./lib');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const db = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const f = readEvidence('fixtures.json');
const t = f.tenants.usa08;
const output = {};

async function main() {
  // ---- T22: business code validation ----
  const bad = await request('POST', '/auth/register', {
    body: { name: 'QA Wrong Code', email: `wrong.${Date.now()}@qa.local`, password: 'QaPass123', businessCode: 'INVALID999' }
  });
  const good = await request('POST', '/auth/register', {
    body: { name: 'QA Good Code', email: `good.${Date.now()}@qa.local`, password: 'QaPass123', businessCode: t.spec.businessCode }
  });
  output.T22 = {
    wrongCode: { status: bad.status, message: bad.data?.message },
    correctCode: { status: good.status, businessId: good.data?.data?.user?.businessId }
  };
  recordResult('T22', bad.status === 404 && good.status === 201 ? 'PASS' : 'FAIL', output.T22);
  recordResult('R32', good.status === 201 ? 'PASS' : 'FAIL', output.T22);

  // ---- T23: cart preview vs committed order ----
  const items = [{ medicineId: t.medicines.normal100.id, quantity: 2 }];
  const preview = await request('POST', '/orders/preview-tax', { token: t.customers.c1.token, body: { items } });
  const order = await request('POST', '/orders', {
    token: t.customers.c1.token, body: { items, paymentMethod: 'Cash' }
  });
  output.T23 = {
    preview: preview.data?.data, order: order.data?.data,
    totalsMatch: preview.data?.data?.totalAmount === order.data?.data?.totalAmount
  };
  recordResult('T23', output.T23.totalsMatch ? 'PASS' : 'FAIL', output.T23);
  recordResult('R10', output.T23.totalsMatch ? 'PASS' : 'FAIL', output.T23);

  // ---- T24: prescription-only order and customer status view ----
  const fd = new FormData();
  fd.append('prescription', new Blob([Buffer.from('QA prescription')], { type: 'image/png' }), 'rx.png');
  const upload = await fetch(`${BASE}/prescriptions`, {
    method: 'POST', headers: { Authorization: `Bearer ${t.customers.c2.token}` }, body: fd
  });
  const rx = await upload.json();
  const rxId = rx.data?.id;
  await request('PATCH', `/prescriptions/${rxId}/status`, { token: t.ownerToken, body: { status: 'Approved' } });
  const rxOrder = await request('POST', '/orders', {
    token: t.customers.c2.token, body: { prescriptionId: rxId, paymentMethod: 'Cash' }
  });
  const myOrders = await request('GET', '/orders/my-orders', { token: t.customers.c2.token });
  output.T24 = {
    uploadStatus: upload.status, prescriptionId: rxId,
    prescriptionOrder: { status: rxOrder.status, data: rxOrder.data?.data },
    customerSeesOrder: (myOrders.data?.data?.orders || []).some(o => o.id === rxOrder.data?.data?.id)
  };
  recordResult('T24', upload.status === 201 && rxOrder.status === 201 && output.T24.customerSeesOrder ? 'PASS' : 'FAIL', output.T24);
  recordResult('R33', upload.status === 201 ? 'PASS' : 'FAIL', output.T24);

  // ---- T25: reorder, edit quantities, and D13 invalid source order ----
  const reordered = await request('POST', '/orders', {
    token: t.customers.c1.token,
    body: { items: [{ medicineId: t.medicines.normal100.id, quantity: 1 }],
      reorderedFromOrderId: order.data?.data?.id, paymentMethod: 'Cash' }
  });
  const bogus = await request('POST', '/orders', {
    token: t.customers.c1.token,
    body: { items: [{ medicineId: t.medicines.normal100.id, quantity: 1 }],
      reorderedFromOrderId: 999999, paymentMethod: 'Cash' }
  });
  const [stored] = await db.query('SELECT ReorderedFromOrderId FROM Orders WHERE OrderId = ?', [reordered.data?.data?.id]);
  const [storedBogus] = await db.query('SELECT ReorderedFromOrderId FROM Orders WHERE OrderId = ?', [bogus.data?.data?.id]);
  output.T25 = {
    reorderStatus: reordered.status, stored: stored[0]?.ReorderedFromOrderId,
    bogusStatus: bogus.status, storedBogus: storedBogus[0]?.ReorderedFromOrderId
  };
  recordResult('T25', reordered.status === 201 && bogus.status === 400 &&
    output.T25.stored === order.data?.data?.id ? 'PASS' : 'FAIL', output.T25);
  recordResult('R16', output.T25.stored === order.data?.data?.id && bogus.status === 400 ? 'PASS' : 'FAIL', output.T25);
  recordResult('D13', bogus.status === 400 ? 'REFUTED' : 'CONFIRMED',
    `Invalid reorderedFromOrderId 999999 returned ${bogus.status}, stored=${output.T25.storedBogus}`);

  // ---- R17: customer A must not see customer B's orders ----
  const mine = await request('GET', '/orders/my-orders', { token: t.customers.c1.token });
  const other = await request('GET', '/orders/my-orders', { token: t.customers.c2.token });
  const myIds = (mine.data?.data?.orders || []).map(o => o.id);
  const otherIds = (other.data?.data?.orders || []).map(o => o.id);
  output.R17 = { myIds, otherIds, overlap: myIds.filter(id => otherIds.includes(id)) };
  recordResult('R17', output.R17.overlap.length === 0 ? 'PASS' : 'FAIL', output.R17);

  await db.end();
  writeEvidence('mobile_api.json', output);
  console.log('MOBILE_API_DONE');
}

main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
