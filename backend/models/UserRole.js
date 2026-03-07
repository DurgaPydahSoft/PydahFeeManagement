const mongoose = require('mongoose');

const userRoleSchema = mongoose.Schema({
  employeeId: {
    type: String, 
    required: true,
    unique: true, // One role object per HRMS employee
    description: 'The employee ID or emp_no from the HRMS database'
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'office_staff', 'cashier'], 
    default: 'office_staff',
  },
  college: {
    type: String, // College name for role-based scoping
  },
  permissions: {
    type: [String], // Array of allowed paths (e.g., ['/dashboard', '/students'])
    default: [],
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('UserRole', userRoleSchema);
