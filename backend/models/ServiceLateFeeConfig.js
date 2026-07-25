const mongoose = require('mongoose');

/**
 * Hostel / Transport config keyed by type + academic year.
 *
 * Two independent pieces:
 * 1) defaultTermsCount + defaultTerms — how the applicable fee head is split
 *    for ALL students in that year (just term count + %).
 * 2) lateFeeRules[] — late-fee amounts/timing by termsCount (like Default Rules).
 *    Not forced to match defaultTermsCount; can save rules for 1/2/3/4 independently.
 *    Runtime: student has N terms from (1) → pick lateFeeRules where termsCount=N,
 *    else fall back to DefaultLateFeeConfig.
 */
const serviceLateFeeConfigSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['HOSTEL', 'TRANSPORT'],
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  // Fee head whose dues are checked / split into default terms
  applicableFeeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
    required: true
  },
  // Default # of terms for this applicable head in this academic year
  defaultTermsCount: {
    type: Number,
    required: true,
    min: 1
  },
  // % split only (no late-fee amounts here)
  defaultTerms: [{
    termNumber: { type: Number, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 }
  }],
  // Independent late-fee rules by terms count (not linked to defaultTermsCount)
  lateFeeRules: [{
    termsCount: { type: Number, required: true, min: 1 },
    lateFeeHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeHead',
      required: true
    },
    terms: [{
      termNumber: { type: Number, required: true },
      lateFeeAmount: { type: Number, default: 0 },
      dueDateMode: { type: String, enum: ['offset', 'fixed'], default: 'offset' },
      referenceSemester: { type: Number },
      dueOffsetDays: { type: Number, default: 0 },
      fixedDueDate: { type: Date },
      dueDescription: { type: String, default: '' }
    }]
  }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

serviceLateFeeConfigSchema.index({ type: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('ServiceLateFeeConfig', serviceLateFeeConfigSchema);
