const mongoose = require('mongoose');

const receiptSettingSchema = mongoose.Schema({
  showCollegeHeader: {
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('ReceiptSetting', receiptSettingSchema);
