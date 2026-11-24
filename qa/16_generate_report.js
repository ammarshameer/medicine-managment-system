// QA artifact - generate qa/REPORT.md from consolidated post-remediation results.
// Usage: node qa/16_generate_report.js
const fs = require('fs');
const path = require('path');
const { readEvidence } = require('./lib');

function rows(map) {
  return Object.entries(map).map(([id, [status, evidence]]) =>
    `| ${id} | ${status} | ${String(evidence).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`).join('\n');
}

function main() {
  const f = readEvidence('final_results.json');
  const c = f.counts;
  const md = `# MMS QA Report — post-remediation verification

## Environment

- **OS:** ${f.environment.os}
- **Node:** ${f.environment.node}; **npm:** ${f.environment.npm}
- **MySQL:** ${f.environment.mysql}
- **Source:** commit \`${f.environment.commit}\`; brief source zip \`${f.environment.sourceZip}\`
- **Phase:** ${f.environment.phase}
- **Database path used:** all documented paths were rerun sequentially in \`mms_db\`: fresh (\`schema_multi_tenant.sql\` + \`seed_data.sql\`), upgrade (\`schema.sql\` + all migrations + \`database/run_migration.js\`), and the documented fresh-plus-migrations sequence. The final application-test DB was restored from the shipped multi-tenant schema; no QA-only columns are needed.
- **Config:** \`backend/.env\` was untracked and added to \`.gitignore\`. Runtime secret values are not reproduced in this report. Stripe uses a placeholder key locally, so payment-intent creation correctly returns 503 instead of a fake success.

## Summary

- **Requirements R1–R38:** ${c.requirements.PASS} PASS, ${c.requirements.FAIL || 0} FAIL, ${c.requirements.PARTIAL || 0} PARTIAL, ${c.requirements.BLOCKED || 0} BLOCKED.
- **Original defects D1–D16:** ${c.defects.REFUTED || 0} REFUTED, ${c.defects.CONFIRMED || 0} CONFIRMED, ${c.defects.PARTLY || 0} PARTLY.
- **New defects N1–N8:** ${c.newDefects.REFUTED || 0} REFUTED, ${c.newDefects.CONFIRMED || 0} CONFIRMED.
- **Scenarios T1–T28:** ${c.scenarios.PASS} PASS, ${c.scenarios.FAIL || 0} FAIL, ${c.scenarios.PARTIAL || 0} PARTIAL, ${c.scenarios.BLOCKED || 0} BLOCKED.

### Closure of the five most serious original findings

1. **Controlled-drug gates now work.** A single country-aware helper drives POS and online checks; no-Rx, Pending and wrong-owner prescriptions are rejected, and the ledger records Dispensed only at delivery. \`qa/evidence/controlled.json\`, \`qa/evidence/d9_refund.json\`.
2. **Cross-tenant catalog leak fixed.** \`GET /api/medicines\` and \`GET /api/categories\` require auth and are scoped to \`BusinessId\`; unauthenticated calls return 401 and a forced \`businessId\` is ignored for non-super-admins. \`qa/evidence/public_catalog_isolation.json\`.
3. **Setup paths now succeed.** Fresh seeding completes, the upgrade path no longer truncates \`Role\` or fails on missing \`BusinessId\`/\`dotenv\`, and the documented migrations are MySQL-8-compatible and idempotent. \`qa/logs/db_path_*.log\`, \`qa/evidence/setup_results.json\`.
4. **Purchasing and checkout are stable.** ISO order dates normalize to DATE, PO receive uses the correct \`MedicineId\` case and updates weighted-average cost, and shipped SQL now creates \`LegalName\`/\`ZipCode\`. \`qa/evidence/inventory.json\`.
5. **Mobile and controlled ledger completed.** Mobile screens fetch the real tenant catalog with auth and format money by business currency; the ledger records Received, Adjusted, Destroyed and Reversed actions. \`qa/evidence/static_requirements.json\`, \`qa/evidence/controlled.json\`.

## Requirement results

| ID | Status | Evidence |
|---|---|---|
${rows(f.requirements)}

## Original defect closure (D1–D16)

| ID | Status | Verification |
|---|---|---|
${rows(f.defects)}

## New defect closure (N1–N8)

| ID | Status | Verification |
|---|---|---|
${rows(f.newDefects)}

## Scenario results (T1–T28)

| ID | Status | Evidence |
|---|---|---|
${rows(f.scenarios)}

## Tests added under \`qa/\` and how to run them

- \`qa/lib.js\` — shared HTTP, fixture and evidence helpers.
- \`qa/01_db_paths.sh\` — destructive; drops/recreates \`mms_db\` to test fresh, upgrade and documented sequences. Run only when the test DB can be replaced.
- \`qa/02_fixtures.js\` — creates five tenants with owners, staff, customers and medicines via the real API.
- \`qa/03_tax_money.js\` — T1–T7, R21.
- \`qa/04_security.js\` — T8–T11, R1/R2/R20, D14 API guard.
- \`qa/05_inventory.js\` — T7/T12–T15, R6/R8/R14, N4/N5 closure.
- \`qa/06_controlled.js\` — T16–T19, R12/R13/R19, D2/D3/D5/D6.
- \`qa/07_hrms.js\` — T20–T21, R22/R23/R24, N7 closure.
- \`qa/08_mobile_api.js\` — T22–T25, D13/R10/R16/R17/R32/R33.
- \`qa/09_static_requirements.js\` — static and live checks for all remaining requirements.
- \`qa/10_rtl_check.js\` — T26 via headless Chrome/CDP; requires admin-web on port 3002.
- \`qa/11_d9_refund_probe.js\` — POS void/refund and controlled-ledger reversal.
- \`qa/12_public_catalog_isolation.js\` — authenticated catalog isolation probes.
- \`qa/13_registration_phone_probe.js\` — E.164 phone validation, including \`+92\`.
- \`qa/14_setup_results.js\` — reads post-remediation setup/build logs.
- \`qa/15_final_results.js\` — consolidates final statuses and counts.
- \`qa/16_generate_report.js\` — generates this report.
- \`qa/verify_all.sh\` — full rerun runner (except the destructive DB path script, which is run separately).

Full verification sequence:

\`\`\`bash
bash qa/01_db_paths.sh      # destructive: restores the shipped multi-tenant schema at the end
cd backend && npm start     # in a separate shell; then wait for /api/health
bash qa/verify_all.sh
\`\`\`

For T26 only, start the admin UI first:

\`\`\`bash
cd admin-web && BROWSER=none PORT=3002 npm start
# in another shell
node qa/10_rtl_check.js
\`\`\`

Raw HTTP bodies, SQL output and logs are in \`qa/evidence/\` and \`qa/logs/\`.

## Notes and limitations

- Stripe is integrated for real PaymentIntents, but no live secret key is shipped. With the placeholder key the API returns 503 by design; no payment is reported as successful without a provider response.
- RTL was verified at the document level and with an Arabic screenshot. Logged-in per-page visual review was not automated; static checks confirm every admin page uses i18n and logical layout utilities.
- Printed receipts and payslips are rendered by the UI and their data fields are verified via API; print-preview pixel comparison was not automated.
- \`backend/.env\` remains local-only and untracked. A real deployment must provide its own DB credentials, JWT secret and payment-provider key.
`;
  fs.writeFileSync(path.join(__dirname, 'REPORT.md'), md);
  console.log('REPORT_GENERATED');
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
