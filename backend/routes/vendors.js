const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessOwner } = require('../middleware/auth');

const router = express.Router();

// All vendor endpoints are strictly BUSINESS_OWNER only
router.use(authenticateToken, requireTenant, requireBusinessOwner);

/**
 * GET /api/vendors
 * List vendors for the current business
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString(),
  query('status').optional().isIn(['active', 'inactive', 'all'])
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
    const search = req.query.search;
    const status = req.query.status || 'active';

    let whereClause = 'WHERE BusinessId = ?';
    const params = [businessId];

    if (status === 'active') {
      whereClause += ' AND IsActive = TRUE';
    } else if (status === 'inactive') {
      whereClause += ' AND IsActive = FALSE';
    }

    if (search) {
      whereClause += ' AND (Name LIKE ? OR ContactPerson LIKE ? OR Email LIKE ? OR Phone LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM Vendors ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const vendors = await dbQuery(
      `SELECT VendorId, BusinessId, Name, ContactPerson, Email, Phone, Address, IsActive, CreatedAt, UpdatedAt
       FROM Vendors
       ${whereClause}
       ORDER BY Name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        vendors: vendors.map(v => ({
          id: v.VendorId,
          businessId: v.BusinessId,
          name: v.Name,
          contactPerson: v.ContactPerson,
          email: v.Email,
          phone: v.Phone,
          address: v.Address,
          isActive: Boolean(v.IsActive),
          createdAt: v.CreatedAt,
          updatedAt: v.UpdatedAt
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
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors'
    });
  }
});

/**
 * GET /api/vendors/:id
 * Get single vendor by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const vendorId = parseInt(req.params.id, 10);

    const vendors = await dbQuery(
      `SELECT VendorId, BusinessId, Name, ContactPerson, Email, Phone, Address, IsActive, CreatedAt, UpdatedAt
       FROM Vendors
       WHERE VendorId = ? AND BusinessId = ?`,
      [vendorId, businessId]
    );

    if (vendors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const v = vendors[0];
    res.json({
      success: true,
      data: {
        vendor: {
          id: v.VendorId,
          businessId: v.BusinessId,
          name: v.Name,
          contactPerson: v.ContactPerson,
          email: v.Email,
          phone: v.Phone,
          address: v.Address,
          isActive: Boolean(v.IsActive),
          createdAt: v.CreatedAt,
          updatedAt: v.UpdatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor'
    });
  }
});

/**
 * POST /api/vendors
 * Create a new vendor
 */
router.post('/', [
  body('name').trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('address').optional().trim()
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
    const { name, contactPerson, email, phone, address } = req.body;

    const result = await dbQuery(
      `INSERT INTO Vendors (BusinessId, Name, ContactPerson, Email, Phone, Address, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [businessId, name, contactPerson || null, email || null, phone || null, address || null]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        vendorId: result.insertId,
        name,
        contactPerson,
        email,
        phone,
        address
      }
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vendor'
    });
  }
});

/**
 * PUT /api/vendors/:id
 * Update vendor details
 */
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Vendor name cannot be empty'),
  body('contactPerson').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('isActive').optional().isBoolean()
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
    const vendorId = parseInt(req.params.id, 10);

    const existing = await dbQuery(
      'SELECT VendorId FROM Vendors WHERE VendorId = ? AND BusinessId = ?',
      [vendorId, businessId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const updates = [];
    const params = [];

    const fields = ['name', 'contactPerson', 'email', 'phone', 'address', 'isActive'];
    const dbFields = ['Name', 'ContactPerson', 'Email', 'Phone', 'Address', 'IsActive'];

    fields.forEach((field, index) => {
      if (req.body[field] !== undefined) {
        updates.push(`${dbFields[index]} = ?`);
        params.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update'
      });
    }

    params.push(vendorId, businessId);

    await dbQuery(
      `UPDATE Vendors SET ${updates.join(', ')} WHERE VendorId = ? AND BusinessId = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor'
    });
  }
});

/**
 * DELETE /api/vendors/:id
 * Toggle deactivate vendor
 */
router.delete('/:id', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const vendorId = parseInt(req.params.id, 10);

    const result = await dbQuery(
      'UPDATE Vendors SET IsActive = FALSE WHERE VendorId = ? AND BusinessId = ?',
      [vendorId, businessId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate vendor'
    });
  }
});

module.exports = router;
