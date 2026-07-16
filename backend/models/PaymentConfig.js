const mongoose = require('mongoose');

const paymentConfigSchema = mongoose.Schema({
    college: {
        type: String,
        required: function() { return !this.is_global; }
    },
    course: {
        type: String,
        required: function() { return !this.is_global; }
    },
    account_name: {
        type: String, // e.g., "College Fees Account"
        required: true
    },
    bank_name: {
        type: String, // e.g., "HDFC Bank"
        required: true
    },
    account_number: {
        type: String,
        required: true
    },
    ifsc_code: {
        type: String,
        required: false
    },
    upi_id: {
        type: String, // Optional
        required: false
    },
    razorpay_key_id: {
        type: String,
        required: false
    },
    razorpay_key_secret: {
        type: String,
        required: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_global: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
