const mongoose = require('mongoose');

const concessionApproverSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('ConcessionApprover', concessionApproverSchema);
