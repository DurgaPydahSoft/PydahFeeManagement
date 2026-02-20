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
    // Check for user
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let isMatch = false;

    /* 
      [UPDATED AUTH LOGIC]
      Prioritize LOCAL password if it exists (e.g. reset by Superadmin).
      Fall back to Employee DB password only if local password is not set.
    */

    if (user.password) {
      // Check local password first
      isMatch = await bcrypt.compare(password, user.password);
    }

    // If no local password is set, AND user is linked, check Employee DB
    if (!user.password && user.employeeId) {
      // User is linked to an Employee (Staff)
      // Verify password against Employee DB
      const getEmployeeModel = require('../models/Employee');
      const Employee = getEmployeeModel();

      if (Employee) {
        // Find employee by emp_no (which matches username) or employeeId
        // The user.username is set to emp_no for linked users
        const employee = await Employee.findOne({ emp_no: user.username }).select('password');

        if (employee && employee.password) {
          // Direct string comparison for now...
          isMatch = await bcrypt.compare(password, employee.password);
        }
      } else {
        console.error("Employee DB not connected during login check");
        return res.status(503).json({ message: 'Authentication service unavailable' });
      }
    }

    if (isMatch) {
      res.json({
        _id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        college: user.college,
        permissions: user.permissions,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  loginUser,
};
