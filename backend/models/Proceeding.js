const mongoose = require('mongoose');

const proceedingSchema = mongoose.Schema({
    proceedingNumber: {
        type: String,
        required: true,
        unique: true
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

module.exports = mongoose.model('Proceeding', proceedingSchema);
