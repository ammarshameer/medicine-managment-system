const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Register endpoint for customers (with business code)
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters long'),
  body('businessCode').optional().isLength({ min: 3, max: 50 }).withMessage('Business code required'),
  body('emiratesId').optional().trim(),
  body('nationalIdLast4').optional().trim().isLength({ min: 4, max: 4 }).withMessage('National ID Last 4 must be exactly 4 digits')
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

    const { name, email, phone, password, businessCode, emiratesId, nationalIdLast4 } = req.body;

    // If businessCode is provided, verify it exists and is active
    let businessId = null;
    let businessRecord = null;
    if (businessCode) {
      const businesses = await query(
        `SELECT BusinessId, BusinessName, BusinessCode, Country, Currency, TaxEnabled, TaxRate, 
                TaxRegistrationNumber, LicenseNumber, LicenseAuthority, Locale, Timezone, PharmacistInChargeName, Status 
         FROM Businesses WHERE BusinessCode = ?`,
        [businessCode]
      );

      if (businesses.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invalid business code'
        });
      }

      if (businesses[0].Status !== 'Active') {
        return res.status(403).json({
          success: false,
          message: 'Business is not active'
        });
      }

      businessRecord = businesses[0];
      businessId = businessRecord.BusinessId;
    }

    // Check if user already exists (globally or within business)
    let checkQuery = 'SELECT UserId FROM Users WHERE Email = ?';
    let checkParams = [email];

    if (businessId) {
      checkQuery = 'SELECT UserId FROM Users WHERE Email = ? AND BusinessId = ?';
      checkParams = [email, businessId];
    }

    const existingUsers = await query(checkQuery, checkParams);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await query(
      'INSERT INTO Users (BusinessId, Name, Email, Phone, EmiratesId, NationalIdLast4, PasswordHash, Role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [businessId, name, email, phone, emiratesId || null, nationalIdLast4 || null, passwordHash, 'CUSTOMER']
    );

    // Get the created user
    const users = await query(
      'SELECT UserId, BusinessId, Name, Email, Phone, EmiratesId, NationalIdLast4, Role, IsActive, CreatedAt FROM Users WHERE UserId = ?',
      [result.insertId]
    );

    const user = users[0];

    // Generate JWT token with businessId
    const token = jwt.sign(
      { userId: user.UserId, businessId: user.BusinessId, email: user.Email, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.UserId,
          businessId: user.BusinessId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          emiratesId: user.EmiratesId,
          nationalIdLast4: user.NationalIdLast4,
          role: user.Role,
          isActive: user.IsActive,
          createdAt: user.CreatedAt,
          business: businessRecord ? {
            id: businessRecord.BusinessId,
            name: businessRecord.BusinessName,
            code: businessRecord.BusinessCode,
            country: businessRecord.Country,
            currency: businessRecord.Currency,
            taxEnabled: Boolean(businessRecord.TaxEnabled !== 0),
            taxRate: parseFloat(businessRecord.TaxRate) || 0,
            taxRegistrationNumber: businessRecord.TaxRegistrationNumber,
            licenseNumber: businessRecord.LicenseNumber,
            licenseAuthority: businessRecord.LicenseAuthority,
            locale: businessRecord.Locale,
            timezone: businessRecord.Timezone,
            pharmacistInChargeName: businessRecord.PharmacistInChargeName
          } : null
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    // Find user by email (include BusinessId)
    const users = await query(
      'SELECT UserId, BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive FROM Users WHERE Email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    if (!user.IsActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token with businessId
    const token = jwt.sign(
      { userId: user.UserId, businessId: user.BusinessId, email: user.Email, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Load tenant business configuration if user belongs to a business
    let businessConfig = null;
    if (user.BusinessId) {
      const bizRows = await query(
        `SELECT BusinessId, BusinessName, BusinessCode, Country, Currency, TaxEnabled, TaxRate, 
                TaxRegistrationNumber, LicenseNumber, LicenseAuthority, Locale, Timezone, PharmacistInChargeName 
         FROM Businesses WHERE BusinessId = ?`,
        [user.BusinessId]
      );
      if (bizRows.length > 0) {
        const b = bizRows[0];
        businessConfig = {
          id: b.BusinessId,
          name: b.BusinessName,
          code: b.BusinessCode,
          country: b.Country || 'USA',
          currency: b.Currency || 'USD',
          taxEnabled: Boolean(b.TaxEnabled !== 0),
          taxRate: parseFloat(b.TaxRate) || 0,
          taxRegistrationNumber: b.TaxRegistrationNumber,
          licenseNumber: b.LicenseNumber,
          licenseAuthority: b.LicenseAuthority,
          locale: b.Locale || 'en-US',
          timezone: b.Timezone || 'America/New_York',
          pharmacistInChargeName: b.PharmacistInChargeName
        };
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.UserId,
          businessId: user.BusinessId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          isActive: user.IsActive,
          business: businessConfig
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    const isConnRefused = error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED');
    res.status(500).json({
      success: false,
      message: isConnRefused
        ? `Database connection refused (${error.address || 'localhost'}:${error.port || 3306}). Please verify MySQL server is installed and running.`
        : (process.env.NODE_ENV === 'production' ? 'Internal server error' : (error.message || 'Internal server error'))
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
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

    const { email } = req.body;

    // Check if user exists
    const users = await query(
      'SELECT UserId, Name, Email FROM Users WHERE Email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // In a real application, you would send an email with a reset link
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change password endpoint (requires authentication)
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 4 }).withMessage('New password must be at least 4 characters long')
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

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.UserId;

    // Get user with current password
    const users = await query(
      'SELECT PasswordHash FROM Users WHERE UserId = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].PasswordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE Users SET PasswordHash = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE UserId = ?',
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists and is active (include BusinessId)
    const users = await query(
      'SELECT UserId, BusinessId, Name, Email, Phone, Role, IsActive FROM Users WHERE UserId = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].IsActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user deactivated'
      });
    }

    const user = users[0];
    let businessConfig = null;
    if (user.BusinessId) {
      const bizRows = await query(
        `SELECT BusinessId, BusinessName, BusinessCode, Country, Currency, TaxEnabled, TaxRate, 
                TaxRegistrationNumber, LicenseNumber, LicenseAuthority, Locale, Timezone, PharmacistInChargeName 
         FROM Businesses WHERE BusinessId = ?`,
        [user.BusinessId]
      );
      if (bizRows.length > 0) {
        const b = bizRows[0];
        businessConfig = {
          id: b.BusinessId,
          name: b.BusinessName,
          code: b.BusinessCode,
          country: b.Country || 'USA',
          currency: b.Currency || 'USD',
          taxEnabled: Boolean(b.TaxEnabled !== 0),
          taxRate: parseFloat(b.TaxRate) || 0,
          taxRegistrationNumber: b.TaxRegistrationNumber,
          licenseNumber: b.LicenseNumber,
          licenseAuthority: b.LicenseAuthority,
          locale: b.Locale || 'en-US',
          timezone: b.Timezone || 'America/New_York',
          pharmacistInChargeName: b.PharmacistInChargeName
        };
      }
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user.UserId,
          businessId: user.BusinessId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          isActive: user.IsActive,
          business: businessConfig
        }
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Super Admin Login endpoint (separate for platform admin)
router.post('/super-admin-login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    // Find user by email with SUPER_ADMIN role
    const users = await query(
      'SELECT UserId, BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive FROM Users WHERE Email = ? AND Role = ?',
      [email, 'SUPER_ADMIN']
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a Super Admin'
      });
    }

    const user = users[0];

    if (!user.IsActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token with businessId (null for super admin)
    const token = jwt.sign(
      { userId: user.UserId, businessId: user.BusinessId, email: user.Email, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Super Admin login successful',
      data: {
        user: {
          id: user.UserId,
          businessId: user.BusinessId,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          isActive: user.IsActive
        },
        token
      }
    });

  } catch (error) {
    console.error('Super Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
