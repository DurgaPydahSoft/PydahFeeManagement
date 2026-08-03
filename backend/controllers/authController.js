const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const { notifyLogout } = require('../utils/sseManager');
const sendEmail = require('../utils/sendEmail');

/**
 * Generate a JWT embedding both the user id and the current session UUID.
 * The sessionId is validated on every protected request to enforce
 * single active device login.
 */
const generateToken = (id, sessionId) => {
  return jwt.sign({ id, sessionId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const FEE_ACCESS_DENIED = 'User not authorized for Fee Management system';

const findFeeManagementUser = async ({ username, employeeId, identifier }) => {
  const orConditions = [];
  if (employeeId) orConditions.push({ employeeId });
  if (username) orConditions.push({ username });
  if (identifier) {
    orConditions.push({ employeeId: identifier });
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      orConditions.push({ _id: identifier });
    }
  }
  if (orConditions.length === 0) return null;
  return User.findOne({ $or: orConditions });
};

const applyFeeManagementProfile = (authUser, feeUser) => ({
  _id: feeUser._id,
  name: authUser.name || feeUser.name,
  username: feeUser.username,
  role: feeUser.role,
  college: feeUser.college || '',
  colleges: feeUser.colleges || [],
  campuses: feeUser.campuses || [],
  courses: feeUser.courses || [],
  permissions: feeUser.permissions || [],
  employeeId: feeUser.employeeId,
  paymentAccess: feeUser.paymentAccess || {},
});

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
          _id: localUser._id,
          name: localUser.name,
          username: localUser.username,
          role: localUser.role,
          college: localUser.college,
          colleges: localUser.colleges || [],
          campuses: localUser.campuses || [],
          courses: localUser.courses || [],
          permissions: localUser.permissions,
          employeeId: localUser.employeeId,
          paymentAccess: localUser.paymentAccess || {},
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

      // HRMS credentials are valid only when a Fee Management User record exists
      if (authUser && (authMethod === 'HRMS Employees' || authMethod === 'HRMS Users')) {
        const feeUser = await findFeeManagementUser({
          username,
          employeeId: authUser.employeeId,
        });

        if (!feeUser) {
          console.log(`[AUTH LOG] FAILURE: HRMS user ${username} has no Fee Management profile`);
          return res.status(401).json({ message: FEE_ACCESS_DENIED });
        }

        authUser = applyFeeManagementProfile(authUser, feeUser);
      }
    }

    // ==========================================
    // Final Authentication Resolution
    // ==========================================
    if (authUser) {
      console.log(`[AUTH LOG] SUCCESS! Found user in: ${authMethod}`);

      // --- Single Active Device Login ---
      // 1. Generate a fresh session UUID for this login.
      const newSessionId = crypto.randomUUID();

      // 2. If the user already had an active session, notify that SSE client
      //    so the old device is logged out instantly.
      const dbUser = await User.findById(authUser._id);
      if (dbUser) {
        if (dbUser.isActive === false) {
          console.log(`[AUTH LOG] FAILURE: Account is manually deactivated for user ${username}`);
          return res.status(403).json({ message: 'Your account has been deactivated. Please contact your system administrator.' });
        }

        // Check if deactivated via HRMS
        if (dbUser.employeeId) {
          try {
            const getEmployeeModel = require('../models/Employee');
            const Employee = getEmployeeModel();
            if (Employee) {
              const employee = await Employee.findById(dbUser.employeeId).select('is_active');
              if (employee && employee.is_active === false) {
                console.log(`[AUTH LOG] FAILURE: Account is HRMS deactivated for user ${username}`);
                return res.status(403).json({ message: 'Your account has been deactivated via HRMS. Please contact HR.' });
              }
            }
          } catch (err) {
            console.error('HRMS deactivation check failed during login:', err);
          }
        }
      }

      if (dbUser && dbUser.sessionId) {
        notifyLogout(dbUser.sessionId);
      }

      // 3. Persist the new sessionId in MongoDB.
      await User.findByIdAndUpdate(authUser._id, { sessionId: newSessionId });

      const token = generateToken(authUser._id, newSessionId);

      res.json({
        _id: authUser._id,
        name: authUser.name,
        username: authUser.username,
        role: authUser.role,
        college: authUser.college,
        colleges: authUser.colleges || [],
        campuses: authUser.campuses || [],
        courses: authUser.courses || [],
        permissions: authUser.permissions,
        paymentAccess: authUser.paymentAccess || {},
        sessionId: newSessionId,
        token,
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

// @desc    SSO Login
// @route   POST /api/auth/sso-login
// @access  Public
const ssoLogin = async (req, res) => {
  const { encryptedToken } = req.body;

  if (!encryptedToken) {
    return res.status(400).json({ message: 'SSO token is required' });
  }

  try {
    // 1. Verify token with CRM Backend
    const verifyResponse = await axios.post(`${process.env.CRM_BACKEND_URL}/auth/verify-token`, {
      encryptedToken
    });

    if (!verifyResponse.data.success || !verifyResponse.data.valid) {
      return res.status(401).json({ message: verifyResponse.data.message || 'Invalid SSO token' });
    }

    const { userId } = verifyResponse.data.data;
    const identifier = userId; // CRM identifier (usually the _id or username/email)

    let authUser = null;
    let authMethod = '';

    // 2. Resolve user locally or via HRMS
    
    // STEP 1: Local DB (Check by username OR _id if possible)
    let localUser = await User.findOne({
      $or: [
        { username: identifier },
        ...(mongoose.Types.ObjectId.isValid(identifier) ? [{ _id: identifier }] : [])
      ]
    });

    if (localUser) {
      authUser = {
        _id: localUser._id,
        name: localUser.name,
        username: localUser.username,
        role: localUser.role,
        college: localUser.college,
        colleges: localUser.colleges || [],
        campuses: localUser.campuses || [],
        courses: localUser.courses || [],
        permissions: localUser.permissions,
        employeeId: localUser.employeeId
      };
      authMethod = 'Local User DB (SSO)';
    }

    // STEP 2: HRMS Fallback
    if (!authUser) {
      const { getEmployeeConnection } = require('../config/dbEmployee');
      const hrmsConn = getEmployeeConnection();

      if (hrmsConn) {
        const getEmployeeModel = require('../models/Employee');
        const Employee = getEmployeeModel();
        
        // Search in Employee collection
        let hrmsEmployee = await Employee.findOne({
          $or: [
            { emp_no: identifier },
            ...(mongoose.Types.ObjectId.isValid(identifier) ? [{ _id: identifier }] : [])
          ]
        });

        if (hrmsEmployee) {
          authUser = {
            name: hrmsEmployee.employee_name,
            username: hrmsEmployee.emp_no || identifier,
            employeeId: hrmsEmployee._id.toString()
          };
          authMethod = 'HRMS Employees (SSO)';
        } else {
          // Search in HRMS users collection
          let hrmsNativeUser = await hrmsConn.collection('users').findOne({
            $or: [
              { username: identifier },
              { email: identifier },
              { emp_no: identifier },
              ...(mongoose.Types.ObjectId.isValid(identifier) ? [{ _id: new mongoose.Types.ObjectId(identifier) }] : [])
            ]
          });

          if (hrmsNativeUser) {
            authUser = {
              name: hrmsNativeUser.name || hrmsNativeUser.username,
              username: hrmsNativeUser.username || hrmsNativeUser.emp_no || identifier,
              employeeId: hrmsNativeUser.emp_no || hrmsNativeUser._id.toString()
            };
            authMethod = 'HRMS Users (SSO)';
          }
        }

        if (authUser) {
          const feeUser = await findFeeManagementUser({
            username: authUser.username,
            employeeId: authUser.employeeId,
            identifier,
          });

          if (!feeUser) {
            console.log(`[AUTH LOG] SSO FAILURE: HRMS user ${identifier} has no Fee Management profile`);
            return res.status(401).json({ message: FEE_ACCESS_DENIED });
          }

          authUser = applyFeeManagementProfile(authUser, feeUser);
        }
      }
    }

    if (authUser) {
      console.log(`[AUTH LOG] SSO SUCCESS! Found user in: ${authMethod}`);

      // --- Single Active Device Login (SSO path) ---
      const newSessionId = crypto.randomUUID();
      const dbUser = await User.findById(authUser._id);
      if (dbUser) {
        if (dbUser.isActive === false) {
          console.log(`[AUTH LOG] SSO FAILURE: Account is manually deactivated for user ${dbUser.username}`);
          return res.status(403).json({ message: 'Your account has been deactivated. Please contact your system administrator.' });
        }

        // Check if deactivated via HRMS
        if (dbUser.employeeId) {
          try {
            const getEmployeeModel = require('../models/Employee');
            const Employee = getEmployeeModel();
            if (Employee) {
              const employee = await Employee.findById(dbUser.employeeId).select('is_active');
              if (employee && employee.is_active === false) {
                console.log(`[AUTH LOG] SSO FAILURE: Account is HRMS deactivated for user ${dbUser.username}`);
                return res.status(403).json({ message: 'Your account has been deactivated via HRMS. Please contact HR.' });
              }
            }
          } catch (err) {
            console.error('HRMS deactivation check failed during SSO login:', err);
          }
        }
      }

      if (dbUser && dbUser.sessionId) {
        notifyLogout(dbUser.sessionId);
      }
      await User.findByIdAndUpdate(authUser._id, { sessionId: newSessionId });
      const token = generateToken(authUser._id, newSessionId);

      res.json({
        _id: authUser._id,
        name: authUser.name,
        username: authUser.username,
        role: authUser.role,
        college: authUser.college,
        colleges: authUser.colleges || [],
        campuses: authUser.campuses || [],
        courses: authUser.courses || [],
        permissions: authUser.permissions,
        paymentAccess: authUser.paymentAccess || {},
        sessionId: newSessionId,
        token,
      });
    } else {
      console.log(`[AUTH LOG] SSO FAILURE: User ${identifier} not found in Fee Management`);
      res.status(401).json({ message: 'User not authorized for Fee Management system' });
    }

  } catch (error) {
    console.error('SSO Login Error:', error.message);
    res.status(500).json({ message: 'SSO Authentication failed' });
  }
};

/**
 * @desc    Logout — clear sessionId from DB and SSE
 * @route   POST /api/auth/logout
 * @access  Protected
 */
const logoutUser = async (req, res) => {
  try {
    const user = req.user;
    if (user && user.sessionId) {
      notifyLogout(user.sessionId);
    }
    await User.findByIdAndUpdate(user._id, { sessionId: null });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Logout failed.' });
  }
};

// @desc    Forgot Password for Super Admin (Generates, saves, & sends a new temporary password)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    if (user.role !== 'superadmin') {
      return res.status(403).json({ 
        message: 'Password reset is restricted to Super Admins. Employees should contact HRMS administrators.' 
      });
    }

    // Generate random 6-digit numeric temporary password
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(tempPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Super Admin Password Reset',
        message: `Your Super Admin password has been reset. Your new temporary password is: ${tempPassword}\n\nPlease log in using this password.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #2563eb; margin-bottom: 20px; text-align: center;">Super Admin Password Reset</h2>
            <p style="text-align: center; font-size: 16px; color: #475569;">Your password has been reset successfully. Here is your new login credential:</p>
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background-color: #f1f5f9; padding: 18px 36px; border-radius: 12px; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #1e293b; border: 2px dashed #3b82f6; user-select: all; -webkit-user-select: all; cursor: pointer;">
                ${tempPassword}
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 8px;">(Double-click or long-press the code above to select and copy)</p>
            </div>
            <p style="font-size: 15px; line-height: 1.5; color: #334155; text-align: center;">Please use the temporary password shown above to log in to the Fee Management dashboard.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">If you did not request this password reset, please contact system administration immediately.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
      return res.status(500).json({ message: 'Failed to send password reset email via Brevo. Please check email settings.' });
    }

    res.json({ message: 'A new password has been sent to your email.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  loginUser,
  ssoLogin,
  logoutUser,
  forgotPassword,
};
