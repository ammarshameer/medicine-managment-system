const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess, requireCustomer } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const router = express.Router();

// Get user's orders (with tenant filtering)
router.get('/my-orders', authenticateToken, requireTenant, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']).withMessage('Invalid status')
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
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE o.UserId = ? AND o.BusinessId = ?';
    const params = [userId, businessId];

    if (status) {
      whereClause += ' AND o.Status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Orders o 
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get orders with items
    const ordersQuery = `
      SELECT 
        o.OrderId,
        o.BusinessId,
        o.OrderDate,
        o.Status,
        o.TotalAmount,
        o.DeliveryAddress,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        p.PrescriptionId,
        p.Status as PrescriptionStatus
      FROM Orders o
      LEFT JOIN Prescriptions p ON o.PrescriptionId = p.PrescriptionId
      ${whereClause}
      ORDER BY o.OrderDate DESC
      LIMIT ? OFFSET ?
    `;
    const orders = await dbQuery(ordersQuery, [...params, limit, offset]);

    // Get order items for each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await dbQuery(`
        SELECT 
          oi.OrderItemId,
          oi.Quantity,
          oi.Price,
          oi.Subtotal,
          m.MedicineId,
          m.Name as MedicineName,
          m.ImagePath
        FROM OrderItems oi
        JOIN Medicines m ON oi.MedicineId = m.MedicineId
        WHERE oi.OrderId = ?
      `, [order.OrderId]);

      return {
        id: order.OrderId,
        businessId: order.BusinessId,
        orderDate: order.OrderDate,
        status: order.Status,
        totalAmount: parseFloat(order.TotalAmount),
        deliveryAddress: order.DeliveryAddress,
        paymentMethod: order.PaymentMethod,
        paymentStatus: order.PaymentStatus,
        notes: order.Notes,
        prescription: order.PrescriptionId ? {
          id: order.PrescriptionId,
          status: order.PrescriptionStatus
        } : null,
        items: items.map(item => ({
          id: item.OrderItemId,
          quantity: item.Quantity,
          price: parseFloat(item.Price),
          subtotal: parseFloat(item.Subtotal),
          medicine: {
            id: item.MedicineId,
            name: item.MedicineName,
            imagePath: item.ImagePath
          }
        }))
      };
    }));

    res.json({
      success: true,
      data: {
        orders: ordersWithItems,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new order (with tenant isolation)
router.post('/', authenticateToken, requireTenant, requireCustomer, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.medicineId').isInt({ min: 1 }).withMessage('Invalid medicine ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deliveryAddress').trim().isLength({ min: 5 }).withMessage('Delivery address is required'),
  body('paymentMethod').isIn(['Cash on Delivery', 'Credit Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa']).withMessage('Invalid payment method'),
  body('prescriptionId').optional().isInt().withMessage('Invalid prescription ID'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long')
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

    const { items, deliveryAddress, paymentMethod, prescriptionId, notes } = req.body;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    // Verify all medicines exist and have sufficient stock (with tenant filtering)
    const medicineIds = items.map(item => item.medicineId);
    const medicines = await dbQuery(`
      SELECT MedicineId, BusinessId, Name, Price, Stock, RequiresPrescription, IsActive
      FROM Medicines 
      WHERE MedicineId IN (${medicineIds.map(() => '?').join(',')}) AND BusinessId = ?
    `, [...medicineIds, businessId]);

    if (medicines.length !== medicineIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more medicines not found'
      });
    }

    // Check stock availability and prescription requirements
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const medicine = medicines.find(m => m.MedicineId === item.medicineId);
      
      if (!medicine.IsActive) {
        return res.status(400).json({
          success: false,
          message: `Medicine "${medicine.Name}" is not available`
        });
      }

      if (medicine.Stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${medicine.Name}". Available: ${medicine.Stock}`
        });
      }

      if (medicine.RequiresPrescription && !prescriptionId) {
        return res.status(400).json({
          success: false,
          message: `Prescription required for "${medicine.Name}"`
        });
      }

      const subtotal = parseFloat(medicine.Price) * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        medicineId: item.medicineId,
        quantity: item.quantity,
        price: parseFloat(medicine.Price),
        subtotal
      });
    }

    // Verify prescription if provided (with tenant filtering)
    if (prescriptionId) {
      const prescriptions = await dbQuery(`
        SELECT PrescriptionId, Status 
        FROM Prescriptions 
        WHERE PrescriptionId = ? AND UserId = ? AND BusinessId = ?
      `, [prescriptionId, userId, businessId]);

      if (prescriptions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid prescription'
        });
      }

      if (prescriptions[0].Status !== 'Approved') {
        return res.status(400).json({
          success: false,
          message: 'Prescription must be approved before placing order'
        });
      }
    }

    // Create order with businessId
    const orderResult = await dbQuery(`
      INSERT INTO Orders (BusinessId, UserId, TotalAmount, DeliveryAddress, PaymentMethod, PrescriptionId, Notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [businessId, userId, totalAmount, deliveryAddress, paymentMethod, prescriptionId || null, notes || null]);

    const orderId = orderResult.insertId;

    // Create order items with businessId
    for (const item of orderItems) {
      await dbQuery(`
        INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, Subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [businessId, orderId, item.medicineId, item.quantity, item.price, item.subtotal]);

      // Update medicine stock
      await dbQuery(`
        UPDATE Medicines 
        SET Stock = Stock - ?, UpdatedAt = CURRENT_TIMESTAMP 
        WHERE MedicineId = ?
      `, [item.quantity, item.medicineId]);
    }

    // Get created order with items
    const createdOrder = await dbQuery(`
      SELECT 
        o.OrderId,
        o.OrderDate,
        o.Status,
        o.TotalAmount,
        o.DeliveryAddress,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes
      FROM Orders o
      WHERE o.OrderId = ?
    `, [orderId]);

    const orderItemsResult = await dbQuery(`
      SELECT 
        oi.OrderItemId,
        oi.Quantity,
        oi.Price,
        oi.Subtotal,
        m.MedicineId,
        m.Name as MedicineName,
        m.ImagePath
      FROM OrderItems oi
      JOIN Medicines m ON oi.MedicineId = m.MedicineId
      WHERE oi.OrderId = ?
    `, [orderId]);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        id: createdOrder[0].OrderId,
        orderDate: createdOrder[0].OrderDate,
        status: createdOrder[0].Status,
        totalAmount: parseFloat(createdOrder[0].TotalAmount),
        deliveryAddress: createdOrder[0].DeliveryAddress,
        paymentMethod: createdOrder[0].PaymentMethod,
        paymentStatus: createdOrder[0].PaymentStatus,
        notes: createdOrder[0].Notes,
        items: orderItemsResult.map(item => ({
          id: item.OrderItemId,
          quantity: item.Quantity,
          price: parseFloat(item.Price),
          subtotal: parseFloat(item.Subtotal),
          medicine: {
            id: item.MedicineId,
            name: item.MedicineName,
            imagePath: item.ImagePath
          }
        }))
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single order by ID (with tenant filtering)
router.get('/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    // Get order with tenant filtering
    let whereClause = 'WHERE o.OrderId = ?';
    const params = [orderId];

    // Customers can only see their own orders, business owners can see orders from their business
    if (req.user.Role === 'CUSTOMER') {
      whereClause += ' AND o.UserId = ?';
      params.push(userId);
    }
    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND o.BusinessId = ?';
      params.push(businessId);
    }

    const orders = await dbQuery(`
      SELECT 
        o.OrderId,
        o.BusinessId,
        o.OrderDate,
        o.Status,
        o.TotalAmount,
        o.DeliveryAddress,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        o.UserId,
        p.PrescriptionId,
        p.Status as PrescriptionStatus
      FROM Orders o
      LEFT JOIN Prescriptions p ON o.PrescriptionId = p.PrescriptionId
      ${whereClause}
    `, params);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Get order items
    const items = await dbQuery(`
      SELECT 
        oi.OrderItemId,
        oi.Quantity,
        oi.Price,
        oi.Subtotal,
        m.MedicineId,
        m.Name as MedicineName,
        m.ImagePath
      FROM OrderItems oi
      JOIN Medicines m ON oi.MedicineId = m.MedicineId
      WHERE oi.OrderId = ?
    `, [orderId]);

    res.json({
      success: true,
      data: {
        id: order.OrderId,
        businessId: order.BusinessId,
        orderDate: order.OrderDate,
        status: order.Status,
        totalAmount: parseFloat(order.TotalAmount),
        deliveryAddress: order.DeliveryAddress,
        paymentMethod: order.PaymentMethod,
        paymentStatus: order.PaymentStatus,
        notes: order.Notes,
        prescription: order.PrescriptionId ? {
          id: order.PrescriptionId,
          status: order.PrescriptionStatus
        } : null,
        items: items.map(item => ({
          id: item.OrderItemId,
          quantity: item.Quantity,
          price: parseFloat(item.Price),
          subtotal: parseFloat(item.Subtotal),
          medicine: {
            id: item.MedicineId,
            name: item.MedicineName,
            imagePath: item.ImagePath
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Cancel order (with tenant filtering)
router.patch('/:id/cancel', authenticateToken, requireTenant, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    // Get order with tenant filtering
    let whereClause = 'WHERE OrderId = ?';
    const params = [orderId];

    if (req.user.Role === 'CUSTOMER') {
      whereClause += ' AND UserId = ?';
      params.push(userId);
    }
    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND BusinessId = ?';
      params.push(businessId);
    }

    const orders = await dbQuery(`SELECT OrderId, Status, UserId, BusinessId FROM Orders ${whereClause}`, params);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Check if order can be cancelled
    if (order.Status === 'Delivered' || order.Status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled'
      });
    }

    // Update order status
    await dbQuery('UPDATE Orders SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE OrderId = ?', ['Cancelled', orderId]);

    // Restore stock for cancelled order
    const orderItems = await dbQuery('SELECT MedicineId, Quantity FROM OrderItems WHERE OrderId = ?', [orderId]);
    for (const item of orderItems) {
      await dbQuery('UPDATE Medicines SET Stock = Stock + ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ?', [item.Quantity, item.MedicineId]);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all orders (business owner/staff only with tenant filtering)
router.get('/admin/all', authenticateToken, requireTenant, requireBusinessAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']).withMessage('Invalid status'),
  query('userId').optional().isInt().withMessage('Invalid user ID')
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
    const status = req.query.status;
    const userId = req.query.userId;
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND o.BusinessId = ?';
      params.push(businessId);
    }

    if (status) {
      whereClause += ' AND o.Status = ?';
      params.push(status);
    }

    if (userId) {
      whereClause += ' AND o.UserId = ?';
      params.push(userId);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Orders o 
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get orders with user info
    const ordersQuery = `
      SELECT 
        o.OrderId,
        o.BusinessId,
        o.OrderDate,
        o.Status,
        o.TotalAmount,
        o.DeliveryAddress,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        u.UserId,
        u.Name as UserName,
        u.Email,
        p.PrescriptionId,
        p.Status as PrescriptionStatus
      FROM Orders o
      JOIN Users u ON o.UserId = u.UserId
      LEFT JOIN Prescriptions p ON o.PrescriptionId = p.PrescriptionId
      ${whereClause}
      ORDER BY o.OrderDate DESC
      LIMIT ? OFFSET ?
    `;
    const orders = await dbQuery(ordersQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => ({
          id: order.OrderId,
          businessId: order.BusinessId,
          orderDate: order.OrderDate,
          status: order.Status,
          totalAmount: parseFloat(order.TotalAmount),
          deliveryAddress: order.DeliveryAddress,
          paymentMethod: order.PaymentMethod,
          paymentStatus: order.PaymentStatus,
          notes: order.Notes,
          user: {
            id: order.UserId,
            name: order.UserName,
            email: order.Email
          },
          prescription: order.PrescriptionId ? {
            id: order.PrescriptionId,
            status: order.PrescriptionStatus
          } : null
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
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update order status (business owner/staff only with tenant filtering)
router.patch('/:id/status', authenticateToken, requireTenant, requireBusinessAccess, [
  body('status').isIn(['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']).withMessage('Invalid status')
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

    const orderId = req.params.id;
    const { status } = req.body;
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Get order with tenant filtering
    let whereClause = 'WHERE OrderId = ?';
    const params = [orderId];

    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND BusinessId = ?';
      params.push(businessId);
    }

    const orders = await dbQuery(`SELECT OrderId, Status, BusinessId FROM Orders ${whereClause}`, params);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status
    await dbQuery('UPDATE Orders SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE OrderId = ?', [status, orderId]);

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
