# Remediation tracker

Scope: user approved "Fix everything" on 2026-11-24, overriding the earlier report-only constraint.

## Workstreams

| Area | Owner | Scope | Status |
|---|---|---|---|
| Database/setup | subagent `ses_df2631815ffeDGHYpk3GjaEueW` | `database/**` | Completed |
| Backend APIs | subagent `ses_df2631814ffe9BQnYnYiaYsBj7` | `backend/**` except `.env` | Completed |
| Admin web | subagent `ses_df2631811ffd1EAlOOuM63cBwl` | `admin-web/**`, root `README.md` | Completed |
| Mobile app | subagent `ses_df263180bffeaFpprJ2hWauPnU` | `mobile-app/**` | Completed |
| QA re-verification | main session | `qa/**` only | Completed |

## Gap closure checklist

### Requirements
- [x] R1 tenant isolation on every route
- [x] R2 role guards
- [x] R3 super admin create/edit/activate
- [x] R4 owner settings + snapshots
- [x] R5 medicines CRUD
- [x] R6 categories/inventory/low-stock
- [x] R7 vendors CRUD
- [x] R8 purchase orders + weighted average
- [x] R9 single tax engine
- [x] R10 preview-tax used everywhere
- [x] R11 POS sale + stock/log/receipt
- [x] R12 POS controlled gate
- [x] R13 online/prescription orders
- [x] R14 lifecycle + cancel/restock
- [x] R15 POS void/refund/return
- [x] R16 reorder + edit
- [x] R17 customer own orders
- [x] R18 source filter
- [x] R19 controlled ledger complete
- [x] R20 Emirates ID masking
- [x] R21 receipts
- [x] R22 HRMS employees
- [x] R23 payroll + pay once
- [x] R24 attendance
- [x] R25 staff dashboard no financials
- [x] R26 owner analytics
- [x] R27 super admin dashboard
- [x] R28 no hardcoded currency
- [x] R29 Arabic/RTL admin
- [x] R30 mobile i18n/RTL
- [x] R31 mobile real catalog
- [x] R32 mobile register/login
- [x] R33 prescription upload
- [x] R34 real payments
- [x] R35 migrations/fresh install
- [x] R36 route/DB tests
- [x] R37 clean admin build
- [x] R38 secrets handling

### Confirmed defects
- [x] D1 hardcoded mobile catalog
- [x] D2 POS prescription gate
- [x] D3 online prescription check
- [x] D4 secrets
- [x] D5 controlled ledger
- [x] D6 controlled definition/country
- [x] D7 migration path
- [x] D8 tests do not test app
- [x] D9 POS void/refund
- [x] D10 super admin totals
- [x] D11 POS payment buttons
- [x] D12 partial Arabic
- [x] D13 reorder id validation
- [x] D14 staff medicine access decision
- [x] D15 mobile price display
- [x] D16 stale README

### New defects
- [x] N1 seed Country/FK failure
- [x] N2 missing LegalName/ZipCode
- [x] N3 +92 phone rejected
- [x] N4 PO ISO date 500
- [x] N5 PO receive case mismatch
- [x] N6 public catalog tenant leak
- [x] N7 salary double pay
- [x] N8 run_migration dotenv

## Final verification

- Full rerun command: `bash qa/01_db_paths.sh`, then `bash qa/verify_all.sh` with backend on port 5000 and admin-web on port 3002.
- Counts: requirements **38 PASS / 0 FAIL / 0 PARTIAL**; original defects **16 REFUTED / 0 CONFIRMED**; new defects **8 REFUTED / 0 CONFIRMED**; scenarios **28 PASS / 0 FAIL / 0 PARTIAL**.
- Backend Jest: 4 suites, 26 tests passed. Admin build: compiled successfully, no warnings. Mobile bundle: Metro v0.73.10 bundle completed with `App.js` entry.
- All three database setup paths exit 0 with no SQL errors, and the working `mms_db` is restored from `database/schema_multi_tenant.sql`.
- `backend/.env` was untracked and is ignored by root `.gitignore`; secret values are not reproduced in QA evidence or the report.
- Final report: `qa/REPORT.md`.

## Notes

- Stripe is integrated for real PaymentIntents, but only a placeholder key is available locally; payment-intent creation returns 503 by design rather than a fake success.
- RTL was verified at document level and with an Arabic screenshot; static checks also confirm every admin page uses i18n and logical layout utilities.
- Application changes remain uncommitted, as requested.
