# MMS Database Migration Sequence & Fresh Setup Guide

This document defines the exact execution sequence for migrations across fresh databases and upgrading existing environments.

---

## 1. Automated Migration (Recommended)

To safely apply all USA/UAE schema updates, alter tables idempotently, and execute the historical currency and order backfills:

```bash
node database/run_migration.js
```

---

## 2. Manual SQL Migration Sequence (For Existing Databases)

If executing `.sql` scripts manually via MySQL CLI or a database client (e.g. MySQL Workbench, DBeaver), run them in this **strict numbered order**:

1. **`01_migration_handoff_modules.sql`**
   - Adds `Vendors`, `PurchaseOrders`, `PurchaseOrderItems`, `Employees`, `Payroll`, `Attendance`.
   - Adds `AverageCost` and `TotalPurchased` to `Medicines`.
   - Adds `CostPrice` to `OrderItems`.
   - Adds `Source`, `CustomerName`, `CustomerPhone`, `CreatedBy` to `Orders`.

2. **`migrate_usa_uae_ready.sql`**
   - Adds `Currency`, `TaxEnabled`, `TaxRate DECIMAL(6,5)`, `TaxRegistrationNumber`, `LicenseNumber`, `LicenseAuthority`, `Locale`, `Timezone`, `PharmacistInChargeName` to `Businesses`.
   - Drops hardcoded `'Pakistan'` defaults from `Businesses` and `Addresses`.
   - Backfills existing businesses with `Currency = 'PKR'`.
   - Adds `DEASchedule`, `UAEClassification`, `IsTaxable`, `PriceIncludesTax` to `Medicines`.
   - Adds `Subtotal`, `TaxRate`, `TaxAmount`, `Currency` to `Orders` and modifies `PaymentMethod`.
   - Adds `TaxAmount`, `IsTaxable`, `PriceIncludesTax` to `OrderItems`.
   - Adds `EmiratesId` and `NationalIdLast4` to `Users`.
   - Creates `ControlledSubstanceLog` table.
   - Backfills historical orders with `Subtotal = TotalAmount, TaxRate = 0, TaxAmount = 0, Currency = 'PKR'`.

---

## 3. Fresh Installation

For initializing a brand new database from scratch:
1. Run `database/schema_multi_tenant.sql`
2. Run `database/01_migration_handoff_modules.sql`
3. Run `database/migrate_usa_uae_ready.sql`
4. (Optional) Run `database/seed_data.sql`
