const express = require('express');
const { query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// Dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = {};

    // Total users
    const totalUsers = await dbQuery('SELECT COUNT(*) as count FROM Users');
    stats.totalUsers = totalUsers[0].count;

    // Total orders
    const totalOrders = await dbQuery('SELECT COUNT(*) as count FROM Orders');
    stats.totalOrders = totalOrders[0].count;

    // Total revenue
    const revenue = await dbQuery('SELECT SUM(TotalAmount) as total FROM Orders WHERE Status = "Delivered"');
    stats.totalRevenue = parseFloat(revenue[0].total) || 0;

    // Low stock medicines (stock < 10)
    const lowStock = await dbQuery('SELECT COUNT(*) as count FROM Medicines WHERE Stock < 10 AND IsActive = TRUE');
    stats.lowStockMedicines = lowStock[0].count;

    // Recent orders
    const recentOrders = await dbQuery(`
      SELECT o.OrderId, o.OrderDate, o.Status, o.TotalAmount, u.Name as UserName
      FROM Orders o
      JOIN Users u ON o.UserId = u.UserId
      ORDER BY o.OrderDate DESC
      LIMIT 5
    `);
    stats.recentOrders = recentOrders.map(order => ({
      id: order.OrderId,
      date: order.OrderDate,
      status: order.Status,
      amount: parseFloat(order.TotalAmount),
      customer: order.UserName
    }));

    // Orders by status
    const ordersByStatus = await dbQuery(`
      SELECT Status, COUNT(*) as count
      FROM Orders
      GROUP BY Status
    `);
    stats.ordersByStatus = ordersByStatus.reduce((acc, item) => {
      acc[item.Status] = item.count;
      return acc;
    }, {});

    // Top selling medicines
    const topMedicines = await dbQuery(`
      SELECT m.MedicineId, m.Name, SUM(oi.Quantity) as totalSold
      FROM Medicines m
      JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
      JOIN Orders o ON oi.OrderId = o.OrderId
      WHERE o.Status = 'Delivered'
      GROUP BY m.MedicineId, m.Name
      ORDER BY totalSold DESC
      LIMIT 5
    `);
    stats.topMedicines = topMedicines.map(medicine => ({
      id: medicine.MedicineId,
      name: medicine.Name,
      sold: medicine.totalSold
    }));

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

// User management
router.get('/users', authenticateToken, requireAdmin, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['Patient', 'Super Admin', 'Pharmacy Admin', 'Inventory Manager', 'Delivery Manager']).withMessage('Invalid role'),
  query('search').optional().isLength({ min: 1 }).withMessage('Search term cannot be empty')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (role) {
      whereClause += ' AND Role = ?';
      params.push(role);
    }

    if (search) {
      whereClause += ' AND (Name LIKE ? OR Email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM Users ${whereClause}`;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get users
    const usersQuery = `
      SELECT UserId, Name, Email, Phone, Role, IsActive, CreatedAt
      FROM Users 
      ${whereClause}
      ORDER BY CreatedAt DESC
      LIMIT ? OFFSET ?
    `;
    const users = await dbQuery(usersQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.UserId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          isActive: user.IsActive,
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

// Block/Unblock user
router.patch('/users/:id/status', authenticateToken, requireAdmin, [
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

    const userId = req.params.id;
    const { isActive } = req.query;

    // Check if user exists
    const users = await dbQuery('SELECT UserId, Role FROM Users WHERE UserId = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent blocking super admin (only super admin can do this)
    if (users[0].Role === 'Super Admin' && req.user.Role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot block super admin'
      });
    }

    // Update user status
    await dbQuery('UPDATE Users SET IsActive = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ?', [isActive === 'true', userId]);

    res.json({
      success: true,
      message: `User ${isActive === 'true' ? 'unblocked' : 'blocked'} successfully`
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Inventory management
router.get('/inventory', authenticateToken, requireAdmin, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('lowStock').optional().isBoolean().withMessage('Low stock must be boolean'),
  query('search').optional().isLength({ min: 1 }).withMessage('Search term cannot be empty')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const lowStock = req.query.lowStock === 'true';
    const search = req.query.search;

    // Build WHERE clause
    let whereClause = 'WHERE m.IsActive = TRUE';
    const params = [];

    if (lowStock) {
      whereClause += ' AND m.Stock < 10';
    }

    if (search) {
      whereClause += ' AND (m.Name LIKE ? OR m.Manufacturer LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Medicines m 
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get medicines with category
    const medicinesQuery = `
      SELECT 
        m.MedicineId,
        m.Name,
        m.Price,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      ${whereClause}
      ORDER BY m.Stock ASC, m.Name ASC
      LIMIT ? OFFSET ?
    `;
    const medicines = await dbQuery(medicinesQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        medicines: medicines.map(medicine => ({
          id: medicine.MedicineId,
          name: medicine.Name,
          price: parseFloat(medicine.Price),
          stock: medicine.Stock,
          expiryDate: medicine.ExpiryDate,
          manufacturer: medicine.Manufacturer,
          category: medicine.CategoryName
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

// Stock adjustment
router.post('/inventory/adjust', authenticateToken, requireAdmin, [
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

    const medicineId = parseInt(req.query.medicineId);
    const quantity = parseInt(req.query.quantity);
    const reason = req.query.reason;
    const performedBy = req.user.UserId;

    // Get current stock
    const medicines = await dbQuery('SELECT MedicineId, Name, Stock FROM Medicines WHERE MedicineId = ?', [medicineId]);
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

    // Determine transaction type
    let transactionType;
    if (quantity > 0) {
      transactionType = 'Stock In';
    } else if (quantity < 0) {
      transactionType = 'Stock Out';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be zero'
      });
    }

    // Update medicine stock
    await dbQuery('UPDATE Medicines SET Stock = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ?', [newStock, medicineId]);

    // Record inventory transaction
    await dbQuery(`
      INSERT INTO InventoryTransactions (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.businessId, medicineId, transactionType, Math.abs(quantity), previousStock, newStock, reason, performedBy]);

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

// Reports
router.get('/reports/sales', authenticateToken, requireAdmin, [
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

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Sales by date
    const salesByDate = await dbQuery(`
      SELECT DATE(OrderDate) as date, COUNT(*) as orders, SUM(TotalAmount) as revenue
      FROM Orders
      WHERE OrderDate BETWEEN ? AND ? AND Status = 'Delivered'
      GROUP BY DATE(OrderDate)
      ORDER BY date ASC
    `, [startDate, endDate]);

    // Top medicines
    const topMedicines = await dbQuery(`
      SELECT m.MedicineId, m.Name, SUM(oi.Quantity) as totalSold, SUM(oi.Subtotal) as revenue
      FROM Medicines m
      JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
      JOIN Orders o ON oi.OrderId = o.OrderId
      WHERE o.OrderDate BETWEEN ? AND ? AND o.Status = 'Delivered'
      GROUP BY m.MedicineId, m.Name
      ORDER BY totalSold DESC
      LIMIT 10
    `, [startDate, endDate]);

    // Sales by category
    const salesByCategory = await dbQuery(`
      SELECT c.CategoryName, COUNT(oi.OrderItemId) as items, SUM(oi.Subtotal) as revenue
      FROM Categories c
      JOIN Medicines m ON c.CategoryId = m.CategoryId
      JOIN OrderItems oi ON m.MedicineId = oi.MedicineId
      JOIN Orders o ON oi.OrderId = o.OrderId
      WHERE o.OrderDate BETWEEN ? AND ? AND o.Status = 'Delivered'
      GROUP BY c.CategoryId, c.CategoryName
      ORDER BY revenue DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        salesByDate: salesByDate.map(item => ({
          date: item.date,
          orders: item.orders,
          revenue: parseFloat(item.revenue)
        })),
        topMedicines: topMedicines.map(item => ({
          id: item.MedicineId,
          name: item.Name,
          sold: item.totalSold,
          revenue: parseFloat(item.revenue)
        })),
        salesByCategory: salesByCategory.map(item => ({
          category: item.CategoryName,
          items: item.items,
          revenue: parseFloat(item.revenue)
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
