-- Multi-Tenant Medicine Management System Database Schema
-- MySQL/MariaDB Database with Tenant Isolation

-- Create database
CREATE DATABASE IF NOT EXISTS mms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mms_db;

-- Businesses table (Multi-tenancy core table)
CREATE TABLE Businesses (
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

-- Users table with businessId for tenant isolation
CREATE TABLE Users (
    UserId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    Phone VARCHAR(20),
    PasswordHash VARCHAR(255) NOT NULL,
    Role ENUM('SUPER_ADMIN', 'BUSINESS_OWNER', 'CUSTOMER', 'STAFF') NOT NULL DEFAULT 'CUSTOMER',
    IsActive BOOLEAN DEFAULT TRUE,
    ProfileImage VARCHAR(255),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    INDEX idx_business_id (BusinessId),
    INDEX idx_email (Email),
    INDEX idx_phone (Phone),
    INDEX idx_role (Role),
    UNIQUE KEY unique_business_email (BusinessId, Email)
);

-- Categories table with businessId
CREATE TABLE Categories (
    CategoryId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    CategoryName VARCHAR(100) NOT NULL,
    Description TEXT,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    INDEX idx_business_category (BusinessId),
    INDEX idx_category_name (CategoryName),
    UNIQUE KEY unique_business_category (BusinessId, CategoryName)
);

-- Medicines table with businessId
CREATE TABLE Medicines (
    MedicineId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    CategoryId INT,
    Name VARCHAR(200) NOT NULL,
    Description TEXT,
    Price DECIMAL(10,2) NOT NULL,
    AverageCost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    Stock INT NOT NULL DEFAULT 0,
    ExpiryDate DATE,
    Manufacturer VARCHAR(100),
    ImagePath VARCHAR(255),
    RequiresPrescription BOOLEAN DEFAULT FALSE,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_medicine_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_medicine_category FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId) ON DELETE SET NULL,
    INDEX idx_business_medicine (BusinessId),
    INDEX idx_medicine_name (Name),
    INDEX idx_category (CategoryId),
    INDEX idx_expiry (ExpiryDate),
    INDEX idx_stock (Stock),
    INDEX idx_active (IsActive)
);

-- Addresses table with businessId
CREATE TABLE Addresses (
    AddressId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    UserId INT NOT NULL,
    Street VARCHAR(255) NOT NULL,
    City VARCHAR(100) NOT NULL,
    State VARCHAR(100) NOT NULL,
    PostalCode VARCHAR(20) NOT NULL,
    Country VARCHAR(100) DEFAULT 'Pakistan',
    IsDefault BOOLEAN DEFAULT FALSE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_address_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_address_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    INDEX idx_business_address (BusinessId),
    INDEX idx_user (UserId),
    INDEX idx_default (IsDefault)
);

-- Orders table with businessId
CREATE TABLE Orders (
    OrderId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    UserId INT NULL,
    OrderDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    Source ENUM('Online', 'POS') DEFAULT 'Online',
    TotalAmount DECIMAL(10,2) NOT NULL,
    DeliveryAddress VARCHAR(255),
    CustomerName VARCHAR(100) NULL,
    CustomerPhone VARCHAR(20) NULL,
    PaymentMethod ENUM('Cash on Delivery', 'Credit Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Cash') DEFAULT 'Cash on Delivery',
    PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') DEFAULT 'Pending',
    PrescriptionId INT NULL,
    Notes TEXT,
    CreatedBy INT NULL,
    ReorderedFromOrderId INT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_order_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL,
    CONSTRAINT fk_order_creator FOREIGN KEY (CreatedBy) REFERENCES Users(UserId) ON DELETE SET NULL,
    INDEX idx_business_order (BusinessId),
    INDEX idx_user_orders (UserId),
    INDEX idx_status (Status),
    INDEX idx_order_date (OrderDate),
    INDEX idx_source (Source)
);

-- OrderItems table with businessId
CREATE TABLE OrderItems (
    OrderItemId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    OrderId INT NOT NULL,
    MedicineId INT NOT NULL,
    Quantity INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    CostPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    Subtotal DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_orderitem_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_order FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE RESTRICT,
    INDEX idx_business_orderitem (BusinessId),
    INDEX idx_order (OrderId),
    INDEX idx_medicine (MedicineId)
);

