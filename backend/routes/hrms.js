const express = require('express');
const bcrypt = require('bcryptjs');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery, pool } = require('../config/database');
const { authenticateToken, requireTenant, requireBusinessOwner } = require('../middleware/auth');

const router = express.Router();

// Strictly BUSINESS_OWNER only - salary & HR data is confidential
router.use(authenticateToken, requireTenant, requireBusinessOwner);

/**
 * GET /api/hrms/employees
 * List all employees for the current business
 */
router.get('/employees', [
  query('status').optional().isIn(['Active', 'Inactive', 'Terminated', 'On Leave', 'all']),
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
    const status = req.query.status;
    const search = req.query.search;

    let whereClause = 'WHERE e.BusinessId = ?';
    const params = [businessId];

    if (status && status !== 'all') {
      whereClause += ' AND e.EmploymentStatus = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (u.Name LIKE ? OR u.Email LIKE ? OR e.Designation LIKE ? OR e.Department LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const employees = await dbQuery(
      `SELECT 
        e.EmployeeId, e.BusinessId, e.UserId, e.Designation, e.Department,
        e.JoiningDate, e.Salary, e.EmploymentStatus, e.CreatedAt, e.UpdatedAt,
        u.Name, u.Email, u.Phone, u.Role, u.IsActive as UserActive
       FROM Employees e
       JOIN Users u ON e.UserId = u.UserId
       ${whereClause}
       ORDER BY e.CreatedAt DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        employees: employees.map(emp => ({
          id: emp.EmployeeId,
          businessId: emp.BusinessId,
          userId: emp.UserId,
          name: emp.Name,
          email: emp.Email,
          phone: emp.Phone,
          role: emp.Role,
          designation: emp.Designation,
          department: emp.Department,
          joiningDate: emp.JoiningDate,
          salary: parseFloat(emp.Salary) || 0,
          employmentStatus: emp.EmploymentStatus,
          userActive: Boolean(emp.UserActive),
          createdAt: emp.CreatedAt,
          updatedAt: emp.UpdatedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees'
    });
  }
});

/**
 * GET /api/hrms/unlinked-users
 * List users from this business who do NOT have an employee profile yet
 */
router.get('/unlinked-users', async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const unlinkedUsers = await dbQuery(
      `SELECT u.UserId, u.Name, u.Email, u.Phone, u.Role, u.IsActive
       FROM Users u
       LEFT JOIN Employees e ON u.UserId = e.UserId AND e.BusinessId = u.BusinessId
       WHERE u.BusinessId = ? AND e.EmployeeId IS NULL AND u.Role != 'SUPER_ADMIN'
       ORDER BY u.Name ASC`,
      [businessId]
    );

    res.json({
      success: true,
      data: {
        users: unlinkedUsers.map(u => ({
          id: u.UserId,
          name: u.Name,
          email: u.Email,
          phone: u.Phone,
          role: u.Role,
          isActive: Boolean(u.IsActive)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching unlinked users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unlinked users'
    });
  }
});

/**
 * POST /api/hrms/employees
 * Add employee: Supports either (A) Create new user + employee OR (B) Link existing user + employee
 */
router.post('/employees', [
  body('mode').optional().isIn(['new_user', 'link_existing']),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('department').optional().trim(),
  body('joiningDate').isISO8601().withMessage('Valid joining date is required'),
  body('salary').isFloat({ min: 0 }).withMessage('Salary must be a non-negative number'),
  body('employmentStatus').optional().isIn(['Active', 'Inactive', 'Terminated', 'On Leave']),
  // Conditional validations for new_user vs link_existing
  body('userId').if(body('mode').equals('link_existing')).isInt().withMessage('Valid user ID required when linking existing user'),
  body('name').if(body('mode').not().equals('link_existing')).trim().notEmpty().withMessage('Name is required for new user'),
  body('email').if(body('mode').not().equals('link_existing')).isEmail().withMessage('Valid email is required for new user'),
  body('password').if(body('mode').not().equals('link_existing')).isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  body('phone').optional().trim(),
  body('role').optional().isIn(['STAFF', 'BUSINESS_OWNER', 'CUSTOMER'])
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
    const {
      mode = req.body.userId ? 'link_existing' : 'new_user',
      userId,
      name,
      email,
      password,
      phone,
      role = 'STAFF',
      designation,
      department = 'Pharmacy',
      joiningDate,
      salary,
      employmentStatus = 'Active'
    } = req.body;

    await connection.beginTransaction();

    let finalUserId;

    if (mode === 'link_existing') {
      // 1. Validate user exists in this business
      const [users] = await connection.query(
        'SELECT UserId, Role FROM Users WHERE UserId = ? AND BusinessId = ?',
        [userId, businessId]
      );

      if (users.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Selected user does not belong to your business'
        });
      }

      // Check if user already has an employee record
      const [existingEmp] = await connection.query(
        'SELECT EmployeeId FROM Employees WHERE UserId = ? AND BusinessId = ?',
        [userId, businessId]
      );

      if (existingEmp.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'This user already has an employee profile'
        });
      }

      finalUserId = userId;
      // If role update is requested, apply it
      if (req.body.role && req.body.role !== users[0].Role) {
        await connection.query(
          'UPDATE Users SET Role = ? WHERE UserId = ?',
          [req.body.role, finalUserId]
        );
      }
    } else {
      // 2. Create new user
      const [existingUser] = await connection.query(
        'SELECT UserId FROM Users WHERE Email = ? AND (BusinessId = ? OR BusinessId IS NULL)',
        [email, businessId]
      );

      if (existingUser.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'A user with this email address already exists in your business'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const [userResult] = await connection.query(
        `INSERT INTO Users (BusinessId, Name, Email, Phone, PasswordHash, Role, IsActive)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [businessId, name, email, phone || null, passwordHash, role]
      );

      finalUserId = userResult.insertId;
    }

    // 3. Create Employee record
    const [empResult] = await connection.query(
      `INSERT INTO Employees (BusinessId, UserId, Designation, Department, JoiningDate, Salary, EmploymentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [businessId, finalUserId, designation, department, joiningDate, salary, employmentStatus]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Employee record created successfully',
      data: {
        employeeId: empResult.insertId,
        userId: finalUserId,
        designation,
        department,
        salary: parseFloat(salary),
        employmentStatus
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create employee'
    });
  }
});

/**
 * PUT /api/hrms/employees/:id
 * Update employee details
 */
router.put('/employees/:id', [
  body('designation').optional().trim().notEmpty().withMessage('Designation cannot be empty'),
  body('department').optional().trim(),
  body('joiningDate').optional().isISO8601(),
  body('salary').optional().isFloat({ min: 0 }),
  body('employmentStatus').optional().isIn(['Active', 'Inactive', 'Terminated', 'On Leave']),
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('password').optional({ checkFalsy: true }).isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  body('role').optional().isIn(['STAFF', 'BUSINESS_OWNER', 'CUSTOMER'])
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
    const employeeId = parseInt(req.params.id, 10);

    const [existing] = await connection.query(
      'SELECT EmployeeId, UserId FROM Employees WHERE EmployeeId = ? AND BusinessId = ?',
      [employeeId, businessId]
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const emp = existing[0];
    await connection.beginTransaction();

    const empUpdates = [];
    const empParams = [];
    const empFields = ['designation', 'department', 'joiningDate', 'salary', 'employmentStatus'];
    const empDbFields = ['Designation', 'Department', 'JoiningDate', 'Salary', 'EmploymentStatus'];

    empFields.forEach((field, index) => {
      if (req.body[field] !== undefined) {
        empUpdates.push(`${empDbFields[index]} = ?`);
        empParams.push(req.body[field]);
      }
    });

    if (empUpdates.length > 0) {
      empParams.push(employeeId, businessId);
      await connection.query(
        `UPDATE Employees SET ${empUpdates.join(', ')} WHERE EmployeeId = ? AND BusinessId = ?`,
        empParams
      );
    }

    // Update user table details if provided
    const userUpdates = [];
    const userParams = [];
    if (req.body.name !== undefined) {
      userUpdates.push('Name = ?');
      userParams.push(req.body.name);
    }
    if (req.body.phone !== undefined) {
      userUpdates.push('Phone = ?');
      userParams.push(req.body.phone);
    }
    if (req.body.role !== undefined) {
      userUpdates.push('Role = ?');
      userParams.push(req.body.role);
    }
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(req.body.password, salt);
      userUpdates.push('PasswordHash = ?');
      userParams.push(passwordHash);
    }
    if (req.body.employmentStatus !== undefined) {
      const isUserActive = req.body.employmentStatus === 'Active' || req.body.employmentStatus === 'On Leave';
      userUpdates.push('IsActive = ?');
      userParams.push(isUserActive);
    }

    if (userUpdates.length > 0) {
      userParams.push(emp.UserId, businessId);
      await connection.query(
        `UPDATE Users SET ${userUpdates.join(', ')} WHERE UserId = ? AND BusinessId = ?`,
        userParams
      );
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Employee profile updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee'
    });
  }
});

/**
 * DELETE /api/hrms/employees/:id
 * Deactivate employee
 */
router.delete('/employees/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const businessId = req.user.businessId;
    const employeeId = parseInt(req.params.id, 10);

    const [existing] = await connection.query(
      'SELECT EmployeeId, UserId FROM Employees WHERE EmployeeId = ? AND BusinessId = ?',
      [employeeId, businessId]
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    await connection.beginTransaction();

    // Mark employee as Inactive
    await connection.query(
      `UPDATE Employees SET EmploymentStatus = 'Inactive' WHERE EmployeeId = ? AND BusinessId = ?`,
      [employeeId, businessId]
    );

    // Deactivate user account
    await connection.query(
      `UPDATE Users SET IsActive = FALSE WHERE UserId = ? AND BusinessId = ?`,
      [existing[0].UserId, businessId]
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error deactivating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate employee'
    });
  }
});

/**
 * GET /api/hrms/salaries
 * List payroll records with filters
 */
router.get('/salaries', [
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020, max: 2100 }),
  query('employeeId').optional().isInt(),
  query('status').optional().isIn(['Pending', 'Paid', 'Cancelled', 'all'])
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
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const employeeId = req.query.employeeId;
    const status = req.query.status;

    let whereClause = 'WHERE s.BusinessId = ?';
    const params = [businessId];

    if (month) {
      whereClause += ' AND s.Month = ?';
      params.push(month);
    }
    if (year) {
      whereClause += ' AND s.Year = ?';
      params.push(year);
    }
    if (employeeId) {
      whereClause += ' AND s.EmployeeId = ?';
      params.push(employeeId);
    }
    if (status && status !== 'all') {
      whereClause += ' AND s.PaymentStatus = ?';
      params.push(status);
    }

    const salaries = await dbQuery(
      `SELECT 
        s.SalaryId, s.BusinessId, s.EmployeeId, s.Month, s.Year,
        s.BasicSalary, s.Allowances, s.Deductions, s.NetSalary,
        s.PaymentStatus, s.PaymentDate, s.PaymentMethod, s.Notes,
        s.CreatedAt, s.UpdatedAt,
        e.Designation, e.Department,
        u.Name as EmployeeName, u.Email as EmployeeEmail, u.Phone as EmployeePhone
       FROM Salaries s
       JOIN Employees e ON s.EmployeeId = e.EmployeeId
       JOIN Users u ON e.UserId = u.UserId
       ${whereClause}
       ORDER BY s.Year DESC, s.Month DESC, u.Name ASC`,
      params
    );

    res.json({
      success: true,
      data: {
        salaries: salaries.map(s => ({
          id: s.SalaryId,
          businessId: s.BusinessId,
          employeeId: s.EmployeeId,
          employeeName: s.EmployeeName,
          employeeEmail: s.EmployeeEmail,
          employeePhone: s.EmployeePhone,
          designation: s.Designation,
          department: s.Department,
          month: s.Month,
          year: s.Year,
          basicSalary: parseFloat(s.BasicSalary) || 0,
          allowances: parseFloat(s.Allowances) || 0,
          deductions: parseFloat(s.Deductions) || 0,
          netSalary: parseFloat(s.NetSalary) || 0,
          paymentStatus: s.PaymentStatus,
          paymentDate: s.PaymentDate,
          paymentMethod: s.PaymentMethod,
          notes: s.Notes,
          createdAt: s.CreatedAt,
          updatedAt: s.UpdatedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salaries'
    });
  }
});

/**
 * POST /api/hrms/salaries
 * Create or generate individual salary slip
 */
router.post('/salaries', [
  body('employeeId').isInt().withMessage('Valid employee ID is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
  body('basicSalary').isFloat({ min: 0 }).withMessage('Basic salary must be non-negative'),
  body('allowances').optional().isFloat({ min: 0 }),
  body('deductions').optional().isFloat({ min: 0 }),
  body('notes').optional().isString()
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
    const { employeeId, month, year, basicSalary, allowances = 0, deductions = 0, notes } = req.body;

    // Verify employee belongs to this business
    const employees = await dbQuery(
      'SELECT EmployeeId, Salary FROM Employees WHERE EmployeeId = ? AND BusinessId = ?',
      [employeeId, businessId]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found in your business'
      });
    }

    // Check if salary record already exists for this period
    const existing = await dbQuery(
      'SELECT SalaryId FROM Salaries WHERE BusinessId = ? AND EmployeeId = ? AND Month = ? AND Year = ?',
      [businessId, employeeId, month, year]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A salary record already exists for this employee for the selected month and year'
      });
    }

    const base = parseFloat(basicSalary);
    const allow = parseFloat(allowances) || 0;
    const deduct = parseFloat(deductions) || 0;
    const netSalary = Math.max(0, Math.round((base + allow - deduct) * 100) / 100);

    const result = await dbQuery(
      `INSERT INTO Salaries 
       (BusinessId, EmployeeId, Month, Year, BasicSalary, Allowances, Deductions, NetSalary, PaymentStatus, Notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [businessId, employeeId, month, year, base, allow, deduct, netSalary, notes || null]
    );

    res.status(201).json({
      success: true,
      message: 'Salary record created successfully',
      data: {
        salaryId: result.insertId,
        employeeId,
        month,
        year,
        basicSalary: base,
        allowances: allow,
        deductions: deduct,
        netSalary,
        paymentStatus: 'Pending'
      }
    });
  } catch (error) {
    console.error('Error creating salary record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create salary record'
    });
  }
});

