const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery, pool } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessOwner } = require('../middleware/auth');

const router = express.Router();

// Strictly BUSINESS_OWNER only
router.use(authenticateToken, requireTenant, requireBusinessOwner);

/**
 * GET /api/purchase-orders
 * List purchase orders with filters
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['Draft', 'Ordered', 'Received', 'Cancelled', 'all']),
  query('vendorId').optional().isInt(),
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
    const status = req.query.status;
    const vendorId = req.query.vendorId;
    const search = req.query.search;

    let whereClause = 'WHERE po.BusinessId = ?';
    const params = [businessId];

    if (status && status !== 'all') {
      whereClause += ' AND po.Status = ?';
      params.push(status);
    }

    if (vendorId) {
      whereClause += ' AND po.VendorId = ?';
      params.push(vendorId);
    }

    if (search) {
      whereClause += ' AND (po.OrderNumber LIKE ? OR v.Name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total 
       FROM PurchaseOrders po
       LEFT JOIN Vendors v ON po.VendorId = v.VendorId
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const orders = await dbQuery(
      `SELECT 
        po.PurchaseOrderId, po.BusinessId, po.VendorId, po.OrderNumber, po.OrderDate,
        po.Status, po.TotalAmount, po.Notes, po.ReceivedAt, po.CreatedBy, po.CreatedAt,
        v.Name as VendorName, v.Phone as VendorPhone,
        u.Name as CreatorName,
        COUNT(poi.PurchaseOrderItemId) as ItemCount
       FROM PurchaseOrders po
       LEFT JOIN Vendors v ON po.VendorId = v.VendorId
       LEFT JOIN Users u ON po.CreatedBy = u.UserId
       LEFT JOIN PurchaseOrderItems poi ON po.PurchaseOrderId = poi.PurchaseOrderId
       ${whereClause}
       GROUP BY po.PurchaseOrderId
       ORDER BY po.CreatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        purchaseOrders: orders.map(po => ({
          id: po.PurchaseOrderId,
          businessId: po.BusinessId,
          vendorId: po.VendorId,
          vendorName: po.VendorName,
          vendorPhone: po.VendorPhone,
          orderNumber: po.OrderNumber,
          orderDate: po.OrderDate,
          status: po.Status,
          totalAmount: parseFloat(po.TotalAmount) || 0,
          notes: po.Notes,
          receivedAt: po.ReceivedAt,
          createdBy: po.CreatedBy,
          creatorName: po.CreatorName,
          itemCount: parseInt(po.ItemCount, 10) || 0,
          createdAt: po.CreatedAt
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
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase orders'
    });
  }
});

/**
 * GET /api/purchase-orders/:id
 * Get single PO with line items
 */
