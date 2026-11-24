#!/usr/bin/env bash
# QA artifact - database setup paths (D7 / R35 / T27).
# Runs each documented path in mms_db sequentially, capturing exact output.
# Usage: bash qa/01_db_paths.sh
set -u
cd "$(dirname "$0")/.." || exit 1

set -a
# shellcheck disable=SC1091
source backend/.env
set +a
export MYSQL_PWD="$DB_PASSWORD"
MYSQL=(mysql -h"$DB_HOST" -P"${DB_PORT:-3306}" -u"$DB_USER" "$DB_NAME")

LOGS=qa/logs
EVIDENCE=qa/evidence/db_paths.txt
mkdir -p "$LOGS" qa/evidence
: > "$EVIDENCE"

reset_db() {
  "${MYSQL[@]}" -e "DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME};" || echo "RESET FAILED"
}

apply_sql() {
  local file="$1" log="$2"
  echo "--- applying $file ---" >> "$log"
  "${MYSQL[@]}" --force < "$file" >> "$log" 2>&1
  local rc=$?
  echo "exit_code=$rc" >> "$log"
  return $rc
}

snapshot() {
  local path="$1" log="$2"
  {
    echo "== $path snapshot =="
    "${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" | sed 's/^/tables=/'
    for t in Businesses Users Medicines Orders OrderItems ControlledSubstanceLog Vendors PurchaseOrders Employees Salaries Attendance PaymentTransactions; do
      local n rows
      n=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='$t';" 2>/dev/null || echo '?')
      rows='n/a'
      if [ "$n" = "1" ]; then
        rows=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM \`$t\`;" 2>/dev/null || echo '?')
      fi
      echo "table:$t=$n rows=$rows"
    done
    "${MYSQL[@]}" -N -e "SELECT CONCAT('column:',table_name,'.',column_name) FROM information_schema.columns WHERE table_schema='${DB_NAME}' AND column_name IN ('TaxRate','TaxEnabled','DEASchedule','UAEClassification','PriceIncludesTax','Subtotal','Currency','EmiratesId','AverageCost','CostPrice','Source','ControlledSubstanceLogID','LegalName','ZipCode') ORDER BY table_name,column_name;" 2>/dev/null
    echo "--- stderr/errors in log ---"
    grep -i -E '^ERROR|error [0-9]+' "$log" | head -40 || echo '(none)'
  } >> "$EVIDENCE" 2>&1
}

echo "=== Database path evidence ($(date -u +%FT%TZ)) ===" >> "$EVIDENCE"
echo "mysql_version=$("${MYSQL[@]}" -N -e 'SELECT VERSION();')" >> "$EVIDENCE"

# ---- Path A: schema_multi_tenant.sql + seed_data.sql (fresh install) ----
LOG="$LOGS/db_path_A_fresh.log"
: > "$LOG"
reset_db
apply_sql database/schema_multi_tenant.sql "$LOG"
echo "path_A_schema_exit=$?" >> "$EVIDENCE"
apply_sql database/seed_data.sql "$LOG"
echo "path_A_seed_exit=$?" >> "$EVIDENCE"
snapshot "A_fresh" "$LOG"

# ---- Path B: documented upgrade path from schema.sql ----
LOG="$LOGS/db_path_B_upgrade.log"
: > "$LOG"
reset_db
apply_sql database/schema.sql "$LOG"
echo "path_B_schema_exit=$?" >> "$EVIDENCE"
apply_sql database/migrate_to_multi_tenant.sql "$LOG"
echo "path_B_migrate_to_multi_tenant_exit=$?" >> "$EVIDENCE"
apply_sql database/01_migration_handoff_modules.sql "$LOG"
echo "path_B_handoff_exit=$?" >> "$EVIDENCE"
apply_sql database/migrate_usa_uae_ready.sql "$LOG"
echo "path_B_usa_uae_exit=$?" >> "$EVIDENCE"
node database/run_migration.js >> "$LOG" 2>&1
echo "path_B_run_migration_exit=$?" >> "$EVIDENCE"
snapshot "B_upgrade" "$LOG"

# ---- Path C: MIGRATION_SEQUENCE.md fresh-plus-migrations sequence ----
LOG="$LOGS/db_path_C_sequence.log"
: > "$LOG"
reset_db
apply_sql database/schema_multi_tenant.sql "$LOG"
echo "path_C_step1_exit=$?" >> "$EVIDENCE"
apply_sql database/01_migration_handoff_modules.sql "$LOG"
echo "path_C_step2_exit=$?" >> "$EVIDENCE"
apply_sql database/migrate_usa_uae_ready.sql "$LOG"
echo "path_C_step3_exit=$?" >> "$EVIDENCE"
snapshot "C_sequence" "$LOG"

# ---- Restore Path A as the working database for all later tests ----
LOG="$LOGS/db_restore_A.log"
: > "$LOG"
reset_db
apply_sql database/schema_multi_tenant.sql "$LOG"
echo "restored_path=$DB_NAME from schema_multi_tenant.sql" >> "$EVIDENCE"

echo "DB_PATHS_DONE"
