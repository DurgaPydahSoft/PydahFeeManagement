const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res) => {
  const { name, username, password, role, college, employeeId, permissions } = req.body;

  // Validation: Password is required only if NOT linked to an employee
  if (!name || !username || !role) {
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
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const user = await User.create({
      name,
      username,
      password: hashedPassword, // Will be undefined for employee-linked users
      role,
      college,
      employeeId, // Link to external employee
      permissions: permissions || [] // Save permissions if provided
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        college: user.college,
        employeeId: user.employeeId,
        permissions: user.permissions
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
      permissions: user.permissions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateUser = async (req, res) => {
  const { name, username, password, role, college, permissions } = req.body;

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
    user.college = college === '' ? '' : (college || user.college); // Allow clearing college

    // Update permissions if provided
    if (permissions) {
      user.permissions = permissions;
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
      permissions: updatedUser.permissions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getUsers,
  createUser,
  deleteUser,
  updateUserPermissions,
  updateUser
};