/**
 * POST /api/hrms/salaries/batch-generate
 * Generate monthly payroll for all active employees
 */
router.post('/salaries/batch-generate', [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required')
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
    const { month, year } = req.body;

    await connection.beginTransaction();

    // Get all active employees
    const [activeEmployees] = await connection.query(
      `SELECT EmployeeId, Salary 
       FROM Employees 
       WHERE BusinessId = ? AND EmploymentStatus = 'Active'`,
      [businessId]
    );

    if (activeEmployees.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'No active employees found to generate payroll'
      });
    }

    let generatedCount = 0;
    for (const emp of activeEmployees) {
      // Check if already generated
      const [existing] = await connection.query(
        `SELECT SalaryId FROM Salaries WHERE BusinessId = ? AND EmployeeId = ? AND Month = ? AND Year = ?`,
        [businessId, emp.EmployeeId, month, year]
      );

      if (existing.length === 0) {
        const base = parseFloat(emp.Salary) || 0;
        await connection.query(
          `INSERT INTO Salaries 
           (BusinessId, EmployeeId, Month, Year, BasicSalary, Allowances, Deductions, NetSalary, PaymentStatus)
           VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, 'Pending')`,
          [businessId, emp.EmployeeId, month, year, base, base]
        );
        generatedCount++;
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `Generated ${generatedCount} salary records for ${month}/${year}. (${activeEmployees.length - generatedCount} already existed)`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error generating payroll batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate payroll batch'
    });
  }
});

