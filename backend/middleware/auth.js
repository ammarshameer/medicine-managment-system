const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Platform administrators can work across tenants. SUPPORT is a hidden role
// reserved for the platform owner; it is never shown in business user lists.
const PLATFORM_ADMIN_ROLES = ['SUPER_ADMIN', 'SUPPORT'];

const isPlatformAdmin = (user) => Boolean(user && PLATFORM_ADMIN_ROLES.includes(user.Role));

// Resolve the tenant a request should act on. A platform admin may select a
// tenant with X-Business-Id, ?businessId=, or body.businessId; everyone else is
// always pinned to their own BusinessId.
const resolveBusinessId = (req) => {
  if (req.activeBusinessId) return req.activeBusinessId;

  if (isPlatformAdmin(req.user)) {
    const fromQuery = parseInt(req.query?.businessId, 10);
    if (Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;
    const fromBody = parseInt(req.body?.businessId, 10);
    if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  }

  return req.user?.businessId || null;
};

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

    // A platform admin can select the tenant to operate on with X-Business-Id.
    // The selected id becomes the effective businessId for the rest of the
    // request, so ordinary owner routes work without special-case branches.
    if (isPlatformAdmin(req.user)) {
      const selectedId = parseInt(req.headers['x-business-id'], 10);
      if (Number.isInteger(selectedId) && selectedId > 0) {
        const businesses = await query(
          'SELECT BusinessId, Status FROM Businesses WHERE BusinessId = ?',
          [selectedId]
        );
        if (businesses.length > 0 && businesses[0].Status === 'Active') {
          req.activeBusinessId = selectedId;
          req.user.businessId = selectedId;
        }
      }
    }

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

  // Platform admins (SUPER_ADMIN and hidden SUPPORT) can access all data.
  if (isPlatformAdmin(req.user)) {
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

// Role-specific middleware. SUPPORT is treated as a platform admin and may
// perform owner-level operations while remaining hidden from business users.
const requirePlatformAdmin = requireRole(PLATFORM_ADMIN_ROLES);
const requireSuperAdmin = requirePlatformAdmin;
const requireBusinessOwner = requireRole(['BUSINESS_OWNER', 'SUPPORT']);
// Owner-level data mutations: business owner or platform admin only.
// STAFF remains allowed to read and to run POS/prescription/order workflows.
const requireBusinessOwnerAccess = requireRole(['BUSINESS_OWNER', 'SUPER_ADMIN', 'SUPPORT']);
const requireCustomer = requireRole(['CUSTOMER']);
const requireStaff = requireRole(['STAFF']);
const requireBusinessAccess = requireRole(['BUSINESS_OWNER', 'STAFF', 'SUPER_ADMIN', 'SUPPORT']);

// Legacy compatibility (map old roles to new structure)
const requireAdmin = requireRole(['SUPER_ADMIN', 'SUPPORT', 'BUSINESS_OWNER', 'STAFF']);

module.exports = {
  authenticateToken,
  requireTenant,
  requireRole,
  isPlatformAdmin,
  resolveBusinessId,
  requirePlatformAdmin,
  requireSuperAdmin,
  requireBusinessOwner,
  requireBusinessOwnerAccess,
  requireCustomer,
  requireStaff,
  requireBusinessAccess,
  requireAdmin
};
