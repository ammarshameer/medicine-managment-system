const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const envPath = path.join(backendDir, '.env');

// dotenv is installed in backend/node_modules. Requiring it bare fails when
// this script is launched from the repository root (there is no root
// node_modules), so resolve it explicitly against the backend directory.
try {
  const dotenvPath = require.resolve('dotenv', { paths: [backendDir, __dirname] });
  require(dotenvPath).config({ path: envPath });
} catch (err) {
  // dotenv is optional: backend/config/database.js provides safe defaults and
  // DB_* may already be present in the environment.
  console.warn('dotenv could not be loaded; using existing environment/defaults.');
}

const { pool } = require(path.join(backendDir, 'config', 'database'));

async function hasColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function hasTable(connection, table) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (await hasColumn(connection, table, column)) return false;
  console.log(`Adding ${table}.${column}...`);
  // Table and column names are internal constants, not user input.
  await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function ensureTable(connection, table, ddl) {
  if (await hasTable(connection, table)) {
    console.log(`${table} table verified.`);
    return false;
  }
  console.log(`Creating ${table} table...`);
  await connection.query(ddl);
  return true;
}

const attendanceDdl = `
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const paymentTransactionsDdl = `
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function runMigration() {
  const connection = await pool.getConnection();
  console.log('Connected to MySQL mms_db for USA/UAE Migration.');

  try {
    // 1. Businesses (including the columns backend SELECTs for settings/receipts)
    const businessColumns = [
      ['LegalName', 'VARCHAR(200) NULL'],
      ['ZipCode', 'VARCHAR(20) NULL'],
      ['Currency', "VARCHAR(3) DEFAULT 'USD'"],
      ['TaxEnabled', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      ['TaxRate', 'DECIMAL(6,5) DEFAULT 0.00000'],
      ['TaxRegistrationNumber', 'VARCHAR(50) NULL'],
      ['LicenseNumber', 'VARCHAR(100) NULL'],
      ['LicenseAuthority', 'VARCHAR(100) NULL'],
      ['Locale', "VARCHAR(10) DEFAULT 'en-US'"],
      ['Timezone', "VARCHAR(50) DEFAULT 'America/New_York'"],
      ['PharmacistInChargeName', 'VARCHAR(100) NULL']
    ];
    const addedBusiness = {};
    for (const [name, definition] of businessColumns) {
      addedBusiness[name] = await addColumn(connection, 'Businesses', name, definition);
    }

    // Keep a safe Country default instead of dropping it: this is what made
    // seed inserts fail with ERROR 1364 on MySQL 8.4.
    await connection.query(`ALTER TABLE Businesses MODIFY COLUMN Country VARCHAR(100) NULL DEFAULT 'Pakistan'`);
    await connection.query(`UPDATE Businesses SET Country = 'Pakistan' WHERE Country IS NULL OR Country = ''`);
    if (await hasTable(connection, 'Addresses')) {
      await connection.query(`ALTER TABLE Addresses MODIFY COLUMN Country VARCHAR(100) NULL DEFAULT 'Pakistan'`);
      await connection.query(`UPDATE Addresses SET Country = 'Pakistan' WHERE Country IS NULL OR Country = ''`);
    }

    // Backfill only when Currency was just added; never overwrite a configured
    // business currency on a later re-run.
    if (addedBusiness.Currency) {
      await connection.query(
        `UPDATE Businesses SET Currency = 'PKR' WHERE Country = 'Pakistan' OR Country IS NULL`
      );
      console.log('Backfilled existing Pakistan businesses to PKR.');
    }

    // 2. Medicines
    for (const [name, definition] of [
      ['DEASchedule', "ENUM('None', 'I', 'II', 'III', 'IV', 'V') NOT NULL DEFAULT 'None'"],
      ['UAEClassification', "ENUM('OTC', 'Pharmacist-Only', 'POM', 'Controlled', 'Semi-Controlled', 'Narcotic') NOT NULL DEFAULT 'OTC'"],
      ['IsTaxable', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      ['PriceIncludesTax', 'BOOLEAN NOT NULL DEFAULT FALSE']
    ]) {
      await addColumn(connection, 'Medicines', name, definition);
    }

    // 3. Orders
    const addedOrderSubtotal = await addColumn(
      connection, 'Orders', 'Subtotal', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00'
    );
    for (const [name, definition] of [
      ['TaxRate', 'DECIMAL(6,5) NOT NULL DEFAULT 0.00000'],
      ['TaxAmount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00'],
      ['Currency', "VARCHAR(3) NOT NULL DEFAULT 'USD'"]
    ]) {
      await addColumn(connection, 'Orders', name, definition);
    }
    await connection.query(`
      ALTER TABLE Orders MODIFY COLUMN PaymentMethod ENUM(
        'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay',
        'Cash on Delivery', 'JazzCash', 'EasyPaisa'
      ) DEFAULT 'Cash'
    `);

    // 4. OrderItems
    for (const [name, definition] of [
      ['TaxAmount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00'],
      ['IsTaxable', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      ['PriceIncludesTax', 'BOOLEAN NOT NULL DEFAULT FALSE']
    ]) {
      await addColumn(connection, 'OrderItems', name, definition);
    }

    // 5. Users
    for (const [name, definition] of [
      ['EmiratesId', 'VARCHAR(20) NULL'],
      ['NationalIdLast4', 'VARCHAR(4) NULL']
    ]) {
      await addColumn(connection, 'Users', name, definition);
    }

    // 6. ControlledSubstanceLog: all actions, all ledger columns
    await connection.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      ALTER TABLE ControlledSubstanceLog MODIFY COLUMN Action
        ENUM('Dispensed', 'Received', 'Adjusted', 'Destroyed', 'Reversed') NOT NULL
    `);
    await addColumn(
      connection, 'ControlledSubstanceLog', 'CreatedAt', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );
    console.log('ControlledSubstanceLog table verified.');

    // 7. Supporting tables required by other workstreams. Attendance depends on
    // Employees, so the handoff SQL migration must run before this point on an
    // upgrade path; on a fresh schema_multi_tenant.sql database it already exists.
    if (await hasTable(connection, 'Employees')) {
      await ensureTable(connection, 'Attendance', attendanceDdl);
    } else {
      console.warn('Employees table missing; Attendance creation skipped (run 01_migration_handoff_modules.sql first).');
    }
    await ensureTable(connection, 'PaymentTransactions', paymentTransactionsDdl);

    // 8. Historic backfill - only for databases that just gained Subtotal.
    if (addedOrderSubtotal) {
      await connection.query(`
        UPDATE Orders
        SET Subtotal = TotalAmount, TaxRate = 0.00000, TaxAmount = 0.00, Currency = 'PKR'
        WHERE (Subtotal = 0.00 OR Subtotal IS NULL) AND TotalAmount > 0
      `);
    }
    await connection.query(`
      UPDATE OrderItems
      SET TaxAmount = 0.00, IsTaxable = TRUE, PriceIncludesTax = FALSE
      WHERE TaxAmount IS NULL
    `);
    console.log('Historic orders and order items backfilled.');

    console.log('Migration completed successfully!');
    return true;
  } finally {
    connection.release();
  }
}

// Only connect/mutate when executed directly. Requiring this module (for tests
// or tooling) must not touch the database.
if (require.main === module) {
  runMigration()
    .then(() => { process.exitCode = 0; })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { runMigration, hasColumn, hasTable, addColumn, ensureTable };
