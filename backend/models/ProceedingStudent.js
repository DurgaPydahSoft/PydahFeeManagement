const mongoose = require('mongoose');

const proceedingStudentSchema = mongoose.Schema({
    proceedingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proceeding',
        required: true
    },
    studentId: {
        type: String,
        required: true
    },
    studentName: {
        type: String,
        default: ''
    },
    admissionNumber: {
        type: String,
        default: ''
    },
    pinNo: {
        type: String,
        default: ''
    },
    college: { type: String, default: '' },
    collegeId: { type: Number },
    course: { type: String, default: '' },
    courseId: { type: Number },
    branch: { type: String, default: '' },
    branchId: { type: Number },
    caste: { type: String, default: '' },
    batch: { type: String, default: '' },
    /** Current year from student master (display / reference). */
    studentYear: { type: String, default: '' },
    /**
     * Year of study for this proceeding's academic year
     * (batch 2024 + AY 2025-2026 => 2). Used on generated transactions.
     */
    proceedingYear: { type: Number, default: null },
    /** Individual share for this student (used when generating transactions). */
    shareAmount: { type: Number, default: 0 },
    /** Auto-generation skipped — student share exceeds fee-head demand at approve time. */
    txnPending: { type: Boolean, default: false },
    txnPendingReason: { type: String, default: '' }
}, {
    timestamps: true
});

proceedingStudentSchema.index({ proceedingId: 1 });
proceedingStudentSchema.index({ proceedingId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ProceedingStudent', proceedingStudentSchema);