-- Prescriptions table with businessId
CREATE TABLE Prescriptions (
    PrescriptionId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    UserId INT NOT NULL,
    ImagePath VARCHAR(255) NOT NULL,
    Status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    Notes TEXT,
    ApprovedBy INT NULL,
    ApprovedAt TIMESTAMP NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_prescription_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_approver FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId) ON DELETE SET NULL,
    INDEX idx_business_prescription (BusinessId),
    INDEX idx_user_prescriptions (UserId),
    INDEX idx_status (Status)
);

-- Inventory transactions table with businessId
CREATE TABLE InventoryTransactions (
    TransactionId INT AUTO_INCREMENT PRIMARY KEY,
    BusinessId INT NOT NULL,
    MedicineId INT NOT NULL,
    TransactionType ENUM('Stock In', 'Stock Out', 'Adjustment') NOT NULL,
    Quantity INT NOT NULL,
    PreviousStock INT NOT NULL,
    NewStock INT NOT NULL,
    Reason VARCHAR(255),
    PerformedBy INT NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transaction_business FOREIGN KEY (BusinessId) REFERENCES Businesses(BusinessId) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_performer FOREIGN KEY (PerformedBy) REFERENCES Users(UserId) ON DELETE RESTRICT,
    INDEX idx_business_transaction (BusinessId),
    INDEX idx_medicine_transactions (MedicineId),
    INDEX idx_transaction_type (TransactionType),
    INDEX idx_performed_by (PerformedBy)
);

-- Vendors table
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

-- Purchase Orders table
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

-- Purchase Order Items table (UnitCost)
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

-- Employees table
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

-- Salaries / Payroll table
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

