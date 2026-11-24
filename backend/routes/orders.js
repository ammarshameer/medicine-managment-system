const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery, pool } = require('../config/database');
const {
  authenticateToken,
  requireTenant,
  requireBusinessAccess,
  requireCustomer,
  requireRole,
  requireBusinessOwnerAccess
} = require('../middleware/auth');
const { calculateOrderTax } = require('../utils/taxEngine');
const {
  isControlledMedicine,
  insertControlledLog,
  validateControlledPrescription,
  reverseDispensedLogs
} = require('../utils/controlledDrugs');
const router = express.Router();

// Wrap a mysql2 transaction connection into the simple (sql, params) => rows
// shape used by the shared controlled-substance helpers.
function transactionQuery(connection) {
  return (sql, params) => connection.query(sql, params).then(([rows]) => rows);
}

/**
 * GET /api/orders/my-orders
 * Customer view: Get logged-in user's orders
 */
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

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    let whereClause = 'WHERE o.UserId = ? AND o.BusinessId = ?';
    const params = [userId, businessId];

    if (status) {
      whereClause += ' AND o.Status = ?';
      params.push(status);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM Orders o ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const orders = await dbQuery(`
      SELECT 
        o.OrderId,
        o.BusinessId,
        o.OrderDate,
        o.Status,
        o.Source,
        o.TotalAmount,
        o.DeliveryAddress,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        o.ReorderedFromOrderId,
        p.PrescriptionId,
        p.Status as PrescriptionStatus,
        p.ImagePath as PrescriptionImagePath
      FROM Orders o
      LEFT JOIN Prescriptions p ON o.PrescriptionId = p.PrescriptionId
      ${whereClause}
      ORDER BY o.OrderDate DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await dbQuery(`
        SELECT 
          oi.OrderItemId,
          oi.Quantity,
          oi.Price,
          oi.Subtotal,
          oi.TaxAmount,
          oi.IsTaxable,
          oi.PriceIncludesTax,
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
        source: order.Source || 'Online',
        subtotal: parseFloat(order.Subtotal) || parseFloat(order.TotalAmount) || 0,
        taxRate: parseFloat(order.TaxRate) || 0,
        taxAmount: parseFloat(order.TaxAmount) || 0,
        totalAmount: parseFloat(order.TotalAmount) || 0,
        currency: order.Currency || 'USD',
        deliveryAddress: order.DeliveryAddress,
        paymentMethod: order.PaymentMethod,
        paymentStatus: order.PaymentStatus,
        notes: order.Notes,
        reorderedFromOrderId: order.ReorderedFromOrderId,
        prescription: order.PrescriptionId ? {
          id: order.PrescriptionId,
          status: order.PrescriptionStatus,
          imagePath: order.PrescriptionImagePath
        } : null,
        items: items.map(item => ({
          id: item.OrderItemId,
          medicineId: item.MedicineId,
          name: item.MedicineName,
          quantity: item.Quantity,
          price: parseFloat(item.Price),
          subtotal: parseFloat(item.Subtotal),
          taxAmount: parseFloat(item.TaxAmount) || 0,
          isTaxable: Boolean(item.IsTaxable),
          priceIncludesTax: Boolean(item.PriceIncludesTax),
          imagePath: item.ImagePath
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

/**
 * POST /api/orders/preview-tax
 * Real-time cart tax calculation using the centralized tax engine
 */
router.post('/preview-tax', authenticateToken, requireTenant, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required in cart'),
  body('items.*.medicineId').isInt({ min: 1 }).withMessage('Valid medicine ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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
    const { items } = req.body;

    const businesses = await dbQuery(
      `SELECT Currency, TaxEnabled, TaxRate FROM Businesses WHERE BusinessId = ?`,
      [businessId]
    );

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const business = businesses[0];
    const medicineIds = items.map(i => i.medicineId);

    const medicines = await dbQuery(
      `SELECT MedicineId, Name, Price, IsTaxable, PriceIncludesTax, DEASchedule, UAEClassification, RequiresPrescription
       FROM Medicines
       WHERE BusinessId = ? AND MedicineId IN (?)`,
      [businessId, medicineIds]
    );

    const enrichedItems = items.map(cartItem => {
      const med = medicines.find(m => m.MedicineId === cartItem.medicineId);
      return {
        medicineId: cartItem.medicineId,
        name: med ? med.Name : 'Medicine',
        price: med ? parseFloat(med.Price) : 0,
        quantity: parseInt(cartItem.quantity, 10),
        isTaxable: med ? Boolean(med.IsTaxable) : true,
        priceIncludesTax: med ? Boolean(med.PriceIncludesTax) : false,
        deaSchedule: med ? med.DEASchedule : 'None',
        uaeClassification: med ? med.UAEClassification : 'OTC',
        requiresPrescription: med ? Boolean(med.RequiresPrescription) : false
      };
    });

    const taxResult = calculateOrderTax(enrichedItems, {
      taxEnabled: business.TaxEnabled,
      taxRate: business.TaxRate
    });

    res.json({
      success: true,
      data: {
        currency: business.Currency || 'USD',
        subtotal: taxResult.subtotal,
        taxRate: taxResult.taxRate,
        taxAmount: taxResult.taxAmount,
        totalAmount: taxResult.totalAmount,
        items: taxResult.items
      }
    });
  } catch (error) {
    console.error('Preview tax error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/orders/pos
 * Point of Sale (POS) checkout for walk-in counter sales
 * Guarded explicitly by requireBusinessAccess (both STAFF and BUSINESS_OWNER)
 */
router.post('/pos', authenticateToken, requireTenant, requireBusinessAccess, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required in cart'),
  body('items.*.medicineId').isInt({ min: 1 }).withMessage('Valid medicine ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').optional().isIn(['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay', 'Cash on Delivery', 'JazzCash', 'EasyPaisa']),
  body('customerName').optional().trim(),
  body('customerPhone').optional().trim(),
  body('userId').optional().isInt().withMessage('Valid user ID if provided'),
  body('prescriptionId').optional().isInt({ min: 1 }).withMessage('Valid prescription ID if provided'),
  body('notes').optional().trim()
], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const businessId = req.user.businessId;
    const staffUserId = req.user.UserId;
    const {
      items,
      paymentMethod = 'Cash',
      customerName = 'Walk-in Customer',
      customerPhone = null,
      userId = null,
      prescriptionId = null,
      notes = null
    } = req.body;

    await connection.beginTransaction();

    // 1. Fetch Business info & tax config
    const [businesses] = await connection.query(
      `SELECT BusinessName, LegalName, Phone, Email, Address, City, State, ZipCode, Country,
              Currency, TaxEnabled, TaxRate, TaxRegistrationNumber, LicenseNumber, LicenseAuthority, PharmacistInChargeName
       FROM Businesses WHERE BusinessId = ?`,
      [businessId]
    );

    if (businesses.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const business = businesses[0];

    // 2. Fetch medicines with lock FOR UPDATE
    const medicineIds = items.map(i => i.medicineId);
    const [medicines] = await connection.query(
      `SELECT MedicineId, Name, Price, AverageCost, Stock, IsActive, IsTaxable, PriceIncludesTax,
              DEASchedule, UAEClassification, RequiresPrescription
       FROM Medicines 
       WHERE BusinessId = ? AND MedicineId IN (?)
       FOR UPDATE`,
      [businessId, medicineIds]
    );

    if (medicines.length !== medicineIds.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'One or more medicines could not be found in your business'
      });
    }

    // 3. Prepare items for tax calculation & check stock/active status
    const cartItemsWithDetails = [];
    const controlledItemsToLog = [];

    for (const item of items) {
      const med = medicines.find(m => m.MedicineId === item.medicineId);
      if (!med.IsActive) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Medicine "${med.Name}" is currently deactivated`
        });
      }

      const reqQty = parseInt(item.quantity, 10);
      const currentStock = parseInt(med.Stock, 10) || 0;
      if (currentStock < reqQty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${med.Name}". Available: ${currentStock}, Requested: ${reqQty}`
        });
      }

      // Controlled-substance audit track (country-aware shared definition)
      if (isControlledMedicine(med, business.Country)) {
        controlledItemsToLog.push({
          medicineId: med.MedicineId,
          medicineName: med.Name,
          quantity: reqQty,
          notes: `POS Dispensation by ${req.user.Name} (${req.user.Role}) to ${customerName}`
        });
      }

      cartItemsWithDetails.push({
        medicineId: med.MedicineId,
        medicineName: med.Name,
        quantity: reqQty,
        price: parseFloat(med.Price),
        costPrice: parseFloat(med.AverageCost) || 0,
        isTaxable: Boolean(med.IsTaxable),
        priceIncludesTax: Boolean(med.PriceIncludesTax),
        currentStock,
        newStock: currentStock - reqQty
      });
    }

    // Controlled substances require an Approved prescription owned by the
    // ordering customer. STAFF/OWNER may supply userId explicitly; when it is
    // omitted, an approved prescription provides the customer identity.
    let effectiveUserId = req.user.Role === 'CUSTOMER' ? req.user.UserId : (userId || null);
    if (controlledItemsToLog.length > 0) {
      if (!effectiveUserId && prescriptionId && req.user.Role !== 'CUSTOMER') {
        const [prescriptions] = await connection.query(
          'SELECT UserId, Status FROM Prescriptions WHERE PrescriptionId = ? AND BusinessId = ?',
          [prescriptionId, businessId]
        );
        if (prescriptions.length > 0 && prescriptions[0].Status === 'Approved' && prescriptions[0].UserId) {
          effectiveUserId = prescriptions[0].UserId;
        }
      }

      const rxCheck = await validateControlledPrescription(transactionQuery(connection), {
        prescriptionId,
        businessId,
        customerUserId: effectiveUserId,
        medicineName: controlledItemsToLog[0].medicineName
      });
      if (!rxCheck.ok) {
        await connection.rollback();
        connection.release();
        return res.status(rxCheck.status).json({ success: false, message: rxCheck.message });
      }
      controlledItemsToLog.forEach(item => { item.prescriptionId = rxCheck.prescriptionId; });
    }

    // 4. Calculate Tax using Centralized Tax Engine
    const taxResult = calculateOrderTax(cartItemsWithDetails, {
      taxEnabled: business.TaxEnabled,
      taxRate: business.TaxRate
    });

    const currency = business.Currency || 'USD';

    // 5. Create Orders record (Source = 'POS', Status = 'Delivered', PaymentStatus = 'Paid')
    const [orderResult] = await connection.query(
      `INSERT INTO Orders 
       (BusinessId, UserId, Status, Source, Subtotal, TaxRate, TaxAmount, TotalAmount, Currency, DeliveryAddress, CustomerName, CustomerPhone, PaymentMethod, PaymentStatus, PrescriptionId, CreatedBy, Notes)
       VALUES (?, ?, 'Delivered', 'POS', ?, ?, ?, ?, ?, 'Counter Sale (POS)', ?, ?, ?, 'Paid', ?, ?, ?)`,
      [
        businessId,
        effectiveUserId,
        taxResult.subtotal,
        taxResult.taxRate,
        taxResult.taxAmount,
        taxResult.totalAmount,
        currency,
        customerName || 'Walk-in Customer',
        customerPhone || null,
        paymentMethod,
        prescriptionId || null,
        staffUserId,
        notes
      ]
    );

    const orderId = orderResult.insertId;

    // 6. Insert OrderItems with net Subtotal and TaxAmount, deduct stock, log inventory
    for (const line of taxResult.items) {
      await connection.query(
        `INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, CostPrice, Subtotal, TaxAmount, IsTaxable, PriceIncludesTax)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          businessId,
          orderId,
          line.medicineId,
          line.quantity,
          line.price,
          line.costPrice,
          line.lineSubtotal, // Net pre-tax subtotal for revenue tracking
          line.lineTax,
          line.isTaxable,
          line.priceIncludesTax
        ]
      );

      // Deduct stock
      await connection.query(
        `UPDATE Medicines SET Stock = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?`,
        [line.newStock, line.medicineId, businessId]
      );

      // Log inventory transaction
      await connection.query(
        `INSERT INTO InventoryTransactions 
         (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
         VALUES (?, ?, 'Stock Out', ?, ?, ?, ?, ?)`,
        [
          businessId,
          line.medicineId,
          line.quantity,
          line.currentStock,
          line.newStock,
          `POS Sale #${orderId} (${customerName})`,
          staffUserId
        ]
      );
    }

    // 7. Log Controlled Substances Dispensation (POS is Delivered at creation)
    for (const cItem of controlledItemsToLog) {
      await insertControlledLog(transactionQuery(connection), {
        businessId,
        medicineId: cItem.medicineId,
        orderId,
        prescriptionId: cItem.prescriptionId || null,
        action: 'Dispensed',
        quantity: cItem.quantity,
        performedBy: staffUserId,
        notes: cItem.notes
      });
    }

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: 'POS checkout completed successfully',
      data: {
        orderId,
        orderNumber: `POS-${orderId}`,
        orderDate: new Date().toISOString(),
        source: 'POS',
        status: 'Delivered',
        paymentStatus: 'Paid',
        paymentMethod,
        subtotal: taxResult.subtotal,
        taxRate: taxResult.taxRate,
        taxAmount: taxResult.taxAmount,
        totalAmount: taxResult.totalAmount,
        currency,
        customer: {
          name: customerName,
          phone: customerPhone,
          userId: effectiveUserId
        },
        cashier: {
          id: req.user.UserId,
          name: req.user.Name
        },
        business: {
          name: business.BusinessName,
          legalName: business.LegalName,
          phone: business.Phone,
          email: business.Email,
          address: `${business.Address || ''}, ${business.City || ''} ${business.State || ''}`.trim(),
          taxRegistrationNumber: business.TaxRegistrationNumber,
          licenseNumber: business.LicenseNumber,
          licenseAuthority: business.LicenseAuthority,
          pharmacistInChargeName: business.PharmacistInChargeName
        },
        items: taxResult.items.map(i => ({
          medicineId: i.medicineId,
          name: i.medicineName,
          quantity: i.quantity,
          price: i.price,
          isTaxable: i.isTaxable,
          priceIncludesTax: i.priceIncludesTax,
          subtotal: i.lineSubtotal,
          taxAmount: i.lineTax,
          lineTotal: i.lineTotal
        }))
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('POS Checkout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete POS checkout'
    });
  }
});

/**
 * POST /api/orders
 * Customer & Admin order creation (supports catalog items, walk-in/custom customers, reordering)
 */
router.post('/', authenticateToken, requireTenant, requireRole(['CUSTOMER', 'BUSINESS_OWNER', 'STAFF']), [
  body('items').optional().isArray(),
  body('deliveryAddress').optional().trim(),
  body('paymentMethod').optional().isIn(['Cash on Delivery', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Insurance Copay', 'JazzCash', 'EasyPaisa', 'Cash']),
  body('prescriptionId').optional().isInt(),
  body('reorderedFromOrderId').optional().isInt(),
  body('userId').optional().isInt(),
  body('customerName').optional().trim(),
  body('customerPhone').optional().trim(),
  body('notes').optional().trim()
], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      items = [],
      deliveryAddress = 'Direct / Counter Pickup',
      paymentMethod = 'Cash on Delivery',
      prescriptionId = null,
      reorderedFromOrderId = null,
      notes = null,
      customerName = null,
      customerPhone = null
    } = req.body;

    const businessId = req.user.businessId;
    const isCustomer = req.user.Role === 'CUSTOMER';
    const targetUserId = isCustomer ? req.user.UserId : (req.body.userId || null);
    const finalCustomerName = customerName || (isCustomer ? req.user.Name : null);
    const finalCustomerPhone = customerPhone || (isCustomer ? req.user.Phone : null);

    if (items.length === 0 && !prescriptionId) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Order must contain either items or an approved prescription'
      });
    }

    await connection.beginTransaction();

    // 1. Fetch business tax settings & currency
    const [businesses] = await connection.query(
      `SELECT Currency, Country, TaxEnabled, TaxRate FROM Businesses WHERE BusinessId = ?`,
      [businessId]
    );

    if (businesses.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const business = businesses[0];
    const currency = business.Currency || 'USD';

    // Reorder references must be real orders in the same business and, for
    // customers, orders belonging to the same customer.
    if (reorderedFromOrderId) {
      const reorderId = parseInt(reorderedFromOrderId, 10);
      const [reorderSource] = await connection.query(
        'SELECT OrderId, BusinessId, UserId FROM Orders WHERE OrderId = ?',
        [reorderId]
      );
      if (!Number.isInteger(reorderId) || reorderId <= 0 || reorderSource.length === 0 ||
          Number(reorderSource[0].BusinessId) !== Number(businessId) ||
          (isCustomer && Number(reorderSource[0].UserId) !== Number(req.user.UserId))) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Invalid reorderedFromOrderId: order not found in this business/customer'
        });
      }
    }

    let orderItems = [];
    const controlledItemsToLog = [];

    if (items.length > 0) {
      const medicineIds = items.map(item => item.medicineId);
      const [medicines] = await connection.query(
        `SELECT MedicineId, BusinessId, Name, Price, AverageCost, Stock, RequiresPrescription, IsActive,
                IsTaxable, PriceIncludesTax, DEASchedule, UAEClassification
         FROM Medicines 
         WHERE MedicineId IN (?) AND BusinessId = ?
         FOR UPDATE`,
        [medicineIds, businessId]
      );

      if (medicines.length !== medicineIds.length) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'One or more selected medicines could not be found'
        });
      }

      for (const item of items) {
        const medicine = medicines.find(m => m.MedicineId === item.medicineId);
        if (!medicine.IsActive) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `Medicine "${medicine.Name}" is currently unavailable`
          });
        }

        const qty = parseInt(item.quantity, 10);
        const currentStock = parseInt(medicine.Stock, 10) || 0;
        if (currentStock < qty) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${medicine.Name}". Available: ${currentStock}`
          });
        }

        // Country-aware controlled definition (USA Schedule II, UAE Controlled/Narcotic only)
        const isControlled = isControlledMedicine(medicine, business.Country);

        if ((medicine.RequiresPrescription && isCustomer && !prescriptionId) || (isControlled && !prescriptionId)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `An approved prescription is required for "${medicine.Name}"`
          });
        }

        if (isControlled) {
          controlledItemsToLog.push({
            medicineId: medicine.MedicineId,
            medicineName: medicine.Name,
            quantity: qty,
            notes: `Online order dispensation requirement`
          });
        }

        orderItems.push({
          medicineId: item.medicineId,
          medicineName: medicine.Name,
          quantity: qty,
          price: parseFloat(medicine.Price),
          costPrice: parseFloat(medicine.AverageCost) || 0,
          isTaxable: Boolean(medicine.IsTaxable),
          priceIncludesTax: Boolean(medicine.PriceIncludesTax),
          currentStock,
          newStock: currentStock - qty
        });
      }
    }

    // Verify prescription. Controlled items additionally require an Approved
    // prescription belonging to the ordering customer. STAFF/OWNER identify the
    // customer with userId; when omitted, an approved prescription supplies it.
    let effectiveUserId = targetUserId;
    if (prescriptionId) {
      const [prescriptions] = await connection.query(
        `SELECT PrescriptionId, UserId, Status FROM Prescriptions
         WHERE PrescriptionId = ? AND BusinessId = ?`,
        [prescriptionId, businessId]
      );

      if (prescriptions.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Invalid prescription selected'
        });
      }

      if (controlledItemsToLog.length > 0) {
        if (!effectiveUserId && !isCustomer) {
          effectiveUserId = prescriptions[0].UserId || null;
        }
        const rxCheck = await validateControlledPrescription(transactionQuery(connection), {
          prescriptionId,
          businessId,
          customerUserId: effectiveUserId,
          medicineName: controlledItemsToLog[0].medicineName
        });
        if (!rxCheck.ok) {
          await connection.rollback();
          connection.release();
          return res.status(rxCheck.status).json({ success: false, message: rxCheck.message });
        }
      }
    }

    // Run tax calculation
    const taxResult = calculateOrderTax(orderItems, {
      taxEnabled: business.TaxEnabled,
      taxRate: business.TaxRate
    });

    // Insert Order
    const [orderResult] = await connection.query(
      `INSERT INTO Orders 
       (BusinessId, UserId, CustomerName, CustomerPhone, Status, Source, Subtotal, TaxRate, TaxAmount, TotalAmount, Currency, DeliveryAddress, PaymentMethod, PaymentStatus, PrescriptionId, ReorderedFromOrderId, Notes, CreatedBy)
       VALUES (?, ?, ?, ?, 'Pending', 'Online', ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
      [
        businessId,
        effectiveUserId,
        finalCustomerName,
        finalCustomerPhone,
        taxResult.subtotal,
        taxResult.taxRate,
        taxResult.taxAmount,
        taxResult.totalAmount,
        currency,
        deliveryAddress,
        paymentMethod,
        prescriptionId || null,
        reorderedFromOrderId || null,
        notes,
        req.user.UserId
      ]
    );

    const orderId = orderResult.insertId;

    // Insert OrderItems and deduct stock
    for (const item of taxResult.items) {
      await connection.query(
        `INSERT INTO OrderItems (BusinessId, OrderId, MedicineId, Quantity, Price, CostPrice, Subtotal, TaxAmount, IsTaxable, PriceIncludesTax)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          businessId,
          orderId,
          item.medicineId,
          item.quantity,
          item.price,
          item.costPrice,
          item.lineSubtotal, // Pre-tax net subtotal
          item.lineTax,
          item.isTaxable,
          item.priceIncludesTax
        ]
      );

      await connection.query(
        `UPDATE Medicines SET Stock = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?`,
        [item.newStock, item.medicineId, businessId]
      );

      await connection.query(
        `INSERT INTO InventoryTransactions 
         (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
         VALUES (?, ?, 'Stock Out', ?, ?, ?, ?, ?)`,
        [
          businessId,
          item.medicineId,
          item.quantity,
          item.currentStock,
          item.newStock,
          `Online Order #${orderId}`,
          req.user.UserId
        ]
      );
    }

    // Online orders are Pending until delivery; Dispensed is logged only when
    // the order reaches Delivered (see PATCH /:id/status).

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        id: orderId,
        orderNumber: `#${orderId}`,
        subtotal: taxResult.subtotal,
        taxRate: taxResult.taxRate,
        taxAmount: taxResult.taxAmount,
        totalAmount: taxResult.totalAmount,
        currency,
        status: 'Pending',
        source: 'Online',
        itemsCount: taxResult.items.length,
        prescriptionId: prescriptionId || null,
        reorderedFromOrderId: reorderedFromOrderId || null
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/orders/admin/all
 * Staff & Business Owner: List orders with filters (Source, Status, Search)
 */
