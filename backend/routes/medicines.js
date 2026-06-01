const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess, requireSuperAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const router = express.Router();

// Get all medicines (public endpoint with optional tenant filtering)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isInt().withMessage('Category must be an integer'),
  query('search').optional().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('sortBy').optional().isIn(['name', 'price', 'stock']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
    const category = req.query.category;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE m.IsActive = TRUE';
    const params = [];

    // Add tenant filtering if user is authenticated and not SUPER_ADMIN
    if (req.user && req.user.Role !== 'SUPER_ADMIN' && req.user.businessId) {
      whereClause += ' AND m.BusinessId = ?';
      params.push(req.user.businessId);
    }

    if (category) {
      whereClause += ' AND m.CategoryId = ?';
      params.push(category);
    }

    if (search) {
      whereClause += ' AND (m.Name LIKE ? OR m.Description LIKE ?)';
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

    // Get medicines with pagination
    const medicinesQuery = `
      SELECT 
        m.MedicineId,
        m.BusinessId,
        m.Name,
        m.Description,
        m.Price,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        m.ImagePath,
        m.RequiresPrescription,
        c.CategoryId,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      ${whereClause}
      ORDER BY m.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    const medicines = await dbQuery(medicinesQuery, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        medicines: medicines.map(medicine => ({
          id: medicine.MedicineId,
          businessId: medicine.BusinessId,
          name: medicine.Name,
          description: medicine.Description,
          price: parseFloat(medicine.Price),
          stock: medicine.Stock,
          expiryDate: medicine.ExpiryDate,
          manufacturer: medicine.Manufacturer,
          imagePath: medicine.ImagePath,
          requiresPrescription: medicine.RequiresPrescription,
          category: medicine.CategoryId ? {
            id: medicine.CategoryId,
            name: medicine.CategoryName
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
    console.error('Get medicines error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single medicine by ID (with tenant filtering)
router.get('/:id', async (req, res) => {
  try {
    const medicineId = req.params.id;

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE m.MedicineId = ? AND m.IsActive = TRUE';
    const params = [medicineId];

    // Add tenant filtering if user is authenticated and not SUPER_ADMIN
    if (req.user && req.user.Role !== 'SUPER_ADMIN' && req.user.businessId) {
      whereClause += ' AND m.BusinessId = ?';
      params.push(req.user.businessId);
    }

    const medicines = await dbQuery(`
      SELECT 
        m.MedicineId,
        m.BusinessId,
        m.Name,
        m.Description,
        m.Price,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        m.ImagePath,
        m.RequiresPrescription,
        c.CategoryId,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      ${whereClause}
    `, params);

    if (medicines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    const medicine = medicines[0];

    res.json({
      success: true,
      data: {
        id: medicine.MedicineId,
        businessId: medicine.BusinessId,
        name: medicine.Name,
        description: medicine.Description,
        price: parseFloat(medicine.Price),
        stock: medicine.Stock,
        expiryDate: medicine.ExpiryDate,
        manufacturer: medicine.Manufacturer,
        imagePath: medicine.ImagePath,
        requiresPrescription: medicine.RequiresPrescription,
        category: medicine.CategoryId ? {
          id: medicine.CategoryId,
          name: medicine.CategoryName
        } : null
      }
    });

  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add new medicine (business owner/staff only with tenant isolation)
router.post('/', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Name must be between 2 and 200 characters'),
  body('categoryId').optional().isInt().withMessage('Category ID must be an integer'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format'),
  body('manufacturer').optional().trim().isLength({ max: 100 }).withMessage('Manufacturer name too long'),
  body('requiresPrescription').optional().isBoolean().withMessage('Requires prescription must be boolean')
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
      name,
      categoryId,
      description,
      price,
      stock,
      expiryDate,
      manufacturer,
      requiresPrescription = false
    } = req.body;

    // Get businessId from authenticated user (SUPER_ADMIN can specify businessId)
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    // Verify category exists and belongs to the same business
    if (categoryId) {
      const categories = await dbQuery(
        'SELECT CategoryId FROM Categories WHERE CategoryId = ? AND BusinessId = ? AND IsActive = TRUE', 
        [categoryId, businessId]
      );
      if (categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category or category does not belong to your business'
        });
      }
    }

    // Insert medicine with businessId
    const result = await dbQuery(`
      INSERT INTO Medicines (BusinessId, Name, CategoryId, Description, Price, Stock, ExpiryDate, Manufacturer, RequiresPrescription)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [businessId, name, categoryId, description, price, stock, expiryDate || null, manufacturer, requiresPrescription]);

    // Get the created medicine
    const medicines = await dbQuery(`
      SELECT 
        m.MedicineId,
        m.BusinessId,
        m.Name,
        m.Description,
        m.Price,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        m.RequiresPrescription,
        c.CategoryId,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      WHERE m.MedicineId = ?
    `, [result.insertId]);

    const medicine = medicines[0];

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      data: {
        id: medicine.MedicineId,
        businessId: medicine.BusinessId,
        name: medicine.Name,
        description: medicine.Description,
        price: parseFloat(medicine.Price),
        stock: medicine.Stock,
        expiryDate: medicine.ExpiryDate,
        manufacturer: medicine.Manufacturer,
        requiresPrescription: medicine.RequiresPrescription,
        category: medicine.CategoryId ? {
          id: medicine.CategoryId,
          name: medicine.CategoryName
        } : null
      }
    });

  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update medicine (business owner/staff only with tenant isolation)