-- Business Settings table
CREATE TABLE BusinessSettings (
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

-- Subscription Payments table
CREATE TABLE SubscriptionPayments (
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

-- Insert default Super Admin (no businessId - platform level)
INSERT INTO Users (Name, Email, Phone, PasswordHash, Role, IsActive) VALUES
('Super Admin', 'superadmin@mms.com', '+923001234567', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SUPER_ADMIN', TRUE);

-- Insert sample businesses
INSERT INTO Businesses (BusinessName, BusinessCode, OwnerName, Email, Phone, Address, City, State, SubscriptionPlan, Status) VALUES
('MediCare Pharmacy', 'MEDICARE001', 'Ahmed Khan', 'ahmed@medicare.com', '+923001234568', '123 Main Street', 'Karachi', 'Sindh', 'Premium', 'Active'),
('HealthPlus Drugs', 'HEALTHPLUS002', 'Fatima Ali', 'fatima@healthplus.com', '+923001234569', '456 Market Road', 'Lahore', 'Punjab', 'Basic', 'Active'),
('CureWell Pharmacy', 'CUREWELL003', 'Usman Malik', 'usman@curewell.com', '+923001234570', '789 Garden Avenue', 'Islamabad', 'Capital', 'Free', 'Active');

-- Insert business owners for each business
INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive) VALUES
(1, 'Ahmed Khan', 'ahmed@medicare.com', '+923001234568', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'BUSINESS_OWNER', TRUE),
(2, 'Fatima Ali', 'fatima@healthplus.com', '+923001234569', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'BUSINESS_OWNER', TRUE),
(3, 'Usman Malik', 'usman@curewell.com', '+923001234570', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'BUSINESS_OWNER', TRUE);

-- Insert default categories for each business
INSERT INTO Categories (BusinessId, CategoryName, Description) VALUES
(1, 'Pain Relief', 'Medicines for pain management and relief'),
(1, 'Antibiotics', 'Antibacterial and antimicrobial medications'),
(1, 'Vitamins & Supplements', 'Dietary supplements and vitamins'),
(1, 'Cold & Flu', 'Medications for cold, flu and respiratory issues'),
(1, 'Digestive Health', 'Medicines for digestive system health'),
(2, 'Pain Relief', 'Medicines for pain management and relief'),
(2, 'Antibiotics', 'Antibacterial and antimicrobial medications'),
(2, 'Vitamins & Supplements', 'Dietary supplements and vitamins'),
(2, 'Cold & Flu', 'Medications for cold, flu and respiratory issues'),
(2, 'Digestive Health', 'Medicines for digestive system health'),
(3, 'Pain Relief', 'Medicines for pain management and relief'),
(3, 'Antibiotics', 'Antibacterial and antimicrobial medications'),
(3, 'Vitamins & Supplements', 'Dietary supplements and vitamins'),
(3, 'Cold & Flu', 'Medications for cold, flu and respiratory issues'),
(3, 'Digestive Health', 'Medicines for digestive system health');

-- Insert sample medicines for each business
INSERT INTO Medicines (BusinessId, CategoryId, Name, Description, Price, Stock, ExpiryDate, Manufacturer, RequiresPrescription) VALUES
(1, 1, 'Paracetamol 500mg', 'Pain relief medication', 50.00, 100, '2025-12-31', 'PharmaCo', FALSE),
(1, 2, 'Amoxicillin 500mg', 'Antibiotic medication', 120.00, 50, '2024-12-31', 'MediLab', TRUE),
(1, 3, 'Vitamin C 1000mg', 'Vitamin C supplement', 80.00, 200, '2026-06-30', 'HealthPlus', FALSE),
(1, 4, 'Cough Syrup', 'Cough relief syrup', 150.00, 75, '2025-08-31', 'CureAll', FALSE),
(1, 5, 'Antacid Tablets', 'Acid relief medication', 60.00, 120, '2025-10-31', 'GutHealth', FALSE),
(2, 6, 'Paracetamol 500mg', 'Pain relief medication', 55.00, 80, '2025-12-31', 'PharmaCo', FALSE),
(2, 7, 'Amoxicillin 500mg', 'Antibiotic medication', 125.00, 40, '2024-12-31', 'MediLab', TRUE),
(2, 8, 'Vitamin C 1000mg', 'Vitamin C supplement', 85.00, 150, '2026-06-30', 'HealthPlus', FALSE),
(2, 9, 'Cough Syrup', 'Cough relief syrup', 160.00, 60, '2025-08-31', 'CureAll', FALSE),
(2, 10, 'Antacid Tablets', 'Acid relief medication', 65.00, 100, '2025-10-31', 'GutHealth', FALSE),
(3, 11, 'Paracetamol 500mg', 'Pain relief medication', 45.00, 90, '2025-12-31', 'PharmaCo', FALSE),
(3, 12, 'Amoxicillin 500mg', 'Antibiotic medication', 115.00, 45, '2024-12-31', 'MediLab', TRUE),
(3, 13, 'Vitamin C 1000mg', 'Vitamin C supplement', 75.00, 180, '2026-06-30', 'HealthPlus', FALSE),
(3, 14, 'Cough Syrup', 'Cough relief syrup', 145.00, 70, '2025-08-31', 'CureAll', FALSE),
(3, 15, 'Antacid Tablets', 'Acid relief medication', 55.00, 110, '2025-10-31', 'GutHealth', FALSE);

-- Insert sample customers for each business
INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive) VALUES
(1, 'Ali Hassan', 'ali@example.com', '+923001234571', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE),
(1, 'Sara Ahmed', 'sara@example.com', '+923001234572', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE),
(2, 'Bilal Khan', 'bilal@example.com', '+923001234573', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE),
(2, 'Zara Ali', 'zara@example.com', '+923001234574', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE),
(3, 'Hassan Malik', 'hassan@example.com', '+923001234575', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE),
(3, 'Ayesha Khan', 'ayesha@example.com', '+923001234576', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CUSTOMER', TRUE);

-- Insert sample orders
INSERT INTO Orders (BusinessId, UserId, TotalAmount, Status, PaymentStatus) VALUES
(1, 4, 200.00, 'Delivered', 'Paid'),
(1, 5, 150.00, 'Pending', 'Pending'),
(2, 6, 180.00, 'Approved', 'Paid'),
(2, 7, 220.00, 'Dispatched', 'Paid'),
(3, 8, 160.00, 'Delivered', 'Paid'),
(3, 9, 140.00, 'Pending', 'Pending');

-- Insert default business settings
INSERT INTO BusinessSettings (BusinessId, SettingKey, SettingValue) VALUES
(1, 'currency', 'PKR'),
(1, 'tax_rate', '0.16'),
(1, 'delivery_fee', '50'),
(1, 'min_order_amount', '100'),
(2, 'currency', 'PKR'),
(2, 'tax_rate', '0.16'),
(2, 'delivery_fee', '60'),
(2, 'min_order_amount', '150'),
(3, 'currency', 'PKR'),
(3, 'tax_rate', '0.16'),
(3, 'delivery_fee', '40'),
(3, 'min_order_amount', '80');
