const mongoose = require('mongoose');

const proceedingSchema = mongoose.Schema({
    proceedingNumber: {
        type: String,
        required: true
    },
    proceedingDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        default: 0
    },
    /** Per-student share used when generating transactions (not bank split). */
    shareAmount: {
        type: Number,
        default: 0
    },
    bankCreditedAmount: {
        type: Number,
        default: 0
    },
    bankAccount: {
        type: String,
        default: ''
    },
    bankCreditedDate: {
        type: Date
    },
    college: {
        type: String,
        required: true
    },
    collegeId: {
        type: Number
    },
    course: {
        type: String,
        required: true
    },
    courseId: {
        type: Number
    },
    branchId: {
        type: Number
    },
    caste: {
        type: String
    },
    batch: {
        type: String
    },
    academicYear: {
        type: String
    },
    /** Optional supporting document uploaded to S3 on create/edit */
    attachmentUrl: {
        type: String,
        default: ''
    },
    attachmentName: {
        type: String,
        default: ''
    },
    attachmentKey: {
        type: String,
        default: ''
    },
    feeHead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeHead'
    },
    status: {
        type: String,
        enum: ['Pending', 'Verified', 'Active', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    transactionsGenerated: {
        type: Boolean,
        default: false
    },
    /** Approved without auto RTF transactions — stay Completed even if pool unused. */
    transactionsSkipped: {
        type: Boolean,
        default: false
    },
    requestedBy: {
        type: String,
        default: ''
    },
    requestedByName: {
        type: String,
        default: ''
    },
    verifiedBy: {
        type: String,
        default: ''
    },
    verifiedByName: {
        type: String,
        default: ''
    },
    verifiedAt: {
        type: Date
    },
    approvedBy: {
        type: String,
        default: ''
    },
    approvedByName: {
        type: String,
        default: ''
    },
    approvedAt: {
        type: Date
    },
    cancelledBy: {
        type: String,
        default: ''
    },
    cancelledByName: {
        type: String,
        default: ''
    },
    cancelledAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Same proceeding number can be used for different courses;
// uniqueness is on (proceedingNumber + course).
proceedingSchema.index({ proceedingNumber: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Proceeding', proceedingSchema);
