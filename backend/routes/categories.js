const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess } = require('../middleware/auth');
const router = express.Router();

// Get all categories (public endpoint with optional tenant filtering)
router.get('/', async (req, res) => {
  try {
    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE IsActive = TRUE';
    const params = [];

    // Add tenant filtering if user is authenticated and not SUPER_ADMIN
    if (req.user && req.user.Role !== 'SUPER_ADMIN' && req.user.businessId) {
      whereClause += ' AND BusinessId = ?';
      params.push(req.user.businessId);
    }

    const categories = await dbQuery(`
      SELECT CategoryId, BusinessId, CategoryName, Description
      FROM Categories 
      ${whereClause}
      ORDER BY CategoryName ASC
    `, params);

    res.json({
      success: true,
      data: {
        categories: categories.map(category => ({
          id: category.CategoryId,
          businessId: category.BusinessId,
          name: category.CategoryName,
          description: category.Description
        }))
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single category by ID (with tenant filtering)
router.get('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Build WHERE clause with tenant filtering
    let whereClause = 'WHERE CategoryId = ? AND IsActive = TRUE';
    const params = [categoryId];

    // Add tenant filtering if user is authenticated and not SUPER_ADMIN
    if (req.user && req.user.Role !== 'SUPER_ADMIN' && req.user.businessId) {
      whereClause += ' AND BusinessId = ?';
      params.push(req.user.businessId);
    }

    const categories = await dbQuery(`
      SELECT CategoryId, BusinessId, CategoryName, Description
      FROM Categories 
      ${whereClause}
    `, params);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const category = categories[0];

    res.json({
      success: true,
      data: {
        id: category.CategoryId,
        businessId: category.BusinessId,
        name: category.CategoryName,
        description: category.Description
      }
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add new category (business owner/staff only with tenant isolation)
router.post('/', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long')
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

    const { name, description } = req.body;

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    // Check if category already exists in the same business
    const existingCategories = await dbQuery(
      'SELECT CategoryId FROM Categories WHERE CategoryName = ? AND BusinessId = ?', 
      [name, businessId]
    );
    if (existingCategories.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists in your business'
      });
    }

    // Insert category with businessId
    const result = await dbQuery(
      'INSERT INTO Categories (BusinessId, CategoryName, Description) VALUES (?, ?, ?)',
      [businessId, name, description || null]
    );

    // Get the created category
    const categories = await dbQuery(
      'SELECT CategoryId, BusinessId, CategoryName, Description FROM Categories WHERE CategoryId = ?',
      [result.insertId]
    );

    const category = categories[0];

    res.status(201).json({
      success: true,
      message: 'Category added successfully',
      data: {
        id: category.CategoryId,
        businessId: category.BusinessId,
        name: category.CategoryName,
        description: category.Description
      }
    });

  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update category (business owner/staff only with tenant isolation)
router.put('/:id', authenticateToken, requireTenant, requireBusinessAccess, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
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

    const categoryId = req.params.id;
    const updateFields = [];
    const params = [];

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Build dynamic update query
    const allowedFields = ['name', 'description', 'isActive'];
    const fieldMapping = {
      name: 'CategoryName',
      description: 'Description',
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

    // Check if category name already exists in the same business (if updating name)
    if (req.body.name) {
      const existingCategories = await dbQuery(
        'SELECT CategoryId FROM Categories WHERE CategoryName = ? AND CategoryId != ? AND BusinessId = ?', 
        [req.body.name, categoryId, businessId]
      );
      if (existingCategories.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Category with this name already exists in your business'
        });
      }
    }

    params.push(categoryId, businessId);

    // Update category with tenant filtering
    await dbQuery(`
      UPDATE Categories 
      SET ${updateFields.join(', ')}, UpdatedAt = CURRENT_TIMESTAMP 
      WHERE CategoryId = ? AND BusinessId = ?
    `, params);

    // Get updated category
    const categories = await dbQuery(`
      SELECT CategoryId, BusinessId, CategoryName, Description, IsActive
      FROM Categories 
      WHERE CategoryId = ? AND BusinessId = ?
    `, [categoryId, businessId]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or does not belong to your business'
      });
    }

    const category = categories[0];

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        id: category.CategoryId,
        businessId: category.BusinessId,
        name: category.CategoryName,
        description: category.Description,
        isActive: category.IsActive
      }
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete category (business owner/staff only with tenant isolation)
router.delete('/:id', authenticateToken, requireTenant, requireBusinessAccess, async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Get businessId from authenticated user
    const businessId = req.user.Role === 'SUPER_ADMIN' 
      ? (req.body.businessId || req.user.businessId) 
      : req.user.businessId;

    // Check if category exists and belongs to the business
    const categories = await dbQuery(
      'SELECT CategoryId FROM Categories WHERE CategoryId = ? AND BusinessId = ?', 
      [categoryId, businessId]
    );
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or does not belong to your business'
      });
    }

    // Check if category has medicines assigned in the same business
    const medicines = await dbQuery(
      'SELECT COUNT(*) as count FROM Medicines WHERE CategoryId = ? AND BusinessId = ?', 
      [categoryId, businessId]
    );
    if (medicines[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with assigned medicines'
      });
    }

    // Soft delete by setting IsActive to false
    await dbQuery(
      'UPDATE Categories SET IsActive = FALSE, UpdatedAt = CURRENT_TIMESTAMP WHERE CategoryId = ? AND BusinessId = ?', 
      [categoryId, businessId]
    );

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
