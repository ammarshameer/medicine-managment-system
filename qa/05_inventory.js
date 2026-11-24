// QA artifact - inventory, purchasing, cost snapshots (T7, T12-T15, R6/R8/R14).
// Usage: node qa/05_inventory.js
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const db = mysql.createPool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});
const f = readEvidence('fixtures.json');
const t = f.tenants.usa825;
const output = {};

async function sql(text, params = []) {
  const [rows] = await db.query(text, params);
  return rows;
}
const med = (id) => sql('SELECT Stock, AverageCost FROM Medicines WHERE MedicineId = ?', [id]).then(r => r[0]);
const invCount = (id) => sql("SELECT COUNT(*) c FROM InventoryTransactions WHERE MedicineId = ? AND TransactionType = 'Stock Out'", [id]).then(r => r[0].c);

async function main() {
  // ---- T12: POS stock deduction, inventory row, CostPrice snapshot ----
  const normal = t.medicines.normal;
  const before = await med(normal.id);
  const invBefore = await invCount(normal.id);
  const sale = await request('POST', '/orders/pos', {
    token: t.staffToken,
    body: { items: [{ medicineId: normal.id, quantity: 2 }], paymentMethod: 'Cash', customerName: 'QA T12' }
  });
  const after = await med(normal.id);
  const invAfter = await invCount(normal.id);
  const orderId = sale.data?.data?.orderId;
  const snapshot = orderId ? await sql('SELECT CostPrice, Subtotal FROM OrderItems WHERE OrderId = ?', [orderId]) : [];
  const oversell = await request('POST', '/orders/pos', {
    token: t.staffToken,
    body: { items: [{ medicineId: normal.id, quantity: 9999 }], paymentMethod: 'Cash', customerName: 'QA T12 Oversell' }
  });
  const afterOversell = await med(normal.id);
  output.T12 = {
    saleStatus: sale.status, stockBefore: before.Stock, stockAfter: after.Stock,
    inventoryRowsAdded: invAfter - invBefore, orderItems: snapshot,
    oversellStatus: oversell.status, oversellMessage: oversell.data?.message,
    stockUnchangedAfterOversell: after.Stock === afterOversell.Stock
  };
  recordResult('T12', sale.status === 201 && after.Stock === before.Stock - 2 && invAfter - invBefore === 1 &&
    oversell.status === 400 && output.T12.stockUnchangedAfterOversell ? 'PASS' : 'FAIL', output.T12);

  // ---- T14 / R8: weighted-average cost via two PO receipts ----
  const vendor = await request('POST', '/vendors', {
    token: t.ownerToken, body: { name: 'QA Vendor', contactPerson: 'QA', email: 'vendor@qa.local', phone: '92300000000' }
  });
  const vendorId = vendor.data?.data?.vendorId;
  const created = await request('POST', '/medicines', {
    token: t.ownerToken,
    body: {
      name: `QA PO Weighted ${Date.now()}`,
      ...(t.categoryId ? { categoryId: t.categoryId } : {}),
      price: 20, stock: 0, expiryDate: '2030-12-31', manufacturer: 'QA', deaSchedule: 'None'
    }
  });
  if (created.status !== 201) throw new Error(`PO medicine create failed: ${created.raw}`);
  const poMedId = created.data.data.id;
  // Full ISO-8601 timestamps are accepted and normalized to the DATE column.
  async function createAndReceive(medicineId, unitCost) {
    const po = await request('POST', '/purchase-orders', {
      token: t.ownerToken,
      body: { vendorId, orderDate: new Date().toISOString(), status: 'Ordered',
        items: [{ medicineId, quantity: 10, unitCost }] }
    });
    const poId = po.data?.data?.purchaseOrderId || po.data?.data?.id;
    const rec = await request('POST', `/purchase-orders/${poId}/receive`, { token: t.ownerToken, body: {} });
    return { poStatus: po.status, poId, receiveStatus: rec.status, message: rec.data?.message,
      twice: await request('POST', `/purchase-orders/${poId}/receive`, { token: t.ownerToken, body: {} }) };
  }
  const r1 = await createAndReceive(poMedId, 5);
  const r2 = await createAndReceive(poMedId, 7);
  const mid = await med(poMedId);
  output.T14 = {
    first: { poStatus: r1.poStatus, receiveStatus: r1.receiveStatus, message: r1.message },
    second: { poStatus: r2.poStatus, receiveStatus: r2.receiveStatus, message: r2.message },
    doubleReceive: { status: r2.twice.status, message: r2.twice.data?.message },
    stockAfterReceipts: mid?.Stock, averageCostAfterReceipts: Number(mid?.AverageCost)
  };
  const receiveWorks = r1.receiveStatus === 200 && r2.receiveStatus === 200;
  recordResult('T14', receiveWorks && mid.Stock === 20 && Number(mid.AverageCost) === 6 &&
    r2.twice.status === 400 ? 'PASS' : 'FAIL', output.T14);
  recordResult('R8', receiveWorks && mid.Stock === 20 && Number(mid.AverageCost) === 6 ? 'PASS' : 'FAIL', output.T14);
  recordResult('N4', r1.poStatus === 201 && r2.poStatus === 201 ? 'REFUTED' : 'CONFIRMED',
    'ISO-8601 OrderDate accepted and normalized to DATE');
  recordResult('N5', receiveWorks && mid.Stock === 20 && Number(mid.AverageCost) === 6 ? 'REFUTED' : 'CONFIRMED',
    output.T14);

  // ---- T7: earlier order keeps its CostPrice after later cost changes ----
  // Change AverageCost through the real PO receive path (no direct-SQL workaround).
  const costChange = await createAndReceive(normal.id, 6);
  const snapshotAfter = orderId ? await sql('SELECT CostPrice FROM OrderItems WHERE OrderId = ?', [orderId]) : [];
  output.T7 = { beforeReceipts: snapshot, afterReceipts: snapshotAfter,
    currentAverageCost: Number((await med(normal.id)).AverageCost),
    costChange: { poStatus: costChange.poStatus, receiveStatus: costChange.receiveStatus } };
  recordResult('T7', snapshot.length && snapshotAfter.length &&
    Number(snapshot[0].CostPrice) === Number(snapshotAfter[0].CostPrice) ? 'PASS' : 'FAIL', output.T7);

  // ---- T13: two concurrent sales of the last unit ----
  const low = t.medicines.lowstock;
  // Re-runnable setup: force exactly 1 unit in stock via the documented adjust route.
  const currentLow = (await med(low.id)).Stock;
  if (currentLow !== 1) {
    await request('POST', `/admin/inventory/adjust?medicineId=${low.id}&quantity=${1 - currentLow}&reason=QA%20setup`,
      { token: t.ownerToken, body: {} });
  }
  const stockLow = await med(low.id);
  const saleBody = { items: [{ medicineId: low.id, quantity: 1 }], paymentMethod: 'Cash', customerName: 'QA Race' };
  const [raceA, raceB] = await Promise.all([
    request('POST', '/orders/pos', { token: t.staffToken, body: saleBody }),
    request('POST', '/orders/pos', { token: t.staffToken, body: saleBody })
  ]);
  const stockAfterRace = await med(low.id);
  output.T13 = { stockBefore: stockLow.Stock, statuses: [raceA.status, raceB.status],
    stockAfter: stockAfterRace.Stock };
  recordResult('T13', [raceA.status, raceB.status].filter(s => s === 201).length === 1 &&
    [raceA.status, raceB.status].filter(s => s === 400).length === 1 && stockAfterRace.Stock === 0 ? 'PASS' : 'FAIL', output.T13);

  // ---- T15: cancel Pending online order restores stock and logs a row ----
  const target = t.medicines.normal;
  const stockBeforeCancel = (await med(target.id)).Stock;
  const logsBefore = await sql('SELECT COUNT(*) c FROM InventoryTransactions WHERE MedicineId = ?', [target.id]).then(r => r[0].c);
  const online = await request('POST', '/orders', {
    token: t.customers.c1.token,
    body: { items: [{ medicineId: target.id, quantity: 2 }], paymentMethod: 'Cash' }
  });
  const oid = online.data?.data?.id;
  const stockAfterOrder = (await med(target.id)).Stock;
  const cancel = await request('PATCH', `/orders/${oid}/cancel`, { token: t.customers.c1.token, body: {} });
  const stockAfterCancel = (await med(target.id)).Stock;
  const logsAfter = await sql('SELECT COUNT(*) c FROM InventoryTransactions WHERE MedicineId = ?', [target.id]).then(r => r[0].c);
  output.T15 = { orderStatus: online.status, orderId: oid, cancelStatus: cancel.status,
    stockBeforeCancel: stockBeforeCancel, stockAfterOrder: stockAfterOrder, stockAfterCancel: stockAfterCancel,
    logRowsAdded: logsAfter - logsBefore };
  recordResult('T15', online.status === 201 && cancel.status === 200 && stockAfterCancel === stockBeforeCancel &&
    logsAfter - logsBefore === 2 ? 'PASS' : 'FAIL', output.T15);
  recordResult('R14', cancel.status === 200 && stockAfterCancel === stockBeforeCancel ? 'PASS' : 'FAIL', output.T15);

  // ---- R6: low-stock listing ----
  const dash = await request('GET', '/admin/dashboard', { token: t.ownerToken });
  output.R6 = { lowStockMedicines: dash.data?.data?.lowStockMedicines, status: dash.status };
  recordResult('R6', output.R6.status === 200 ? 'PASS' : 'FAIL', output.R6);

  writeEvidence('inventory.json', output);
  await db.end();
  console.log('INVENTORY_DONE');
}

main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
