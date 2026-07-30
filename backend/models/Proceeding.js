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
        required: true
    },
    bankAccount: {
        type: String, // Can be account name or bank name from PaymentConfig
        required: true
    },
    bankCreditedDate: {
        type: Date
    },
    college: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
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
    status: {
        type: String,
        enum: ['Active', 'Completed', 'Cancelled'],
        default: 'Active'
    }
}, {
    timestamps: true
});

// Same proceeding number can be used for different courses;
// uniqueness is on (proceedingNumber + course).
proceedingSchema.index({ proceedingNumber: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Proceeding', proceedingSchema);
