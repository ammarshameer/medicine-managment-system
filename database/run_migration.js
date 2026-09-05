require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { pool, query } = require('../backend/config/database');

async function runMigration() {
  const connection = await pool.getConnection();
  console.log('Connected to MySQL mms_db for USA/UAE Migration.');

  try {
    async function hasColumn(table, column) {
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows.length > 0;
    }

    // 1. Businesses Table Updates
    const bizColumns = [
      { name: 'Currency', sql: `ALTER TABLE Businesses ADD COLUMN Currency VARCHAR(3) DEFAULT 'USD'` },
      { name: 'TaxEnabled', sql: `ALTER TABLE Businesses ADD COLUMN TaxEnabled BOOLEAN NOT NULL DEFAULT TRUE` },
      { name: 'TaxRate', sql: `ALTER TABLE Businesses ADD COLUMN TaxRate DECIMAL(6,5) DEFAULT 0.00000` },
      { name: 'TaxRegistrationNumber', sql: `ALTER TABLE Businesses ADD COLUMN TaxRegistrationNumber VARCHAR(50) NULL` },
      { name: 'LicenseNumber', sql: `ALTER TABLE Businesses ADD COLUMN LicenseNumber VARCHAR(100) NULL` },
      { name: 'LicenseAuthority', sql: `ALTER TABLE Businesses ADD COLUMN LicenseAuthority VARCHAR(100) NULL` },
      { name: 'Locale', sql: `ALTER TABLE Businesses ADD COLUMN Locale VARCHAR(10) DEFAULT 'en-US'` },
      { name: 'Timezone', sql: `ALTER TABLE Businesses ADD COLUMN Timezone VARCHAR(50) DEFAULT 'America/New_York'` },
      { name: 'PharmacistInChargeName', sql: `ALTER TABLE Businesses ADD COLUMN PharmacistInChargeName VARCHAR(100) NULL` }
    ];

    for (const col of bizColumns) {
      if (!(await hasColumn('Businesses', col.name))) {
        console.log(`Adding Businesses.${col.name}...`);
        await connection.query(col.sql);
      } else {
        if (col.name === 'TaxRate') {
          await connection.query(`ALTER TABLE Businesses MODIFY COLUMN TaxRate DECIMAL(6,5) DEFAULT 0.00000`);
        }
      }
    }

    // Drop Country default on Businesses & Addresses
    try {
      await connection.query(`ALTER TABLE Businesses ALTER COLUMN Country DROP DEFAULT`);
      await connection.query(`ALTER TABLE Addresses ALTER COLUMN Country DROP DEFAULT`);
    } catch (e) {
      console.log('Country default drop notice:', e.message);
    }

    // BACKFILL: Preserve pre-existing Pakistan businesses in PKR
    await connection.query(`UPDATE Businesses SET Currency = 'PKR' WHERE Country = 'Pakistan' OR Country IS NULL`);
    console.log('Backfilled existing Pakistan businesses to PKR.');

    // 2. Medicines Table Updates
    const medColumns = [
      { name: 'DEASchedule', sql: `ALTER TABLE Medicines ADD COLUMN DEASchedule ENUM('None', 'I', 'II', 'III', 'IV', 'V') NOT NULL DEFAULT 'None'` },
      { name: 'UAEClassification', sql: `ALTER TABLE Medicines ADD COLUMN UAEClassification ENUM('OTC', 'Pharmacist-Only', 'POM', 'Controlled', 'Semi-Controlled', 'Narcotic') NOT NULL DEFAULT 'OTC'` },
      { name: 'IsTaxable', sql: `ALTER TABLE Medicines ADD COLUMN IsTaxable BOOLEAN NOT NULL DEFAULT TRUE` },
      { name: 'PriceIncludesTax', sql: `ALTER TABLE Medicines ADD COLUMN PriceIncludesTax BOOLEAN NOT NULL DEFAULT FALSE` }
    ];

    for (const col of medColumns) {
      if (!(await hasColumn('Medicines', col.name))) {
        console.log(`Adding Medicines.${col.name}...`);
        await connection.query(col.sql);
      }
    }

    // 3. Orders Table Updates
    const orderColumns = [
      { name: 'Subtotal', sql: `ALTER TABLE Orders ADD COLUMN Subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00` },
      { name: 'TaxRate', sql: `ALTER TABLE Orders ADD COLUMN TaxRate DECIMAL(6,5) NOT NULL DEFAULT 0.00000` },
      { name: 'TaxAmount', sql: `ALTER TABLE Orders ADD COLUMN TaxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00` },
      { name: 'Currency', sql: `ALTER TABLE Orders ADD COLUMN Currency VARCHAR(3) NOT NULL DEFAULT 'USD'` }
    ];

    for (const col of orderColumns) {
      if (!(await hasColumn('Orders', col.name))) {
        console.log(`Adding Orders.${col.name}...`);
        await connection.query(col.sql);
      } else {
        if (col.name === 'TaxRate') {
          await connection.query(`ALTER TABLE Orders MODIFY COLUMN TaxRate DECIMAL(6,5) NOT NULL DEFAULT 0.00000`);
        }
      }
    }

    await connection.query(`
      ALTER TABLE Orders MODIFY COLUMN PaymentMethod ENUM(
        'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay', 'Cash on Delivery', 'JazzCash', 'EasyPaisa'
      ) DEFAULT 'Cash'
    `);

    // 4. OrderItems Table Updates
    const orderItemColumns = [
      { name: 'TaxAmount', sql: `ALTER TABLE OrderItems ADD COLUMN TaxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00` },
      { name: 'IsTaxable', sql: `ALTER TABLE OrderItems ADD COLUMN IsTaxable BOOLEAN NOT NULL DEFAULT TRUE` },
      { name: 'PriceIncludesTax', sql: `ALTER TABLE OrderItems ADD COLUMN PriceIncludesTax BOOLEAN NOT NULL DEFAULT FALSE` }
    ];

    for (const col of orderItemColumns) {
      if (!(await hasColumn('OrderItems', col.name))) {
        console.log(`Adding OrderItems.${col.name}...`);
        await connection.query(col.sql);
      }
    }

    // 5. Users Table Updates
    const userColumns = [
      { name: 'EmiratesId', sql: `ALTER TABLE Users ADD COLUMN EmiratesId VARCHAR(20) NULL` },
      { name: 'NationalIdLast4', sql: `ALTER TABLE Users ADD COLUMN NationalIdLast4 VARCHAR(4) NULL` }
    ];

    for (const col of userColumns) {
      if (!(await hasColumn('Users', col.name))) {
        console.log(`Adding Users.${col.name}...`);
        await connection.query(col.sql);
      }
    }

    // 6. Controlled Substances Compliance Audit Log Table
    await connection.query(`
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
      )
    `);
    console.log('ControlledSubstanceLog table verified.');

    // 7. Backfill Historic Orders & OrderItems
    await connection.query(`
      UPDATE Orders 
      SET Subtotal = TotalAmount, TaxRate = 0.00000, TaxAmount = 0.00, Currency = 'PKR' 
      WHERE Subtotal = 0.00 OR Subtotal IS NULL
    `);

    await connection.query(`
      UPDATE OrderItems 
      SET TaxAmount = 0.00, IsTaxable = TRUE, PriceIncludesTax = FALSE 
      WHERE TaxAmount IS NULL
    `);
    console.log('Historic orders and order items backfilled.');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

runMigration();
