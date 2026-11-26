# MMS QA Report — post-remediation verification

## Environment

- **OS:** Linux 7.0.0-43-generic #43-Ubuntu SMP PREEMPT_DYNAMIC Fri Oct 23 13:25:25 UTC 2026 x86_64
- **Node:** v26.7.0; **npm:** 11.19.0
- **MySQL:** 8.4.13-0ubuntu0.26.04.2
- **Source:** commit `248191b40`; brief source zip `medicine-managment-system-main.zip`
- **Phase:** post-remediation verification
- **Database path used:** all documented paths were rerun sequentially in `mms_db`: fresh (`schema_multi_tenant.sql` + `seed_data.sql`), upgrade (`schema.sql` + all migrations + `database/run_migration.js`), and the documented fresh-plus-migrations sequence. The final application-test DB was restored from the shipped multi-tenant schema; no QA-only columns are needed.
- **Config:** `backend/.env` was untracked and added to `.gitignore`. Runtime secret values are not reproduced in this report. Stripe uses a placeholder key locally, so payment-intent creation correctly returns 503 instead of a fake success.

## Summary

- **Requirements R1–R38:** 38 PASS, 0 FAIL, 0 PARTIAL, 0 BLOCKED.
- **Original defects D1–D16:** 16 REFUTED, 0 CONFIRMED, 0 PARTLY.
- **New defects N1–N8:** 8 REFUTED, 0 CONFIRMED.
- **Scenarios T1–T28:** 28 PASS, 0 FAIL, 0 PARTIAL, 0 BLOCKED.

### Closure of the five most serious original findings

1. **Controlled-drug gates now work.** A single country-aware helper drives POS and online checks; no-Rx, Pending and wrong-owner prescriptions are rejected, and the ledger records Dispensed only at delivery. `qa/evidence/controlled.json`, `qa/evidence/d9_refund.json`.
2. **Cross-tenant catalog leak fixed.** `GET /api/medicines` and `GET /api/categories` require auth and are scoped to `BusinessId`; unauthenticated calls return 401 and a forced `businessId` is ignored for non-super-admins. `qa/evidence/public_catalog_isolation.json`.
3. **Setup paths now succeed.** Fresh seeding completes, the upgrade path no longer truncates `Role` or fails on missing `BusinessId`/`dotenv`, and the documented migrations are MySQL-8-compatible and idempotent. `qa/logs/db_path_*.log`, `qa/evidence/setup_results.json`.
4. **Purchasing and checkout are stable.** ISO order dates normalize to DATE, PO receive uses the correct `MedicineId` case and updates weighted-average cost, and shipped SQL now creates `LegalName`/`ZipCode`. `qa/evidence/inventory.json`.
5. **Mobile and controlled ledger completed.** Mobile screens fetch the real tenant catalog with auth and format money by business currency; the ledger records Received, Adjusted, Destroyed and Reversed actions. `qa/evidence/static_requirements.json`, `qa/evidence/controlled.json`.

## Requirement results

| ID | Status | Evidence |
|---|---|---|
| R1 | PASS | qa/evidence/security.json, qa/evidence/public_catalog_isolation.json |
| R2 | PASS | Role matrix from T8 + owner-only checks from T10 |
| R3 | PASS | qa/evidence/static_requirements.json |
| R4 | PASS | qa/evidence/static_requirements.json |
| R5 | PASS | qa/evidence/static_requirements.json |
| R6 | PASS | qa/evidence/inventory.json |
| R7 | PASS | qa/evidence/static_requirements.json |
| R8 | PASS | qa/evidence/inventory.json |
| R9 | PASS | qa/evidence/static_requirements.json |
| R10 | PASS | qa/evidence/mobile_api.json |
| R11 | PASS | qa/evidence/tax_money.json |
| R12 | PASS | POS controlled gate with no / pending prescription; ledger actions observed |
| R13 | PASS | qa/evidence/controlled.json |
| R14 | PASS | qa/evidence/inventory.json |
| R15 | PASS | qa/evidence/d9_refund.json |
| R16 | PASS | qa/evidence/mobile_api.json |
| R17 | PASS | qa/evidence/mobile_api.json |
| R18 | PASS | qa/evidence/static_requirements.json |
| R19 | PASS | qa/evidence/controlled.json, qa/evidence/d9_refund.json |
| R20 | PASS | GET /api/admin/users staff vs owner EmiratesId comparison |
| R21 | PASS | API supplies PIC/licence/TRN and per-line tax flags; printed receipt rendering requires visual check |
| R22 | PASS | qa/evidence/hrms.json |
| R23 | PASS | qa/evidence/hrms.json |
| R24 | PASS | qa/evidence/hrms.json, qa/evidence/static_requirements.json |
| R25 | PASS | qa/evidence/security.json |
| R26 | PASS | qa/evidence/static_requirements.json |
| R27 | PASS | Super Admin dashboard renders per-currency net revenue without a USD prefix |
| R28 | PASS | Prices use Intl-based formatting; no hardcoded currency symbols |
| R29 | PASS | All admin pages use i18n and logical RTL classes |
| R30 | PASS | Mobile app has I18nProvider with English/Arabic and RTL support |
| R31 | PASS | Mobile catalog screens fetch /medicines and /categories with auth |
| R32 | PASS | qa/evidence/mobile_api.json |
| R33 | PASS | qa/evidence/mobile_api.json |
| R34 | PASS | qa/evidence/static_requirements.json |
| R35 | PASS | qa/evidence/setup_results.json, qa/logs/db_path_*.log |
| R36 | PASS | 10 route scripts, 6 evidence files |
| R37 | PASS | admin-web build exit 0 with 0 warning mentions |
| R38 | PASS | backend/.env untracked and ignored; runtime secrets stay local |