router.get('/:id', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const poId = parseInt(req.params.id, 10);

    const orders = await dbQuery(
      `SELECT 
        po.PurchaseOrderId, po.BusinessId, po.VendorId, po.OrderNumber, po.OrderDate,
        po.Status, po.TotalAmount, po.Notes, po.ReceivedAt, po.CreatedBy, po.CreatedAt,
        v.Name as VendorName, v.ContactPerson as VendorContactPerson, v.Email as VendorEmail, v.Phone as VendorPhone, v.Address as VendorAddress,
        u.Name as CreatorName
       FROM PurchaseOrders po
       LEFT JOIN Vendors v ON po.VendorId = v.VendorId
       LEFT JOIN Users u ON po.CreatedBy = u.UserId
       WHERE po.PurchaseOrderId = ? AND po.BusinessId = ?`,
      [poId, businessId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const po = orders[0];

    const items = await dbQuery(
      `SELECT 
        poi.PurchaseOrderItemId, poi.MedicineId, poi.Quantity, poi.UnitCost, poi.Subtotal,
        m.Name as MedicineName, m.Stock as CurrentStock, m.AverageCost as CurrentAverageCost, m.Price as RetailPrice
       FROM PurchaseOrderItems poi
       JOIN Medicines m ON poi.MedicineId = m.MedicineId
       WHERE poi.PurchaseOrderId = ? AND poi.BusinessId = ?`,
      [poId, businessId]
    );

    res.json({
      success: true,
      data: {
        purchaseOrder: {
          id: po.PurchaseOrderId,
          businessId: po.BusinessId,
          vendorId: po.VendorId,
          vendorName: po.VendorName,
          vendorContactPerson: po.VendorContactPerson,
          vendorEmail: po.VendorEmail,
          vendorPhone: po.VendorPhone,
          vendorAddress: po.VendorAddress,
          orderNumber: po.OrderNumber,
          orderDate: po.OrderDate,
          status: po.Status,
          totalAmount: parseFloat(po.TotalAmount) || 0,
          notes: po.Notes,
          receivedAt: po.ReceivedAt,
          createdBy: po.CreatedBy,
          creatorName: po.CreatorName,
          createdAt: po.CreatedAt,
          items: items.map(item => ({
            id: item.PurchaseOrderItemId,
            medicineId: item.MedicineId,
            medicineName: item.MedicineName,
            currentStock: item.CurrentStock,
            currentAverageCost: parseFloat(item.CurrentAverageCost) || 0,
            retailPrice: parseFloat(item.RetailPrice) || 0,
            quantity: item.Quantity,
            unitCost: parseFloat(item.UnitCost) || 0,
            subtotal: parseFloat(item.Subtotal) || 0
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching purchase order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order details'
    });
  }
});

/**
 * POST /api/purchase-orders
 * Create new Purchase Order with items
 */
router.post('/', [
  body('vendorId').isInt().withMessage('Valid vendor ID is required'),
  body('orderDate').isISO8601().withMessage('Valid order date is required'),
  body('status').optional().isIn(['Draft', 'Ordered']),
  body('notes').optional().isString(),
  body('items').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('items.*.medicineId').isInt().withMessage('Valid medicine ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitCost').isFloat({ min: 0.01 }).withMessage('UnitCost must be greater than 0')
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
    const { vendorId, orderDate, notes, items, status = 'Draft' } = req.body;

    // Verify vendor belongs to this business
    const [vendors] = await connection.query(
      'SELECT VendorId FROM Vendors WHERE VendorId = ? AND BusinessId = ?',
      [vendorId, businessId]
    );

    if (vendors.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Selected vendor does not exist in this pharmacy'
      });
    }

    // Verify all medicines belong to this business
    const medicineIds = items.map(i => i.medicineId);
    const [medicines] = await connection.query(
      `SELECT MedicineId, Name FROM Medicines WHERE BusinessId = ? AND MedicineId IN (?)`,
      [businessId, medicineIds]
    );

    if (medicines.length !== medicineIds.length) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'One or more selected medicines do not exist in your catalog'
      });
    }

    await connection.beginTransaction();

    // Generate Order Number: PO-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `PO-${dateStr}-${randSuffix}`;

    let totalAmount = 0;
    const calculatedItems = items.map(item => {
      const qty = parseInt(item.quantity, 10);
      const cost = parseFloat(item.unitCost);
      const subtotal = Math.round(qty * cost * 100) / 100;
      totalAmount += subtotal;
      return {
        medicineId: item.medicineId,
        quantity: qty,
        unitCost: cost,
        subtotal
      };
    });

    const [poResult] = await connection.query(
      `INSERT INTO PurchaseOrders (BusinessId, VendorId, OrderNumber, OrderDate, Status, TotalAmount, Notes, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [businessId, vendorId, orderNumber, orderDate, status, totalAmount, notes || null, req.user.UserId]
    );

    const poId = poResult.insertId;

    for (const item of calculatedItems) {
      await connection.query(
        `INSERT INTO PurchaseOrderItems (PurchaseOrderId, BusinessId, MedicineId, Quantity, UnitCost, Subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [poId, businessId, item.medicineId, item.quantity, item.unitCost, item.subtotal]
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        purchaseOrderId: poId,
        orderNumber,
        totalAmount,
        status
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase order'
    });
  }
});

/**
 * POST /api/purchase-orders/:id/receive
 * Atomically receive PO:
 * - Update PO status to Received & set ReceivedAt
 * - Increment stock
 * - Recalculate weighted average cost (AverageCost)
 * - Record InventoryTransactions (Stock In)
 */
