const mongoose = require('mongoose');

const reminderConfigSchema = new mongoose.Schema({
    college: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    branch: {
        type: String, // Optional
        default: ''
    },
    academicYear: {
        type: String, // e.g., "2024-2025"
        required: true
    },
    yearOfStudy: {
        type: Number, // 1, 2, 3, 4
        required: true
    },
    semester: {
        type: String,
        enum: ['1', '2', 'BOTH'],
        default: 'BOTH'
    },
    smsTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate'
    },
    emailTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate'
    },
    eventType: {
        type: String,
        enum: ['START_DATE', 'END_DATE'],
        required: true
    },
    triggerType: {
        type: String,
        enum: ['BEFORE', 'AFTER'],
        required: true
    },
    offsets: {
        type: [Number], // Array of days, e.g. [1, 2, 5]
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastExecutedDate: {
        type: Date // To track when this rule was last successfully run
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ReminderConfig', reminderConfigSchema);
