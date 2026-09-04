const express = require('express');
const bcrypt = require('bcryptjs');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess, requireBusinessOwner } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/admin/dashboard
 * Role-branched dashboard summary (tenant isolated):
 * - STAFF: Operational metrics ONLY (no revenue, cost, profit)
 * - BUSINESS_OWNER: Operational metrics + Revenue, Cost, Profit, Top Selling Revenue
 */
router.get('/dashboard', authenticateToken, requireTenant, requireBusinessAccess, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const isStaff = req.user.Role === 'STAFF';
    const stats = {};

    // 1. Total Orders (tenant scoped)
    const totalOrders = await dbQuery(
      'SELECT COUNT(*) as count FROM Orders WHERE BusinessId = ?',
      [businessId]
    );
    stats.totalOrders = totalOrders[0].count;

    // 2. Pending Orders
    const pendingOrders = await dbQuery(
      'SELECT COUNT(*) as count FROM Orders WHERE BusinessId = ? AND Status = "Pending"',
      [businessId]
    );
    stats.pendingOrders = pendingOrders[0].count;

    // 3. Low stock medicines (stock < 10)
    const lowStock = await dbQuery(
      'SELECT COUNT(*) as count FROM Medicines WHERE BusinessId = ? AND Stock < 10 AND IsActive = TRUE',
      [businessId]
    );
    stats.lowStockMedicines = lowStock[0].count;

    // 4. Pending Prescriptions
    const pendingPrescriptions = await dbQuery(
      'SELECT COUNT(*) as count FROM Prescriptions WHERE BusinessId = ? AND Status = "Pending"',
      [businessId]
    );
    stats.pendingPrescriptions = pendingPrescriptions[0].count;

    // 5. Orders by status
    const ordersByStatus = await dbQuery(
      `SELECT Status, COUNT(*) as count
       FROM Orders
       WHERE BusinessId = ?
       GROUP BY Status`,
      [businessId]
    );
    stats.ordersByStatus = ordersByStatus.reduce((acc, item) => {
      acc[item.Status] = item.count;
      return acc;
    }, {});

    // 6. Recent orders
    const recentOrders = await dbQuery(
      `SELECT 
        o.OrderId, o.OrderDate, o.Status, o.Source, o.TotalAmount, o.CustomerName,
        u.Name as RegisteredUserName,
        COUNT(oi.OrderItemId) as ItemCount
       FROM Orders o
       LEFT JOIN Users u ON o.UserId = u.UserId
       LEFT JOIN OrderItems oi ON o.OrderId = oi.OrderId
       WHERE o.BusinessId = ?
       GROUP BY o.OrderId
       ORDER BY o.OrderDate DESC
       LIMIT 5`,
      [businessId]
    );

    stats.recentOrders = recentOrders.map(order => ({
      id: order.OrderId,
      date: order.OrderDate,
      status: order.Status,
      source: order.Source || 'Online',
      customer: order.CustomerName || order.RegisteredUserName || 'Walk-in Customer',
      itemCount: parseInt(order.ItemCount, 10) || 0,
      // Only include amount for Business Owners
      ...(!isStaff && { amount: parseFloat(order.TotalAmount) || 0 })
    }));

    // 7. FINANCIAL METRICS — Strictly for BUSINESS_OWNER
    if (!isStaff) {
      // Total delivered orders revenue
      const revenueRes = await dbQuery(
        'SELECT SUM(TotalAmount) as total FROM Orders WHERE BusinessId = ? AND Status = "Delivered"',
        [businessId]
      );
      const totalRevenue = parseFloat(revenueRes[0].total) || 0;
      stats.totalRevenue = Math.round(totalRevenue * 100) / 100;

      // Total Cost of Goods Sold from delivered OrderItems
      const costRes = await dbQuery(
        `SELECT SUM(oi.CostPrice * oi.Quantity) as totalCost
         FROM OrderItems oi
         JOIN Orders o ON oi.OrderId = o.OrderId
         WHERE o.BusinessId = ? AND o.Status = "Delivered"`,
        [businessId]
      );
      const totalCost = parseFloat(costRes[0].totalCost) || 0;
      stats.totalCost = Math.round(totalCost * 100) / 100;

      // Net Profit
      stats.totalProfit = Math.round((totalRevenue - totalCost) * 100) / 100;
      stats.profitMargin = totalRevenue > 0 
        ? Math.round(((stats.totalProfit / totalRevenue) * 100) * 10) / 10 
        : 0;

      // Top selling medicines with sales & revenue
      const topMedicines = await dbQuery(
        `SELECT 
          m.MedicineId, m.Name, 
          SUM(oi.Quantity) as totalSold, 
          SUM(oi.Subtotal) as totalRevenue,
          SUM((oi.Price - oi.CostPrice) * oi.Quantity) as totalProfit
         FROM Medicines m
         JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
         JOIN Orders o ON oi.OrderId = o.OrderId
         WHERE o.BusinessId = ? AND o.Status = 'Delivered'
         GROUP BY m.MedicineId, m.Name
         ORDER BY totalSold DESC
         LIMIT 5`,
        [businessId]
      );

      stats.topMedicines = topMedicines.map(m => ({
        id: m.MedicineId,
        name: m.Name,
        sold: parseInt(m.totalSold, 10) || 0,
        revenue: Math.round((parseFloat(m.totalRevenue) || 0) * 100) / 100,
        profit: Math.round((parseFloat(m.totalProfit) || 0) * 100) / 100
      }));

      // Total registered customers
      const totalUsers = await dbQuery(
        'SELECT COUNT(*) as count FROM Users WHERE BusinessId = ? AND Role = "CUSTOMER"',
        [businessId]
      );
      stats.totalUsers = totalUsers[0].count;
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/dashboard/analytics
 * Time series analytics (Revenue, Cost, Net Profit trends)
 * Strictly BUSINESS_OWNER only (403 for Staff)
 */
router.get('/dashboard/analytics', authenticateToken, requireTenant, requireBusinessOwner, [
  query('period').optional().isIn(['month', 'quarter', 'year']),
  query('year').optional().isInt({ min: 2020, max: 2100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const period = req.query.period || 'month';
    const targetYear = parseInt(req.query.year, 10) || new Date().getFullYear();

    let series = [];
    let currentTotals = { revenue: 0, cost: 0, profit: 0, ordersCount: 0 };

    if (period === 'month') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const rows = await dbQuery(
        `SELECT 
          MONTH(o.OrderDate) as monthNum,
          COUNT(DISTINCT o.OrderId) as ordersCount,
          SUM(o.TotalAmount) as revenue,
          SUM(oi.CostPrice * oi.Quantity) as cost
         FROM Orders o
         LEFT JOIN OrderItems oi ON o.OrderId = oi.OrderId
         WHERE o.BusinessId = ? AND o.Status = 'Delivered' AND YEAR(o.OrderDate) = ?
         GROUP BY MONTH(o.OrderDate)
         ORDER BY monthNum ASC`,
        [businessId, targetYear]
      );

      const rowsMap = {};
      rows.forEach(r => {
        rowsMap[r.monthNum] = r;
      });

      series = monthNames.map((name, idx) => {
        const mNum = idx + 1;
        const row = rowsMap[mNum];
        const rev = row ? Math.round((parseFloat(row.revenue) || 0) * 100) / 100 : 0;
        const cst = row ? Math.round((parseFloat(row.cost) || 0) * 100) / 100 : 0;
        const prf = Math.round((rev - cst) * 100) / 100;
        const cnt = row ? parseInt(row.ordersCount, 10) || 0 : 0;

        currentTotals.revenue += rev;
        currentTotals.cost += cst;
        currentTotals.profit += prf;
        currentTotals.ordersCount += cnt;

        return {
          label: `${name} ${targetYear}`,
          shortLabel: name,
          revenue: rev,
          cost: cst,
          profit: prf,
          ordersCount: cnt
        };
      });
    } else if (period === 'quarter') {
      const rows = await dbQuery(
        `SELECT 
          QUARTER(o.OrderDate) as qNum,
          COUNT(DISTINCT o.OrderId) as ordersCount,
          SUM(o.TotalAmount) as revenue,
          SUM(oi.CostPrice * oi.Quantity) as cost
         FROM Orders o
         LEFT JOIN OrderItems oi ON o.OrderId = oi.OrderId
         WHERE o.BusinessId = ? AND o.Status = 'Delivered' AND YEAR(o.OrderDate) = ?
         GROUP BY QUARTER(o.OrderDate)
         ORDER BY qNum ASC`,
        [businessId, targetYear]
      );

      const rowsMap = {};
      rows.forEach(r => {
        rowsMap[r.qNum] = r;
      });

      series = [1, 2, 3, 4].map(q => {
        const row = rowsMap[q];
        const rev = row ? Math.round((parseFloat(row.revenue) || 0) * 100) / 100 : 0;
        const cst = row ? Math.round((parseFloat(row.cost) || 0) * 100) / 100 : 0;
        const prf = Math.round((rev - cst) * 100) / 100;
        const cnt = row ? parseInt(row.ordersCount, 10) || 0 : 0;

        currentTotals.revenue += rev;
        currentTotals.cost += cst;
        currentTotals.profit += prf;
        currentTotals.ordersCount += cnt;

        return {
          label: `Q${q} ${targetYear}`,
          shortLabel: `Q${q}`,
          revenue: rev,
          cost: cst,
          profit: prf,
          ordersCount: cnt
        };
      });
    } else if (period === 'year') {
      const startYear = targetYear - 4;
      const rows = await dbQuery(
        `SELECT 
          YEAR(o.OrderDate) as yr,
          COUNT(DISTINCT o.OrderId) as ordersCount,
          SUM(o.TotalAmount) as revenue,
          SUM(oi.CostPrice * oi.Quantity) as cost
         FROM Orders o
         LEFT JOIN OrderItems oi ON o.OrderId = oi.OrderId
         WHERE o.BusinessId = ? AND o.Status = 'Delivered' AND YEAR(o.OrderDate) BETWEEN ? AND ?
         GROUP BY YEAR(o.OrderDate)
         ORDER BY yr ASC`,
        [businessId, startYear, targetYear]
      );

      const rowsMap = {};
      rows.forEach(r => {
        rowsMap[r.yr] = r;
      });

      for (let y = startYear; y <= targetYear; y++) {
        const row = rowsMap[y];
        const rev = row ? Math.round((parseFloat(row.revenue) || 0) * 100) / 100 : 0;
        const cst = row ? Math.round((parseFloat(row.cost) || 0) * 100) / 100 : 0;
        const prf = Math.round((rev - cst) * 100) / 100;
        const cnt = row ? parseInt(row.ordersCount, 10) || 0 : 0;

        currentTotals.revenue += rev;
        currentTotals.cost += cst;
        currentTotals.profit += prf;
        currentTotals.ordersCount += cnt;

        series.push({
          label: `${y}`,
          shortLabel: `${y}`,
          revenue: rev,
          cost: cst,
          profit: prf,
          ordersCount: cnt
        });
      }
    }

    currentTotals.revenue = Math.round(currentTotals.revenue * 100) / 100;
    currentTotals.cost = Math.round(currentTotals.cost * 100) / 100;
    currentTotals.profit = Math.round(currentTotals.profit * 100) / 100;

    res.json({
      success: true,
      data: {
        period,
        year: targetYear,
        totals: currentTotals,
        series
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/admin/users
 * User & Customer management (tenant scoped, accessible by Business Owner & Staff)
 */
router.get('/users', authenticateToken, requireTenant, requireBusinessAccess, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['CUSTOMER', 'STAFF', 'BUSINESS_OWNER']),
  query('search').optional().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;

    let whereClause = 'WHERE BusinessId = ?';
    const params = [businessId];

    if (role) {
      whereClause += ' AND Role = ?';
      params.push(role);
    }

    if (search) {
      whereClause += ' AND (Name LIKE ? OR Email LIKE ? OR Phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM Users ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const users = await dbQuery(
      `SELECT UserId, Name, Email, Phone, Role, IsActive, CreatedAt
       FROM Users 
       ${whereClause}
       ORDER BY CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.UserId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          isActive: Boolean(user.IsActive),
          createdAt: user.CreatedAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Block/Unblock user in business
 */
router.patch('/users/:id/status', authenticateToken, requireTenant, requireBusinessAccess, [
  query('isActive').isBoolean().withMessage('IsActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const userId = parseInt(req.params.id, 10);
    const isActive = req.query.isActive === 'true';

    const users = await dbQuery(
      'SELECT UserId, Role FROM Users WHERE UserId = ? AND BusinessId = ?',
      [userId, businessId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your business'
      });
    }

    // Staff can only manage CUSTOMER status
    if (req.user.Role === 'STAFF' && users[0].Role !== 'CUSTOMER') {
      return res.status(403).json({
        success: false,
        message: 'Staff can only manage customer accounts'
      });
    }

    if (users[0].Role === 'BUSINESS_OWNER' && userId === req.user.UserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    await dbQuery(
      'UPDATE Users SET IsActive = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ? AND BusinessId = ?',
      [isActive, userId, businessId]
    );

    res.json({
      success: true,
      message: `User ${isActive ? 'unblocked' : 'blocked'} successfully`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users
 * Add a new user (Customer or Staff) to the current business (accessible by Business Owner & Staff)
 */
router.post('/users', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().trim(),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters or digits'),
  body('role').optional().isIn(['CUSTOMER', 'STAFF', 'BUSINESS_OWNER'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    let { name, email, phone, password, role = 'CUSTOMER' } = req.body;

    // Staff can only create CUSTOMER accounts
    if (req.user.Role === 'STAFF') {
      role = 'CUSTOMER';
    }

    // Check if user already exists with this email in this business
    const existing = await dbQuery(
      'SELECT UserId FROM Users WHERE Email = ? AND (BusinessId = ? OR BusinessId IS NULL)',
      [email, businessId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await dbQuery(
      `INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [businessId, name, email, phone || null, passwordHash, role]
    );

    res.status(201).json({
      success: true,
      message: `${role === 'CUSTOMER' ? 'Customer' : 'User'} created successfully`,
      data: {
        id: result.insertId,
        businessId,
        name,
        email,
        phone,
        role,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create user'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user details (Name, Phone, Role)
 */
router.put('/users/:id', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  body('role').optional().isIn(['CUSTOMER', 'STAFF', 'BUSINESS_OWNER'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const userId = parseInt(req.params.id, 10);
    let { name, phone, role } = req.body;

    const existing = await dbQuery(
      'SELECT UserId, Role FROM Users WHERE UserId = ? AND BusinessId = ?',
      [userId, businessId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your business'
      });
    }

    // Staff can only update CUSTOMER accounts
    if (req.user.Role === 'STAFF') {
      if (existing[0].Role !== 'CUSTOMER') {
        return res.status(403).json({
          success: false,
          message: 'Staff can only edit customer profiles'
        });
      }
      role = 'CUSTOMER'; // staff cannot change role
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('Name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('Phone = ?');
      params.push(phone);
    }
    if (role !== undefined && req.user.Role !== 'STAFF') {
      updates.push('Role = ?');
      params.push(role);
    }

    if (updates.length > 0) {
      params.push(userId, businessId);
      await dbQuery(
        `UPDATE Users SET ${updates.join(', ')}, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ? AND BusinessId = ?`,
        params
      );
    }

    res.json({
      success: true,
      message: 'User profile updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
});

/**
 * PUT /api/admin/users/:id/password
 * Reset/Set user password (supports 4+ digit PINs and passwords)
 */
router.put('/users/:id/password', authenticateToken, requireTenant, requireBusinessAccess, [
  body('newPassword').isLength({ min: 4 }).withMessage('Password must be at least 4 characters or digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const userId = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    const existing = await dbQuery(
      'SELECT UserId, Role FROM Users WHERE UserId = ? AND BusinessId = ?',
      [userId, businessId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your business'
      });
    }

    // Staff can only reset CUSTOMER passwords
    if (req.user.Role === 'STAFF' && existing[0].Role !== 'CUSTOMER') {
      return res.status(403).json({
        success: false,
        message: 'Staff can only reset passwords for customer accounts'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await dbQuery(
      'UPDATE Users SET PasswordHash = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ? AND BusinessId = ?',
      [passwordHash, userId, businessId]
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

/**
 * GET /api/admin/inventory
 * Inventory list with low stock filter
 */
router.get('/inventory', authenticateToken, requireTenant, requireBusinessAccess, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('lowStock').optional().isBoolean(),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const lowStock = req.query.lowStock === 'true';
    const search = req.query.search;

    let whereClause = 'WHERE m.BusinessId = ? AND m.IsActive = TRUE';
    const params = [businessId];

    if (lowStock) {
      whereClause += ' AND m.Stock < 10';
    }

    if (search) {
      whereClause += ' AND (m.Name LIKE ? OR m.Manufacturer LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM Medicines m ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const medicines = await dbQuery(
      `SELECT 
        m.MedicineId,
        m.Name,
        m.Price,
        m.AverageCost,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      ${whereClause}
      ORDER BY m.Stock ASC, m.Name ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        medicines: medicines.map(m => ({
          id: m.MedicineId,
          name: m.Name,
          price: parseFloat(m.Price),
          averageCost: parseFloat(m.AverageCost) || 0,
          stock: m.Stock,
          expiryDate: m.ExpiryDate,
          manufacturer: m.Manufacturer,
          category: m.CategoryName
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/inventory/adjust
 * Stock adjustment with inventory transaction logging
 */
router.post('/inventory/adjust', authenticateToken, requireTenant, requireBusinessAccess, [
  query('medicineId').isInt({ min: 1 }).withMessage('Invalid medicine ID'),
  query('quantity').isInt().withMessage('Quantity must be integer'),
  query('reason').trim().isLength({ min: 1 }).withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const medicineId = parseInt(req.query.medicineId, 10);
    const quantity = parseInt(req.query.quantity, 10);
    const reason = req.query.reason;
    const performedBy = req.user.UserId;

    const medicines = await dbQuery(
      'SELECT MedicineId, Name, Stock FROM Medicines WHERE MedicineId = ? AND BusinessId = ?',
      [medicineId, businessId]
    );

    if (medicines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    const medicine = medicines[0];
    const previousStock = medicine.Stock;
    const newStock = previousStock + quantity;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock cannot be negative'
      });
    }

    const transactionType = quantity >= 0 ? 'Stock In' : 'Stock Out';

    await dbQuery(
      'UPDATE Medicines SET Stock = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?',
      [newStock, medicineId, businessId]
    );

    await dbQuery(
      `INSERT INTO InventoryTransactions (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, medicineId, transactionType, Math.abs(quantity), previousStock, newStock, reason, performedBy]
    );

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        medicineId: medicine.MedicineId,
        medicineName: medicine.Name,
        previousStock,
        newStock,
        adjustment: quantity,
        transactionType
      }
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/reports/sales
 * Sales reporting strictly tenant scoped (BUSINESS_OWNER only)
 */
router.get('/reports/sales', authenticateToken, requireTenant, requireBusinessOwner, [
  query('startDate').isISO8601().withMessage('Invalid start date format'),
  query('endDate').isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const salesByDate = await dbQuery(
      `SELECT DATE(OrderDate) as date, COUNT(*) as orders, SUM(TotalAmount) as revenue
       FROM Orders
       WHERE BusinessId = ? AND OrderDate BETWEEN ? AND ? AND Status = 'Delivered'
       GROUP BY DATE(OrderDate)
       ORDER BY date ASC`,
      [businessId, startDate, endDate]
    );

    const topMedicines = await dbQuery(
      `SELECT m.MedicineId, m.Name, SUM(oi.Quantity) as totalSold, SUM(oi.Subtotal) as revenue
       FROM Medicines m
       JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
       JOIN Orders o ON oi.OrderId = o.OrderId
       WHERE o.BusinessId = ? AND o.OrderDate BETWEEN ? AND ? AND o.Status = 'Delivered'
       GROUP BY m.MedicineId, m.Name
       ORDER BY totalSold DESC
       LIMIT 10`,
      [businessId, startDate, endDate]
    );

    const salesByCategory = await dbQuery(
      `SELECT c.CategoryName, COUNT(oi.OrderItemId) as items, SUM(oi.Subtotal) as revenue
       FROM Categories c
       JOIN Medicines m ON c.CategoryId = m.CategoryId
       JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
       JOIN Orders o ON oi.OrderId = o.OrderId
       WHERE o.BusinessId = ? AND o.OrderDate BETWEEN ? AND ? AND o.Status = 'Delivered'
       GROUP BY c.CategoryId, c.CategoryName
       ORDER BY revenue DESC`,
      [businessId, startDate, endDate]
    );

    res.json({
      success: true,
      data: {
        salesByDate: salesByDate.map(item => ({
          date: item.date,
          orders: item.orders,
          revenue: parseFloat(item.revenue) || 0
        })),
        topMedicines: topMedicines.map(item => ({
          id: item.MedicineId,
          name: item.Name,
          sold: parseInt(item.totalSold, 10) || 0,
          revenue: parseFloat(item.revenue) || 0
        })),
        salesByCategory: salesByCategory.map(item => ({
          category: item.CategoryName,
          items: parseInt(item.items, 10) || 0,
          revenue: parseFloat(item.revenue) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
