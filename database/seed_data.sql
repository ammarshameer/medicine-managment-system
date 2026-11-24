-- Additional seed data for the Multi-Tenant Medicine Management System.
-- Run AFTER database/schema_multi_tenant.sql.
--
-- This file is tenant-aware: every child row supplies BusinessId and every
-- parent lookup is by BusinessCode / Email / Name rather than by hard-coded
-- auto-increment ids. Each INSERT is guarded so the script is safe to re-run.
-- All rows are created for the primary seeded tenant (MEDICARE001); the
-- remaining sample tenants are seeded by schema_multi_tenant.sql itself.
USE mms_db;

-- ---------------------------------------------------------------------------
-- 1. Users (one STAFF and two CUSTOMER accounts for the primary tenant)
--    Roles MUST use the multi-tenant enum (SUPER_ADMIN / BUSINESS_OWNER /
--    CUSTOMER / STAFF); the old single-tenant roles are no longer valid.
-- ---------------------------------------------------------------------------
INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
SELECT b.BusinessId, 'Pharmacy Staff', 'staff@medicare.com', '+923001234580',
       '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'STAFF', TRUE
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Users u WHERE u.Email = 'staff@medicare.com');

INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
SELECT b.BusinessId, 'John Doe', 'john.doe@email.com', '+923001234581',
       '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Users u WHERE u.Email = 'john.doe@email.com');

INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
SELECT b.BusinessId, 'Jane Smith', 'jane.smith@email.com', '+923001234582',
       '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Users u WHERE u.Email = 'jane.smith@email.com');

-- ---------------------------------------------------------------------------
-- 2. Additional medicines for the primary tenant.
--    CategoryId is resolved by name from that tenant's own Categories rows.
-- ---------------------------------------------------------------------------
INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, AverageCost, Stock, ExpiryDate, Manufacturer, RequiresPrescription, DEASchedule, UAEClassification)
SELECT b.BusinessId,
       (SELECT c.CategoryId FROM Categories c WHERE c.BusinessId = b.BusinessId AND c.CategoryName = 'Pain Relief' LIMIT 1),
       'Ibuprofen 400mg', 'Anti-inflammatory pain medication', 75.00, 0.00, 80, '2027-11-30', 'PainAway', FALSE, 'None', 'OTC'
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Medicines m WHERE m.BusinessId = b.BusinessId AND m.Name = 'Ibuprofen 400mg');

INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, AverageCost, Stock, ExpiryDate, Manufacturer, RequiresPrescription, DEASchedule, UAEClassification)
SELECT b.BusinessId,
       (SELECT c.CategoryId FROM Categories c WHERE c.BusinessId = b.BusinessId AND c.CategoryName = 'Antibiotics' LIMIT 1),
       'Ciprofloxacin 500mg', 'Broad-spectrum antibiotic', 180.00, 0.00, 40, '2027-11-30', 'BioPharm', TRUE, 'None', 'POM'
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Medicines m WHERE m.BusinessId = b.BusinessId AND m.Name = 'Ciprofloxacin 500mg');

INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, AverageCost, Stock, ExpiryDate, Manufacturer, RequiresPrescription, DEASchedule, UAEClassification)
SELECT b.BusinessId,
       (SELECT c.CategoryId FROM Categories c WHERE c.BusinessId = b.BusinessId AND c.CategoryName = 'Vitamins & Supplements' LIMIT 1),
       'Vitamin D3 1000IU', 'Vitamin D3 supplement', 95.00, 0.00, 180, '2027-12-31', 'SunVit', FALSE, 'None', 'OTC'
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Medicines m WHERE m.BusinessId = b.BusinessId AND m.Name = 'Vitamin D3 1000IU');

INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, AverageCost, Stock, ExpiryDate, Manufacturer, RequiresPrescription, DEASchedule, UAEClassification)
SELECT b.BusinessId,
       (SELECT c.CategoryId FROM Categories c WHERE c.BusinessId = b.BusinessId AND c.CategoryName = 'Cold & Flu' LIMIT 1),
       'Cold Tablets', 'Multi-symptom cold relief', 110.00, 0.00, 100, '2027-07-31', 'ColdStop', FALSE, 'None', 'OTC'
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Medicines m WHERE m.BusinessId = b.BusinessId AND m.Name = 'Cold Tablets');

INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, AverageCost, Stock, ExpiryDate, Manufacturer, RequiresPrescription, DEASchedule, UAEClassification)
SELECT b.BusinessId,
       (SELECT c.CategoryId FROM Categories c WHERE c.BusinessId = b.BusinessId AND c.CategoryName = 'Digestive Health' LIMIT 1),
       'Probiotic Capsules', 'Digestive health probiotics', 200.00, 0.00, 70, '2027-03-31', 'GutBalance', FALSE, 'None', 'OTC'
FROM Businesses b
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Medicines m WHERE m.BusinessId = b.BusinessId AND m.Name = 'Probiotic Capsules');

-- ---------------------------------------------------------------------------
-- 3. Addresses (BusinessId is required; Country is supplied explicitly)
-- ---------------------------------------------------------------------------
INSERT INTO Addresses (BusinessId, UserId, Street, City, State, PostalCode, Country, IsDefault)
SELECT b.BusinessId, u.UserId, '123 Main Street', 'Karachi', 'Sindh', '74200', 'Pakistan', TRUE
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'john.doe@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Addresses a WHERE a.UserId = u.UserId AND a.Street = '123 Main Street');

INSERT INTO Addresses (BusinessId, UserId, Street, City, State, PostalCode, Country, IsDefault)
SELECT b.BusinessId, u.UserId, '456 Garden Road', 'Lahore', 'Punjab', '54000', 'Pakistan', TRUE
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'jane.smith@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Addresses a WHERE a.UserId = u.UserId AND a.Street = '456 Garden Road');

-- ---------------------------------------------------------------------------
-- 4. Orders + OrderItems (parent Orders row must exist before its items)
-- ---------------------------------------------------------------------------
INSERT INTO Orders (BusinessId, UserId, Status, Source, Subtotal, TaxRate, TaxAmount, TotalAmount, Currency, DeliveryAddress, PaymentMethod, PaymentStatus)
SELECT b.BusinessId, u.UserId, 'Delivered', 'Online', 250.00, 0.16000, 34.48, 284.48, 'PKR',
       '123 Main Street, Karachi, Sindh 74200', 'Cash on Delivery', 'Paid'
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'john.doe@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Orders o WHERE o.BusinessId = b.BusinessId AND o.UserId = u.UserId AND o.TotalAmount = 284.48);

INSERT INTO Orders (BusinessId, UserId, Status, Source, Subtotal, TaxRate, TaxAmount, TotalAmount, Currency, DeliveryAddress, PaymentMethod, PaymentStatus)
SELECT b.BusinessId, u.UserId, 'Approved', 'POS', 325.00, 0.16000, 44.80, 369.80, 'PKR',
       '456 Garden Road, Lahore, Punjab 54000', 'Cash', 'Paid'
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'jane.smith@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Orders o WHERE o.BusinessId = b.BusinessId AND o.UserId = u.UserId AND o.TotalAmount = 369.80);

INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, CostPrice, Subtotal, TaxAmount, IsTaxable, PriceIncludesTax)
SELECT o.BusinessId, o.OrderId, m.MedicineId, 2, 75.00, 0.00, 150.00, 0.00, TRUE, FALSE
FROM Orders o
JOIN Users u ON u.UserId = o.UserId AND u.Email = 'john.doe@email.com'
JOIN Medicines m ON m.BusinessId = o.BusinessId AND m.Name = 'Ibuprofen 400mg'
WHERE o.TotalAmount = 284.48
  AND NOT EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderId = o.OrderId AND oi.MedicineId = m.MedicineId);

INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, CostPrice, Subtotal, TaxAmount, IsTaxable, PriceIncludesTax)
SELECT o.BusinessId, o.OrderId, m.MedicineId, 1, 110.00, 0.00, 110.00, 0.00, TRUE, FALSE
FROM Orders o
JOIN Users u ON u.UserId = o.UserId AND u.Email = 'john.doe@email.com'
JOIN Medicines m ON m.BusinessId = o.BusinessId AND m.Name = 'Cold Tablets'
WHERE o.TotalAmount = 284.48
  AND NOT EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderId = o.OrderId AND oi.MedicineId = m.MedicineId);

INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, CostPrice, Subtotal, TaxAmount, IsTaxable, PriceIncludesTax)
SELECT o.BusinessId, o.OrderId, m.MedicineId, 1, 95.00, 0.00, 95.00, 0.00, TRUE, FALSE
FROM Orders o
JOIN Users u ON u.UserId = o.UserId AND u.Email = 'jane.smith@email.com'
JOIN Medicines m ON m.BusinessId = o.BusinessId AND m.Name = 'Vitamin D3 1000IU'
WHERE o.TotalAmount = 369.80
  AND NOT EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderId = o.OrderId AND oi.MedicineId = m.MedicineId);

-- ---------------------------------------------------------------------------
-- 5. Prescriptions
-- ---------------------------------------------------------------------------
INSERT INTO Prescriptions (BusinessId, UserId, ImagePath, Status, Notes)
SELECT b.BusinessId, u.UserId, 'uploads/prescriptions/prescription-1.jpg', 'Approved', 'Valid prescription for antibiotics'
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'john.doe@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Prescriptions p WHERE p.UserId = u.UserId AND p.ImagePath = 'uploads/prescriptions/prescription-1.jpg');

INSERT INTO Prescriptions (BusinessId, UserId, ImagePath, Status, Notes)
SELECT b.BusinessId, u.UserId, 'uploads/prescriptions/prescription-2.jpg', 'Pending', 'Awaiting admin review'
FROM Businesses b
JOIN Users u ON u.BusinessId = b.BusinessId AND u.Email = 'jane.smith@email.com'
WHERE b.BusinessCode = 'MEDICARE001'
  AND NOT EXISTS (SELECT 1 FROM Prescriptions p WHERE p.UserId = u.UserId AND p.ImagePath = 'uploads/prescriptions/prescription-2.jpg');

-- ---------------------------------------------------------------------------
-- 6. Inventory transactions (PerformedBy resolves to the tenant owner)
-- ---------------------------------------------------------------------------
INSERT INTO InventoryTransactions (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
SELECT m.BusinessId, m.MedicineId, 'Stock In', 80, 0, 80, 'Initial stock',
       (SELECT u.UserId FROM Users u WHERE u.BusinessId = m.BusinessId AND u.Role = 'BUSINESS_OWNER' LIMIT 1)
FROM Medicines m
JOIN Businesses b ON b.BusinessId = m.BusinessId AND b.BusinessCode = 'MEDICARE001'
WHERE m.Name = 'Ibuprofen 400mg'
  AND NOT EXISTS (SELECT 1 FROM InventoryTransactions it WHERE it.MedicineId = m.MedicineId AND it.Reason = 'Initial stock');

-- ---------------------------------------------------------------------------
-- 7. Controlled substance ledger samples (demonstrates all supported actions)
-- ---------------------------------------------------------------------------
INSERT INTO ControlledSubstanceLog (BusinessId, MedicineId, Action, Quantity, PerformedBy, Notes)
SELECT m.BusinessId, m.MedicineId, 'Received', 20,
       (SELECT u.UserId FROM Users u WHERE u.BusinessId = m.BusinessId AND u.Role = 'BUSINESS_OWNER' LIMIT 1),
       'Opening controlled stock'
FROM Medicines m
JOIN Businesses b ON b.BusinessId = m.BusinessId AND b.BusinessCode = 'MEDICARE001'
WHERE m.Name = 'Amoxicillin 500mg'
  AND NOT EXISTS (SELECT 1 FROM ControlledSubstanceLog l WHERE l.MedicineId = m.MedicineId AND l.Action = 'Received');

SELECT 'Multi-tenant seed data applied successfully!' AS Status;
