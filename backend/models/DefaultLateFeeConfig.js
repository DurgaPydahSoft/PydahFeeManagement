const mongoose = require('mongoose');

const defaultLateFeeConfigSchema = new mongoose.Schema({
  termsCount: {
    type: Number,
    required: true,
    unique: true
  },
  lateFeeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
    required: true
  },
  terms: [{
    termNumber: { type: Number, required: true },
    dueDateMode: { type: String, enum: ['offset', 'fixed'], default: 'offset' },
    referenceSemester: { type: Number },
    dueOffsetDays: { type: Number, default: 0 },
    fixedDueDate: { type: Date },
    dueDescription: { type: String, default: '' }
  }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('DefaultLateFeeConfig', defaultLateFeeConfigSchema);