router.get('/admin/all', authenticateToken, requireTenant, requireBusinessAccess, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled', 'all']),
  query('source').optional().isIn(['Online', 'POS', 'all']),
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

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const source = req.query.source;
    const search = req.query.search;
    const businessId = req.user.businessId;

    let whereClause = 'WHERE o.BusinessId = ?';
    const params = [businessId];

    if (status && status !== 'all') {
      whereClause += ' AND o.Status = ?';
      params.push(status);
    }

    if (source && source !== 'all') {
      whereClause += ' AND o.Source = ?';
      params.push(source);
    }

    if (search) {
      whereClause += ' AND (o.OrderId = ? OR o.CustomerName LIKE ? OR o.CustomerPhone LIKE ? OR u.Name LIKE ? OR u.Email LIKE ?)';
      const searchNum = parseInt(search, 10) || 0;
      const searchLike = `%${search}%`;
      params.push(searchNum, searchLike, searchLike, searchLike, searchLike);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM Orders o
       LEFT JOIN Users u ON o.UserId = u.UserId
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const orders = await dbQuery(`
      SELECT 
        o.OrderId,
        o.BusinessId,
        o.OrderDate,
        o.Status,
        o.Source,
        o.Subtotal,
        o.TaxRate,
        o.TaxAmount,
        o.TotalAmount,
        o.Currency,
        o.DeliveryAddress,
        o.CustomerName,
        o.CustomerPhone,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        o.CreatedBy,
        o.ReorderedFromOrderId,
        u.UserId,
        u.Name as RegisteredUserName,
        u.Email as RegisteredUserEmail,
        creator.Name as CreatorName,
        p.PrescriptionId,
        p.Status as PrescriptionStatus,
        COUNT(oi.OrderItemId) as ItemCount
      FROM Orders o
      LEFT JOIN Users u ON o.UserId = u.UserId
      LEFT JOIN Users creator ON o.CreatedBy = creator.UserId
      LEFT JOIN Prescriptions p ON o.PrescriptionId = p.PrescriptionId
      LEFT JOIN OrderItems oi ON o.OrderId = oi.OrderId
      ${whereClause}
      GROUP BY o.OrderId
      ORDER BY o.OrderDate DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => ({
          id: order.OrderId,
          businessId: order.BusinessId,
          orderDate: order.OrderDate,
          status: order.Status,
          source: order.Source || 'Online',
          subtotal: parseFloat(order.Subtotal) || parseFloat(order.TotalAmount) || 0,
          taxRate: parseFloat(order.TaxRate) || 0,
          taxAmount: parseFloat(order.TaxAmount) || 0,
          totalAmount: parseFloat(order.TotalAmount) || 0,
          currency: order.Currency || 'USD',
          deliveryAddress: order.DeliveryAddress,
          customerName: order.CustomerName || order.RegisteredUserName || 'Walk-in Customer',
          customerPhone: order.CustomerPhone,
          paymentMethod: order.PaymentMethod,
          paymentStatus: order.PaymentStatus,
          notes: order.Notes,
          itemCount: parseInt(order.ItemCount, 10) || 0,
          createdBy: order.CreatedBy,
          creatorName: order.CreatorName,
          reorderedFromOrderId: order.ReorderedFromOrderId,
          user: order.UserId ? {
            id: order.UserId,
            name: order.RegisteredUserName,
            email: order.RegisteredUserEmail
          } : null,
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

/**
 * GET /api/orders/:id
 * Get single order details
 */
router.get('/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    let whereClause = 'WHERE o.OrderId = ?';
    const params = [orderId];

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
        o.Source,
        o.Subtotal,
        o.TaxRate,
        o.TaxAmount,
        o.TotalAmount,
        o.Currency,
        o.DeliveryAddress,
        o.CustomerName,
        o.CustomerPhone,
        o.PaymentMethod,
        o.PaymentStatus,
        o.Notes,
        o.UserId,
        o.CreatedBy,
        o.ReorderedFromOrderId,
        u.Name as RegisteredUserName,
        u.Email as RegisteredUserEmail,
        creator.Name as CreatorName,
        p.PrescriptionId,
        p.Status as PrescriptionStatus,
        p.ImagePath as PrescriptionImagePath
      FROM Orders o
      LEFT JOIN Users u ON o.UserId = u.UserId
      LEFT JOIN Users creator ON o.CreatedBy = creator.UserId
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

    const items = await dbQuery(`
      SELECT 
        oi.OrderItemId,
        oi.Quantity,
        oi.Price,
        oi.CostPrice,
        oi.Subtotal,
        oi.TaxAmount,
        oi.IsTaxable,
        oi.PriceIncludesTax,
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
        source: order.Source || 'Online',
        subtotal: parseFloat(order.Subtotal) || parseFloat(order.TotalAmount) || 0,
        taxRate: parseFloat(order.TaxRate) || 0,
        taxAmount: parseFloat(order.TaxAmount) || 0,
        totalAmount: parseFloat(order.TotalAmount) || 0,
        currency: order.Currency || 'USD',
        deliveryAddress: order.DeliveryAddress,
        customerName: order.CustomerName || order.RegisteredUserName || 'Walk-in Customer',
        customerPhone: order.CustomerPhone,
        paymentMethod: order.PaymentMethod,
        paymentStatus: order.PaymentStatus,
        notes: order.Notes,
        createdBy: order.CreatedBy,
        creatorName: order.CreatorName,
        reorderedFromOrderId: order.ReorderedFromOrderId,
        user: order.UserId ? {
          id: order.UserId,
          name: order.RegisteredUserName,
          email: order.RegisteredUserEmail
        } : null,
        prescription: order.PrescriptionId ? {
          id: order.PrescriptionId,
          status: order.PrescriptionStatus,
          imagePath: order.PrescriptionImagePath
        } : null,
        items: items.map(item => ({
          id: item.OrderItemId,
          medicineId: item.MedicineId,
          name: item.MedicineName,
          quantity: item.Quantity,
          price: parseFloat(item.Price),
          costPrice: parseFloat(item.CostPrice) || 0,
          subtotal: parseFloat(item.Subtotal),
          taxAmount: parseFloat(item.TaxAmount) || 0,
          isTaxable: Boolean(item.IsTaxable),
          priceIncludesTax: Boolean(item.PriceIncludesTax),
          imagePath: item.ImagePath
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

/**
 * PATCH /api/orders/:id/status
 * Update order status (Staff & Business Owner)
 */
router.patch('/:id/status', authenticateToken, requireTenant, requireBusinessAccess, [
  body('status').isIn(['Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']).withMessage('Invalid status')
], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const businessId = req.user.businessId;

    await connection.beginTransaction();

    const [orders] = await connection.query(
      `SELECT o.OrderId, o.Status, o.PrescriptionId, b.Country
       FROM Orders o JOIN Businesses b ON b.BusinessId = o.BusinessId
       WHERE o.OrderId = ? AND o.BusinessId = ? FOR UPDATE`,
      [orderId, businessId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await connection.query(
      'UPDATE Orders SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE OrderId = ? AND BusinessId = ?',
      [status, orderId, businessId]
    );

    // Dispensed is recorded when the order actually reaches Delivered.
    if (status === 'Delivered' && orders[0].Status !== 'Delivered') {
      const [items] = await connection.query(
        `SELECT oi.MedicineId, oi.Quantity, m.Name, m.DEASchedule, m.UAEClassification
         FROM OrderItems oi JOIN Medicines m ON oi.MedicineId = m.MedicineId
         WHERE oi.OrderId = ?`,
        [orderId]
      );
      const [existingLogs] = await connection.query(
        `SELECT COUNT(*) as count FROM ControlledSubstanceLog
         WHERE BusinessId = ? AND OrderId = ? AND Action = 'Dispensed'`,
        [businessId, orderId]
      );

      if (Number(existingLogs[0].count) === 0) {
        for (const item of items) {
          if (isControlledMedicine(item, orders[0].Country)) {
            await insertControlledLog(transactionQuery(connection), {
              businessId,
              medicineId: item.MedicineId,
              orderId,
              prescriptionId: orders[0].PrescriptionId || null,
              action: 'Dispensed',
              quantity: item.Quantity,
              performedBy: req.user.UserId,
              notes: `Online order #${orderId} delivered`
            });
          }
        }
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PATCH /api/orders/:id/cancel
 * Cancel order
 */
router.patch('/:id/cancel', authenticateToken, requireTenant, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const orderId = parseInt(req.params.id, 10);
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    await connection.beginTransaction();

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

    const [orders] = await connection.query(
      `SELECT OrderId, Status, BusinessId FROM Orders ${whereClause} FOR UPDATE`,
      params
    );

    if (orders.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];
    if (order.Status === 'Delivered' || order.Status === 'Cancelled') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled as it is already ${order.Status}`
      });
    }

    await connection.query(
      'UPDATE Orders SET Status = "Cancelled", UpdatedAt = CURRENT_TIMESTAMP WHERE OrderId = ?',
      [orderId]
    );

    // Restore stock
    const [orderItems] = await connection.query(
      'SELECT MedicineId, Quantity FROM OrderItems WHERE OrderId = ?',
      [orderId]
    );

    for (const item of orderItems) {
      await connection.query(
        'UPDATE Medicines SET Stock = Stock + ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ?',
        [item.Quantity, item.MedicineId]
      );

      await connection.query(
        `INSERT INTO InventoryTransactions 
         (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
         SELECT ?, ?, 'Stock In', ?, Stock - ?, Stock, ?, ?
         FROM Medicines WHERE MedicineId = ?`,
        [
          order.BusinessId,
          item.MedicineId,
          item.Quantity,
          item.Quantity,
          `Cancelled Order #${orderId} Restock`,
          userId,
          item.MedicineId
        ]
      );
    }

    // Reverse any Dispensed ledger rows (e.g. orders created before the
    // Delivered-only rule) so cancelling a controlled order leaves no Dispensed.
    await reverseDispensedLogs(transactionQuery(connection), {
      businessId: order.BusinessId,
      orderId,
      performedBy: userId,
      reason: `Order #${orderId} cancelled`
    });

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Order cancelled successfully and inventory restored'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/orders/:id/void
 * Owner-only void/refund of a Delivered POS order. Restores stock, marks the
 * payment Refunded and reverses the Dispensed controlled-substance ledger.
 */
async function voidPosOrder(req, res) {
  const connection = await pool.getConnection();
  try {
    const orderId = parseInt(req.params.id, 10);
    const businessId = req.user.businessId;

    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT OrderId, BusinessId, Status, Source, PaymentStatus FROM Orders WHERE OrderId = ? AND BusinessId = ? FOR UPDATE',
      [orderId, businessId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    if (order.Source !== 'POS' || order.Status !== 'Delivered') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Only a Delivered POS order can be voided/refunded'
      });
    }

    await connection.query(
      `UPDATE Orders SET Status = 'Cancelled', PaymentStatus = 'Refunded', UpdatedAt = CURRENT_TIMESTAMP
       WHERE OrderId = ? AND BusinessId = ?`,
      [orderId, businessId]
    );

    const [items] = await connection.query(
      'SELECT MedicineId, Quantity FROM OrderItems WHERE OrderId = ?',
      [orderId]
    );

    for (const item of items) {
      await connection.query(
        'UPDATE Medicines SET Stock = Stock + ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?',
        [item.Quantity, item.MedicineId, businessId]
      );
      await connection.query(
        `INSERT INTO InventoryTransactions
         (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
         SELECT ?, ?, 'Stock In', ?, Stock - ?, Stock, ?, ? FROM Medicines WHERE MedicineId = ?`,
        [
          businessId,
          item.MedicineId,
          item.Quantity,
          item.Quantity,
          `POS Void/Refund #${orderId} Restock`,
          req.user.UserId,
          item.MedicineId
        ]
      );
    }

    await reverseDispensedLogs(transactionQuery(connection), {
      businessId,
      orderId,
      performedBy: req.user.UserId,
      reason: `POS order #${orderId} voided/refunded`
    });

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'POS order voided/refunded successfully and inventory restored',
      data: { orderId, status: 'Cancelled', paymentStatus: 'Refunded' }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Void POS order error:', error);
    res.status(500).json({ success: false, message: 'Failed to void/refund POS order' });
  }
}

router.post('/:id/void', authenticateToken, requireTenant, requireBusinessOwnerAccess, voidPosOrder);
router.patch('/:id/void', authenticateToken, requireTenant, requireBusinessOwnerAccess, voidPosOrder);
router.post('/:id/refund', authenticateToken, requireTenant, requireBusinessOwnerAccess, voidPosOrder);

// Stripe checkout for an existing order (see /api/payments/create-intent too).
router.post('/:id/pay', authenticateToken, requireTenant, require('../utils/payments').createPaymentIntent);

module.exports = router;
