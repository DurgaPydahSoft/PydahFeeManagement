const mongoose = require('mongoose');

/**
 * Global timely reminder rule (not college-scoped).
 * Timing is relative to fee due dates from late-fee configs
 * (Academic FeeStructure / DefaultLateFeeConfig, or Hostel/Transport ServiceLateFeeConfig).
 * Audience: students with unpaid balance through that term only.
 */
const reminderConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    academicYear: {
        type: String, // e.g. "2025-2026"
        required: true,
        trim: true
    },
    dueSourceType: {
        type: String,
        enum: ['ACADEMIC', 'HOSTEL', 'TRANSPORT'],
        required: true
    },
    /** BEFORE = dueDate - offset days; AFTER = dueDate + offset days; ON uses offset 0 */
    triggerType: {
        type: String,
        enum: ['BEFORE', 'AFTER'],
        required: false
    },
    /** Day offsets relative to due date, e.g. [1, 3, 7] or [{ value: 3, triggerType: 'BEFORE' }] */
    offsets: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    smsTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate'
    },
    emailTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTemplate'
    },
    /**
     * Which mobile numbers to send SMS to.
     * Possible values: 'student' | 'parent' | 'guardian'
     * Defaults to student only for backward compat.
     */
    smsRecipients: {
        type: [String],
        enum: ['student', 'parent', 'guardian'],
        default: ['student']
    },
    /**
     * Student quota codes to target (matches students.stud_type).
     * Empty array = all quotas (no filter applied).
     * e.g. ['CONV', 'MANG']
     */
    quotas: {
        type: [String],
        default: []
    },
    colleges: {
        type: [String],
        default: []
    },
    courses: {
        type: [String],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastExecutedDate: {
        type: Date
    },
    /** Track which offsets already ran on a calendar day: ["2026-07-27:3", ...] */
    lastRunKeys: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

reminderConfigSchema.index({ academicYear: 1, dueSourceType: 1, triggerType: 1 });

module.exports = mongoose.model('ReminderConfig', reminderConfigSchema);
