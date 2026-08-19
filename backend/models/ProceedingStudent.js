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
    studentYear: { type: String, default: '' }
}, {
    timestamps: true
});

proceedingStudentSchema.index({ proceedingId: 1 });
proceedingStudentSchema.index({ proceedingId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ProceedingStudent', proceedingStudentSchema);
