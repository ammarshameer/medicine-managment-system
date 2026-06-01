const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply authentication and super admin middleware to all routes
router.use(authenticateToken, requireSuperAdmin);

// Get platform analytics dashboard
router.get('/analytics', async (req, res) => {
  try {
    // Get total businesses count
    const totalBusinesses = await query(
      'SELECT COUNT(*) as count FROM Businesses'
    );

    // Get active businesses count
    const activeBusinesses = await query(
      'SELECT COUNT(*) as count FROM Businesses WHERE Status = ?',
      ['Active']
    );

    // Get total users count
    const totalUsers = await query(
      'SELECT COUNT(*) as count FROM Users WHERE Role != ?',
      ['SUPER_ADMIN']
    );

    // Get total orders count
    const totalOrders = await query(
      'SELECT COUNT(*) as count FROM Orders'
    );

    // Get total platform revenue (aggregated from all orders across every business)
    const totalRevenue = await query(
      'SELECT SUM(TotalAmount) as revenue FROM Orders'
    );

    // Get businesses by subscription plan
    const businessesByPlan = await query(
      'SELECT SubscriptionPlan, COUNT(*) as count FROM Businesses GROUP BY SubscriptionPlan'
    );

    // Get recent businesses
    const recentBusinesses = await query(
      `SELECT BusinessId, BusinessName, OwnerName, Email, Phone, SubscriptionPlan, Status, CreatedAt 
       FROM Businesses 
       ORDER BY CreatedAt DESC 
       LIMIT 5`
    );

    // Get monthly revenue trend
    const monthlyRevenue = await query(
      `SELECT DATE_FORMAT(CreatedAt, '%Y-%m') as month, SUM(Revenue) as revenue 
       FROM Businesses 
       WHERE CreatedAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(CreatedAt, '%Y-%m')
       ORDER BY month ASC`
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalBusinesses: totalBusinesses[0].count,
          activeBusinesses: activeBusinesses[0].count,
          totalUsers: totalUsers[0].count,
          totalOrders: totalOrders[0].count,
          totalRevenue: totalRevenue[0].revenue || 0
        },
        businessesByPlan,
        recentBusinesses,
        monthlyRevenue
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all businesses with pagination and filters
router.get('/businesses', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      subscriptionPlan = '' 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Search filter
    if (search) {
      whereClause += ' AND (BusinessName LIKE ? OR OwnerName LIKE ? OR Email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Status filter
    if (status) {
      whereClause += ' AND Status = ?';
      params.push(status);
    }

    // Subscription plan filter
    if (subscriptionPlan) {
      whereClause += ' AND SubscriptionPlan = ?';
      params.push(subscriptionPlan);
    }

    // Get businesses with counts
    const businesses = await query(
      `SELECT 
        b.*,
        (SELECT COUNT(*) FROM Users WHERE BusinessId = b.BusinessId AND Role = 'CUSTOMER') as customerCount,
        (SELECT COUNT(*) FROM Users WHERE BusinessId = b.BusinessId AND Role != 'SUPER_ADMIN') as totalUsers,
        (SELECT COUNT(*) FROM Orders WHERE BusinessId = b.BusinessId) as orderCount
       FROM Businesses b
       ${whereClause}
       ORDER BY b.CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total FROM Businesses b ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        businesses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single business details with analytics
router.get('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get business details
    const businesses = await query(
      'SELECT * FROM Businesses WHERE BusinessId = ?',
      [id]
    );

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const business = businesses[0];

    // Get business analytics
    const customerCount = await query(
      "SELECT COUNT(*) as count FROM Users WHERE BusinessId = ? AND Role = 'CUSTOMER'",
      [id]
    );

    const staffCount = await query(
      "SELECT COUNT(*) as count FROM Users WHERE BusinessId = ? AND Role IN ('BUSINESS_OWNER', 'STAFF')",
      [id]
    );

    const medicineCount = await query(
      'SELECT COUNT(*) as count FROM Medicines WHERE BusinessId = ?',
      [id]
    );

    const orderCount = await query(
      'SELECT COUNT(*) as count FROM Orders WHERE BusinessId = ?',
      [id]
    );

    const orderStats = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(TotalAmount) as totalRevenue
       FROM Orders WHERE BusinessId = ?`,
      [id]
    );

    // Get recent orders for this business
    const recentOrders = await query(
      `SELECT o.*, u.Name as CustomerName 
       FROM Orders o 
       JOIN Users u ON o.UserId = u.UserId 
       WHERE o.BusinessId = ? 
       ORDER BY o.OrderDate DESC 
       LIMIT 10`,
      [id]
    );

    // Get business settings
    const settings = await query(
      'SELECT SettingKey, SettingValue FROM BusinessSettings WHERE BusinessId = ?',
      [id]
    );

    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.SettingKey] = setting.SettingValue;
    });

    res.json({
      success: true,
      data: {
        business,
        analytics: {
          customerCount: customerCount[0].count,
          staffCount: staffCount[0].count,
          medicineCount: medicineCount[0].count,
          orderCount: orderCount[0].count,
          deliveredOrders: orderStats[0].delivered,
          pendingOrders: orderStats[0].pending,
          totalRevenue: orderStats[0].totalRevenue || 0
        },
        recentOrders,
        settings: settingsMap
      }
    });

  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new business
router.post('/businesses', [
  body('businessName').trim().isLength({ min: 2, max: 200 }).withMessage('Business name required'),
  body('businessCode').trim().isLength({ min: 3, max: 50 }).withMessage('Business code required'),
  body('ownerName').trim().isLength({ min: 2, max: 100 }).withMessage('Owner name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').isLength({ min: 10, max: 20 }).withMessage('Valid phone number required'),
  body('subscriptionPlan').isIn(['Free', 'Basic', 'Premium']).withMessage('Invalid subscription plan'),
  body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('address').optional(),
  body('city').optional(),
  body('state').optional()
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

    const {
      businessName,
      businessCode,
      ownerName,
      email,
      phone,
      subscriptionPlan = 'Free',
      password,
      address,
      city,
      state
    } = req.body;

    // Check if business code already exists
    const existingBusiness = await query(
      'SELECT BusinessId FROM Businesses WHERE BusinessCode = ?',
      [businessCode]
    );

    if (existingBusiness.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Business code already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await query(
      'SELECT UserId FROM Users WHERE Email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create business
    const businessResult = await query(
      `INSERT INTO Businesses (BusinessName, BusinessCode, OwnerName, Email, Phone, Address, City, State, SubscriptionPlan, Status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessName, businessCode, ownerName, email, phone, address, city, state, subscriptionPlan, 'Active']
    );

    const businessId = businessResult.insertId;

    // Use the password provided by the super admin, or fall back to a default
    const bcrypt = require('bcryptjs');
    const ownerPassword = password && password.trim() ? password.trim() : 'ChangeMe123';
    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    // Create business owner user
    const userResult = await query(
      `INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [businessId, ownerName, email, phone, passwordHash, 'BUSINESS_OWNER', true]
    );

    // Insert default business settings
    await query(
      `INSERT INTO BusinessSettings (BusinessId, SettingKey, SettingValue) VALUES 
       (?, 'currency', 'PKR'),
       (?, 'tax_rate', '0.16'),
       (?, 'delivery_fee', '50'),
       (?, 'min_order_amount', '100')`,
      [businessId, businessId, businessId, businessId]
    );

    // Insert default categories
    const defaultCategories = [
      'Pain Relief',
      'Antibiotics',
      'Vitamins & Supplements',
      'Cold & Flu',
      'Digestive Health',
      'Allergy',
      'Diabetes',
      'Heart Health',
      'First Aid',
      'Personal Care'
    ];

    for (const categoryName of defaultCategories) {
      await query(
        'INSERT INTO Categories (BusinessId, CategoryName, Description) VALUES (?, ?, ?)',
        [businessId, categoryName, `Default category for ${categoryName}`]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: {
        businessId,
        businessName,
        businessCode,
        ownerName,
        email,
        password: ownerPassword
      }
    });

  } catch (error) {
    console.error('Create business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update business
router.put('/businesses/:id', [
  body('businessName').optional().trim().isLength({ min: 2, max: 200 }),
  body('ownerName').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isLength({ min: 10, max: 20 }),
  body('subscriptionPlan').optional().isIn(['Free', 'Basic', 'Premium']),
  body('status').optional().isIn(['Active', 'Inactive', 'Suspended'])
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

    const { id } = req.params;
    const {
      businessName,
      ownerName,
      email,
      phone,
      subscriptionPlan,
      status,
      address,
      city,
      state
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (businessName) {
      updates.push('BusinessName = ?');
      params.push(businessName);
    }
    if (ownerName) {
      updates.push('OwnerName = ?');
      params.push(ownerName);
    }
    if (email) {
      updates.push('Email = ?');
      params.push(email);
    }
    if (phone) {
      updates.push('Phone = ?');
      params.push(phone);
    }
    if (subscriptionPlan) {
      updates.push('SubscriptionPlan = ?');
      params.push(subscriptionPlan);
    }
    if (status) {
      updates.push('Status = ?');
      params.push(status);
    }
    if (address !== undefined) {
      updates.push('Address = ?');
      params.push(address);
    }
    if (city !== undefined) {
      updates.push('City = ?');
      params.push(city);
    }
    if (state !== undefined) {
      updates.push('State = ?');
      params.push(state);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('UpdatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await query(
      `UPDATE Businesses SET ${updates.join(', ')} WHERE BusinessId = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Business updated successfully'
    });

  } catch (error) {
    console.error('Update business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete business (soft delete - set status to Suspended)
router.delete('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if business exists
    const businesses = await query(
      'SELECT BusinessId FROM Businesses WHERE BusinessId = ?',
      [id]
    );

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Soft delete - set status to Suspended
    await query(
      'UPDATE Businesses SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE BusinessId = ?',
      ['Suspended', id]
    );

    // Deactivate all users in this business
    await query(
      'UPDATE Users SET IsActive = 0 WHERE BusinessId = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Business suspended successfully'
    });

  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Activate/Deactivate business
router.patch('/businesses/:id/status', [
  body('status').isIn(['Active', 'Inactive', 'Suspended']).withMessage('Invalid status')
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

    const { id } = req.params;
    const { status } = req.body;

    // Check if business exists
    const businesses = await query(
      'SELECT BusinessId FROM Businesses WHERE BusinessId = ?',
      [id]
    );

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Update business status
    await query(
      'UPDATE Businesses SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE BusinessId = ?',
      [status, id]
    );

    // Update user active status based on business status
    const userActiveStatus = status === 'Active' ? 1 : 0;
    await query(
      'UPDATE Users SET IsActive = ? WHERE BusinessId = ?',
      [userActiveStatus, id]
    );

    res.json({
      success: true,
      message: `Business ${status.toLowerCase()} successfully`
    });

  } catch (error) {
    console.error('Update business status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get business users
router.get('/businesses/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query;

    let whereClause = 'WHERE BusinessId = ?';
    const params = [id];

    if (role) {
      whereClause += ' AND Role = ?';
      params.push(role);
    }

    const users = await query(
      `SELECT UserId, Name, Email, Phone, Role, IsActive, CreatedAt 
       FROM Users 
       ${whereClause}
       ORDER BY CreatedAt DESC`,
      params
    );

    res.json({
      success: true,
      data: { users }
    });

  } catch (error) {
    console.error('Get business users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
