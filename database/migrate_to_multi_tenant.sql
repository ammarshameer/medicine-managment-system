-- Migration: convert an existing single-tenant database to multi-tenant.
-- MySQL 8 compatible and safe to re-run.
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT.
--
-- Fixed upgrade-path defects:
--   * The default business is created BEFORE any FK is added, so child rows
--     never reference a missing parent.
--   * Legacy Role values are mapped to the new enum BEFORE narrowing the
--     column, so MySQL 8 no longer raises "Data truncated for column 'Role'".
--   * Every BusinessId add/index/FK is guarded, so `Unknown column
--     'BusinessId'` can no longer happen after a partial run.

USE mms_db;

-- ---------------------------------------------------------------------------
-- Step 1: Businesses (full shape, including the columns the backend SELECTs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Businesses (
    BusinessId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessName VARCHAR(200) NOT NULL,
    LegalName VARCHAR(200) NULL,
    BusinessCode VARCHAR(50) UNIQUE NOT NULL,
    Logo VARCHAR(255),
    OwnerName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    Phone VARCHAR(20) NOT NULL,
    Address TEXT,
    City VARCHAR(100),
    State VARCHAR(100),
    ZipCode VARCHAR(20) NULL,
    Country VARCHAR(100) NULL DEFAULT 'Pakistan',
    Currency VARCHAR(3) DEFAULT 'USD',
    TaxEnabled BOOLEAN NOT NULL DEFAULT TRUE,
    TaxRate DECIMAL(6,5) DEFAULT 0.00000,
    TaxRegistrationNumber VARCHAR(50) NULL,
    LicenseNumber VARCHAR(100) NULL,
    LicenseAuthority VARCHAR(100) NULL,
    Locale VARCHAR(10) DEFAULT 'en-US',
    Timezone VARCHAR(50) DEFAULT 'America/New_York',
    PharmacistInChargeName VARCHAR(100) NULL,
    SubscriptionPlan ENUM('Free', 'Basic', 'Premium') DEFAULT 'Free',
    Status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
    MaxUsers INT DEFAULT 10,
    MaxMedicines INT DEFAULT 100,
    Revenue DECIMAL(15,2) DEFAULT 0.00,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_business_name (BusinessName),
    INDEX idx_business_code (BusinessCode),
    INDEX idx_status (Status),
    INDEX idx_subscription (SubscriptionPlan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 2: create the default business FIRST so every later FK has a parent
-- ---------------------------------------------------------------------------
INSERT INTO Businesses
  (BusinessName, LegalName, BusinessCode, OwnerName, Email, Phone,
   Address, City, State, ZipCode, Country, Currency, SubscriptionPlan, Status)
SELECT 'Default Pharmacy', 'Default Pharmacy', 'DEFAULT001', 'System Admin',
       'admin@mms.com', '+923000000000', 'Default Address', 'Karachi', 'Sindh',
       '74200', 'Pakistan', 'PKR', 'Premium', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM Businesses WHERE BusinessCode = 'DEFAULT001');

SET @default_business_id = (SELECT BusinessId FROM Businesses WHERE BusinessCode = 'DEFAULT001' LIMIT 1);
SET @default_business_id = IFNULL(@default_business_id, 1);

-- ---------------------------------------------------------------------------
-- Step 3: Users.BusinessId + Role mapping (order matters: widen, map, narrow)
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Users` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'BusinessId' AS col, 'INT NULL' AS def
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Users' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE Users MODIFY COLUMN Role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER';
UPDATE Users SET Role = CASE Role
    WHEN 'Super Admin'       THEN 'SUPER_ADMIN'
    WHEN 'Pharmacy Admin'    THEN 'BUSINESS_OWNER'
    WHEN 'Inventory Manager' THEN 'STAFF'
    WHEN 'Delivery Manager'  THEN 'STAFF'
    WHEN 'Patient'           THEN 'CUSTOMER'
    ELSE Role
  END;
ALTER TABLE Users MODIFY COLUMN Role ENUM('SUPER_ADMIN', 'SUPPORT', 'BUSINESS_OWNER', 'CUSTOMER', 'STAFF') NOT NULL DEFAULT 'CUSTOMER';

UPDATE Users SET BusinessId = @default_business_id WHERE BusinessId IS NULL;

SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Users` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_id (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_user_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
    UNION ALL SELECT 3, 'CONSTRAINT unique_business_email UNIQUE KEY (BusinessId, Email)'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Users' AND s.INDEX_NAME = 'idx_business_id'))
     OR (item.ord = 2 AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Users' AND tc.CONSTRAINT_NAME = 'fk_user_business'))
     OR (item.ord = 3 AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Users' AND tc.CONSTRAINT_NAME = 'unique_business_email'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- Step 4: helper block for BusinessId columns on the remaining child tables
-- ---------------------------------------------------------------------------
-- Categories
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Categories` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Categories' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Categories` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_category (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_category_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
    UNION ALL SELECT 3, 'CONSTRAINT unique_business_category UNIQUE KEY (BusinessId, CategoryName)'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Categories' AND s.INDEX_NAME = 'idx_business_category'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Categories' AND tc.CONSTRAINT_NAME = 'fk_category_business'))
     OR (item.ord = 3 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Categories' AND tc.CONSTRAINT_NAME = 'unique_business_category'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Medicines
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Medicines` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Medicines' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Medicines` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_medicine (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_medicine_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Medicines' AND s.INDEX_NAME = 'idx_business_medicine'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Medicines' AND tc.CONSTRAINT_NAME = 'fk_medicine_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Addresses
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Addresses` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Addresses' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Addresses` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_address (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_address_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Addresses' AND s.INDEX_NAME = 'idx_business_address'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Addresses' AND tc.CONSTRAINT_NAME = 'fk_address_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Orders
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Orders` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Orders' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Orders` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_order (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_order_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Orders' AND s.INDEX_NAME = 'idx_business_order'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Orders' AND tc.CONSTRAINT_NAME = 'fk_order_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- OrderItems
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `OrderItems` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'OrderItems' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `OrderItems` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_orderitem (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_orderitem_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'OrderItems' AND s.INDEX_NAME = 'idx_business_orderitem'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'OrderItems' AND tc.CONSTRAINT_NAME = 'fk_orderitem_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Prescriptions
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Prescriptions` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Prescriptions' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `Prescriptions` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_prescription (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_prescription_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'Prescriptions' AND s.INDEX_NAME = 'idx_business_prescription'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'Prescriptions' AND tc.CONSTRAINT_NAME = 'fk_prescription_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransactions
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `InventoryTransactions` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
         'SELECT 1')
  FROM (SELECT 1 AS ord, 'BusinessId' AS col,
               CONCAT('INT NOT NULL DEFAULT ', @default_business_id) AS def) c
  WHERE NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'InventoryTransactions' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (
  SELECT IFNULL(CONCAT('ALTER TABLE `InventoryTransactions` ', GROUP_CONCAT(CONCAT('ADD ', item.def) ORDER BY item.ord SEPARATOR ', ')), 'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'INDEX idx_business_transaction (BusinessId)' AS def
    UNION ALL SELECT 2, 'CONSTRAINT fk_transaction_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE'
  ) item
  WHERE (item.ord = 1 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'InventoryTransactions' AND s.INDEX_NAME = 'idx_business_transaction'))
     OR (item.ord = 2 AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'InventoryTransactions' AND tc.CONSTRAINT_NAME = 'fk_transaction_business'))
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- Step 5: align legacy enums with the multi-tenant application
-- ---------------------------------------------------------------------------
ALTER TABLE Orders MODIFY COLUMN PaymentMethod ENUM(
  'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer',
  'Insurance Copay', 'Cash on Delivery', 'JazzCash', 'EasyPaisa'
) DEFAULT 'Cash';
ALTER TABLE Orders MODIFY COLUMN PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') DEFAULT 'Pending';

-- ---------------------------------------------------------------------------
-- Step 6: BusinessSettings and SubscriptionPayments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS BusinessSettings (
    SettingId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    SettingKey VARCHAR(100) NOT NULL,
    SettingValue TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_setting_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    UNIQUE KEY unique_business_setting (BusinessId, SettingKey),
    INDEX idx_business_setting (BusinessId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS SubscriptionPayments (
    PaymentId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PaymentMethod VARCHAR(50),
    PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('Pending', 'Completed', 'Failed', 'Refunded') DEFAULT 'Pending',
    TransactionId VARCHAR(255),
    NextBillingDate DATE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    INDEX idx_business_payment (BusinessId),
    INDEX idx_payment_date (PaymentDate),
    INDEX idx_payment_status (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO BusinessSettings (BusinessId, SettingKey, SettingValue)
SELECT @default_business_id, s.SettingKey, s.SettingValue
FROM (
  SELECT 'currency' AS SettingKey, 'PKR' AS SettingValue
  UNION ALL SELECT 'tax_rate', '0.16'
  UNION ALL SELECT 'delivery_fee', '50'
  UNION ALL SELECT 'min_order_amount', '100'
) s
WHERE NOT EXISTS (
  SELECT 1 FROM BusinessSettings bs
  WHERE bs.BusinessId = @default_business_id AND bs.SettingKey = s.SettingKey
);

SELECT 'Migration to multi-tenant schema completed successfully!' AS Status;
