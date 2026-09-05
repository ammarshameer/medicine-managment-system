-- Migration: Making MMS USA/UAE-Ready
-- Description: Adds multi-country configurations, line-item tax engine fields, 
-- DEA/UAE medicine classifications, controlled substance audit logs, and Emirates ID.

USE mms_db;

-- 1. Businesses Table Updates
ALTER TABLE Businesses 
  ADD COLUMN Currency VARCHAR(3) DEFAULT 'USD',
  ADD COLUMN TaxEnabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN TaxRate DECIMAL(6,5) DEFAULT 0.00000,
  ADD COLUMN TaxRegistrationNumber VARCHAR(50) NULL,
  ADD COLUMN LicenseNumber VARCHAR(100) NULL,
  ADD COLUMN LicenseAuthority VARCHAR(100) NULL,
  ADD COLUMN Locale VARCHAR(10) DEFAULT 'en-US',
  ADD COLUMN Timezone VARCHAR(50) DEFAULT 'America/New_York',
  ADD COLUMN PharmacistInChargeName VARCHAR(100) NULL;

-- Remove hardcoded default 'Pakistan'
ALTER TABLE Businesses ALTER COLUMN Country DROP DEFAULT;

-- BACKFILL: Preserve pre-existing Pakistan businesses in PKR
UPDATE Businesses 
SET Currency = 'PKR' 
WHERE Country = 'Pakistan' OR Country IS NULL;

-- 2. Addresses Table: Remove default 'Pakistan'
ALTER TABLE Addresses ALTER COLUMN Country DROP DEFAULT;

-- 3. Medicines Table Updates
ALTER TABLE Medicines
  ADD COLUMN DEASchedule ENUM('None', 'I', 'II', 'III', 'IV', 'V') NOT NULL DEFAULT 'None',
  ADD COLUMN UAEClassification ENUM('OTC', 'Pharmacist-Only', 'POM', 'Controlled', 'Semi-Controlled', 'Narcotic') NOT NULL DEFAULT 'OTC',
  ADD COLUMN IsTaxable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN PriceIncludesTax BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Orders Table Updates
ALTER TABLE Orders
  ADD COLUMN Subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN TaxRate DECIMAL(6,5) NOT NULL DEFAULT 0.00000,
  ADD COLUMN TaxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN Currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  MODIFY COLUMN PaymentMethod ENUM('Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay', 'Cash on Delivery', 'JazzCash', 'EasyPaisa') DEFAULT 'Cash';

-- 5. OrderItems Table Updates
ALTER TABLE OrderItems
  ADD COLUMN TaxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IsTaxable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN PriceIncludesTax BOOLEAN NOT NULL DEFAULT FALSE;

-- 6. Users Table Updates
ALTER TABLE Users
  ADD COLUMN EmiratesId VARCHAR(20) NULL,
  ADD COLUMN NationalIdLast4 VARCHAR(4) NULL;

-- 7. Controlled Substances Compliance Audit Log Table
CREATE TABLE IF NOT EXISTS ControlledSubstanceLog (
    LogId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    MedicineId INT NOT NULL,
    OrderId INT NULL,
    PrescriptionId INT NULL,
    Action ENUM('Dispensed', 'Received', 'Adjusted', 'Destroyed') NOT NULL,
    Quantity INT NOT NULL,
    PerformedBy INT NOT NULL,
    Notes TEXT NULL,
    Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_csl_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_csl_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE RESTRICT,
    CONSTRAINT fk_csl_order FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE SET NULL,
    CONSTRAINT fk_csl_performer FOREIGN KEY (PerformedBy) REFERENCES Users(UserId) ON DELETE RESTRICT,
    INDEX idx_csl_business (BusinessId),
    INDEX idx_csl_medicine (MedicineId),
    INDEX idx_csl_action (Action),
    INDEX idx_csl_timestamp (Timestamp)
);

-- 8. Backfill Historic Orders & OrderItems
UPDATE Orders 
SET Subtotal = TotalAmount, TaxRate = 0.00000, TaxAmount = 0.00, Currency = 'PKR' 
WHERE Subtotal = 0.00 OR Subtotal IS NULL;

UPDATE OrderItems 
SET TaxAmount = 0.00, IsTaxable = TRUE, PriceIncludesTax = FALSE 
WHERE TaxAmount IS NULL;
