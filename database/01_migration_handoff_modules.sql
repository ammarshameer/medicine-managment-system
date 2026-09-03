-- Migration script for MMS Handoff Modules:
-- 1. POS enhancements (Source, walk-in support, CreatedBy, ReorderedFromOrderId)
-- 2. Average Cost on Medicines and CostPrice snapshot on OrderItems
-- 3. Vendors & Purchase Orders (with UnitCost)
-- 4. HRMS (Employees & Salaries/Payroll)

USE mms_db;

-- 1. Update Medicines table for AverageCost
ALTER TABLE Medicines 
ADD COLUMN IF NOT EXISTS AverageCost DECIMAL(10,2) DEFAULT 0.00 AFTER Price;

-- 2. Update OrderItems table for CostPrice snapshot
ALTER TABLE OrderItems 
ADD COLUMN IF NOT EXISTS CostPrice DECIMAL(10,2) DEFAULT 0.00 AFTER Price;

-- 3. Update Orders table for POS & Reordering support
ALTER TABLE Orders 
MODIFY COLUMN UserId INT NULL;

ALTER TABLE Orders 
ADD COLUMN IF NOT EXISTS Source ENUM('Online', 'POS') DEFAULT 'Online' AFTER Status,
ADD COLUMN IF NOT EXISTS CustomerName VARCHAR(100) NULL AFTER DeliveryAddress,
ADD COLUMN IF NOT EXISTS CustomerPhone VARCHAR(20) NULL AFTER CustomerName,
ADD COLUMN IF NOT EXISTS CreatedBy INT NULL AFTER Notes,
ADD COLUMN IF NOT EXISTS ReorderedFromOrderId INT NULL AFTER CreatedBy;

-- Optional foreign keys (ignore if already added)
-- ALTER TABLE Orders ADD CONSTRAINT fk_orders_created_by FOREIGN KEY (CreatedBy) REFERENCES Users(UserId) ON DELETE SET NULL;
-- ALTER TABLE Orders ADD CONSTRAINT fk_orders_reordered FOREIGN KEY (ReorderedFromOrderId) REFERENCES Orders(OrderId) ON DELETE SET NULL;

-- 4. Vendors table
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
);

-- 5. Purchase Orders table
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
);

-- 6. Purchase Order Items table (UnitCost)
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
);

-- 7. Employees table
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
);

-- 8. Salaries / Payroll table
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
);
