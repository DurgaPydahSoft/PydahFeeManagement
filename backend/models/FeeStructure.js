const mongoose = require('mongoose');

const feeStructureSchema = mongoose.Schema({
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'FeeHead',
  },
  college: {
    type: String,
    required: true,
  },
  course: {
    type: String,
    required: true,
  },
  branch: {
    type: String,
    required: true,
  },
  academicYear: {
    type: String, // e.g., "2024-2025" (Calendar Year)
    required: true,
  },
  studentYear: { // [NEW]
    type: Number, // e.g., 1, 2, 3, 4
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  }
}, {
  timestamps: true,
});

// Prevent duplicate fees for the same head/college/course/branch/academicYear/studentYear
feeStructureSchema.index({ feeHead: 1, college: 1, course: 1, branch: 1, academicYear: 1, studentYear: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
