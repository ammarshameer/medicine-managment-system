#!/usr/bin/env bash
# QA artifact - rerun the full non-destructive verification suite.
# Usage: bash qa/verify_all.sh
# Prerequisites: MySQL mms_db restored, backend running on port 5000.
# T26 is included only when ADMIN_DEV_URL is reachable; start admin-web on 3002 first.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[qa] fixtures"
node qa/02_fixtures.js
echo "[qa] tax/money"
node qa/03_tax_money.js
echo "[qa] security"
node qa/04_security.js
echo "[qa] inventory"
node qa/05_inventory.js
echo "[qa] controlled"
node qa/06_controlled.js
echo "[qa] hrms"
node qa/07_hrms.js
echo "[qa] mobile API"
node qa/08_mobile_api.js
echo "[qa] static requirements"
node qa/09_static_requirements.js
echo "[qa] refund probe"
node qa/11_d9_refund_probe.js
echo "[qa] public catalog isolation"
node qa/12_public_catalog_isolation.js
echo "[qa] phone validation"
node qa/13_registration_phone_probe.js
echo "[qa] hidden SUPPORT role"
node qa/17_support_access.js
echo "[qa] platform login flow"
node qa/18_platform_login_flow.js
echo "[qa] setup results"
node qa/14_setup_results.js
echo "[qa] RTL (optional)"
if curl -fsS http://localhost:3002/ >/dev/null 2>&1; then
  node qa/10_rtl_check.js
  node qa/19_platform_ui_check.js
  node qa/20_business_switch_ui.js
else
  echo "[qa] admin-web not on 3002; reusing existing RTL evidence"
fi
echo "[qa] consolidate + report"
node qa/15_final_results.js
node qa/16_generate_report.js
echo "[qa] DONE -> qa/REPORT.md"
