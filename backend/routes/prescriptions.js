const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess, requireCustomer } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const router = express.Router();

// Get user's prescriptions (with tenant filtering)
router.get('/my-prescriptions', authenticateToken, requireTenant, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['Pending', 'Approved', 'Rejected']).withMessage('Invalid status')
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
    let whereClause = 'WHERE p.UserId = ? AND p.BusinessId = ?';
    const params = [userId, businessId];

    if (status) {
      whereClause += ' AND p.Status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Prescriptions p 
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get prescriptions
    const prescriptionsQuery = `
      SELECT 
        p.PrescriptionId,
        p.BusinessId,
        p.ImagePath,
        p.Status,
        p.Notes,
        p.CreatedAt,
        p.ApprovedAt,
        approver.Name as ApprovedByName
      FROM Prescriptions p
      LEFT JOIN Users approver ON p.ApprovedBy = approver.UserId
      ${whereClause}
      ORDER BY p.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;
    const prescriptions = await dbQuery(prescriptionsQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        prescriptions: prescriptions.map(prescription => ({
          id: prescription.PrescriptionId,
          businessId: prescription.BusinessId,
          imagePath: prescription.ImagePath,
          status: prescription.Status,
          notes: prescription.Notes,
          createdAt: prescription.CreatedAt,
          approvedAt: prescription.ApprovedAt,
          approvedBy: prescription.ApprovedByName
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
    console.error('Get prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload new prescription (with tenant filtering)
router.post('/', authenticateToken, requireTenant, requireCustomer, uploadSingle('prescription'), [
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No prescription image provided'
      });
    }

    const userId = req.user.UserId;
    const businessId = req.user.businessId;
    const { notes } = req.body;
    const imagePath = req.file.path.replace(/\\/g, '/');

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    // Insert prescription with businessId
    const result = await dbQuery(`
      INSERT INTO Prescriptions (BusinessId, UserId, ImagePath, Notes)
      VALUES (?, ?, ?, ?)
    `, [businessId, userId, imagePath, notes || null]);

    // Get the created prescription
    const prescriptions = await dbQuery(`
      SELECT PrescriptionId, BusinessId, ImagePath, Status, Notes, CreatedAt
      FROM Prescriptions 
      WHERE PrescriptionId = ?
    `, [result.insertId]);

    const prescription = prescriptions[0];

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: {
        id: prescription.PrescriptionId,
        businessId: prescription.BusinessId,
        imagePath: prescription.ImagePath,
        status: prescription.Status,
        notes: prescription.Notes,
        createdAt: prescription.CreatedAt
      }
    });

  } catch (error) {
    console.error('Upload prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single prescription by ID (with tenant filtering)
router.get('/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE p.PrescriptionId = ?';
    const params = [prescriptionId];

    if (req.user.Role === 'CUSTOMER') {
      whereClause += ' AND p.UserId = ?';
      params.push(userId);
    }
    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND p.BusinessId = ?';
      params.push(businessId);
    }

    const prescriptions = await dbQuery(`
      SELECT 
        p.PrescriptionId,
        p.BusinessId,
        p.ImagePath,
        p.Status,
        p.Notes,
        p.CreatedAt,
        p.ApprovedAt,
        p.ApprovedBy,
        approver.Name as ApprovedByName
      FROM Prescriptions p
      LEFT JOIN Users approver ON p.ApprovedBy = approver.UserId
      ${whereClause}
    `, params);

    if (prescriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = prescriptions[0];

    res.json({
      success: true,
      data: {
        id: prescription.PrescriptionId,
        businessId: prescription.BusinessId,
        imagePath: prescription.ImagePath,
        status: prescription.Status,
        notes: prescription.Notes,
        createdAt: prescription.CreatedAt,
        approvedAt: prescription.ApprovedAt,
        approvedBy: prescription.ApprovedByName
      }
    });

  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all prescriptions (business owner/staff only with tenant filtering)
router.get('/admin/all', authenticateToken, requireTenant, requireBusinessAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['Pending', 'Approved', 'Rejected']).withMessage('Invalid status'),
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
      whereClause += ' AND p.BusinessId = ?';
      params.push(businessId);
    }

    if (status) {
      whereClause += ' AND p.Status = ?';
      params.push(status);
    }

    if (userId) {
      whereClause += ' AND p.UserId = ?';
      params.push(userId);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM Prescriptions p 
      ${whereClause}
    `;
    const countResult = await dbQuery(countQuery, params);
    const total = countResult[0].total;

    // Get prescriptions with user info
    const prescriptionsQuery = `
      SELECT 
        p.PrescriptionId,
        p.BusinessId,
        p.ImagePath,
        p.Status,
        p.Notes,
        p.CreatedAt,
        p.ApprovedAt,
        u.UserId,
        u.Name as UserName,
        u.Email,
        approver.Name as ApprovedByName
      FROM Prescriptions p
      JOIN Users u ON p.UserId = u.UserId
      LEFT JOIN Users approver ON p.ApprovedBy = approver.UserId
      ${whereClause}
      ORDER BY p.CreatedAt DESC
      LIMIT ? OFFSET ?
    `;
    const prescriptions = await dbQuery(prescriptionsQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        prescriptions: prescriptions.map(prescription => ({
          id: prescription.PrescriptionId,
          businessId: prescription.BusinessId,
          imagePath: prescription.ImagePath,
          status: prescription.Status,
          notes: prescription.Notes,
          createdAt: prescription.CreatedAt,
          approvedAt: prescription.ApprovedAt,
          user: {
            id: prescription.UserId,
            name: prescription.UserName,
            email: prescription.Email
          },
          approvedBy: prescription.ApprovedByName
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
    console.error('Get all prescriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Approve/Reject prescription (business owner/staff only with tenant filtering)
router.patch('/:id/status', authenticateToken, requireTenant, requireBusinessAccess, [
  body('status').isIn(['Approved', 'Rejected']).withMessage('Invalid status'),
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

    const prescriptionId = req.params.id;
    const { status, notes } = req.body;
    const approvedBy = req.user.UserId;
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Get prescription with tenant filtering
    let whereClause = 'WHERE PrescriptionId = ?';
    const queryParams = [prescriptionId];

    if (req.user.Role !== 'SUPER_ADMIN') {
      whereClause += ' AND BusinessId = ?';
      queryParams.push(businessId);
    }

    const prescriptions = await dbQuery(`SELECT PrescriptionId, Status, BusinessId FROM Prescriptions ${whereClause}`, queryParams);
    if (prescriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Check if prescription is already processed
    if (prescriptions[0].Status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Prescription has already been processed'
      });
    }

    // Update prescription status
    const updateFields = ['Status = ?', 'ApprovedBy = ?', 'ApprovedAt = CURRENT_TIMESTAMP'];
    const updateParams = [status, approvedBy];

    if (notes !== undefined) {
      updateFields.push('Notes = ?');
      updateParams.push(notes);
    }

    updateParams.push(prescriptionId);

    await dbQuery(`
      UPDATE Prescriptions 
      SET ${updateFields.join(', ')}, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE PrescriptionId = ?
    `, updateParams);

    res.json({
      success: true,
      message: `Prescription ${status.toLowerCase()} successfully`
    });

  } catch (error) {
    console.error('Update prescription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
