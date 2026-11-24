// QA artifact - international phone validation probe (N3).
// Usage: node qa/13_registration_phone_probe.js
const { request, writeEvidence, recordResult } = require('./lib');

async function main() {
  const stamp = Date.now();
  const international = await request('POST', '/auth/register', {
    body: { name: 'QA Phone Plus', email: `phone.${stamp}@qa.local`, password: 'QaPass123',
      businessCode: 'QAUSA008', phone: '+92300000002' }
  });
  const invalid = await request('POST', '/auth/register', {
    body: { name: 'QA Phone Invalid', email: `badphone.${stamp}@qa.local`, password: 'QaPass123',
      businessCode: 'QAUSA008', phone: 'not-a-phone' }
  });
  const storedPhone = international.data?.data?.user?.phone;
  const out = {
    international: { status: international.status, storedPhone },
    invalid: { status: invalid.status, message: invalid.data?.message }
  };
  writeEvidence('registration_phone.json', out);
  recordResult('N3', international.status === 201 && storedPhone === '+92300000002' &&
    invalid.status === 400 ? 'REFUTED' : 'CONFIRMED', out);
  console.log('REGISTRATION_PHONE_PROBE_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
