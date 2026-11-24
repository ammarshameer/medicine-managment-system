// QA artifact - D9 / R15 POS void-refund verification.
// Usage: node qa/11_d9_refund_probe.js
const { BASE, request, readEvidence, writeEvidence, recordResult } = require('./lib');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const db = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const f = readEvidence('fixtures.json');
const t = f.tenants.usa825;
const output = {};

async function sql(text, params = []) { const [rows] = await db.query(text, params); return rows; }
const stock = (id) => sql('SELECT Stock FROM Medicines WHERE MedicineId = ?', [id]).then(r => r[0].Stock);
const refundRows = (id) => sql("SELECT COUNT(*) c FROM InventoryTransactions WHERE MedicineId = ? AND Reason LIKE '%Void/Refund%'", [id]).then(r => r[0].c);
const logCount = (action) => sql('SELECT COUNT(*) c FROM ControlledSubstanceLog WHERE BusinessId = ? AND Action = ?', [t.businessId, action]).then(r => r[0].c);

async function approvedPrescription() {
  const fd = new FormData();
  fd.append('prescription', new Blob([Buffer.from('QA void prescription')], { type: 'image/png' }), 'qa-void-rx.png');
  fd.append('notes', 'QA POS void test');
  const uploaded = await fetch(`${BASE}/prescriptions`, {
    method: 'POST', headers: { Authorization: `Bearer ${t.customers.c1.token}` }, body: fd
  });
  const id = (await uploaded.json()).data?.id;
  const approved = await request('PATCH', `/prescriptions/${id}/status`, {
    token: t.ownerToken, body: { status: 'Approved', notes: 'QA approval' }
  });
  return { uploadStatus: uploaded.status, approveStatus: approved.status, id };
}

async function main() {
  // Normal POS sale: Delivered/Paid cannot be cancelled, but owner can void/refund.
  const normal = t.medicines.normal;
  const before = await stock(normal.id);
  const refundsBefore = await refundRows(normal.id);
  const sale = await request('POST', '/orders/pos', {
    token: t.staffToken,
    body: { items: [{ medicineId: normal.id, quantity: 1 }], paymentMethod: 'Cash', customerName: 'QA D9' }
  });
  const id = sale.data?.data?.orderId;
  const afterSale = await stock(normal.id);
  const detail = await request('GET', `/orders/${id}`, { token: t.ownerToken });
  const cancel = await request('PATCH', `/orders/${id}/cancel`, { token: t.ownerToken, body: {} });
  const voided = await request('POST', `/orders/${id}/void`, { token: t.ownerToken, body: {} });
  const after = await request('GET', `/orders/${id}`, { token: t.ownerToken });
  const afterVoid = await stock(normal.id);
  const refundsAfter = await refundRows(normal.id);
  const data = after.data?.data || after.data;

  output.normal = {
    saleStatus: sale.status,
    orderStatusAtCreation: sale.data?.data?.status,
    detailStatus: detail.status,
    cancelStatus: cancel.status,
    cancelMessage: cancel.data?.message,
    voidStatus: voided.status,
    voidMessage: voided.data?.message,
    statusAfterVoid: data?.Status || data?.status,
    paymentStatusAfterVoid: data?.PaymentStatus || data?.paymentStatus,
    stockBefore: before, stockAfterSale: afterSale, stockAfterVoid: afterVoid,
    refundRowsAdded: refundsAfter - refundsBefore
  };
  recordResult('D9', output.normal.cancelStatus === 400 && output.normal.voidStatus === 200 &&
    output.normal.statusAfterVoid === 'Cancelled' && output.normal.paymentStatusAfterVoid === 'Refunded' ? 'REFUTED' : 'CONFIRMED', output.normal);
  recordResult('R15', output.normal.voidStatus === 200 && output.normal.stockAfterVoid === before &&
    output.normal.refundRowsAdded === 1 ? 'PASS' : 'FAIL', output.normal);

  // Controlled POS sale: void must also reverse the Dispensed ledger row.
  const rx = await approvedPrescription();
  const reversedBefore = await logCount('Reversed');
  const controlledSale = await request('POST', '/orders/pos', {
    token: t.staffToken,
    body: { items: [{ medicineId: t.medicines.schedule2.id, quantity: 1 }],
      prescriptionId: rx.id, paymentMethod: 'Cash', customerName: 'QA Controlled Void' }
  });
  const controlledId = controlledSale.data?.data?.orderId;
  const controlledVoid = controlledId ? await request('POST', `/orders/${controlledId}/void`, { token: t.ownerToken, body: {} }) : null;
  const reversedAfter = await logCount('Reversed');
  output.controlled = {
    prescription: rx, saleStatus: controlledSale.status, voidStatus: controlledVoid?.status,
    reversedBefore, reversedAfter, reversedRowsAdded: reversedAfter - reversedBefore
  };
  recordResult('R19', controlledSale.status === 201 && controlledVoid?.status === 200 &&
    output.controlled.reversedRowsAdded === 1 ? 'PASS' : 'FAIL', output.controlled);

  writeEvidence('d9_refund.json', output);
  await db.end();
  console.log('D9_PROBE_DONE');
}

main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
