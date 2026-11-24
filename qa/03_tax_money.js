// QA artifact - tax and money scenarios T1-T7 (single source of truth, snapshots).
// Usage: node qa/03_tax_money.js
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const f = readEvidence('fixtures.json');
const output = {};

async function preview(token, items) {
  return request('POST', '/orders/preview-tax', { token, body: { items } });
}
async function pos(token, items, extra = {}) {
  return request('POST', '/orders/pos', {
    token, body: { items, paymentMethod: 'Cash', customerName: 'QA Walk-in', ...extra }
  });
}
async function online(token, items, extra = {}) {
  return request('POST', '/orders', { token, body: { items, paymentMethod: 'Cash', ...extra } });
}
async function analytics(token) {
  const r = await request('GET', '/admin/dashboard/analytics?period=year', { token });
  return r.data?.data?.totals || {};
}
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
function numbers(r) {
  const d = r.data?.data || {};
  return { subtotal: money(d.subtotal), tax: money(d.taxAmount), total: money(d.totalAmount), currency: d.currency };
}

async function main() {
  // Reset the tax-free tenant currency in case a previous run changed it.
  await request('PUT', '/admin/settings', {
    token: f.tenants.notax.ownerToken, body: { currency: 'USD' }
  });

  // ---- T1: USA exclusive 8% with one taxable and one exempt line ----
  const t = f.tenants.usa08;
  const itemsT1 = [
    { medicineId: t.medicines.taxable20.id, quantity: 1 },
    { medicineId: t.medicines.exempt50.id, quantity: 1 }
  ];
  const beforeT1 = await analytics(t.ownerToken);
  const p1 = await preview(t.ownerToken, itemsT1);
  const s1 = await pos(t.staffToken, itemsT1);
  const o1 = await online(t.customers.c1.token, itemsT1);
  const afterT1 = await analytics(t.ownerToken);
  const t1 = { preview: numbers(p1), pos: numbers(s1), online: numbers(o1),
    revenueDelta: money(afterT1.revenue - beforeT1.revenue),
    posReceipt: s1.data?.data?.business, posItems: s1.data?.data?.items };
  output.T1 = t1;
  const t1ok = t1.preview.subtotal === 70 && t1.preview.tax === 1.6 && t1.preview.total === 71.6 &&
    JSON.stringify(t1.preview) === JSON.stringify(t1.pos) && JSON.stringify(t1.preview) === JSON.stringify(t1.online) &&
    t1.revenueDelta === 70;
  recordResult('T1', t1ok ? 'PASS' : 'FAIL', t1);

  // ---- T5 (part 1): preview/POS/online identical for the USA cart ----
  recordResult('T5', t1ok ? 'PASS' : 'FAIL', { cart: 'USA 20 taxable + 50 exempt', ...t1 });

  // ---- T2: UAE tax-inclusive 5% ----
  const u = f.tenants.uae;
  const itemsT2 = [{ medicineId: u.medicines.inclusive105.id, quantity: 1 }];
  const beforeT2 = await analytics(u.ownerToken);
  const p2 = await preview(u.ownerToken, itemsT2);
  const s2 = await pos(u.staffToken, itemsT2);
  const o2 = await online(u.customers.c1.token, itemsT2);
  const afterT2 = await analytics(u.ownerToken);
  const t2 = { preview: numbers(p2), pos: numbers(s2), online: numbers(o2),
    revenueDelta: money(afterT2.revenue - beforeT2.revenue) };
  output.T2 = t2;
  const t2ok = t2.preview.subtotal === 100 && t2.preview.tax === 5 && t2.preview.total === 105 &&
    JSON.stringify(t2.preview) === JSON.stringify(t2.pos) && JSON.stringify(t2.preview) === JSON.stringify(t2.online) &&
    t2.revenueDelta === 100;
  recordResult('T2', t2ok ? 'PASS' : 'FAIL', t2);
  recordResult('T5', t1ok && t2ok ? 'PASS' : 'FAIL', { usa: t1, uae: t2 });

  // ---- T3: tax-disabled tenant ----
  const n = f.tenants.notax;
  const p3 = await preview(n.ownerToken, [{ medicineId: n.medicines.plain100.id, quantity: 1 }]);
  const s3 = await pos(n.staffToken, [{ medicineId: n.medicines.plain100.id, quantity: 1 }]);
  const t3 = { preview: numbers(p3), pos: numbers(s3), receiptTax: s3.data?.data?.taxAmount,
    receiptItemFlags: s3.data?.data?.items?.map(i => ({ isTaxable: i.isTaxable, priceIncludesTax: i.priceIncludesTax })) };
  output.T3 = t3;
  recordResult('T3', t3.preview.tax === 0 && t3.preview.total === 100 && t3.pos.total === 100 ? 'PASS' : 'FAIL', t3);

  // ---- T4: 8.875% rounding ----
  const y = f.tenants.nyc;
  const p4 = await preview(y.ownerToken, [{ medicineId: y.medicines.hundred.id, quantity: 1 }]);
  const t4 = numbers(p4);
  output.T4 = t4;
  recordResult('T4', t4.tax === 8.88 && t4.total === 108.88 ? 'PASS' : 'FAIL', t4);

  // ---- T6: changing tenant currency must not mutate old order snapshot ----
  const orderBefore = s3.data?.data;
  const orderId = orderBefore?.orderId;
  const detailBefore = orderId ? await request('GET', `/orders/${orderId}`, { token: n.ownerToken }) : null;
  const update = await request('PUT', '/admin/settings', { token: n.ownerToken, body: { currency: 'AED' } });
  const detailAfter = orderId ? await request('GET', `/orders/${orderId}`, { token: n.ownerToken }) : null;
  const settings = await request('GET', '/admin/settings', { token: n.ownerToken });
  const t6 = {
    updateStatus: update.status,
    orderCurrencyBefore: detailBefore?.data?.data?.currency,
    orderCurrencyAfter: detailAfter?.data?.data?.currency,
    settingsCurrency: settings.data?.data?.settings?.currency ?? settings.data?.data?.currency
  };
  output.T6 = t6;
  recordResult('T6', t6.orderCurrencyBefore === t6.orderCurrencyAfter && t6.orderCurrencyBefore === 'USD' ? 'PASS' : 'FAIL', t6);

  // ---- R21: receipt data fields supplied by API ----
  const receipt = s1.data?.data?.business || {};
  const r21 = {
    pharmacistInChargeName: receipt.pharmacistInChargeName,
    licenseNumber: receipt.licenseNumber,
    taxRegistrationNumber: receipt.taxRegistrationNumber,
    perItemTaxFlags: s1.data?.data?.items?.map(i => ({ name: i.name, isTaxable: i.isTaxable, priceIncludesTax: i.priceIncludesTax }))
  };
  output.R21 = r21;
  recordResult('R21', r21.pharmacistInChargeName && r21.licenseNumber && r21.taxRegistrationNumber ? 'PASS' : 'FAIL',
    'API supplies PIC/licence/TRN and per-line tax flags; printed receipt rendering requires visual check');

  writeEvidence('tax_money.json', output);
  console.log('TAX_SCENARIOS_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
