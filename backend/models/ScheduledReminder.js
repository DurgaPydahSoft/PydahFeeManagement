const mongoose = require('mongoose');

const scheduledReminderSchema = new mongoose.Schema({
    college: {
        type: String,
        required: true
    },
    course: {
        type: String, // Optional, can be 'All' or specific
        default: ''
    },
    branch: {
        type: String, // Optional
        default: ''
    },
    batch: {
        type: String, // Optional
        default: ''
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate',
        required: true
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSED', 'FAILED'],
        default: 'PENDING'
    },
    type: {
        type: String, // 'SMS' or 'EMAIL'
        required: true
    },
    createdBy: {
        type: String,
        default: 'System'
    },
    logs: [{
        timestamp: Date,
        message: String,
        successCount: Number,
        failureCount: Number
    }]
}, {
    timestamps: true
});

// Index for efficient querying by scheduler
scheduledReminderSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model('ScheduledReminder', scheduledReminderSchema);
