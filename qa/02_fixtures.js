// QA artifact - create tenants, users, and medicine fixtures via the real API.
// Usage: node qa/02_fixtures.js
const { request, login, writeEvidence } = require('./lib');

const PASSWORD = 'QaPass123';

const tenants = [
  {
    key: 'usa825', businessName: 'QA USA Pharmacy', businessCode: 'QAUSA001',
    ownerName: 'QA USA Owner', email: 'owner.qausa001@qa.local', phone: '92300000001',
    country: 'USA', currency: 'USD', taxEnabled: true, taxRate: 0.0825,
    taxRegistrationNumber: 'EIN-QA-001', licenseNumber: 'LIC-USA-001',
    licenseAuthority: 'DEA', locale: 'en-US', timezone: 'America/New_York',
    pharmacistInChargeName: 'Dr QA Pharmacist'
  },
  {
    key: 'uae', businessName: 'QA UAE Pharmacy', businessCode: 'QA UAE002',
    ownerName: 'QA UAE Owner', email: 'owner.qauae002@qa.local', phone: '92300000002',
    country: 'UAE', currency: 'AED', taxEnabled: true, taxRate: 0.05,
    taxRegistrationNumber: 'TRN-QA-002', licenseNumber: 'LIC-UAE-002',
    licenseAuthority: 'DHA', locale: 'ar-AE', timezone: 'Asia/Dubai',
    pharmacistInChargeName: 'Dr QA UAE Pharmacist'
  },
  {
    key: 'notax', businessName: 'QA Tax-Free Pharmacy', businessCode: 'QANTX003',
    ownerName: 'QA NoTax Owner', email: 'owner.qantx003@qa.local', phone: '92300000003',
    country: 'USA', currency: 'USD', taxEnabled: false, taxRate: 0,
    taxRegistrationNumber: 'EIN-QA-003', licenseNumber: 'LIC-NT-003',
    licenseAuthority: 'DEA', locale: 'en-US', timezone: 'America/New_York',
    pharmacistInChargeName: 'Dr QA NoTax'
  },
  {
    key: 'usa08', businessName: 'QA USA 8 Percent', businessCode: 'QAUSA008',
    ownerName: 'QA USA8 Owner', email: 'owner.qausa008@qa.local', phone: '92300000008',
    country: 'USA', currency: 'USD', taxEnabled: true, taxRate: 0.08,
    taxRegistrationNumber: 'EIN-QA-008', licenseNumber: 'LIC-USA-008',
    licenseAuthority: 'DEA', locale: 'en-US', timezone: 'America/New_York',
    pharmacistInChargeName: 'Dr QA USA8'
  },
  {
    key: 'nyc', businessName: 'QA NYC Pharmacy', businessCode: 'QANYC009',
    ownerName: 'QA NYC Owner', email: 'owner.qanyc009@qa.local', phone: '92300000009',
    country: 'USA', currency: 'USD', taxEnabled: true, taxRate: 0.08875,
    taxRegistrationNumber: 'EIN-QA-009', licenseNumber: 'LIC-NYC-009',
    licenseAuthority: 'DEA', locale: 'en-US', timezone: 'America/New_York',
    pharmacistInChargeName: 'Dr QA NYC'
  }
];

