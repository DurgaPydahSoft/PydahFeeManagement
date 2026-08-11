const mongoose = require('mongoose');

const sentReminderLogSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        trim: true
    },
    studentName: {
        type: String,
        required: true
    },
    college: {
        type: String,
        required: true
    },
    course: {
        type: String,
        default: ''
    },
    branch: {
        type: String,
        default: ''
    },
    pinNo: {
        type: String,
        default: ''
    },
    recipient: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['SMS', 'EMAIL'],
        required: true
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate'
    },
    templateName: {
        type: String,
        default: ''
    },
    subject: {
        type: String,
        default: ''
    },
    body: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for efficient reports queries
sentReminderLogSchema.index({ type: 1, status: 1 });
sentReminderLogSchema.index({ sentAt: -1 });
sentReminderLogSchema.index({ studentId: 1 });

module.exports = mongoose.model('SentReminderLog', sentReminderLogSchema);
