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
    default: 'office_staff',
  },
  college: {
    type: String, // College name for role-based scoping
  },
  colleges: {
    type: [String],
    default: []
  },
  campuses: {
    type: [Number],
    default: []
  },
  courses: {
    type: [String],
    default: []
  },
  permissions: {
    type: [String], // Array of allowed paths (e.g., ['/dashboard', '/students'])
    default: [],
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  mobile: {
    type: String,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  sessionId: {
    type: String,
    default: null, // Stores the UUID of the current active session
  },
  paymentAccess: {
    // Master kill-switch: when true the user cannot collect any fee at all
    feeCollectionDisabled: { type: Boolean, default: false },
    // Per-user payment method overrides. null = follow global setting, true/false = override
    enableCashPayment: { type: Boolean, default: null },
    enableBankPayment: { type: Boolean, default: null },
    enableSplitPayment: { type: Boolean, default: null },
    // When set to true, the user's access was manually enabled — will auto-reset at configured time
    autoResetEnabled: { type: Boolean, default: false },
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
