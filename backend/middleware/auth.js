const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists and is active (include BusinessId for tenant isolation)
    const users = await query(
      'SELECT UserId, BusinessId, Name, Email, Role, IsActive FROM Users WHERE UserId = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!users[0].IsActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    req.user = users[0];
    req.user.businessId = users[0].BusinessId;
    next();
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
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Tenant isolation middleware - ensures users can only access their business data
const requireTenant = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // SUPER_ADMIN can access all data
  if (req.user.Role === 'SUPER_ADMIN') {
    return next();
  }

  // BUSINESS_OWNER and CUSTOMER must have a businessId
  if (!req.user.businessId) {
    return res.status(403).json({ 
      success: false, 
      message: 'No business associated with this account' 
    });
  }

  // Verify business is active
  try {
    const businesses = await query(
      'SELECT Status FROM Businesses WHERE BusinessId = ?',
      [req.user.businessId]
    );
    
    if (businesses.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Business not found' 
      });
    }

    if (businesses[0].Status !== 'Active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Business is not active' 
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// RBAC middleware with new role structure
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.Role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Role-specific middleware
const requireSuperAdmin = requireRole(['SUPER_ADMIN']);
const requireBusinessOwner = requireRole(['BUSINESS_OWNER']);
const requireCustomer = requireRole(['CUSTOMER']);
const requireStaff = requireRole(['STAFF']);
const requireBusinessAccess = requireRole(['BUSINESS_OWNER', 'STAFF']);

// Legacy compatibility (map old roles to new structure)
const requireAdmin = requireRole(['SUPER_ADMIN', 'BUSINESS_OWNER', 'STAFF']);

module.exports = {
  authenticateToken,
  requireTenant,
  requireRole,
  requireSuperAdmin,
  requireBusinessOwner,
  requireCustomer,
  requireStaff,
  requireBusinessAccess,
  requireAdmin
};
