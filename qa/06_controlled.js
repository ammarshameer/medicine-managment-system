// QA artifact - controlled-substance gate and ledger (T16-T19, R12/R13/R19, D2/D3/D5/D6).
// Usage: node qa/06_controlled.js
const { BASE, request, readEvidence, writeEvidence, recordResult } = require('./lib');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const db = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const f = readEvidence('fixtures.json');
const us = f.tenants.usa825;
const ae = f.tenants.uae;
const output = {};

async function sql(text, params = []) { const [rows] = await db.query(text, params); return rows; }

async function uploadPrescription(token) {
  const fd = new FormData();
  fd.append('prescription', new Blob([Buffer.from('QA prescription image')], { type: 'image/png' }), 'qa-rx.png');
  fd.append('notes', 'QA controlled-substance test');
  const res = await fetch(`${BASE}/prescriptions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  return { status: res.status, data: await res.json() };
}
async function approve(token, id) {
  return request('PATCH', `/prescriptions/${id}/status`, { token, body: { status: 'Approved', notes: 'QA approval' } });
}
async function ledger(businessId) {
  const rows = await sql('SELECT Action, COUNT(*) c FROM ControlledSubstanceLog WHERE BusinessId = ? GROUP BY Action', [businessId]);
  return rows.reduce((o, r) => { o[r.Action] = r.c; return o; }, {});
}
async function createVendor(token, name) {
  const res = await request('POST', '/vendors', { token, body: { name, contactPerson: 'QA', email: 'vendor@qa.local', phone: '92300000000' } });
  return res.data?.data?.vendorId || res.data?.data?.id;
}
async function receiveControlledStock(token, vendorId, medicineId) {
  const po = await request('POST', '/purchase-orders', {
    token,
    body: { vendorId, orderDate: new Date().toISOString(), status: 'Ordered',
      items: [{ medicineId, quantity: 5, unitCost: 10 }] }
  });
  const poId = po.data?.data?.purchaseOrderId || po.data?.data?.id;
  const rec = await request('POST', `/purchase-orders/${poId}/receive`, { token, body: {} });
  return { poStatus: po.status, poId, receiveStatus: rec.status, message: rec.data?.message };
}
const pos = (token, body) => request('POST', '/orders/pos', { token, body: { paymentMethod: 'Cash', customerName: 'QA Controlled', ...body } });
const online = (token, body) => request('POST', '/orders', { token, body: { paymentMethod: 'Cash', ...body } });

async function main() {
  // ---- Prescription fixtures ----
  const up1 = await uploadPrescription(us.customers.c1.token);
  const up2 = await uploadPrescription(us.customers.c2.token);
  const rxPending = up1.data?.data?.id;
  const rxOtherCustomer = up2.data?.data?.id;
  const approved = await approve(us.ownerToken, rxOtherCustomer);
  await approve(ae.ownerToken, (await uploadPrescription(ae.customers.c1.token)).data?.data?.id);
  output.prescriptions = { uploadStatus: up1.status, rxPending, rxOtherCustomer, approvedStatus: approved.status };

  // ---- T16: USA Schedule II via POS ----
  const sid = us.medicines.schedule2.id;
  const posNone = await pos(us.staffToken, { items: [{ medicineId: sid, quantity: 1 }] });
  const posPending = await pos(us.staffToken, { items: [{ medicineId: sid, quantity: 1 }], prescriptionId: rxPending });
  const posApproved = await pos(us.staffToken, { items: [{ medicineId: sid, quantity: 1 }], prescriptionId: rxOtherCustomer });
  const ledgerUS = await ledger(us.businessId);
  output.T16 = {
    noPrescription: { status: posNone.status, message: posNone.data?.message },
    pendingPrescription: { status: posPending.status, message: posPending.data?.message },
    approvedPrescription: { status: posApproved.status, message: posApproved.data?.message },
    ledger: ledgerUS
  };
  recordResult('T16', posNone.status === 400 && posPending.status === 400 && posApproved.status === 201 ? 'PASS' : 'FAIL', output.T16);
  recordResult('R12', posNone.status === 400 && posPending.status === 400 ? 'PASS' : 'FAIL',
    'POS controlled gate with no / pending prescription; ledger actions observed');

  // ---- T17: online path as CUSTOMER, STAFF, OWNER ----
  const onlineNoCust = await online(us.customers.c1.token, { items: [{ medicineId: sid, quantity: 1 }] });
  const onlineNoStaff = await online(us.staffToken, { items: [{ medicineId: sid, quantity: 1 }], userId: us.customers.c1.userId });
  const onlineNoOwner = await online(us.ownerToken, { items: [{ medicineId: sid, quantity: 1 }], userId: us.customers.c1.userId });
  const onlinePending = await online(us.customers.c1.token, { items: [{ medicineId: sid, quantity: 1 }], prescriptionId: rxPending });
  const onlineWrongOwner = await online(us.customers.c1.token, { items: [{ medicineId: sid, quantity: 1 }], prescriptionId: rxOtherCustomer });
  output.T17 = {
    customerNoRx: { status: onlineNoCust.status, message: onlineNoCust.data?.message },
    staffNoRx: { status: onlineNoStaff.status, message: onlineNoStaff.data?.message },
    ownerNoRx: { status: onlineNoOwner.status, message: onlineNoOwner.data?.message },
    customerPendingRx: { status: onlinePending.status, message: onlinePending.data?.message },
    customerOtherCustomersApprovedRx: { status: onlineWrongOwner.status, message: onlineWrongOwner.data?.message }
  };
  recordResult('T17', Object.values(output.T17).every(v => v.status === 400) ? 'PASS' : 'FAIL', output.T17);
  recordResult('R13', output.T17.customerNoRx.status === 400 && output.T17.customerPendingRx.status === 400 &&
    output.T17.customerOtherCustomersApprovedRx.status === 400 ? 'PASS' : 'FAIL', output.T17);

  // ---- T18: UAE Narcotic via POS and online ----
  const nid = ae.medicines.narcotic.id;
  const aePos = await pos(ae.staffToken, { items: [{ medicineId: nid, quantity: 1 }] });
  const aeOnlineCust = await online(ae.customers.c1.token, { items: [{ medicineId: nid, quantity: 1 }] });
  const aeOnlineStaff = await online(ae.staffToken, { items: [{ medicineId: nid, quantity: 1 }], userId: ae.customers.c1.userId });
  output.T18 = {
    posNoRx: { status: aePos.status, message: aePos.data?.message },
    customerNoRx: { status: aeOnlineCust.status, message: aeOnlineCust.data?.message },
    staffNoRx: { status: aeOnlineStaff.status, message: aeOnlineStaff.data?.message }
  };
  recordResult('T18', Object.values(output.T18).every(v => v.status === 400) ? 'PASS' : 'FAIL', output.T18);
  recordResult('D2', posNone.status === 400 && posPending.status === 400 && posApproved.status === 201 ? 'REFUTED' : 'CONFIRMED', output.T16);
  recordResult('D3', Object.values(output.T17).every(v => v.status === 400) ? 'REFUTED' : 'CONFIRMED', output.T17);

  // ---- D5: Dispensed is written only when an online order reaches Delivered ----
  const approvedC1 = await approve(us.ownerToken, rxPending);
  const before = await ledger(us.businessId);
  const controlledOrder = await online(us.staffToken, {
    items: [{ medicineId: sid, quantity: 1 }],
    userId: us.customers.c1.userId, prescriptionId: rxPending
  });
  const controlledOrderId = controlledOrder.data?.data?.id;
  const during = await ledger(us.businessId);
  const delivered = controlledOrderId
    ? await request('PATCH', `/orders/${controlledOrderId}/status`, { token: us.staffToken, body: { status: 'Delivered' } })
    : null;
  const afterDelivery = await ledger(us.businessId);
  const cancelDelivered = controlledOrderId
    ? await request('PATCH', `/orders/${controlledOrderId}/cancel`, { token: us.ownerToken, body: {} })
    : null;
  output.D5 = {
    approvedC1Status: approvedC1.status,
    orderCreateStatus: controlledOrder.status,
    orderStatusAtCreation: controlledOrder.data?.data?.status,
    deliveredStatus: delivered?.status,
    cancelDeliveredStatus: cancelDelivered?.status,
    before, during, afterDelivery,
    dispensedAddedAtCreation: (during.Dispensed || 0) - (before.Dispensed || 0),
    dispensedAddedAtDelivery: (afterDelivery.Dispensed || 0) - (during.Dispensed || 0)
  };
  recordResult('D5', controlledOrder.status === 201 && output.D5.dispensedAddedAtCreation === 0 &&
    output.D5.dispensedAddedAtDelivery === 1 && cancelDelivered?.status === 400 ? 'REFUTED' : 'CONFIRMED', output.D5);

  // ---- T19: full ledger lifecycle (Received / Adjusted / Destroyed) ----
  const vendorId = await createVendor(us.ownerToken, `QA Controlled Vendor ${Date.now()}`);
  const received = await receiveControlledStock(us.ownerToken, vendorId, sid);
  const afterReceive = await ledger(us.businessId);
  const adjust = await request('POST', `/admin/inventory/adjust?medicineId=${sid}&quantity=5&reason=QA%20controlled%20adjust`,
    { token: us.ownerToken, body: {} });
  const afterAdjust = await ledger(us.businessId);
  const destroy = await request('POST', `/admin/inventory/destroy?medicineId=${sid}&quantity=1&reason=QA%20controlled%20destroy`,
    { token: us.ownerToken, body: {} });
  const afterDestroy = await ledger(us.businessId);
  const compliance = await request('GET', '/admin/compliance/controlled-logs', { token: us.ownerToken });
  output.T19 = {
    receive: received, afterReceive,
    adjustStatus: adjust.status, afterAdjust,
    destroyStatus: destroy.status, afterDestroy,
    complianceStatus: compliance.status,
    complianceActions: [...new Set((compliance.data?.data?.logs || []).map(l => l.action || l.Action))]
  };
  recordResult('T19', received.receiveStatus === 200 && adjust.status === 200 && destroy.status === 200 &&
    ['Received', 'Adjusted'].every(a => (afterAdjust[a] || 0) > 0) ? 'PASS' : 'FAIL', output.T19);
  recordResult('R19', ['Dispensed', 'Received', 'Adjusted', 'Destroyed'].every(a => (afterDestroy[a] || 0) > 0) ? 'PASS' : 'FAIL', output.T19);

  writeEvidence('controlled.json', output);
  await db.end();
  console.log('CONTROLLED_DONE');
}

main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
