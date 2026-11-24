# MMS Database Migration Sequence & Fresh Setup Guide

All scripts target **MySQL 8.0+ / MySQL 8.4** and use `USE mms_db`. Every schema
and migration script is idempotent (safe to re-run); no SQL file relies on
MariaDB-only conditional column additions.

There are exactly **two supported paths**. Pick one — do not mix them.

---

## 1. Fresh installation (recommended)

Use this for a new database or when `mms_db` can be recreated.

```bash
mysql -u root -p < database/schema_multi_tenant.sql
mysql -u root -p < database/seed_data.sql        # optional sample data
```

`schema_multi_tenant.sql` creates the complete current schema, including:

- `Businesses` with `LegalName`, `ZipCode`, `Country` (safe default `'Pakistan'`),
  currency and tax columns,
- POS/order columns (`Source`, `Subtotal`, `TaxRate`, `TaxAmount`, `Currency`,
  `CostPrice`, `CreatedBy`, `ReorderedFromOrderId`),
- `Vendors`, `PurchaseOrders`, `PurchaseOrderItems`,
- `Employees`, `Salaries` (this is the payroll table — there is **no** `Payroll`
  table), `Attendance`,
- `PaymentTransactions`,
- `ControlledSubstanceLog` with actions `Dispensed`, `Received`, `Adjusted`,
  `Destroyed`, `Reversed` and columns `OrderId`, `MedicineId`, `Quantity`,
  `PerformedBy`, `Notes`, `CreatedAt`.

`seed_data.sql` is tenant-aware: it supplies `BusinessId`, resolves parent IDs
by `BusinessCode`/email/name, uses the multi-tenant `Role` values and always
sets `Country`. Each insert is guarded, so re-running it does not duplicate rows.

Running any of the migration scripts from section 2 after the fresh install is
harmless — they detect existing columns/tables and become no-ops.

---

## 2. Upgrade an existing single-tenant database

Use this when `mms_db` was created with the legacy `database/schema.sql`.
**Back up the database first.** Run the files in this exact order:

```bash
mysql -u root -p < database/schema.sql                       # only if starting from legacy baseline
mysql -u root -p < database/migrate_to_multi_tenant.sql
mysql -u root -p < database/01_migration_handoff_modules.sql
mysql -u root -p < database/migrate_usa_uae_ready.sql
node database/run_migration.js                                # optional verification / catch-up
```

### What each step does

1. **`migrate_to_multi_tenant.sql`**
   - Creates `Businesses` (with `LegalName`, `ZipCode` and a safe `Country`
     default) and inserts the `DEFAULT001` business **before** any foreign key
     is added, so child rows always have a parent.
   - Adds `BusinessId` + index + FK (and the business/email unique key) to
     `Users`, `Categories`, `Medicines`, `Addresses`, `Orders`, `OrderItems`,
     `Prescriptions` and `InventoryTransactions`. Guards prevent
     `Unknown column 'BusinessId'` after a partial run.
   - Maps legacy roles (`Patient` → `CUSTOMER`, `Super Admin` → `SUPER_ADMIN`,
     `Pharmacy Admin` → `BUSINESS_OWNER`, Inventory/Delivery Manager → `STAFF`)
     before narrowing `Role` to the new ENUM, avoiding
     `Data truncated for column 'Role'`.
   - Creates `BusinessSettings` and `SubscriptionPayments`.

2. **`01_migration_handoff_modules.sql`**
   - Adds `Medicines.AverageCost` and `OrderItems.CostPrice`.
   - Makes `Orders.UserId` nullable and adds `Source`, `CustomerName`,
     `CustomerPhone`, `CreatedBy`, `ReorderedFromOrderId`.
   - Creates `Vendors`, `PurchaseOrders`, `PurchaseOrderItems`, `Employees`,
     `Salaries` (payroll), **Attendance** and **PaymentTransactions**.

3. **`migrate_usa_uae_ready.sql`**
   - Adds `Currency`, `TaxEnabled`, `TaxRate`, `TaxRegistrationNumber`,
     `LicenseNumber`, `LicenseAuthority`, `Locale`, `Timezone`,
     `PharmacistInChargeName`, plus `LegalName` and `ZipCode` to `Businesses`.
   - Preserves the safe `Country` default instead of dropping it, backfills
     empty country values, and backfills Pakistani businesses to PKR once (only
     when the `Currency` column is first added).
   - Adds `DEASchedule`, `UAEClassification`, `IsTaxable`, `PriceIncludesTax` to
     `Medicines`; `Subtotal`, `TaxRate`, `TaxAmount`, `Currency` to `Orders`;
     `TaxAmount`, `IsTaxable`, `PriceIncludesTax` to `OrderItems`; `EmiratesId`,
     `NationalIdLast4` to `Users`.
   - Creates/extends `ControlledSubstanceLog` and creates `Attendance` and
     `PaymentTransactions` if an earlier step did not.

### Automated catch-up

```bash
node database/run_migration.js
```

This works from the repository root: it resolves `dotenv` from
`backend/node_modules` and loads `backend/.env`, rather than expecting a root
`node_modules`. It checks `INFORMATION_SCHEMA` for every column/table and
backfills only rows created by that run, so it is safe to repeat. Requiring the
module (`require('./database/run_migration.js')`) performs **no** database
work; migration only runs when the file is executed directly.

---

## 3. Troubleshooting notes

- `ERROR 1364 ... Field 'Country' doesn't have a default value` — fixed by the
  `DEFAULT 'Pakistan'` on `Businesses.Country`/`Addresses.Country` and by
  supplying `Country` in seed rows. Do not reintroduce `ALTER COLUMN Country
  DROP DEFAULT`.
- `ERROR 1265 Data truncated for column 'Role'` — fixed by the widen → map →
  narrow sequence in `migrate_to_multi_tenant.sql`.
- `ERROR 1060 Duplicate column name` / `ERROR 1064 ... conditional ALTER` — fixed by
  the guarded `SET @sql` / `PREPARE` blocks in the migration SQL files.
- `Unknown column 'LegalName'` / `'ZipCode'` — both columns ship in
  `schema_multi_tenant.sql` and are added by both upgrade migration scripts.
- Backend compliance API expects `ControlledSubstanceLog.Timestamp`; the new
  `CreatedAt` column is additive and does not remove it.