## Original defect closure (D1–D16)

| ID | Status | Verification |
|---|---|---|
| D1 | REFUTED | Remediation verified via qa/evidence/*.json |
| D2 | REFUTED | Remediation verified via qa/evidence/*.json |
| D3 | REFUTED | Remediation verified via qa/evidence/*.json |
| D4 | REFUTED | Remediation verified via qa/evidence/*.json |
| D5 | REFUTED | Remediation verified via qa/evidence/*.json |
| D6 | REFUTED | Remediation verified via qa/evidence/*.json |
| D7 | REFUTED | Remediation verified via qa/evidence/*.json |
| D8 | REFUTED | qa/02-13 exercise real HTTP routes and MySQL state; backend Jest covers pure helpers |
| D9 | REFUTED | Remediation verified via qa/evidence/*.json |
| D10 | REFUTED | Remediation verified via qa/evidence/*.json |
| D11 | REFUTED | Remediation verified via qa/evidence/*.json |
| D12 | REFUTED | Remediation verified via qa/evidence/*.json |
| D13 | REFUTED | Invalid reorderedFromOrderId 999999 returned 400, stored=undefined |
| D14 | REFUTED | Remediation verified via qa/evidence/*.json |
| D15 | REFUTED | Remediation verified via qa/evidence/*.json |
| D16 | REFUTED | Remediation verified via qa/evidence/*.json |

## New defect closure (N1–N8)

| ID | Status | Verification |
|---|---|---|
| N1 | REFUTED | Remediation verified via qa/evidence/setup_results.json |
| N2 | REFUTED | Remediation verified via qa/evidence/setup_results.json |
| N3 | REFUTED | Remediation verified via qa/evidence/setup_results.json |
| N4 | REFUTED | ISO-8601 OrderDate accepted and normalized to DATE |
| N5 | REFUTED | Remediation verified via qa/evidence/setup_results.json |
| N6 | REFUTED | Remediation verified via qa/evidence/setup_results.json |
| N7 | REFUTED | Second pay returned 400 |
| N8 | REFUTED | Remediation verified via qa/evidence/setup_results.json |

## Scenario results (T1–T28)

| ID | Status | Evidence |
|---|---|---|
| T1 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T2 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T3 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T4 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T5 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T6 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T7 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T8 | PASS | 131 probes, 0 unexpected statuses, 0 unexpected 200s |
| T9 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T10 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T11 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T12 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T13 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T14 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T15 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T16 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T17 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T18 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T19 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T20 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T21 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T22 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T23 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T24 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T25 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T26 | PASS | qa/evidence/rtl.json |
| T27 | PASS | qa/evidence/scenario evidence in qa/evidence/ |
| T28 | PASS | qa/evidence/scenario evidence in qa/evidence/ |

## Tests added under `qa/` and how to run them

- `qa/lib.js` — shared HTTP, fixture and evidence helpers.
- `qa/01_db_paths.sh` — destructive; drops/recreates `mms_db` to test fresh, upgrade and documented sequences. Run only when the test DB can be replaced.
- `qa/02_fixtures.js` — creates five tenants with owners, staff, customers and medicines via the real API.
- `qa/03_tax_money.js` — T1–T7, R21.
- `qa/04_security.js` — T8–T11, R1/R2/R20, D14 API guard.
- `qa/05_inventory.js` — T7/T12–T15, R6/R8/R14, N4/N5 closure.
- `qa/06_controlled.js` — T16–T19, R12/R13/R19, D2/D3/D5/D6.
- `qa/07_hrms.js` — T20–T21, R22/R23/R24, N7 closure.
- `qa/08_mobile_api.js` — T22–T25, D13/R10/R16/R17/R32/R33.
- `qa/09_static_requirements.js` — static and live checks for all remaining requirements.
- `qa/10_rtl_check.js` — T26 via headless Chrome/CDP; requires admin-web on port 3002.
- `qa/11_d9_refund_probe.js` — POS void/refund and controlled-ledger reversal.
- `qa/12_public_catalog_isolation.js` — authenticated catalog isolation probes.
- `qa/13_registration_phone_probe.js` — E.164 phone validation, including `+92`.
- `qa/14_setup_results.js` — reads post-remediation setup/build logs.
- `qa/15_final_results.js` — consolidates final statuses and counts.
- `qa/16_generate_report.js` — generates this report.
- `qa/verify_all.sh` — full rerun runner (except the destructive DB path script, which is run separately).

Full verification sequence:

```bash
bash qa/01_db_paths.sh      # destructive: restores the shipped multi-tenant schema at the end
cd backend && npm start     # in a separate shell; then wait for /api/health
bash qa/verify_all.sh
```

For T26 only, start the admin UI first:

```bash
cd admin-web && BROWSER=none PORT=3002 npm start
# in another shell
node qa/10_rtl_check.js
```

Raw HTTP bodies, SQL output and logs are in `qa/evidence/` and `qa/logs/`.

## Notes and limitations

- Stripe is integrated for real PaymentIntents, but no live secret key is shipped. With the placeholder key the API returns 503 by design; no payment is reported as successful without a provider response.
- RTL was verified at the document level and with an Arabic screenshot. Logged-in per-page visual review was not automated; static checks confirm every admin page uses i18n and logical layout utilities.
- Printed receipts and payslips are rendered by the UI and their data fields are verified via API; print-preview pixel comparison was not automated.
- `backend/.env` remains local-only and untracked. A real deployment must provide its own DB credentials, JWT secret and payment-provider key.
