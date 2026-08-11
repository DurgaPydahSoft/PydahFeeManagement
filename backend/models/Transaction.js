const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
  studentId: {
    type: String, // Admission Number (from SQL)
    required: true,
  },
  studentName: {
    type: String, // Snapshot of name
  },
  college: {
    type: String, // Snapshot of college
  },
  collegeId: {
    type: Number, // SQL college_id
  },
  course: {
    type: String, // Snapshot of course
  },
  courseId: {
    type: Number, // SQL course_id
  },
  branch: {
    type: String, // Snapshot of branch
  },
  branchId: {
    type: Number, // SQL branch_id
  },
  pinNo: {
    type: String, // Snapshot of PIN number
  },
  admissionNumber: {
    type: String, // Snapshot of admission number
  },
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  transactionType: {
    type: String,
    enum: ['DEBIT', 'CREDIT'],
    default: 'DEBIT',
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI', 'Cheque', 'DD', 'Card', 'Net Banking', 'Adjustment', 'Waiver', 'Refund', 'Credit', 'RTF'],
    default: 'Cash',
  },
  bankName: {
    type: String, // For Cheque or DD
  },
  instrumentDate: {
    type: Date, // For Cheque/DD Date
  },
  referenceNo: {
    type: String, // Bank RRN (Retrieval Reference Number) or Txn ID from Bank
  },
  referenceDate: {
    type: Date, // Date the transfer was actually made by the student/parent
  },
  gatewayPaymentId: {
    type: String, // Razorpay Payment ID or Gateway Reference
    unique: true,
    sparse: true
  },
  remarks: {
    type: String,
  },
  semester: {
    type: String, // e.g., "1", "2"
  },
  studentYear: {
    type: String, // e.g., "1", "2", "3", "4"
  },
  receiptNumber: {
    type: String,
    // unique: true, // Removed to allow multiple transactions to share the same receipt number
  },
  collectedBy: {
    type: String, // Username (e.g., 'admin')
  },
  collectedByName: {
    type: String, // Full Name (e.g., 'Administrator')
  },
  paymentConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentConfig'
  },
  depositedToAccount: {
    type: String // Snapshot of account name
  },
  proceedingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proceeding'
  },
  concessionRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConcessionRequest'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active',
  },
  cancelledBy: {
    type: String, // Username of whoever cancelled
  },
  cancelledByName: {
    type: String, // Full name of whoever cancelled
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes for query performance optimization
transactionSchema.index({ studentId: 1 });
transactionSchema.index({ paymentDate: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ college: 1 });
transactionSchema.index({ collegeId: 1 });

// Middleware to cache core student metadata on save (single document)
transactionSchema.pre('save', async function (next) {
  if (this.studentId && (!this.college || !this.course || !this.branch || !this.pinNo || !this.admissionNumber || !this.studentName || !this.studentYear || !this.collegeId || !this.courseId || !this.branchId)) {
    try {
      const db = require('../config/sqlDb');
      const [studentRows] = await db.query(
        'SELECT student_name, college, course, branch, pin_no, admission_number, current_year, college_id, course_id, branch_id FROM students WHERE admission_number = ? OR pin_no = ?',
        [this.studentId, this.studentId]
      );
      if (studentRows && studentRows.length > 0) {
        const s = studentRows[0];
        if (!this.studentName && s.student_name) this.studentName = s.student_name;
        if (!this.college && s.college) this.college = s.college;
        if (!this.course && s.course) this.course = s.course;
        if (!this.branch && s.branch) this.branch = s.branch;
        if (!this.pinNo && s.pin_no) this.pinNo = s.pin_no;
        if (!this.admissionNumber && s.admission_number) this.admissionNumber = s.admission_number;
        if (!this.studentYear && s.current_year) this.studentYear = String(s.current_year);
        if (!this.collegeId && s.college_id) this.collegeId = s.college_id;
        if (!this.courseId && s.course_id) this.courseId = s.course_id;
        if (!this.branchId && s.branch_id) this.branchId = s.branch_id;
      }
    } catch (err) {
      console.error('[Transaction Pre-Save Metadata Cache Failed]', err);
    }
  }
  next();
});

// Middleware to cache core student metadata on insertMany (bulk docs)
transactionSchema.pre('insertMany', async function (next, docs) {
  if (!docs || docs.length === 0) return next();
  try {
    const db = require('../config/sqlDb');
    const studentIds = [...new Set(docs.map(d => d.studentId).filter(Boolean))];
    if (studentIds.length > 0) {
      const idPlaceholders = studentIds.map(() => '?').join(',');
      const [studentRows] = await db.query(
        `SELECT admission_number, pin_no, student_name, college, course, branch, current_year, college_id, course_id, branch_id FROM students WHERE admission_number IN (${idPlaceholders}) OR pin_no IN (${idPlaceholders})`,
        [...studentIds, ...studentIds]
      );
      
      const studentMap = {};
      studentRows.forEach(s => {
        const data = {
          studentName: s.student_name,
          college: s.college,
          course: s.course,
          branch: s.branch,
          pinNo: s.pin_no,
          admissionNumber: s.admission_number,
          studentYear: String(s.current_year),
          collegeId: s.college_id,
          courseId: s.course_id,
          branchId: s.branch_id
        };
        if (s.admission_number) {
          studentMap[s.admission_number.trim().toLowerCase()] = data;
        }
        if (s.pin_no) {
          studentMap[s.pin_no.trim().toLowerCase()] = data;
        }
      });

      docs.forEach(doc => {
        if (doc.studentId) {
          const key = doc.studentId.trim().toLowerCase();
          const s = studentMap[key];
          if (s) {
            if (!doc.studentName && s.studentName) doc.studentName = s.studentName;
            if (!doc.college && s.college) doc.college = s.college;
            if (!doc.course && s.course) doc.course = s.course;
            if (!doc.branch && s.branch) doc.branch = s.branch;
            if (!doc.pinNo && s.pinNo) doc.pinNo = s.pinNo;
            if (!doc.admissionNumber && s.admissionNumber) doc.admissionNumber = s.admissionNumber;
            if (!doc.studentYear && s.studentYear) doc.studentYear = s.studentYear;
            if (!doc.collegeId && s.collegeId) doc.collegeId = s.collegeId;
            if (!doc.courseId && s.courseId) doc.courseId = s.courseId;
            if (!doc.branchId && s.branchId) doc.branchId = s.branchId;
          }
        }
      });
    }
  } catch (err) {
    console.error('[Transaction Pre-InsertMany Metadata Cache Failed]', err);
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
