const mongoose = require('mongoose');

const receiptSequenceSchema = mongoose.Schema({
  collegeCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  groupCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  financialYear: {
    type: String,
    required: true,
    trim: true,
  },
  nextNumber: {
    type: Number,
    required: true,
    default: 1,
  }
}, {
  timestamps: true,
});

// Compound unique index for college, course, group, and financial year
receiptSequenceSchema.index({ collegeCode: 1, courseCode: 1, groupCode: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('ReceiptSequence', receiptSequenceSchema);
