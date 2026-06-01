const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessAccess } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const router = express.Router();

// Get user profile (with tenant filtering)
router.get('/profile', authenticateToken, requireTenant, async (req, res) => {
  try {
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    const users = await dbQuery(`
      SELECT UserId, BusinessId, Name, Email, Phone, Role, ProfileImage, IsActive, CreatedAt
      FROM Users 
      WHERE UserId = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        id: user.UserId,
        businessId: user.BusinessId,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        role: user.Role,
        profileImage: user.ProfileImage,
        isActive: user.IsActive,
        createdAt: user.CreatedAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile (with tenant filtering)
router.put('/profile', authenticateToken, requireTenant, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required')
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

    const userId = req.user.UserId;
    const { name, phone } = req.body;

    // Check if phone is already used by another user in the same business
    if (phone) {
      const existingUsers = await dbQuery(
        'SELECT UserId FROM Users WHERE Phone = ? AND UserId != ? AND BusinessId = ?', 
        [phone, userId, req.user.businessId]
      );
      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already in use'
        });
      }
    }

    // Update user profile
    const updateFields = [];
    const params = [];

    if (name !== undefined) {
      updateFields.push('Name = ?');
      params.push(name);
    }

    if (phone !== undefined) {
      updateFields.push('Phone = ?');
      params.push(phone);
    }

    if (updateFields.length > 0) {
      updateFields.push('UpdatedAt = CURRENT_TIMESTAMP');
      params.push(userId);

      await dbQuery(`
        UPDATE Users 
        SET ${updateFields.join(', ')} 
        WHERE UserId = ?
      `, params);
    }

    // Get updated user
    const users = await dbQuery(`
      SELECT UserId, BusinessId, Name, Email, Phone, Role, ProfileImage, IsActive
      FROM Users 
      WHERE UserId = ?
    `, [userId]);

    const user = users[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.UserId,
        businessId: user.BusinessId,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        role: user.Role,
        profileImage: user.ProfileImage,
        isActive: user.IsActive
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload profile image
router.post('/profile/image', authenticateToken, uploadSingle('profileImage'), async (req, res) => {
  try {
    const userId = req.user.UserId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Update user with image path
    const imagePath = req.file.path.replace(/\\/g, '/');
    await dbQuery('UPDATE Users SET ProfileImage = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ?', [imagePath, userId]);

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImage: imagePath
      }
    });

  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user addresses (with tenant filtering)
router.get('/addresses', authenticateToken, requireTenant, async (req, res) => {
  try {
    const userId = req.user.UserId;
    const businessId = req.user.businessId;

    const addresses = await dbQuery(`
      SELECT AddressId, BusinessId, Street, City, State, PostalCode, Country, IsDefault
      FROM Addresses 
      WHERE UserId = ? AND BusinessId = ?
      ORDER BY IsDefault DESC, CreatedAt DESC
    `, [userId, businessId]);

    res.json({
      success: true,
      data: {
        addresses: addresses.map(address => ({
          id: address.AddressId,
          businessId: address.BusinessId,
          street: address.Street,
          city: address.City,
          state: address.State,
          postalCode: address.PostalCode,
          country: address.Country,
          isDefault: address.IsDefault
        }))
      }
    });

  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add new address (with tenant filtering)
router.post('/addresses', authenticateToken, requireTenant, [
  body('street').trim().isLength({ min: 5 }).withMessage('Street address is required'),
  body('city').trim().isLength({ min: 2 }).withMessage('City is required'),
  body('state').trim().isLength({ min: 2 }).withMessage('State is required'),
  body('postalCode').trim().isLength({ min: 3 }).withMessage('Postal code is required'),
  body('country').optional().trim().isLength({ min: 2 }).withMessage('Country is required'),
  body('isDefault').optional().isBoolean().withMessage('Is default must be boolean')
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

    const userId = req.user.UserId;
    const businessId = req.user.businessId;
    const { street, city, state, postalCode, country = 'Pakistan', isDefault = false } = req.body;

    // If setting as default, unset other default addresses in the same business
    if (isDefault) {
      await dbQuery('UPDATE Addresses SET IsDefault = FALSE WHERE UserId = ? AND BusinessId = ?', [userId, businessId]);
    }

    // Insert new address with businessId
    const result = await dbQuery(`
      INSERT INTO Addresses (BusinessId, UserId, Street, City, State, PostalCode, Country, IsDefault)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [businessId, userId, street, city, state, postalCode, country, isDefault]);

    // Get the created address
    const addresses = await dbQuery(`
      SELECT AddressId, BusinessId, Street, City, State, PostalCode, Country, IsDefault
      FROM Addresses 
      WHERE AddressId = ?
    `, [result.insertId]);

    const address = addresses[0];

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: {
        id: address.AddressId,
        businessId: address.BusinessId,
        street: address.Street,
        city: address.City,
        state: address.State,
        postalCode: address.PostalCode,
        country: address.Country,
        isDefault: address.IsDefault
      }
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update address (with tenant filtering)
router.put('/addresses/:id', authenticateToken, requireTenant, [
  body('street').optional().trim().isLength({ min: 5 }).withMessage('Street address is required'),
  body('city').optional().trim().isLength({ min: 2 }).withMessage('City is required'),
  body('state').optional().trim().isLength({ min: 2 }).withMessage('State is required'),
  body('postalCode').optional().trim().isLength({ min: 3 }).withMessage('Postal code is required'),
  body('country').optional().trim().isLength({ min: 2 }).withMessage('Country is required'),
  body('isDefault').optional().isBoolean().withMessage('Is default must be boolean')
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

    const userId = req.user.UserId;
    const businessId = req.user.businessId;
    const addressId = req.params.id;
    const { street, city, state, postalCode, country, isDefault } = req.body;

    // Check if address belongs to user and business
    const addresses = await dbQuery(
      'SELECT AddressId FROM Addresses WHERE AddressId = ? AND UserId = ? AND BusinessId = ?', 
      [addressId, userId, businessId]
    );
    if (addresses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If setting as default, unset other default addresses in the same business
    if (isDefault) {
      await dbQuery('UPDATE Addresses SET IsDefault = FALSE WHERE UserId = ? AND BusinessId = ?', [userId, businessId]);
    }

    // Build dynamic update query
    const updateFields = [];
    const params = [];

    const allowedFields = ['street', 'city', 'state', 'postalCode', 'country', 'isDefault'];
    const fieldMapping = {
      street: 'Street',
      city: 'City',
      state: 'State',
      postalCode: 'PostalCode',
      country: 'Country',
      isDefault: 'IsDefault'
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

    updateFields.push('UpdatedAt = CURRENT_TIMESTAMP');
    params.push(addressId);

    // Update address
    await dbQuery(`
      UPDATE Addresses 
      SET ${updateFields.join(', ')} 
      WHERE AddressId = ?
    `, params);

    // Get updated address
    const updatedAddresses = await dbQuery(`
      SELECT AddressId, BusinessId, Street, City, State, PostalCode, Country, IsDefault
      FROM Addresses 
      WHERE AddressId = ?
    `, [addressId]);

    const address = updatedAddresses[0];

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: {
        id: address.AddressId,
        businessId: address.BusinessId,
        street: address.Street,
        city: address.City,
        state: address.State,
        postalCode: address.PostalCode,
        country: address.Country,
        isDefault: address.IsDefault
      }
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete address (with tenant filtering)
router.delete('/addresses/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const userId = req.user.UserId;
    const businessId = req.user.businessId;
    const addressId = req.params.id;

    // Check if address belongs to user and business
    const addresses = await dbQuery(
      'SELECT AddressId FROM Addresses WHERE AddressId = ? AND UserId = ? AND BusinessId = ?', 
      [addressId, userId, businessId]
    );
    if (addresses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Delete address
    await dbQuery('DELETE FROM Addresses WHERE AddressId = ?', [addressId]);

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });

  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
