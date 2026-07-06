const mongoose = require('mongoose');

const settingSchema = mongoose.Schema({
  showCollegeHeader: {
    type: Boolean,
    default: true,
  },
  enableCashPayment: {
    type: Boolean,
    default: true,
  },
  enableBankPayment: {
    type: Boolean,
    default: true,
  },
  enableSplitPayment: {
    type: Boolean,
    default: true,
  },
  maskedFeeHeads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
  }],
  maskName: {
    type: String,
    default: 'Processing Fee', // Default name for masked fees
  },
  paperSize: {
    type: String,
    enum: ['A4', 'A5'],
    default: 'A4',
  },
  copiesPerPage: {
    type: Number,
    enum: [1, 2],
    default: 2,
  },
  enableCustomReceiptSequence: {
    type: Boolean,
    default: false,
  },
  receiptSequenceSeparator: {
    type: String,
    default: '/',
  },
  receiptSequencePadding: {
    type: Number,
    default: 5,
  },
  receiptSequenceResetMonth: {
    type: Number,
    default: 4, // April
  },
  receiptSequenceResetDay: {
    type: Number,
    default: 1, // 1st
  },
  // Per-user payment access auto-reset schedule
  paymentAccessAutoReset: {
    type: Boolean,
    default: true, // enabled by default
  },
  paymentAccessResetHour: {
    type: Number,
    default: 9, // 9 AM
    min: 0,
    max: 23,
  },
  paymentAccessResetMinute: {
    type: Number,
    default: 0,
    min: 0,
    max: 59,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Setting', settingSchema);
