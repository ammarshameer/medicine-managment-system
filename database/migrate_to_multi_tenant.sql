-- Migration Script: Convert existing single-tenant schema to multi-tenant
-- This script should be run on an existing database to add multi-tenancy support
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT

USE mms_db;

-- Step 1: Add Businesses table
CREATE TABLE IF NOT EXISTS Businesses (
    BusinessId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessName VARCHAR(200) NOT NULL,
    BusinessCode VARCHAR(50) UNIQUE NOT NULL,
    Logo VARCHAR(255),
    OwnerName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    Phone VARCHAR(20) NOT NULL,
    Address TEXT,
    City VARCHAR(100),
    State VARCHAR(100),
    Country VARCHAR(100) DEFAULT 'Pakistan',
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
);

-- Step 2: Add BusinessId column to Users table
ALTER TABLE Users 
ADD COLUMN BusinessId INT NULL AFTER UserId,
ADD INDEX idx_business_id (BusinessId),
ADD CONSTRAINT fk_user_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 3: Update Users table to use new role enum
ALTER TABLE Users 
MODIFY COLUMN Role ENUM('SUPER_ADMIN', 'BUSINESS_OWNER', 'CUSTOMER', 'STAFF') NOT NULL DEFAULT 'CUSTOMER';

-- Step 4: Add unique constraint for business+email
ALTER TABLE Users 
ADD UNIQUE KEY unique_business_email (BusinessId, Email);

-- Step 5: Add BusinessId column to Categories table
ALTER TABLE Categories 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER CategoryId,
ADD INDEX idx_business_category (BusinessId),
ADD CONSTRAINT fk_category_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
ADD UNIQUE KEY unique_business_category (BusinessId, CategoryName);

-- Step 6: Add BusinessId column to Medicines table
ALTER TABLE Medicines 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER MedicineId,
ADD INDEX idx_business_medicine (BusinessId),
ADD CONSTRAINT fk_medicine_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 7: Add BusinessId column to Addresses table
ALTER TABLE Addresses 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER AddressId,
ADD INDEX idx_business_address (BusinessId),
ADD CONSTRAINT fk_address_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 8: Add BusinessId column to Orders table
ALTER TABLE Orders 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER OrderId,
ADD INDEX idx_business_order (BusinessId),
ADD CONSTRAINT fk_order_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 9: Update Orders PaymentMethod enum
ALTER TABLE Orders 
MODIFY COLUMN PaymentMethod ENUM('Cash on Delivery', 'Credit Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa') DEFAULT 'Cash on Delivery';

-- Step 10: Update Orders PaymentStatus enum
ALTER TABLE Orders 
MODIFY COLUMN PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') DEFAULT 'Pending';

-- Step 11: Add BusinessId column to OrderItems table
ALTER TABLE OrderItems 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER OrderItemId,
ADD INDEX idx_business_orderitem (BusinessId),
ADD CONSTRAINT fk_orderitem_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 12: Add BusinessId column to Prescriptions table
ALTER TABLE Prescriptions 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER PrescriptionId,
ADD INDEX idx_business_prescription (BusinessId),
ADD CONSTRAINT fk_prescription_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 13: Add BusinessId column to InventoryTransactions table
ALTER TABLE InventoryTransactions 
ADD COLUMN BusinessId INT NOT NULL DEFAULT 1 AFTER TransactionId,
ADD INDEX idx_business_transaction (BusinessId),
ADD CONSTRAINT fk_transaction_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE;

-- Step 14: Create BusinessSettings table
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
);

-- Step 15: Create SubscriptionPayments table
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
);

-- Step 16: Insert default business (for existing data)
INSERT INTO Businesses (BusinessName, BusinessCode, OwnerName, Email, Phone, Address, City, State, SubscriptionPlan, Status)
VALUES ('Default Pharmacy', 'DEFAULT001', 'System Admin', 'admin@mms.com', '+923000000000', 'Default Address', 'Karachi', 'Sindh', 'Premium', 'Active')
ON DUPLICATE KEY UPDATE BusinessName = BusinessName;

-- Step 17: Update existing users to link to default business
UPDATE Users SET BusinessId = 1 WHERE BusinessId IS NULL;

-- Step 18: Make BusinessId NOT NULL in Users after updating
ALTER TABLE Users MODIFY COLUMN BusinessId INT NULL;

-- Step 19: Update existing categories to link to default business
UPDATE Categories SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 20: Update existing medicines to link to default business
UPDATE Medicines SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 21: Update existing addresses to link to default business
UPDATE Addresses SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 22: Update existing orders to link to default business
UPDATE Orders SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 23: Update existing order items to link to default business
UPDATE OrderItems SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 24: Update existing prescriptions to link to default business
UPDATE Prescriptions SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 25: Update existing inventory transactions to link to default business
UPDATE InventoryTransactions SET BusinessId = 1 WHERE BusinessId IS NULL OR BusinessId = 0;

-- Step 26: Insert default business settings
INSERT INTO BusinessSettings (BusinessId, SettingKey, SettingValue) VALUES
(1, 'currency', 'PKR'),
(1, 'tax_rate', '0.16'),
(1, 'delivery_fee', '50'),
(1, 'min_order_amount', '100')
ON DUPLICATE KEY UPDATE SettingValue = SettingValue;

-- Migration complete
SELECT 'Migration to multi-tenant schema completed successfully!' AS Status;
