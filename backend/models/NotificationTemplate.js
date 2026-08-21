const mongoose = require('mongoose');

const NotificationTemplateSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['SMS', 'EMAIL', 'PUSH']
    },
    name: {
        type: String,
        required: true
    },
    subject: {
        type: String, // Only for EMAIL
        default: ''
    },
    templateId: {
        type: String, // Only for SMS (DLT Template ID)
        default: ''
    },
    senderId: {
        type: String, // Only for EMAIL/SMS (Sender Name/ID)
        default: ''
    },
    body: {
        type: String,
        required: true
    },
    /**
     * When true, SMS is sent via BulkSMS Unicode API (coding=3)
     * for non-English / multi-language content (e.g. Telugu).
     */
    isUnicode: {
        type: Boolean,
        default: false
    },
    /**
     * Maps body placeholders to data sources.
     * DLT SMS: key = var_1, var_2, … (left-to-right {#var#} order)
     * Named: key = student_name for {{student_name}}
     * source: "student.<column>" or "computed.<field>"
     */
    variableMap: [{
        key: { type: String, required: true },
        index: { type: Number },
        source: { type: String, required: true }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('NotificationTemplate', NotificationTemplateSchema);
