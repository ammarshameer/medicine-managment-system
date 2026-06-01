-- Additional seed data for Medicine Management System
USE mms_db;

-- Insert more sample medicines
INSERT INTO Medicines (Name, CategoryId, Description, Price, Stock, ExpiryDate, Manufacturer, RequiresPrescription) VALUES
('Ibuprofen 400mg', 1, 'Anti-inflammatory pain medication', 75.00, 80, '2025-11-30', 'PainAway', FALSE),
('Aspirin 300mg', 1, 'Blood thinner and pain reliever', 45.00, 150, '2026-01-31', 'AspirinCorp', FALSE),
('Ciprofloxacin 500mg', 2, 'Broad-spectrum antibiotic', 180.00, 40, '2024-11-30', 'BioPharm', TRUE),
('Azithromycin 250mg', 2, 'Macrolide antibiotic', 220.00, 35, '2025-02-28', 'ZithroMed', TRUE),
('Vitamin D3 1000IU', 3, 'Vitamin D3 supplement', 95.00, 180, '2026-12-31', 'SunVit', FALSE),
('Multivitamin Tablets', 3, 'Complete multivitamin supplement', 160.00, 90, '2025-09-30', 'MultiHealth', FALSE),
('Cold Tablets', 4, 'Multi-symptom cold relief', 110.00, 100, '2025-07-31', 'ColdStop', FALSE),
('Nasal Spray', 4, 'Nasal congestion relief', 85.00, 60, '2025-08-31', 'NasalCare', FALSE),
('Probiotic Capsules', 5, 'Digestive health probiotics', 200.00, 70, '2026-03-31', 'GutBalance', FALSE),
('Laxative Tablets', 5, 'Constipation relief', 70.00, 80, '2025-06-30', 'ReliefNow', FALSE),
('Loratadine 10mg', 6, 'Antihistamine for allergies', 130.00, 110, '2025-10-31', 'AllergyFree', FALSE),
('Cetirizine 10mg', 6, 'Antihistamine for allergies', 125.00, 95, '2025-09-30', 'HistamineBlock', FALSE),
('Metformin 500mg', 7, 'Diabetes medication', 90.00, 120, '2025-04-30', 'DiaCare', TRUE),
('Insulin Pen', 7, 'Insulin delivery device', 1500.00, 30, '2024-12-31', 'InsuTech', TRUE),
('Atorvastatin 20mg', 8, 'Cholesterol medication', 140.00, 85, '2025-05-31', 'HeartGuard', TRUE),
('Bandage Pack', 9, 'First aid bandages', 40.00, 200, '2027-01-31', 'FirstAidPro', FALSE),
('Antiseptic Solution', 9, 'Wound cleaning solution', 55.00, 120, '2026-08-31', 'CleanWound', FALSE),
('Hand Sanitizer', 10, 'Alcohol-based hand sanitizer', 35.00, 250, '2026-11-30', 'CleanHands', FALSE),
('Face Mask Pack', 10, 'Protective face masks', 25.00, 500, '2025-03-31', 'SafeMask', FALSE),
('Thermometer Digital', 10, 'Digital thermometer', 180.00, 60, '2027-02-28', 'TempCheck', FALSE);

-- Insert sample users
INSERT INTO Users (Name, Email, Phone, PasswordHash, Role) VALUES
('John Doe', 'john.doe@email.com', '03001234567', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient'),
('Jane Smith', 'jane.smith@email.com', '03002345678', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient'),
('Ahmed Khan', 'ahmed.khan@email.com', '03003456789', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient'),
('Sarah Wilson', 'sarah.wilson@email.com', '03004567890', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Patient'),
('Pharmacy Admin', 'pharmacy@mms.com', '03005678901', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Pharmacy Admin'),
('Inventory Manager', 'inventory@mms.com', '03006789012', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Inventory Manager'),
('Delivery Manager', 'delivery@mms.com', '03007890123', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Delivery Manager');

-- Insert sample addresses
INSERT INTO Addresses (UserId, Street, City, State, PostalCode, IsDefault) VALUES
(2, '123 Main Street', 'Karachi', 'Sindh', '74200', TRUE),
(2, '456 Garden Road', 'Lahore', 'Punjab', '54000', FALSE),
(3, '789 Boulevard', 'Islamabad', 'Capital', '44000', TRUE),
(4, '321 Market Street', 'Faisalabad', 'Punjab', '38000', TRUE),
(5, '654 Park Avenue', 'Rawalpindi', 'Punjab', '46000', TRUE);

-- Insert sample orders
INSERT INTO Orders (UserId, Status, TotalAmount, DeliveryAddress, PaymentMethod, PaymentStatus) VALUES
(2, 'Delivered', 250.00, '123 Main Street, Karachi, Sindh 74200', 'Cash on Delivery', 'Paid'),
(3, 'Approved', 320.00, '789 Boulevard, Islamabad, Capital 44000', 'Credit Card', 'Paid'),
(4, 'Pending', 180.00, '321 Market Street, Faisalabad, Punjab 38000', 'Cash on Delivery', 'Pending'),
(2, 'Dispatched', 450.00, '123 Main Street, Karachi, Sindh 74200', 'Bank Transfer', 'Paid');

-- Insert sample order items
INSERT INTO OrderItems (OrderId, MedicineId, Quantity, Price, Subtotal) VALUES
(1, 1, 2, 50.00, 100.00),
(1, 3, 1, 80.00, 80.00),
(1, 4, 1, 70.00, 70.00),
(2, 2, 1, 120.00, 120.00),
(2, 5, 2, 100.00, 200.00),
(3, 1, 1, 50.00, 50.00),
(3, 6, 1, 130.00, 130.00),
(4, 7, 1, 150.00, 150.00),
(4, 8, 2, 150.00, 300.00);

-- Insert sample prescriptions
INSERT INTO Prescriptions (UserId, ImagePath, Status, Notes) VALUES
(2, 'uploads/prescriptions/prescription-1.jpg', 'Approved', 'Valid prescription for antibiotics'),
(3, 'uploads/prescriptions/prescription-2.jpg', 'Pending', 'Awaiting admin review'),
(4, 'uploads/prescriptions/prescription-3.jpg', 'Rejected', 'Invalid prescription format');

-- Insert sample inventory transactions
INSERT INTO InventoryTransactions (MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy) VALUES
(1, 'Stock In', 50, 50, 100, 'Initial stock', 6),
(2, 'Stock In', 30, 20, 50, 'New shipment', 6),
(3, 'Stock Out', 5, 105, 100, 'Order #1', 2),
(4, 'Stock In', 10, 65, 75, 'Restock', 6),
(5, 'Adjustment', -5, 85, 80, 'Damaged items removed', 6);