router.put('/:id', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Name must be between 2 and 200 characters'),
  body('categoryId').optional().isInt().withMessage('Category ID must be an integer'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format'),
  body('manufacturer').optional().trim().isLength({ max: 100 }).withMessage('Manufacturer name too long'),
  body('requiresPrescription').optional().isBoolean().withMessage('Requires prescription must be boolean'),
  body('isActive').optional().isBoolean().withMessage('Is active must be boolean')
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

    const medicineId = req.params.id;
    const updateFields = [];
    const params = [];

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Build dynamic update query
    const allowedFields = ['name', 'categoryId', 'description', 'price', 'stock', 'expiryDate', 'manufacturer', 'requiresPrescription', 'isActive'];
    const fieldMapping = {
      name: 'Name',
      categoryId: 'CategoryId',
      description: 'Description',
      price: 'Price',
      stock: 'Stock',
      expiryDate: 'ExpiryDate',
      manufacturer: 'Manufacturer',
      requiresPrescription: 'RequiresPrescription',
      isActive: 'IsActive'
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${fieldMapping[field]} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Verify category exists and belongs to the same business if provided
    if (req.body.categoryId) {
      const categories = await dbQuery(
        'SELECT CategoryId FROM Categories WHERE CategoryId = ? AND BusinessId = ? AND IsActive = TRUE', 
        [req.body.categoryId, businessId]
      );
      if (categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category or category does not belong to your business'
        });
      }
    }

    params.push(medicineId, businessId);

    // Update medicine with tenant filtering
    await dbQuery(`
      UPDATE Medicines 
      SET ${updateFields.join(', ')}, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE MedicineId = ? AND BusinessId = ?
    `, params);

    // Get updated medicine
    const medicines = await dbQuery(`
      SELECT 
        m.MedicineId,
        m.BusinessId,
        m.Name,
        m.Description,
        m.Price,
        m.Stock,
        m.ExpiryDate,
        m.Manufacturer,
        m.ImagePath,
        m.RequiresPrescription,
        m.IsActive,
        c.CategoryId,
        c.CategoryName
      FROM Medicines m
      LEFT JOIN Categories c ON m.CategoryId = c.CategoryId
      WHERE m.MedicineId = ? AND m.BusinessId = ?
    `, [medicineId, businessId]);

    if (medicines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found or does not belong to your business'
      });
    }

    const medicine = medicines[0];

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: {
        id: medicine.MedicineId,
        businessId: medicine.BusinessId,
        name: medicine.Name,
        description: medicine.Description,
        price: parseFloat(medicine.Price),
        stock: medicine.Stock,
        expiryDate: medicine.ExpiryDate,
        manufacturer: medicine.Manufacturer,
        imagePath: medicine.ImagePath,
        requiresPrescription: medicine.RequiresPrescription,
        isActive: medicine.IsActive,
        category: medicine.CategoryId ? {
          id: medicine.CategoryId,
          name: medicine.CategoryName
        } : null
      }
    });

  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete medicine (business owner/staff only with tenant isolation)
router.delete('/:id', authenticateToken, requireTenant, requireBusinessAccess, async (req, res) => {
  try {
    const medicineId = req.params.id;

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Check if medicine exists and belongs to the business
    const medicines = await dbQuery(
      'SELECT MedicineId FROM Medicines WHERE MedicineId = ? AND BusinessId = ?', 
      [medicineId, businessId]
    );
    if (medicines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found or does not belong to your business'
      });
    }

    // Soft delete by setting IsActive to false
    await dbQuery(
      'UPDATE Medicines SET IsActive = FALSE, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?', 
      [medicineId, businessId]
    );

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });

  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload medicine image (business owner/staff only with tenant isolation)
router.post('/:id/image', authenticateToken, requireTenant, requireBusinessAccess, uploadSingle('medicineImage'), async (req, res) => {
  try {
    const medicineId = req.params.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Check if medicine exists and belongs to the business
    const medicines = await dbQuery(
      'SELECT MedicineId FROM Medicines WHERE MedicineId = ? AND BusinessId = ?', 
      [medicineId, businessId]
    );
    if (medicines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found or does not belong to your business'
      });
    }

    // Update medicine with image path
    const imagePath = req.file.path.replace(/\\/g, '/');
    await dbQuery(
      'UPDATE Medicines SET ImagePath = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE MedicineId = ? AND BusinessId = ?', 
      [imagePath, medicineId, businessId]
    );

    res.json({
      success: true,
      message: 'Medicine image uploaded successfully',
      data: {
        imagePath: imagePath
      }
    });

  } catch (error) {
    console.error('Upload medicine image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
