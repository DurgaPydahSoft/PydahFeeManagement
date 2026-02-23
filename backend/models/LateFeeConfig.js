const mongoose = require('mongoose');

const lateFeeConfigSchema = new mongoose.Schema({
  college: { type: String, required: true },
  course: { type: String, required: true },
  branch: { type: String, required: true },
  batch: { type: String, required: true }, // Academic Year like "2024"
  studentYear: { type: Number, required: true }, // 1, 2, 3, 4
  semester: { type: Number }, // Optional, 1 or 2 (at rule level)
  categories: [{ type: String }],
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
    required: true
  },
  // lateFeeHead: { // The head to which the late fee demand will be added
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'FeeHead',
  //   required: true
  // },
  termMappings: [{
    termNumber: { type: Number, required: true },
    studentYear: { type: Number, required: true },
    semester: { type: Number }, // Optional, 1 or 2
    // Mapping to SQL Academic Calendar
    dueEventType: { type: String, enum: ['START_DATE', 'END_DATE'], default: 'START_DATE' },
    offsetDays: { type: Number, default: 0 }, // Grace period or offset from the event date
  }],
  penaltyType: { type: String, enum: ['Fixed', 'Percentage'], default: 'Fixed' },
  penaltyValue: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('LateFeeConfig', lateFeeConfigSchema);
