const mongoose = require('mongoose');

const feeGroupSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
  },
  feeHeads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
  }],
  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('FeeGroup', feeGroupSchema);
