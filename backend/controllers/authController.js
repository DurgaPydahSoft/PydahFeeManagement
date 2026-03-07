const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // console.log(`\n[AUTH DEBUG] -----------------------------------------`);
    // console.log(`[AUTH DEBUG] Login attempt started for username: "${username}"`);
    let authUser = null;
    let authMethod = '';

    // ==========================================
    // STEP 1: Check Local "User" Collection
    // ==========================================
    let localUser = await User.findOne({ username });
    // console.log(`[AUTH DEBUG] Step 1: Local User DB lookup -> ${localUser ? 'Found' : 'Not Found'}`);
    
    if (localUser && localUser.password) {
      const isLocalMatch = await bcrypt.compare(password, localUser.password);
      // console.log(`[AUTH DEBUG] Step 1: Password match -> ${isLocalMatch ? 'YES' : 'NO'}`);
      if (isLocalMatch) {
        authUser = {
          _id: localUser._id, // FIX: Use ._id from Mongoose doc
          name: localUser.name,
          username: localUser.username,
          role: localUser.role,
          college: localUser.college, // Specific to Fee Management 
          permissions: localUser.permissions,
          employeeId: localUser.employeeId
        };
        authMethod = 'Local User DB';
      }
    } else if (localUser && !localUser.password) {
      // console.log(`[AUTH DEBUG] Step 1: User found locally but has no local password.`);
    }

    // ==========================================
    // STEP 2 & 3: HRMS Fallbacks
    // ==========================================
    if (!authUser) {
      const { getEmployeeConnection } = require('../config/dbEmployee');
      const hrmsConn = getEmployeeConnection();

      if (!hrmsConn) {
        return res.status(503).json({ message: 'Authentication fallback service unavailable' });
      }

      // -- Step 2: Check 'employees' collection --
      const getEmployeeModel = require('../models/Employee');
      const Employee = getEmployeeModel();
      let hrmsEmployee = await Employee.findOne({ emp_no: username }).select('password employee_name');
      // console.log(`[AUTH DEBUG] Step 2: HRMS Employee DB lookup by emp_no -> ${hrmsEmployee ? 'Found' : 'Not Found'}`);

      if (hrmsEmployee && hrmsEmployee.password) {
        // console.log(`[AUTH DEBUG] Step 2: Fetched hash prefix -> ${hrmsEmployee.password.substring(0, 7)}...`);
        // console.log(`[AUTH DEBUG] Step 2: Hash length: ${hrmsEmployee.password.length}, Input length: ${password.length}`);
        
        // Try direct compare, trimmed compare, and trimmed hash compare just in case.
        const isEmpMatch = await bcrypt.compare(password, hrmsEmployee.password);
        const isEmpMatchTrimmed = await bcrypt.compare(password.trim(), hrmsEmployee.password);
        
        // console.log(`[AUTH DEBUG] Step 2: Password match -> ${isEmpMatch ? 'YES' : 'NO'} | Trimmed match -> ${isEmpMatchTrimmed ? 'YES' : 'NO'}`);
        if (isEmpMatch || isEmpMatchTrimmed) {
          authUser = {
            name: hrmsEmployee.employee_name,
            username: username,
            employeeId: hrmsEmployee._id.toString() // Or use emp_no based on preference
          };
          authMethod = 'HRMS Employees';
        }
      }

      // -- Step 3: Check 'users' collection --
      if (!authUser) {
        let hrmsNativeUser = await hrmsConn.collection('users').findOne({
          $or: [{ email: username }, { username: username }, { emp_no: username }]
        });
        // console.log(`[AUTH DEBUG] Step 3: HRMS Users collection lookup -> ${hrmsNativeUser ? 'Found' : 'Not Found'}`);

        if (hrmsNativeUser && hrmsNativeUser.password) {
          // console.log(`[AUTH DEBUG] Step 3: Fetched hash prefix -> ${hrmsNativeUser.password.substring(0, 7)}...`);
          const isNativeMatch = await bcrypt.compare(password, hrmsNativeUser.password);
          // console.log(`[AUTH DEBUG] Step 3: Password match -> ${isNativeMatch ? 'YES' : 'NO'}`);
          if (isNativeMatch) {
            authUser = {
              name: hrmsNativeUser.name || hrmsNativeUser.username, // Fallback if no name
              username: username,
              employeeId: hrmsNativeUser.emp_no || hrmsNativeUser._id.toString() 
            };
            authMethod = 'HRMS Users';
          }
        }
      }

      // ==========================================
      // Apply UserRole Permissions for HRMS Users
      // ==========================================
      if (authUser && (authMethod === 'HRMS Employees' || authMethod === 'HRMS Users')) {
        const UserRole = require('../models/UserRole');
        
        // Find existing role mapping for this employee
        const userRole = await UserRole.findOne({ employeeId: authUser.employeeId });

        if (userRole) {
          authUser.role = userRole.role;
          authUser.college = userRole.college || '';
          authUser.permissions = userRole.permissions || [];
        } else {
          // Default fallback for HRMS users if no UserRole document exists
          authUser.role = 'office_staff';
          authUser.college = '';
          authUser.permissions = [];
        }
        
        // We use their HRMS ID or generated ID for the token signing
        authUser._id = authUser.employeeId; 
      }
    }

    // ==========================================
    // Final Authentication Resolution
    // ==========================================
    if (authUser) {
      console.log(`[AUTH LOG] SUCCESS! Found user in: ${authMethod}`);
      
      res.json({
        _id: authUser._id,
        name: authUser.name,
        username: authUser.username,
        role: authUser.role,
        college: authUser.college,
        permissions: authUser.permissions,
        token: generateToken(authUser._id),
      });
    } else {
      console.log(`[AUTH LOG] FAILURE: Invalid credentials for ${username} (Failed all DB checks)`);
      res.status(400).json({ message: 'Invalid credentials' });
    }

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  loginUser,
};
