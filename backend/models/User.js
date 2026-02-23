const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    // Password is now optional because it might come from the Employee DB
  },
  employeeId: {
    type: String, // Storing as String to match whatever ID format comes from external DB, or ObjectId if preferred
    ref: 'Employee',
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'office_staff', 'cashier'], // [UPDATED]
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

module.exports = mongoose.model('User', userSchema);
