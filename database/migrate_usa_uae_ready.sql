-- Migration: Making MMS USA/UAE-Ready (MySQL 8 compatible, safe to re-run)
-- Adds multi-country configuration, line-item tax fields, DEA/UAE medicine
-- classifications, the controlled-substance audit log and Emirates IDs.
--
-- Every column addition is guarded via INFORMATION_SCHEMA because MySQL 8 does
-- not support conditional column additions directly in an ALTER statement.

USE mms_db;

-- Remember whether Currency already existed so the currency backfill below
-- runs exactly once (and never overwrites a later, deliberate currency change).
SET @business_currency_existed = (
  SELECT COUNT(*) > 0 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Businesses' AND COLUMN_NAME = 'Currency'
);

-- ---------------------------------------------------------------------------
-- 1. Businesses table (also the columns the backend SELECTs: LegalName/ZipCode)
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Businesses` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'LegalName' AS col, 'VARCHAR(200) NULL' AS def
    UNION ALL SELECT 2, 'ZipCode', 'VARCHAR(20) NULL'
    UNION ALL SELECT 3, 'Currency', 'VARCHAR(3) DEFAULT ''USD'''
    UNION ALL SELECT 4, 'TaxEnabled', 'BOOLEAN NOT NULL DEFAULT TRUE'
    UNION ALL SELECT 5, 'TaxRate', 'DECIMAL(6,5) DEFAULT 0.00000'
    UNION ALL SELECT 6, 'TaxRegistrationNumber', 'VARCHAR(50) NULL'
    UNION ALL SELECT 7, 'LicenseNumber', 'VARCHAR(100) NULL'
    UNION ALL SELECT 8, 'LicenseAuthority', 'VARCHAR(100) NULL'
    UNION ALL SELECT 9, 'Locale', 'VARCHAR(10) DEFAULT ''en-US'''
    UNION ALL SELECT 10, 'Timezone', 'VARCHAR(50) DEFAULT ''America/New_York'''
    UNION ALL SELECT 11, 'PharmacistInChargeName', 'VARCHAR(100) NULL'
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Businesses' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Keep a safe default on Country so inserts that omit it never fail.
-- (The old script dropped the default, which reintroduced ERROR 1364.)
ALTER TABLE Businesses MODIFY COLUMN Country VARCHAR(100) NULL DEFAULT 'Pakistan';
ALTER TABLE Addresses MODIFY COLUMN Country VARCHAR(100) NULL DEFAULT 'Pakistan';
UPDATE Businesses SET Country = 'Pakistan' WHERE Country IS NULL OR Country = '';
UPDATE Addresses SET Country = 'Pakistan' WHERE Country IS NULL OR Country = '';

-- BACKFILL: preserve pre-existing Pakistan businesses in PKR (one time only).
UPDATE Businesses
SET Currency = 'PKR'
WHERE @business_currency_existed = 0
  AND (Country = 'Pakistan' OR Country IS NULL OR Country = '');

-- ---------------------------------------------------------------------------
-- 2. Medicines classifications
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Medicines` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'DEASchedule' AS col, 'ENUM(''None'', ''I'', ''II'', ''III'', ''IV'', ''V'') NOT NULL DEFAULT ''None''' AS def
    UNION ALL SELECT 2, 'UAEClassification', 'ENUM(''OTC'', ''Pharmacist-Only'', ''POM'', ''Controlled'', ''Semi-Controlled'', ''Narcotic'') NOT NULL DEFAULT ''OTC'''
    UNION ALL SELECT 3, 'IsTaxable', 'BOOLEAN NOT NULL DEFAULT TRUE'
    UNION ALL SELECT 4, 'PriceIncludesTax', 'BOOLEAN NOT NULL DEFAULT FALSE'
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Medicines' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 3. Orders tax/currency columns
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Orders` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'Subtotal' AS col, 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' AS def
    UNION ALL SELECT 2, 'TaxRate', 'DECIMAL(6,5) NOT NULL DEFAULT 0.00000'
    UNION ALL SELECT 3, 'TaxAmount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00'
    UNION ALL SELECT 4, 'Currency', 'VARCHAR(3) NOT NULL DEFAULT ''USD'''
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Orders' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE Orders MODIFY COLUMN PaymentMethod ENUM(
  'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay',
  'Cash on Delivery', 'JazzCash', 'EasyPaisa'
) DEFAULT 'Cash';

-- ---------------------------------------------------------------------------
-- 4. OrderItems tax columns
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `OrderItems` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'TaxAmount' AS col, 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' AS def
    UNION ALL SELECT 2, 'IsTaxable', 'BOOLEAN NOT NULL DEFAULT TRUE'
    UNION ALL SELECT 3, 'PriceIncludesTax', 'BOOLEAN NOT NULL DEFAULT FALSE'
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'OrderItems' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 5. Users identity columns
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Users` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'EmiratesId' AS col, 'VARCHAR(20) NULL' AS def
    UNION ALL SELECT 2, 'NationalIdLast4', 'VARCHAR(4) NULL'
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Users' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 6. Controlled Substances Compliance Audit Log
--    Extend existing installations with 'Reversed' and CreatedAt; the
--    CREATE TABLE below covers databases that do not have the table yet.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ControlledSubstanceLog (
    LogId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    MedicineId INT NOT NULL,
    OrderId INT NULL,
    PrescriptionId INT NULL,
    Action ENUM('Dispensed', 'Received', 'Adjusted', 'Destroyed', 'Reversed') NOT NULL,
    Quantity INT NOT NULL,
    PerformedBy INT NOT NULL,
    Notes TEXT NULL,
    Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_csl_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_csl_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE RESTRICT,
    CONSTRAINT fk_csl_order FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE SET NULL,
    CONSTRAINT fk_csl_performer FOREIGN KEY (PerformedBy) REFERENCES Users(UserId) ON DELETE RESTRICT,
    INDEX idx_csl_business (BusinessId),
    INDEX idx_csl_medicine (MedicineId),
    INDEX idx_csl_action (Action),
    INDEX idx_csl_timestamp (Timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ControlledSubstanceLog MODIFY COLUMN Action
  ENUM('Dispensed', 'Received', 'Adjusted', 'Destroyed', 'Reversed') NOT NULL;

SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `ControlledSubstanceLog` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'CreatedAt' AS col, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' AS def
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'ControlledSubstanceLog' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 7. Attendance and PaymentTransactions (also created by the handoff migration
--    so both supported upgrade paths end up with the same tables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Attendance (
    AttendanceId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    EmployeeId INT NOT NULL,
    AttendanceDate DATE NOT NULL,
    Status ENUM('Present', 'Absent', 'Leave', 'Half Day') NOT NULL DEFAULT 'Present',
    CheckIn TIME NULL,
    CheckOut TIME NULL,
    Notes TEXT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_employee FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance_employee_date (BusinessId, EmployeeId, AttendanceDate),
    INDEX idx_attendance_business (BusinessId),
    INDEX idx_attendance_employee (EmployeeId),
    INDEX idx_attendance_date (AttendanceDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PaymentTransactions (
    PaymentTransactionId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    OrderId INT NOT NULL,
    Provider VARCHAR(50) NOT NULL,
    ProviderReference VARCHAR(255) NULL,
    Amount DECIMAL(10,2) NOT NULL,
    Currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    Status ENUM('Pending', 'Succeeded', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    PaymentMethod VARCHAR(50) NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_tx_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_payment_tx_order FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE CASCADE,
    INDEX idx_payment_tx_business (BusinessId),
    INDEX idx_payment_tx_order (OrderId),
    INDEX idx_payment_tx_status (Status),
    INDEX idx_payment_tx_provider (Provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Backfill historic rows (guarded so re-runs do not overwrite configured tax)
-- ---------------------------------------------------------------------------
UPDATE Orders
SET Subtotal = TotalAmount, TaxRate = 0.00000, TaxAmount = 0.00, Currency = 'PKR'
WHERE (Subtotal = 0.00 OR Subtotal IS NULL) AND TotalAmount > 0;

UPDATE OrderItems
SET TaxAmount = 0.00, IsTaxable = TRUE, PriceIncludesTax = FALSE
WHERE TaxAmount IS NULL;

SELECT 'USA/UAE readiness migration completed successfully!' AS Status;
