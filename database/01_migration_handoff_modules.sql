-- Migration script for MMS Handoff Modules (MySQL 8 compatible, safe to re-run):
--   1. POS enhancements (Source, walk-in support, CreatedBy, ReorderedFromOrderId)
--   2. Average Cost on Medicines and CostPrice snapshot on OrderItems
--   3. Vendors / Purchase Orders / PurchaseOrderItems
--   4. HRMS: Employees, Salaries (payroll) and Attendance
--   5. PaymentTransactions (payment gateway audit)
--
-- NOTE: there is no table named `Payroll`. Payroll data lives in `Salaries`,
-- and staff attendance lives in `Attendance`.
--
-- Column additions are guarded through INFORMATION_SCHEMA because MySQL 8 does
-- not support conditional column additions directly in an ALTER statement.

USE mms_db;

-- ---------------------------------------------------------------------------
-- 1. Medicines.AverageCost
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Medicines` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'AverageCost' AS col, 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' AS def
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Medicines' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2. OrderItems.CostPrice
-- ---------------------------------------------------------------------------
SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `OrderItems` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'CostPrice' AS col, 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' AS def
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'OrderItems' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 3. Orders: allow walk-in (NULL UserId) and add POS/reorder columns
-- ---------------------------------------------------------------------------
ALTER TABLE Orders MODIFY COLUMN UserId INT NULL;

SET @sql = (
  SELECT IFNULL(
    CONCAT('ALTER TABLE `Orders` ',
           GROUP_CONCAT(CONCAT('ADD COLUMN `', c.col, '` ', c.def) ORDER BY c.ord SEPARATOR ', ')),
    'SELECT 1')
  FROM (
    SELECT 1 AS ord, 'Source' AS col, 'ENUM(''Online'', ''POS'') DEFAULT ''Online''' AS def
    UNION ALL SELECT 2, 'CustomerName', 'VARCHAR(100) NULL'
    UNION ALL SELECT 3, 'CustomerPhone', 'VARCHAR(20) NULL'
    UNION ALL SELECT 4, 'CreatedBy', 'INT NULL'
    UNION ALL SELECT 5, 'ReorderedFromOrderId', 'INT NULL'
  ) c
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS ic
    WHERE ic.TABLE_SCHEMA = DATABASE() AND ic.TABLE_NAME = 'Orders' AND ic.COLUMN_NAME = c.col)
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4. Vendors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Vendors (
    VendorId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    Name VARCHAR(150) NOT NULL,
    ContactPerson VARCHAR(100),
    Email VARCHAR(100),
    Phone VARCHAR(20),
    Address TEXT,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_vendor_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    INDEX idx_business_vendor (BusinessId),
    INDEX idx_vendor_name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. Purchase Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PurchaseOrders (
    PurchaseOrderId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    VendorId INT NOT NULL,
    OrderNumber VARCHAR(50) NOT NULL,
    OrderDate DATE NOT NULL,
    Status ENUM('Draft', 'Ordered', 'Received', 'Cancelled') DEFAULT 'Draft',
    TotalAmount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    Notes TEXT,
    ReceivedAt TIMESTAMP NULL,
    CreatedBy INT NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_po_vendor FOREIGN KEY (VendorId) REFERENCES Vendors(VendorId) ON DELETE RESTRICT,
    CONSTRAINT fk_po_creator FOREIGN KEY (CreatedBy) REFERENCES Users(UserId) ON DELETE RESTRICT,
    INDEX idx_business_po (BusinessId),
    INDEX idx_po_vendor (VendorId),
    INDEX idx_po_status (Status),
    INDEX idx_po_number (OrderNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Purchase Order Items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PurchaseOrderItems (
    PurchaseOrderItemId INT AUTO_INCREMENT PRIMARY KEY,
    PurchaseOrderId INT NOT NULL,
    BusinessId INT NOT NULL,
    MedicineId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitCost DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(12,2) NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_poi_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_poi_order FOREIGN KEY (PurchaseOrderId) REFERENCES PurchaseOrders(PurchaseOrderId) ON DELETE CASCADE,
    CONSTRAINT fk_poi_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE RESTRICT,
    INDEX idx_poi_business (BusinessId),
    INDEX idx_poi_order (PurchaseOrderId),
    INDEX idx_poi_medicine (MedicineId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. Employees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Employees (
    EmployeeId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    UserId INT NOT NULL,
    Designation VARCHAR(100) NOT NULL,
    Department VARCHAR(100) DEFAULT 'Pharmacy',
    JoiningDate DATE NOT NULL,
    Salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    EmploymentStatus ENUM('Active', 'Inactive', 'Terminated', 'On Leave') DEFAULT 'Active',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_employee_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    UNIQUE KEY unique_business_user (BusinessId, UserId),
    INDEX idx_business_employee (BusinessId),
    INDEX idx_employee_status (EmploymentStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Salaries (the payroll table used by the HRMS routes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Salaries (
    SalaryId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    EmployeeId INT NOT NULL,
    Month INT NOT NULL,
    Year INT NOT NULL,
    BasicSalary DECIMAL(10,2) NOT NULL,
    Allowances DECIMAL(10,2) DEFAULT 0.00,
    Deductions DECIMAL(10,2) DEFAULT 0.00,
    NetSalary DECIMAL(10,2) NOT NULL,
    PaymentStatus ENUM('Pending', 'Paid', 'Cancelled') DEFAULT 'Pending',
    PaymentDate DATE NULL,
    PaymentMethod VARCHAR(50) NULL,
    Notes TEXT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_salary_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_salary_employee FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE,
    INDEX idx_business_salary (BusinessId),
    INDEX idx_salary_employee (EmployeeId),
    INDEX idx_salary_period (Year, Month),
    INDEX idx_salary_status (PaymentStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9. Attendance
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

-- ---------------------------------------------------------------------------
-- 10. PaymentTransactions
-- ---------------------------------------------------------------------------
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

SELECT 'Handoff module migration completed successfully!' AS Status;
