const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').lean().sort({ createdAt: -1 });

    try {
      const getEmployeeModel = require('../models/Employee');
      const Employee = getEmployeeModel();
      if (Employee) {
        const empIds = users.filter(u => u.employeeId).map(u => u.employeeId);
        if (empIds.length > 0) {
          const employees = await Employee.find({ _id: { $in: empIds } }).select('is_active email phone_number dynamicFields');
          const empMap = employees.reduce((acc, emp) => {
            acc[emp._id.toString()] = emp;
            return acc;
          }, {});

          users.forEach(u => {
            if (u.employeeId && empMap[u.employeeId.toString()]) {
              const emp = empMap[u.employeeId.toString()];
              u.hrmsActive = emp.is_active;

              // Fallback for Email
              if (!u.email) {
                u.email = emp.email || (emp.dynamicFields && emp.dynamicFields.email) || '';
              }
              // Fallback for Mobile
              if (!u.mobile) {
                u.mobile = emp.phone_number || (emp.dynamicFields && (emp.dynamicFields.phone_number || emp.dynamicFields.mobile || emp.dynamicFields.phone)) || '';
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to populate HRMS status in getUsers:', err);
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get current logged-in user's fresh profile (including paymentAccess)
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.employeeId) {
      try {
        const getEmployeeModel = require('../models/Employee');
        const Employee = getEmployeeModel();
        if (Employee) {
          const emp = await Employee.findById(user.employeeId).select('is_active email phone_number dynamicFields');
          if (emp) {
            user.hrmsActive = emp.is_active;

            // Fallback for Email
            if (!user.email) {
              user.email = emp.email || (emp.dynamicFields && emp.dynamicFields.email) || '';
            }
            // Fallback for Mobile
            if (!user.mobile) {
              user.mobile = emp.phone_number || (emp.dynamicFields && (emp.dynamicFields.phone_number || emp.dynamicFields.mobile || emp.dynamicFields.phone)) || '';
            }
          }
        }
      } catch (err) {
        console.error('Failed to populate HRMS details in getMe:', err);
      }
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update per-user payment access overrides
// @route   PUT /api/users/:id/payment-access
// @access  Admin / SuperAdmin
const updateUserPaymentAccess = async (req, res) => {
  try {
    const { enableCashPayment, enableBankPayment, enableSplitPayment, feeCollectionDisabled } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.paymentAccess = {
      feeCollectionDisabled: feeCollectionDisabled === true,
      enableCashPayment: enableCashPayment !== undefined ? enableCashPayment : null,
      enableBankPayment: enableBankPayment !== undefined ? enableBankPayment : null,
      enableSplitPayment: enableSplitPayment !== undefined ? enableSplitPayment : null,
      autoResetEnabled: true,
    };
    await user.save();

    res.json({ message: 'Payment access updated', paymentAccess: user.paymentAccess });
  } catch (error) {
    console.error('Error updating payment access:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res) => {
  // console.log('\n[USER CREATION DEBUG] -----------------------------------------');
  // console.log('[USER CREATION DEBUG] Received Payload:', req.body);
  const { name, username, password, role, college, colleges, campuses, courses, employeeId, permissions, email, mobile, isActive } = req.body;

  // Validation: Password is required only if NOT linked to an employee
  if (!name || !username || !role) {
    // console.log('[USER CREATION DEBUG] Validation Failed: Missing required fields');
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  if (!employeeId && !password) {
    return res.status(400).json({ message: 'Password is required for local users' });
  }

  try {
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let hashedPassword = undefined;

    // Hash password ONLY if it's a local user
    if (!employeeId && password) {
      // console.log('[USER CREATION DEBUG] Creating Local User -> Hashing Password');
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    } else if (employeeId) {
      // console.log('[USER CREATION DEBUG] Creating HRMS-Linked User -> Skipping Password Hash');
    }

    /*
    console.log('[USER CREATION DEBUG] Creating user document mapping...', {
      employeeId_provided: !!employeeId,
      password_hashed: !!hashedPassword
    });
    */

    const user = await User.create({
      name,
      username,
      password: hashedPassword, // Will be undefined for employee-linked users
      role,
      college: (colleges && colleges.length > 0) ? colleges[0] : (college || ''),
      colleges: colleges || [],
      campuses: campuses || [],
      courses: courses || [],
      employeeId, // Link to external employee
      permissions: permissions || [], // Save permissions if provided
      email: email || undefined,
      mobile: mobile || undefined,
      isActive: isActive !== undefined ? isActive : true
    });

    // console.log(`[USER CREATION DEBUG] User created successfully: ${user._id}`);

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        college: user.college,
        colleges: user.colleges,
        campuses: user.campuses,
        courses: user.courses,
        employeeId: user.employeeId,
        permissions: user.permissions,
        email: user.email,
        mobile: user.mobile,
        isActive: user.isActive
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.deleteOne();
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user permissions
// @route   PUT /api/users/:id/permissions
// @access  Super Admin
const updateUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.permissions = req.body.permissions || [];
    await user.save();

    res.json({
      _id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      college: user.college,
      colleges: user.colleges,
      courses: user.courses,
      permissions: user.permissions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateUser = async (req, res) => {
  const { name, username, password, role, college, colleges, campuses, courses, permissions, email, mobile, isActive } = req.body;

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name || user.name;

    // Only allow changing username if NOT linked to an employee
    if (!user.employeeId) {
      user.username = username || user.username;
    }

    user.role = role || user.role;
    
    if (colleges) {
      user.colleges = colleges;
      user.college = colleges.length > 0 ? colleges[0] : '';
    } else {
      user.college = college === '' ? '' : (college || user.college);
    }

    if (campuses !== undefined) {
      user.campuses = campuses;
    }

    if (courses) {
      user.courses = courses;
    }

    // Update permissions if provided
    if (permissions) {
      user.permissions = permissions;
    }

    if (email !== undefined) {
      user.email = email === '' ? undefined : email;
    }

    if (mobile !== undefined) {
      user.mobile = mobile === '' ? undefined : mobile;
    }

    if (isActive !== undefined) {
      if (isActive === false && user.isActive !== false) {
        if (user.sessionId) {
          try {
            const { notifyLogout } = require('../utils/sseManager');
            notifyLogout(user.sessionId);
          } catch (err) {
            console.error('SSE displacement logout failed during deactivation:', err);
          }
          user.sessionId = null;
        }
      }
      user.isActive = isActive;
    }

    // Allow changing password for ALL users (including linked ones) 
    // This allows Superadmins (or users themselves, if we add that later) to set a local override password.
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      username: updatedUser.username,
      role: updatedUser.role,
      college: updatedUser.college,
      colleges: updatedUser.colleges,
      campuses: updatedUser.campuses,
      courses: updatedUser.courses,
      permissions: updatedUser.permissions,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      isActive: updatedUser.isActive
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getUsers,
  getMe,
  createUser,
  deleteUser,
  updateUserPermissions,
  updateUser,
  updateUserPaymentAccess
};
