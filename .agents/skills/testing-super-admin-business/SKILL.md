---
name: testing-super-admin-business
description: Test the Super Admin "Add Business Owner" / create-business flow end-to-end in the medicine-management-system admin-web. Use when verifying super-admin business creation UI or the POST /api/super-admin/businesses API.
---

# Testing the Super Admin "Add Business Owner" flow

## Stack / how to run locally
- MySQL runs in Docker container `mms-mysql` (port 3306, root password `password`, db `mms_db`). This is a local-only dev DB password.
- Backend (Express) on `http://localhost:5000`; admin-web (React, CRA) on `http://localhost:3000` which proxies `/api` to the backend.
- Quick health checks: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health` and `... http://localhost:3000`.

## Login / accounts (local seeded DB)
- Super admin: `superadmin@mms.com` / `admin123` (role SUPER_ADMIN). The login page also shows demo creds `admin@mms.com / admin123`.
- A seeded business owner: `ahmed@medicare.com` / `admin123` (role BUSINESS_OWNER) — useful to confirm the menu item is hidden for non-super-admins.

## Reaching the feature
- Top-right user dropdown → **Add Business Owner** (only rendered for `SUPER_ADMIN`; lives in `admin-web/src/components/Layout.js`). It links to `/super-admin/businesses/create` → `admin-web/src/pages/SuperAdminBusinessForm.js`.

## Create-business form / API contract
- `POST /api/super-admin/businesses` (validation in `backend/routes/super-admin.js`) requires camelCase fields: `businessName`, `businessCode` (3-50 chars, unique), `ownerName`, `email`, `phone` (>=10 chars), `subscriptionPlan` ∈ {Free, Basic, Premium}. Optional: address/city/state/country, `status` ∈ {Active, Inactive, Suspended}.
- Success returns `data.defaultPassword` (currently `ChangeMe123`), shown in a success toast. Creates a `Businesses` row + a linked `BUSINESS_OWNER` user.
- Duplicate `businessCode` → 409 "Business code already exists"; duplicate email → 409 "Email already exists". The form surfaces these via `toast.error`.
- Gotcha: backend uses express-validator `normalizeEmail()`, which strips dots in gmail addresses (`a.b@gmail.com` → `ab@gmail.com`). Query the DB with the normalized email when verifying the created owner.

## Verifying via DB
```
docker exec -i mms-mysql mysql -uroot -ppassword mms_db -e \
  "SELECT BusinessId,BusinessName,BusinessCode,OwnerName,Email,Status FROM Businesses WHERE BusinessCode='<CODE>'; \
   SELECT UserId,Email,Role,BusinessId FROM Users WHERE BusinessId=<ID>;"
```
Clean up test rows afterwards (delete from Users, Categories, BusinessSettings, then Businesses for that BusinessId/code).

## Known issue (may or may not still be present)
- The super-admin **Businesses list** page (`GET /api/super-admin/businesses`) may return **500**, so the list shows "No businesses found" even when rows exist. This appears to be the root of the "all APIs fail after login except categories" report. If you can't see a created business in the list UI, verify via DB instead and check the backend console / browser console for the 500. A likely culprit to investigate is the mysql2 prepared-statement `LIMIT ? OFFSET ?` pattern, which can throw on some mysql2 versions.

## Devin Secrets Needed
- None. All credentials above are local seeded dev accounts; no external secrets required for this flow.
