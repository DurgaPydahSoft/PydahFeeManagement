const Role = require('../models/Role');

const allPermissions = [
  '/dashboard',
  '/students',
  '/fee-collection',
  '/overall-concessions',
  '/concessions',
  '/bulk-fee-upload',
  '/proceedings',
  '/reports',
  '/due-reports',
  '/fee-config',
  '/payment-config',
  '/settings',
  '/reminders',
  '/academic-calendar',
  '/caution-deposit',
  '/user-management',
  '/permissions',
  'fee_collection_pay',
  'fee_collection_concession',
  'fee_collection_edit',
  'proceedings_approve',
  'proceedings_edit',
  'proceedings_view',
  'reports_daily_collection',
  'reports_cashier_summary',
  'reports_fee_head_summary',
  'reports_account_wise'
];

const defaultRoles = [
  {
    name: 'superadmin',
    description: 'Super Administrator with full control over the system.',
    permissions: allPermissions
  },
  {
    name: 'admin',
    description: 'System Administrator with wide access to system configurations, collections, and reports.',
    permissions: allPermissions.filter(p => p !== '/user-management' && p !== '/permissions')
  },
  {
    name: 'office_staff',
    description: 'Office Staff with view access to students, reminders, calendar, and reports.',
    permissions: [
      '/dashboard',
      '/students',
      '/concessions',
      '/reports',
      '/due-reports',
      '/academic-calendar',
      '/proceedings',
      'proceedings_view'
    ]
  },
  {
    name: 'cashier',
    description: 'Cashier with permissions restricted to fee collection and recording payments.',
    permissions: [
      '/fee-collection',
      'fee_collection_pay'
    ]
  }
];

// @desc    Get all roles (seeds default roles if DB is empty)
// @route   GET /api/roles
// @access  Admin
const getRoles = async (req, res) => {
  try {
    let roles = await Role.find().sort({ createdAt: 1 });

    if (roles.length === 0) {
      await Role.insertMany(defaultRoles);
      roles = await Role.find().sort({ createdAt: 1 });
    }

    res.json(roles);
  } catch (error) {
    console.error('Get Roles Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a custom role
// @route   POST /api/roles
// @access  Super Admin
const createRole = async (req, res) => {
  const { name, description, permissions } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    const roleExists = await Role.findOne({ name: name.toLowerCase().trim() });
    if (roleExists) {
      return res.status(400).json({ message: 'Role with this name already exists' });
    }

    const role = await Role.create({
      name: name.toLowerCase().trim(),
      description: description || '',
      permissions: permissions || []
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Create Role Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a custom role
// @route   PUT /api/roles/:id
// @access  Super Admin
const updateRole = async (req, res) => {
  const { name, description, permissions } = req.body;

  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Protect superadmin role modifications
    if (role.name === 'superadmin') {
      return res.status(403).json({ message: 'Modifying the superadmin role is restricted' });
    }

    role.name = name ? name.toLowerCase().trim() : role.name;
    role.description = description !== undefined ? description : role.description;
    role.permissions = permissions !== undefined ? permissions : role.permissions;

    const updatedRole = await role.save();
    res.json(updatedRole);
  } catch (error) {
    console.error('Update Role Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a custom role
// @route   DELETE /api/roles/:id
// @access  Super Admin
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Protect default roles from deletion
    const isDefault = defaultRoles.some(dr => dr.name === role.name);
    if (isDefault) {
      return res.status(403).json({ message: `System default role '${role.name}' cannot be deleted` });
    }

    await role.deleteOne();
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete Role Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole
};
