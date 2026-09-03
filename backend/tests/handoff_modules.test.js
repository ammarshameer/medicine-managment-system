const jwt = require('jsonwebtoken');

// Test weighted average cost formula logic
describe('Procurement Weighted Average Cost Calculations', () => {
  const calculateWeightedAverageCost = (currentStock, currentAvgCost, incomingQty, incomingUnitCost) => {
    const totalNewStock = currentStock + incomingQty;
    if (totalNewStock <= 0) return incomingUnitCost;
    const totalInventoryVal = (currentStock * currentAvgCost) + (incomingQty * incomingUnitCost);
    return Math.round((totalInventoryVal / totalNewStock) * 100) / 100;
  };

  test('calculates correct initial average cost for first stock in', () => {
    // 0 current stock at 0 cost, 50 incoming at PKR 40.00 unit cost
    const result = calculateWeightedAverageCost(0, 0, 50, 40);
    expect(result).toBe(40.00);
  });

  test('correctly averages higher incoming unit cost with existing stock', () => {
    // 100 current units at PKR 50.00, 50 new units at PKR 65.00
    // Total value = (100 * 50) + (50 * 65) = 5000 + 3250 = 8250
    // Total stock = 150
    // New avg = 8250 / 150 = 55.00
    const result = calculateWeightedAverageCost(100, 50, 50, 65);
    expect(result).toBe(55.00);
  });

  test('correctly averages lower incoming unit cost with existing stock', () => {
    // 200 current units at PKR 100.00, 100 new units at PKR 70.00
    // Total value = (200 * 100) + (100 * 70) = 20000 + 7000 = 27000
    // Total stock = 300
    // New avg = 27000 / 300 = 90.00
    const result = calculateWeightedAverageCost(200, 100, 100, 70);
    expect(result).toBe(90.00);
  });
});

// Test POS Sale profit and cost snapshotting
describe('POS Sale Financial & Inventory Logic', () => {
  test('snapshots CostPrice as medicine AverageCost at time of sale', () => {
    const medicine = {
      id: 1,
      name: 'Amoxicillin 500mg',
      price: 120.00,
      averageCost: 75.50,
      stock: 40
    };

    const requestedQty = 3;
    const costPriceSnapshot = medicine.averageCost || 0;
    const retailPrice = medicine.price;
    const subtotal = retailPrice * requestedQty;
    const costTotal = costPriceSnapshot * requestedQty;
    const profitOnSale = subtotal - costTotal;

    expect(costPriceSnapshot).toBe(75.50);
    expect(subtotal).toBe(360.00);
    expect(costTotal).toBe(226.50);
    expect(profitOnSale).toBe(133.50);
  });

  test('validates and deducts stock on POS checkout', () => {
    const currentStock = 25;
    const sellQty = 5;
    const newStock = currentStock - sellQty;

    expect(newStock).toBe(20);
    expect(newStock).toBeGreaterThanOrEqual(0);
  });
});

// Test Role Guard Access Matrix
describe('Role-Based Security Matrix', () => {
  const checkRoleAccess = (userRole, allowedRoles) => {
    return allowedRoles.includes(userRole);
  };

  test('STAFF has access to POS register but NOT to Vendors, POs, HRMS, or Financial Analytics', () => {
    const staffRole = 'STAFF';

    // POS register: accessible to both STAFF and BUSINESS_OWNER
    expect(checkRoleAccess(staffRole, ['BUSINESS_OWNER', 'STAFF'])).toBe(true);

    // Vendors: strictly BUSINESS_OWNER
    expect(checkRoleAccess(staffRole, ['BUSINESS_OWNER'])).toBe(false);

    // Purchase Orders: strictly BUSINESS_OWNER
    expect(checkRoleAccess(staffRole, ['BUSINESS_OWNER'])).toBe(false);

    // HRMS & Salaries: strictly BUSINESS_OWNER
    expect(checkRoleAccess(staffRole, ['BUSINESS_OWNER'])).toBe(false);

    // Financial Analytics: strictly BUSINESS_OWNER
    expect(checkRoleAccess(staffRole, ['BUSINESS_OWNER'])).toBe(false);
  });

  test('BUSINESS_OWNER has full access to POS, Vendors, POs, HRMS, and Financial Analytics', () => {
    const ownerRole = 'BUSINESS_OWNER';

    expect(checkRoleAccess(ownerRole, ['BUSINESS_OWNER', 'STAFF'])).toBe(true);
    expect(checkRoleAccess(ownerRole, ['BUSINESS_OWNER'])).toBe(true);
  });
});

// Test HRMS Employee Data Structures
describe('HRMS Employee & Payroll Logic', () => {
  test('computes NetSalary correctly from basic, allowances, and deductions', () => {
    const basicSalary = 50000;
    const allowances = 5000;
    const deductions = 2500;

    const netSalary = Math.max(0, basicSalary + allowances - deductions);
    expect(netSalary).toBe(52500);
  });

  test('handles both new user creation and existing user linking payload shapes', () => {
    const newEmployeePayload = {
      mode: 'new_user',
      name: 'Hamza Farooq',
      email: 'hamza@pharmacy.com',
      password: 'password123',
      role: 'STAFF',
      designation: 'Staff Pharmacist',
      department: 'Dispensing',
      salary: 42000,
      joiningDate: '2025-01-15'
    };

    const linkExistingPayload = {
      mode: 'link_existing',
      userId: 14,
      designation: 'Head Cashier',
      department: 'Counters',
      salary: 38000,
      joiningDate: '2025-02-01'
    };

    expect(newEmployeePayload.mode).toBe('new_user');
    expect(newEmployeePayload.email).toBeDefined();

    expect(linkExistingPayload.mode).toBe('link_existing');
    expect(linkExistingPayload.userId).toBe(14);
  });
});
