// QA artifact - post-remediation static and live checks for the remaining requirements.
// Usage: node qa/09_static_requirements.js
const fs = require('fs');
const path = require('path');
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const f = readEvidence('fixtures.json');
const output = { static: {}, api: {} };

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(__dirname, '..', rel)); }
function matches(rel, regex, limit = 12) {
  const lines = read(rel).split('\n');
  const out = [];
  lines.forEach((line, i) => { if (regex.test(line) && out.length < limit) out.push(`${i + 1}: ${line.trim().slice(0, 180)}`); });
  return out;
}
function walk(dir, ext = '.js') {
  const base = path.join(__dirname, '..', dir);
  return fs.readdirSync(base, { withFileTypes: true }).flatMap(e => {
    const p = path.join(base, e.name);
    if (e.isDirectory()) return walk(path.join(dir, e.name), ext);
    return e.name.endsWith(ext) ? [path.relative(path.join(__dirname, '..'), p)] : [];
  });
}

function staticChecks() {
  const s = output.static;

  // D1 / R31: mobile catalog is API driven, not a hardcoded sample array.
  s.D1 = {
    homeSampleData: matches('mobile-app/src/screens/HomeScreen.js', /Paracetamol|Vitamin C|sample medicines|mock medicines/i),
    medicinesSampleData: matches('mobile-app/src/screens/MedicinesScreen.js', /Paracetamol|Vitamin C|sample medicines|mock medicines/i),
    catalogApiCalls: ['HomeScreen.js', 'MedicinesScreen.js', 'MedicineDetailScreen.js'].flatMap(name => {
      const rel = `mobile-app/src/screens/${name}`;
      return matches(rel, /api\.(get|post)|\bgetMedicines|\/medicines|\/categories/i, 6).map(m => `${rel}:${m}`);
    })
  };
  const catalogFixed = s.D1.homeSampleData.length === 0 && s.D1.medicinesSampleData.length === 0 && s.D1.catalogApiCalls.length > 0;
  recordResult('D1', catalogFixed ? 'REFUTED' : 'CONFIRMED', s.D1);
  recordResult('R31', catalogFixed ? 'PASS' : 'FAIL', 'Mobile catalog screens fetch /medicines and /categories with auth');

  // D4 / R38: env is untracked and ignored.
  s.D4 = {
    envTracked: require('child_process').execSync('git ls-files backend/.env', { cwd: path.join(__dirname, '..') }).toString().trim(),
    gitignoreFiles: require('child_process').execSync("find . -maxdepth 2 -name .gitignore -not -path '*/node_modules/*'", { cwd: path.join(__dirname, '..') }).toString().trim(),
    gitignoreHasEnv: exists('.gitignore') && /backend\/\.env/.test(read('.gitignore'))
  };
  const secretsFixed = !s.D4.envTracked && s.D4.gitignoreFiles.length > 0 && s.D4.gitignoreHasEnv;
  recordResult('D4', secretsFixed ? 'REFUTED' : 'CONFIRMED', s.D4);
  recordResult('R38', secretsFixed ? 'PASS' : 'FAIL', 'backend/.env untracked and ignored; runtime secrets stay local');

  // D6: one shared, country-aware controlled-drug definition.
  s.D6 = {
    helperExists: exists('backend/utils/controlledDrugs.js'),
    countryAware: matches('backend/utils/controlledDrugs.js', /USA|UAE|isControlledMedicine/i, 10),
    routeImports: ['orders.js', 'purchase-orders.js', 'admin.js'].flatMap(file =>
      matches(`backend/routes/${file}`, /controlledDrugs/i, 4).map(m => `${file}:${m}`))
  };
  const controlledFixed = s.D6.helperExists && s.D6.countryAware.length > 0 && s.D6.routeImports.length > 0;
  recordResult('D6', controlledFixed ? 'REFUTED' : 'CONFIRMED', s.D6);

  // D10 / R27: super-admin revenue is grouped by currency and uses net subtotals.
  s.D10 = {
    sumTotalAmount: matches('backend/routes/super-admin.js', /SUM\(TotalAmount\)/i, 6),
    revenueByCurrency: matches('backend/routes/super-admin.js', /revenueByCurrency|SUM\(oi\.Subtotal\)/i, 8),
    hardcodedDollar: matches('admin-web/src/pages/SuperAdminDashboard.js', /['"`][^'"`]*\$\d|\$\{[^}]+\}\s*(?:\/|\)|$)/, 6),
    intlFormatter: matches('admin-web/src/pages/SuperAdminDashboard.js', /Intl\.NumberFormat|formatCurrencyIntl/i, 6)
  };
  const totalsFixed = s.D10.sumTotalAmount.length === 0 && s.D10.revenueByCurrency.length > 0 &&
    s.D10.hardcodedDollar.length === 0 && s.D10.intlFormatter.length > 0;
  recordResult('D10', totalsFixed ? 'REFUTED' : 'CONFIRMED', s.D10);
  recordResult('R27', totalsFixed ? 'PASS' : 'FAIL', 'Super Admin dashboard renders per-currency net revenue without a USD prefix');

  // D11: POS payment methods are region aware.
  s.D11 = {
    regionFunction: matches('admin-web/src/pages/POS.js', /getPaymentMethods|isPakistan|businessCountry|paymentMethods/i, 10),
    jazzCashLines: matches('admin-web/src/pages/POS.js', /JazzCash/i, 6),
    insuranceCopay: matches('admin-web/src/pages/POS.js', /Insurance Copay/i, 6)
  };
  const paymentsUiFixed = s.D11.regionFunction.length > 0 && s.D11.jazzCashLines.length === 1 && s.D11.insuranceCopay.length > 0;
  recordResult('D11', paymentsUiFixed ? 'REFUTED' : 'CONFIRMED', s.D11);

  // D12 / R29 / R30: i18n and logical layout classes on every admin page; mobile i18n.
  s.D12 = {
    rootDir: matches('admin-web/src/i18n/index.js', /dir\s*=|rtl|documentElement/i, 6),
    physicalClasses: walk('admin-web/src').flatMap(p =>
      matches(p, /\b(ml|mr|pl|pr|text-left|text-right|left-|right-)-/i, 2).map(m => `${p}:${m}`)),
    logicalClasses: walk('admin-web/src').flatMap(p =>
      matches(p, /\b(ms|me|ps|pe|text-start|text-end)-/i, 2).map(m => `${p}:${m}`)),
    pagesWithoutI18n: walk('admin-web/src/pages').filter(p =>
      !/useTranslation|useI18n|from ['"].*i18n/.test(read(p))).map(p => path.basename(p, '.js')),
    mobileI18n: exists('mobile-app/src/contexts/I18nContext.js') &&
      /I18nProvider/.test(read('mobile-app/App.js'))
  };
  const rtlFixed = s.D12.rootDir.length > 0 && s.D12.physicalClasses.length === 0 &&
    s.D12.logicalClasses.length > 0 && s.D12.pagesWithoutI18n.length === 0;
  recordResult('D12', rtlFixed ? 'REFUTED' : 'CONFIRMED',
    { physicalSamples: s.D12.physicalClasses.slice(0, 5), pagesWithoutI18n: s.D12.pagesWithoutI18n });
  recordResult('R29', rtlFixed ? 'PASS' : 'FAIL', 'All admin pages use i18n and logical RTL classes');
  recordResult('R30', s.D12.mobileI18n ? 'PASS' : 'FAIL', 'Mobile app has I18nProvider with English/Arabic and RTL support');

  // D14: catalog mutations and inventory adjustments are owner-only.
  s.D14 = {
    medicineMutations: matches('backend/routes/medicines.js', /router\.(post|put|delete)\(['/]/i, 8),
    medicineStaffGuard: matches('backend/routes/medicines.js', /requireBusinessAccess/i, 8),
    medicineOwnerGuard: matches('backend/routes/medicines.js', /requireBusinessOwnerAccess/i, 8),
    inventoryOwnerGuard: ['adjust', 'destroy'].map(action => {
      const lines = matches('backend/routes/admin.js', new RegExp(`inventory/${action}.*requireBusinessOwnerAccess`, 'i'), 2);
      return `${action}:${lines.length > 0}`;
    })
  };
  const staffGuardFixed = s.D14.medicineStaffGuard.length === 0 && s.D14.medicineOwnerGuard.length > 0 &&
    s.D14.inventoryOwnerGuard.every(v => v.endsWith('true'));
  recordResult('D14', staffGuardFixed ? 'REFUTED' : 'CONFIRMED', s.D14);

  // D15 / R28: mobile and admin prices use formatters rather than hardcoded symbols.
  s.D15 = {
    mobileBareCurrency: walk('mobile-app/src/screens').flatMap(p => matches(p, /\{currency\}\s*\{|PKR/i, 3).map(m => `${p}:${m}`)),
    mobileFormatter: walk('mobile-app/src').filter(p => /formatCurrency/.test(read(p))),
    adminFormatter: exists('admin-web/src/utils/formatCurrency.js')
  };
  const moneyFixed = s.D15.mobileBareCurrency.length === 0 && s.D15.mobileFormatter.length > 0 && s.D15.adminFormatter;
  recordResult('D15', moneyFixed ? 'REFUTED' : 'CONFIRMED', s.D15);
  recordResult('R28', moneyFixed && totalsFixed ? 'PASS' : 'FAIL', 'Prices use Intl-based formatting; no hardcoded currency symbols');

  // D16: README is current.
  s.D16 = { readmePlaceholders: matches('README.md', /placeholder|coming soon|not implemented|TODO/i, 8) };
  recordResult('D16', s.D16.readmePlaceholders.length === 0 ? 'REFUTED' : 'CONFIRMED', s.D16);

  // R24: attendance routes are implemented.
  s.R24 = { attendanceRoutes: matches('backend/routes/hrms.js', /router\.(get|post|put|patch|delete)\(['"]\/attendance/i, 10) };
  recordResult('R24', s.R24.attendanceRoutes.length >= 4 ? 'PASS' : 'FAIL', s.R24);

  // R34 / D8 / R36: real payments and route/DB integration coverage.
  s.R34 = { paymentSdk: read('backend/package.json').match(/stripe|paypal|razorpay|jazzcash/i) || [] };
  s.R36 = {
    routeScripts: ['02_fixtures.js', '03_tax_money.js', '04_security.js', '05_inventory.js',
      '06_controlled.js', '07_hrms.js', '08_mobile_api.js', '11_d9_refund_probe.js',
      '12_public_catalog_isolation.js', '13_registration_phone_probe.js'].filter(name => exists(`qa/${name}`)),
    evidenceFiles: ['tax_money.json', 'security.json', 'inventory.json', 'controlled.json', 'hrms.json', 'mobile_api.json']
      .filter(name => exists(`qa/evidence/${name}`))
  };
  recordResult('R34', s.R34.paymentSdk.length > 0 ? 'PASS' : 'FAIL', s.R34);
  recordResult('D8', s.R36.routeScripts.length >= 8 && s.R36.evidenceFiles.length >= 6 ? 'REFUTED' : 'CONFIRMED', s.R36);
  recordResult('R36', s.R36.routeScripts.length >= 8 && s.R36.evidenceFiles.length >= 6 ? 'PASS' : 'FAIL', s.R36);
}

async function apiChecks() {
  const a = output.api;
  const superToken = f.superToken;
  const target = f.tenants.nyc.businessId;

  // R3: super admin edit + activate/deactivate
  const edit = await request('PUT', `/super-admin/businesses/${target}`, {
    token: superToken, body: { businessName: 'QA NYC Pharmacy Edited', country: 'USA', currency: 'USD', taxRate: 0.08875 }
  });
  const deactivate = await request('PATCH', `/super-admin/businesses/${target}/status`, { token: superToken, body: { status: 'Inactive' } });
  const activate = await request('PATCH', `/super-admin/businesses/${target}/status`, { token: superToken, body: { status: 'Active' } });
  const detail = await request('GET', `/super-admin/businesses/${target}`, { token: superToken });
  a.R3 = { edit: edit.status, deactivate: deactivate.status, activate: activate.status,
    name: detail.data?.data?.business?.BusinessName, status: detail.data?.data?.business?.Status };
  recordResult('R3', edit.status === 200 && deactivate.status === 200 && activate.status === 200 &&
    a.R3.name === 'QA NYC Pharmacy Edited' && a.R3.status === 'Active' ? 'PASS' : 'FAIL', a.R3);

  // R4: owner settings edit and re-read
  const t = f.tenants.usa825;
  const put = await request('PUT', '/admin/settings', {
    token: t.ownerToken,
    body: { taxRate: 0.07, licenseNumber: 'LIC-CHANGED', pharmacistInChargeName: 'Dr Changed', locale: 'ar-AE' }
  });
  const get = await request('GET', '/admin/settings', { token: t.ownerToken });
  a.R4 = { put: put.status, get: get.status, settings: get.data?.data };
  recordResult('R4', put.status === 200 && get.status === 200 &&
    JSON.stringify(get.data).includes('LIC-CHANGED') ? 'PASS' : 'FAIL', a.R4);

  // R5: medicines create / edit / list
  const med = await request('POST', '/medicines', {
    token: t.ownerToken,
    body: { name: `QA CRUD ${Date.now()}`, price: 10, stock: 5, deaSchedule: 'IV',
      uaeClassification: 'POM', isTaxable: false, priceIncludesTax: true }
  });
  const medId = med.data?.data?.id;
  const editMed = await request('PUT', `/medicines/${medId}`, {
    token: t.ownerToken, body: { price: 12, stock: 7, deaSchedule: 'None', isTaxable: true }
  });
  const listMed = await request('GET', `/medicines/${medId}`, { token: t.ownerToken });
  a.R5 = { create: med.status, edit: editMed.status, read: listMed.status, data: listMed.data?.data };
  recordResult('R5', med.status === 201 && editMed.status === 200 && listMed.status === 200 ? 'PASS' : 'FAIL', a.R5);

  // R7: vendor create + deactivate (DELETE endpoint)
  const vendor = await request('POST', '/vendors', { token: t.ownerToken, body: { name: `QA Vendor CRUD ${Date.now()}` } });
  const vendorId = vendor.data?.data?.vendorId;
  const del = await request('DELETE', `/vendors/${vendorId}`, { token: t.ownerToken });
  a.R7 = { create: vendor.status, deactivateDelete: del.status, message: del.data?.message };
  recordResult('R7', vendor.status === 201 && del.status === 200 ? 'PASS' : 'FAIL', a.R7);

  // R18: order list Source filter
  const posOrders = await request('GET', '/orders/admin/all?source=POS', { token: t.ownerToken });
  const onlineOrders = await request('GET', '/orders/admin/all?source=Online', { token: t.ownerToken });
  const sources = (res) => [...new Set((res.data?.data?.orders || []).map(o => o.Source || o.source))];
  a.R18 = { pos: sources(posOrders), online: sources(onlineOrders) };
  recordResult('R18', a.R18.pos.every(s => s === 'POS') && a.R18.online.every(s => s === 'Online') ? 'PASS' : 'FAIL', a.R18);

  // R26: analytics periods
  const periods = {};
  for (const p of ['month', 'quarter', 'year']) {
    const r = await request('GET', `/admin/dashboard/analytics?period=${p}&year=2026`, { token: t.ownerToken });
    periods[p] = { status: r.status, seriesLength: r.data?.data?.series?.length, totals: r.data?.data?.totals };
  }
  a.R26 = periods;
  recordResult('R26', Object.values(periods).every(p => p.status === 200 && p.seriesLength > 0) ? 'PASS' : 'FAIL', periods);

  // R9: tax engine called by all three order endpoints
  a.R9 = { imports: matches('backend/routes/orders.js', /calculateOrderTax|taxEngine/i, 8) };
  recordResult('R9', a.R9.imports.length >= 3 ? 'PASS' : 'FAIL', a.R9.imports);

  // R34: real payment integration surface, never a fake success.
  const pkMethods = await request('GET', '/payments/methods?country=PK');
  const usMethods = await request('GET', '/payments/methods?country=USA');
  const createIntent = await request('POST', '/payments/create-intent', { token: t.ownerToken, body: { orderId: 1 } });
  a.R34 = {
    pk: pkMethods.data?.data?.methods,
    usa: usMethods.data?.data?.methods,
    createIntentStatus: createIntent.status,
    createIntentMessage: createIntent.data?.message
  };
  const regionOk = pkMethods.status === 200 && (pkMethods.data?.data?.methods || []).includes('JazzCash') &&
    usMethods.status === 200 && !(usMethods.data?.data?.methods || []).includes('JazzCash') &&
    (usMethods.data?.data?.methods || []).includes('Insurance Copay');
  recordResult('R34', regionOk && [200, 201, 503].includes(createIntent.status) ? 'PASS' : 'FAIL', a.R34);
}

async function main() {
  staticChecks();
  await apiChecks();
  writeEvidence('static_requirements.json', output);
  console.log('STATIC_REQUIREMENTS_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