/**
 * PUT /api/hrms/salaries/:id/pay
 * Mark salary as paid
 */
router.put('/salaries/:id/pay', [
  body('paymentMethod').trim().notEmpty().withMessage('Payment method is required (e.g. Bank Transfer, Cash, JazzCash)'),
  body('paymentDate').optional().isISO8601(),
  body('notes').optional().isString()
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
    const salaryId = parseInt(req.params.id, 10);
    const { paymentMethod, paymentDate = new Date().toISOString().slice(0, 10), notes } = req.body;

    const existing = await dbQuery(
      'SELECT SalaryId, PaymentStatus FROM Salaries WHERE SalaryId = ? AND BusinessId = ?',
      [salaryId, businessId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    if (existing[0].PaymentStatus === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This salary has already been paid'
      });
    }

    await dbQuery(
      `UPDATE Salaries 
       SET PaymentStatus = 'Paid', PaymentDate = ?, PaymentMethod = ?, Notes = COALESCE(?, Notes)
       WHERE SalaryId = ? AND BusinessId = ?`,
      [paymentDate, paymentMethod, notes || null, salaryId, businessId]
    );

    res.json({
      success: true,
      message: 'Salary marked as paid successfully'
    });
  } catch (error) {
    console.error('Error updating salary payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update salary payment'
    });
  }
});

