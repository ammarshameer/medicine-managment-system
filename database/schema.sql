-- Medicine Management System Database Schema
-- MySQL/MariaDB Database

-- Create database
CREATE DATABASE IF NOT EXISTS mms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mms_db;

-- Users table
CREATE TABLE Users (
    UserId INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Phone VARCHAR(20) UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Role ENUM('Patient', 'Super Admin', 'Pharmacy Admin', 'Inventory Manager', 'Delivery Manager') NOT NULL DEFAULT 'Patient',
    IsActive BOOLEAN DEFAULT TRUE,
    ProfileImage VARCHAR(255),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (Email),
    INDEX idx_phone (Phone),
    INDEX idx_role (Role)
);

-- Categories table
CREATE TABLE Categories (
    CategoryId INT AUTO_INCREMENT PRIMARY KEY,
    CategoryName VARCHAR(100) NOT NULL,
    Description TEXT,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category_name (CategoryName)
);

-- Medicines table
CREATE TABLE Medicines (
    MedicineId INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    CategoryId INT,
    Description TEXT,
    Price DECIMAL(10,2) NOT NULL,
    Stock INT NOT NULL DEFAULT 0,
    ExpiryDate DATE,
    Manufacturer VARCHAR(100),
    ImagePath VARCHAR(255),
    RequiresPrescription BOOLEAN DEFAULT FALSE,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_medicine_category FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId) ON DELETE SET NULL,
    INDEX idx_medicine_name (Name),
    INDEX idx_category (CategoryId),
    INDEX idx_expiry (ExpiryDate),
    INDEX idx_stock (Stock),
    INDEX idx_active (IsActive)
);

-- Addresses table
CREATE TABLE Addresses (
    AddressId INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    Street VARCHAR(255) NOT NULL,
    City VARCHAR(100) NOT NULL,
    State VARCHAR(100) NOT NULL,
    PostalCode VARCHAR(20) NOT NULL,
    Country VARCHAR(100) DEFAULT 'Pakistan',
    IsDefault BOOLEAN DEFAULT FALSE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_address_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    INDEX idx_user (UserId),
    INDEX idx_default (IsDefault)
);

-- Orders table
CREATE TABLE Orders (
    OrderId INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    OrderDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    TotalAmount DECIMAL(10,2) NOT NULL,
    DeliveryAddress VARCHAR(255),
    PaymentMethod ENUM('Cash on Delivery', 'Credit Card', 'Bank Transfer') DEFAULT 'Cash on Delivery',
    PaymentStatus ENUM('Pending', 'Paid', 'Failed') DEFAULT 'Pending',
    PrescriptionId INT NULL,
    Notes TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    INDEX idx_user_orders (UserId),
    INDEX idx_status (Status),
    INDEX idx_order_date (OrderDate)
);

-- OrderItems table
CREATE TABLE OrderItems (
    OrderItemId INT AUTO_INCREMENT PRIMARY KEY,
    OrderId INT NOT NULL,
    MedicineId INT NOT NULL,
    Quantity INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_orderitem_order FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE RESTRICT,
    INDEX idx_order (OrderId),
    INDEX idx_medicine (MedicineId)
);

-- Prescriptions table
CREATE TABLE Prescriptions (
    PrescriptionId INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    ImagePath VARCHAR(255) NOT NULL,
    Status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    Notes TEXT,
    ApprovedBy INT NULL,
    ApprovedAt TIMESTAMP NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_prescription_user FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_approver FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId) ON DELETE SET NULL,
    INDEX idx_user_prescriptions (UserId),
    INDEX idx_status (Status)
);

-- Inventory transactions table
CREATE TABLE InventoryTransactions (
    TransactionId INT AUTO_INCREMENT PRIMARY KEY,
    MedicineId INT NOT NULL,
    TransactionType ENUM('Stock In', 'Stock Out', 'Adjustment') NOT NULL,
    Quantity INT NOT NULL,
    PreviousStock INT NOT NULL,
    NewStock INT NOT NULL,
    Reason VARCHAR(255),
    PerformedBy INT NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transaction_medicine FOREIGN KEY (MedicineId) REFERENCES Medicines(MedicineId) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_performer FOREIGN KEY (PerformedBy) REFERENCES Users(UserId) ON DELETE RESTRICT,
    INDEX idx_medicine_transactions (MedicineId),
    INDEX idx_transaction_type (TransactionType),
    INDEX idx_performed_by (PerformedBy)
);

-- Insert default categories
INSERT INTO Categories (CategoryName, Description) VALUES
('Pain Relief', 'Medicines for pain management and relief'),
('Antibiotics', 'Antibacterial and antimicrobial medications'),
('Vitamins & Supplements', 'Dietary supplements and vitamins'),
('Cold & Flu', 'Medications for cold, flu and respiratory issues'),
('Digestive Health', 'Medicines for digestive system health'),
('Allergy', 'Anti-allergy medications'),
('Diabetes', 'Medications for diabetes management'),
('Heart Health', 'Cardiovascular medications'),
('First Aid', 'Basic first aid supplies and medications'),
('Personal Care', 'Personal hygiene and care products');

-- Insert default admin user (password: admin123)
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES
('Super Admin', 'admin@mms.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Admin');

-- Insert sample medicines
INSERT INTO Medicines (Name, CategoryId, Description, Price, Stock, ExpiryDate, Manufacturer, RequiresPrescription) VALUES
('Paracetamol 500mg', 1, 'Pain relief medication', 50.00, 100, '2025-12-31', 'PharmaCo', FALSE),
('Amoxicillin 500mg', 2, 'Antibiotic medication', 120.00, 50, '2024-12-31', 'MediLab', TRUE),
('Vitamin C 1000mg', 3, 'Vitamin C supplement', 80.00, 200, '2026-06-30', 'HealthPlus', FALSE),
('Cough Syrup', 4, 'Cough relief syrup', 150.00, 75, '2025-08-31', 'CureAll', FALSE),
('Antacid Tablets', 5, 'Acid relief medication', 60.00, 120, '2025-10-31', 'GutHealth', FALSE);
