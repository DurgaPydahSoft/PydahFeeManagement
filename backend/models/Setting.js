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
}, {
  timestamps: true,
});

module.exports = mongoose.model('Setting', settingSchema);