/**
 * GET /api/hrms/attendance
 * List attendance records with employee/date filters (BUSINESS_OWNER only)
 */
router.get('/attendance', [
  query('employeeId').optional().isInt(),
  query('date').optional().isISO8601(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['Present', 'Absent', 'Leave', 'Half Day', 'all'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const businessId = req.user.businessId;
    let whereClause = 'WHERE a.BusinessId = ?';
    const params = [businessId];

    if (req.query.employeeId) {
      whereClause += ' AND a.EmployeeId = ?';
      params.push(parseInt(req.query.employeeId, 10));
    }
    if (req.query.date) {
      whereClause += ' AND a.AttendanceDate = ?';
      params.push(String(req.query.date).slice(0, 10));
    }
    if (req.query.startDate) {
      whereClause += ' AND a.AttendanceDate >= ?';
      params.push(String(req.query.startDate).slice(0, 10));
    }
    if (req.query.endDate) {
      whereClause += ' AND a.AttendanceDate <= ?';
      params.push(String(req.query.endDate).slice(0, 10));
    }
    if (req.query.status && req.query.status !== 'all') {
      whereClause += ' AND a.Status = ?';
      params.push(req.query.status);
    }

    const rows = await dbQuery(
      `SELECT a.AttendanceId, a.BusinessId, a.EmployeeId, a.AttendanceDate, a.Status,
              a.CheckIn, a.CheckOut, a.Notes, a.CreatedAt, a.UpdatedAt,
              u.Name as EmployeeName, e.Designation
       FROM Attendance a
       JOIN Employees e ON a.EmployeeId = e.EmployeeId
       JOIN Users u ON e.UserId = u.UserId
       ${whereClause}
       ORDER BY a.AttendanceDate DESC, a.AttendanceId DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        attendance: rows.map(row => ({
          id: row.AttendanceId,
          businessId: row.BusinessId,
          employeeId: row.EmployeeId,
          employeeName: row.EmployeeName,
          designation: row.Designation,
          date: row.AttendanceDate,
          attendanceDate: row.AttendanceDate,
          status: row.Status,
          checkIn: row.CheckIn,
          checkOut: row.CheckOut,
          notes: row.Notes,
          createdAt: row.CreatedAt,
          updatedAt: row.UpdatedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
});

/**
 * POST /api/hrms/attendance
 * Create an attendance record (BUSINESS_OWNER only)
 */
router.post('/attendance', [
  body('employeeId').isInt().withMessage('Valid employee ID is required'),
  body('date').isISO8601().withMessage('Valid attendance date is required'),
  body('status').optional().isIn(['Present', 'Absent', 'Leave', 'Half Day']),
  body('checkIn').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('CheckIn must be HH:mm'),
  body('checkOut').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('CheckOut must be HH:mm'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const businessId = req.user.businessId;
    const { employeeId, date, status = 'Present', checkIn = null, checkOut = null, notes = null } = req.body;
    const attendanceDate = String(date).slice(0, 10);

    const employees = await dbQuery(
      'SELECT EmployeeId FROM Employees WHERE EmployeeId = ? AND BusinessId = ?',
      [employeeId, businessId]
    );
    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found in your business' });
    }

    const existing = await dbQuery(
      'SELECT AttendanceId FROM Attendance WHERE BusinessId = ? AND EmployeeId = ? AND AttendanceDate = ?',
      [businessId, employeeId, attendanceDate]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Attendance already recorded for this employee and date' });
    }

    const result = await dbQuery(
      `INSERT INTO Attendance (BusinessId, EmployeeId, AttendanceDate, Status, CheckIn, CheckOut, Notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [businessId, employeeId, attendanceDate, status, checkIn, checkOut, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully',
      data: { id: result.insertId, employeeId, date: attendanceDate, status }
    });
  } catch (error) {
    console.error('Error creating attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to create attendance record' });
  }
});

/**
 * PUT/PATCH /api/hrms/attendance/:id
 * Update an attendance record (BUSINESS_OWNER only)
 */
async function updateAttendance(req, res) {
  try {
    const businessId = req.user.businessId;
    const attendanceId = parseInt(req.params.id, 10);

    const existing = await dbQuery(
      'SELECT AttendanceId FROM Attendance WHERE AttendanceId = ? AND BusinessId = ?',
      [attendanceId, businessId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;
    const updates = [];
    const params = [];

    if (employeeId !== undefined) {
      const employees = await dbQuery(
        'SELECT EmployeeId FROM Employees WHERE EmployeeId = ? AND BusinessId = ?',
        [employeeId, businessId]
      );
      if (employees.length === 0) {
        return res.status(404).json({ success: false, message: 'Employee not found in your business' });
      }
      updates.push('EmployeeId = ?');
      params.push(employeeId);
    }
    if (date !== undefined) {
      updates.push('AttendanceDate = ?');
      params.push(String(date).slice(0, 10));
    }
    if (status !== undefined) {
      updates.push('Status = ?');
      params.push(status);
    }
    if (checkIn !== undefined) { updates.push('CheckIn = ?'); params.push(checkIn); }
    if (checkOut !== undefined) { updates.push('CheckOut = ?'); params.push(checkOut); }
    if (notes !== undefined) { updates.push('Notes = ?'); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(attendanceId, businessId);
    await dbQuery(
      `UPDATE Attendance SET ${updates.join(', ')} WHERE AttendanceId = ? AND BusinessId = ?`,
      params
    );

    res.json({ success: true, message: 'Attendance updated successfully' });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to update attendance record' });
  }
}

router.put('/attendance/:id', [
  body('employeeId').optional().isInt(),
  body('date').optional().isISO8601(),
  body('status').optional().isIn(['Present', 'Absent', 'Leave', 'Half Day']),
  body('checkIn').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('checkOut').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('notes').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
  }
  return updateAttendance(req, res);
});

router.patch('/attendance/:id', [
  body('employeeId').optional().isInt(),
  body('date').optional().isISO8601(),
  body('status').optional().isIn(['Present', 'Absent', 'Leave', 'Half Day']),
  body('checkIn').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('checkOut').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('notes').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
  }
  return updateAttendance(req, res);
});

/**
 * DELETE /api/hrms/attendance/:id
 * Remove/deactivate an attendance record (BUSINESS_OWNER only)
 */
router.delete('/attendance/:id', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const attendanceId = parseInt(req.params.id, 10);
    const result = await dbQuery(
      'DELETE FROM Attendance WHERE AttendanceId = ? AND BusinessId = ?',
      [attendanceId, businessId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance record removed successfully' });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to remove attendance record' });
  }
});

module.exports = router;