async function main() {
  const superToken = await login('superadmin@mms.com', 'password');
  const out = { superToken, tenants: {}, createdAt: new Date().toISOString(), password: PASSWORD };

  for (const spec of tenants) {
    const created = await request('POST', '/super-admin/businesses', {
      token: superToken,
      body: { ...spec, subscriptionPlan: 'Premium', password: PASSWORD }
    });
    if (created.status !== 201) {
      throw new Error(`business create failed for ${spec.key}: ${created.status} ${created.raw}`);
    }
    const businessId = created.data.data.businessId;
    const ownerToken = await login(spec.email, PASSWORD);

    const staffEmail = `staff.${spec.key}@qa.local`;
    const staffRes = await request('POST', '/admin/users', {
      token: ownerToken,
      body: { name: `QA ${spec.key} Staff`, email: staffEmail, phone: spec.phone, password: PASSWORD, role: 'STAFF' }
    });
    if (staffRes.status !== 201) throw new Error(`staff create failed: ${staffRes.raw}`);
    const staffToken = await login(staffEmail, PASSWORD);

    const customers = {};
    for (const suffix of ['c1', 'c2']) {
      const email = `customer.${suffix}.${spec.key}@qa.local`;
      const reg = await request('POST', '/auth/register', {
        body: {
          name: `QA ${spec.key} ${suffix}`, email, phone: spec.phone,
          password: PASSWORD, businessCode: spec.businessCode,
          ...(spec.country === 'UAE' ? { emiratesId: '784-1990-1234567-1', nationalIdLast4: '1234' } : {})
        }
      });
      if (reg.status !== 201) throw new Error(`customer register failed: ${reg.raw}`);
      customers[suffix] = {
        userId: reg.data.data.user.id,
        email,
        token: reg.data.data.token,
        emiratesId: reg.data.data.user.emiratesId
      };
    }

    const catsRes = await request('GET', '/categories', { token: ownerToken });
    const cats = catsRes.data?.data || [];
    const categoryId = Array.isArray(cats) && cats.length ? cats[0].CategoryId || cats[0].categoryId : null;

    const meds = {};
    async function addMed(key, name, price, stock, extra = {}) {
      const res = await request('POST', '/medicines', {
        token: ownerToken,
        body: {
          name, categoryId: categoryId || undefined, description: `QA fixture ${name}`,
          price, stock, expiryDate: '2030-12-31', manufacturer: 'QAManufacturer', ...extra
        }
      });
      if (res.status !== 201) throw new Error(`medicine create failed ${name}: ${res.raw}`);
      meds[key] = { id: res.data.data.id, name, price, stock };
      return meds[key];
    }

    if (spec.key === 'usa825') {
      await addMed('taxable20', 'QA Taxable 20', 20, 100, { isTaxable: true, priceIncludesTax: false });
      await addMed('exempt50', 'QA Exempt 50', 50, 100, { isTaxable: false, priceIncludesTax: false });
      await addMed('schedule2', 'QA Schedule II Morphine', 12, 10, { requiresPrescription: true, deaSchedule: 'II' });
      await addMed('normal', 'QA Normal Item', 30, 50);
      await addMed('lowstock', 'QA Low Stock Item', 9, 2);
    } else if (spec.key === 'uae') {
      await addMed('inclusive105', 'QA VAT Inclusive 105', 105, 100, { isTaxable: true, priceIncludesTax: true });
      await addMed('narcotic', 'QA Narcotic Item', 40, 10, { requiresPrescription: true, uaeClassification: 'Narcotic' });
      await addMed('controlled', 'QA Controlled Item', 25, 10, { requiresPrescription: true, uaeClassification: 'Controlled' });
    } else if (spec.key === 'notax') {
      await addMed('plain100', 'QA NoTax 100', 100, 100);
    } else if (spec.key === 'usa08') {
      await addMed('taxable20', 'QA T1 Taxable 20', 20, 100, { isTaxable: true });
      await addMed('exempt50', 'QA T1 Exempt 50', 50, 100, { isTaxable: false });
      await addMed('normal100', 'QA T5 Normal 100', 100, 100);
    } else if (spec.key === 'nyc') {
      await addMed('hundred', 'QA NYC 100', 100, 100);
    }

    out.tenants[spec.key] = {
      businessId, spec, ownerEmail: spec.email, ownerToken,
      staffEmail, staffToken, customers, categoryId, medicines: meds
    };
    console.log(`tenant ${spec.key}: businessId=${businessId} medicines=${Object.keys(meds).length}`);
  }

  writeEvidence('fixtures.json', out);
  console.log('FIXTURES_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