router.post('/:id/receive', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const businessId = req.user.businessId;
    const poId = parseInt(req.params.id, 10);

    await connection.beginTransaction();

    const [pos] = await connection.query(
      `SELECT PurchaseOrderId, OrderNumber, Status 
       FROM PurchaseOrders 
       WHERE PurchaseOrderId = ? AND BusinessId = ?
       FOR UPDATE`,
      [poId, businessId]
    );

    if (pos.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const po = pos[0];
    if (po.Status === 'Received') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'This purchase order has already been received'
      });
    }

    if (po.Status === 'Cancelled') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Cannot receive a cancelled purchase order'
      });
    }

    // Get line items
    const [items] = await connection.query(
      `SELECT PurchaseOrderItemId, MedicineId, Quantity, UnitCost, Subtotal
       FROM PurchaseOrderItems
       WHERE PurchaseOrderId = ? AND BusinessId = ?`,
      [poId, businessId]
    );

    if (items.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Purchase order has no items'
      });
    }

    // Update each medicine atomically
    for (const item of items) {
      const [meds] = await connection.query(
        `SELECT MedicineId, Stock, AverageCost, Name
         FROM Medicines
         WHERE MedicineId = ? AND BusinessId = ?
         FOR UPDATE`,
        [item.medicineId, businessId]
      );

      if (meds.length === 0) {
        throw new Error(`Medicine #${item.medicineId} not found in this business`);
      }

      const med = meds[0];
      const currentStock = parseInt(med.Stock, 10) || 0;
      const currentAvgCost = parseFloat(med.AverageCost) || 0;
      const addQty = parseInt(item.Quantity, 10);
      const incomingUnitCost = parseFloat(item.UnitCost);

      const newStock = currentStock + addQty;
      // Formula: weighted average cost
      // newAvgCost = ((currentStock * currentAvgCost) + (addQty * incomingUnitCost)) / newStock
      const totalInventoryVal = (currentStock * currentAvgCost) + (addQty * incomingUnitCost);
      const newAvgCost = newStock > 0 
        ? Math.round((totalInventoryVal / newStock) * 100) / 100 
        : incomingUnitCost;

      // 1. Update Medicine stock & AverageCost
      await connection.query(
        `UPDATE Medicines 
         SET Stock = ?, AverageCost = ? 
         WHERE MedicineId = ? AND BusinessId = ?`,
        [newStock, newAvgCost, item.medicineId, businessId]
      );

      // 2. Insert InventoryTransactions record
      await connection.query(
        `INSERT INTO InventoryTransactions 
         (BusinessId, MedicineId, TransactionType, Quantity, PreviousStock, NewStock, Reason, PerformedBy)
         VALUES (?, ?, 'Stock In', ?, ?, ?, ?, ?)`,
        [
          businessId,
          item.medicineId,
          addQty,
          currentStock,
          newStock,
          `PO Received #${po.OrderNumber} (Cost: PKR ${incomingUnitCost.toFixed(2)})`,
          req.user.UserId
        ]
      );
    }

    // Update PO status
    await connection.query(
      `UPDATE PurchaseOrders 
       SET Status = 'Received', ReceivedAt = NOW() 
       WHERE PurchaseOrderId = ? AND BusinessId = ?`,
      [poId, businessId]
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `Purchase order #${po.OrderNumber} received successfully. Inventory and average costs updated.`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error receiving purchase order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to receive purchase order'
    });
  }
});

/**
 * PUT /api/purchase-orders/:id/cancel
 * Cancel a Draft or Ordered PO
 */
router.put('/:id/cancel', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const poId = parseInt(req.params.id, 10);

    const pos = await dbQuery(
      'SELECT PurchaseOrderId, Status FROM PurchaseOrders WHERE PurchaseOrderId = ? AND BusinessId = ?',
      [poId, businessId]
    );

    if (pos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (pos[0].Status === 'Received') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an order that has already been received'
      });
    }

    await dbQuery(
      `UPDATE PurchaseOrders SET Status = 'Cancelled' WHERE PurchaseOrderId = ? AND BusinessId = ?`,
      [poId, businessId]
    );

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel purchase order'
    });
  }
});

module.exports = router;
