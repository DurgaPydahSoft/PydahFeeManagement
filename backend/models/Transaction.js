const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
  studentId: {
    type: String, // Admission Number (from SQL)
    required: true,
  },
  studentName: {
    type: String, // Snapshot of name
  },
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  transactionType: {
    type: String,
    enum: ['DEBIT', 'CREDIT'],
    default: 'DEBIT',
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Adjustment', 'Waiver', 'Refund'],
    default: 'Cash',
  },
  referenceNo: {
    type: String,
  },
  remarks: {
    type: String,
  },
  semester: {
    type: String, // e.g., "1", "2"
  },
  academicYear: {
    type: String, // e.g., "1", "2", "3", "4"
  },
  receiptNumber: {
    type: String,
    unique: true,
  },
  collectedBy: {
    type: String, // Username (e.g., 'admin')
  },
  collectedByName: {
    type: String, // Full Name (e.g., 'Administrator')
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Transaction', transactionSchema);
