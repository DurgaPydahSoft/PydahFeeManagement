const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Proceeding = require('../models/Proceeding');
const FeeGroup = require('../models/FeeGroup');
const Setting = require('../models/Setting');
const ReceiptSequence = require('../models/ReceiptSequence');
const db = require('../config/sqlDb');
const collegeScope = require('../utils/collegeScope');
const { validateProceedingPayment, syncProceedingStudentTxnStatus, syncProceedingCompletionStatus } = require('../utils/proceedingDemand');


const getCollectorFromRequest = (req) => ({
  collectedBy: req.user?.username || 'Unknown',
  collectedByName: req.user?.name || 'Unknown',
});

const canEditTransactionDate = (user) => {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const permissions = user.permissions || [];
  return permissions.includes('fee_collection_edit');
};

/**
 * Resolve collection/payment date for a new transaction.
 * Only users with fee_collection_edit (or admin) may backdate; others always get now.
 * Sets both paymentDate and createdAt so daily reports (filtered by createdAt) respect the date.
 */
const resolveCollectionTimestamps = (req, paymentDateInput) => {
  const now = new Date();
  if (!paymentDateInput || !canEditTransactionDate(req.user)) {
    return { paymentDate: now, createdAt: now, updatedAt: now };
  }

  const raw = String(paymentDateInput).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return { paymentDate: now, createdAt: now, updatedAt: now };
  }

  // Create Date at 12:00:00 PM IST (+05:30) for exact IST day alignment across all server timezones
  const chosen = new Date(`${raw}T12:00:00+05:30`);
  if (Number.isNaN(chosen.getTime())) {
    return { paymentDate: now, createdAt: now, updatedAt: now };
  }
  return { paymentDate: chosen, createdAt: chosen, updatedAt: chosen };
};

const sanitizeField = (val) => {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null') return undefined;
  return s;
};

const resolveStudentMaster = async (sId, payload = {}) => {
  let college = sanitizeField(payload.college);
  let collegeId = payload.collegeId;
  let course = sanitizeField(payload.course);
  let courseId = payload.courseId;
  let branch = sanitizeField(payload.branch);
  let branchId = payload.branchId;
  let pinNo = sanitizeField(payload.pinNo);
  let studentYear = sanitizeField(payload.studentYear);
  let studentName = sanitizeField(payload.studentName);

  if (sId && (!college || !course || !branch || !pinNo || !studentYear || !studentName || !collegeId || !courseId || !branchId)) {
    try {
      const [rows] = await db.query(
        'SELECT student_name, college, course, branch, pin_no, current_year, college_id, course_id, branch_id FROM students WHERE admission_number = ? OR pin_no = ?',
        [sId, sId]
      );
      if (rows && rows.length > 0) {
        const s = rows[0];
        if (!college && s.college) college = s.college;
        if (!course && s.course) course = s.course;
        if (!branch && s.branch) branch = s.branch;
        if (!pinNo && s.pin_no) pinNo = s.pin_no;
        if (!studentYear && s.current_year) studentYear = s.current_year;
        if (!collegeId && s.college_id) collegeId = s.college_id;
        if (!courseId && s.course_id) courseId = s.course_id;
        if (!branchId && s.branch_id) branchId = s.branch_id;
        if (!studentName && s.student_name) studentName = s.student_name;
      }
    } catch (e) {
      console.error('Error resolving student master info:', e);
    }
  }

  return { college, collegeId, course, courseId, branch, branchId, pinNo, studentYear, studentName };
};

// Helper to determine the current financial year (e.g. 2026-27)
const calculateFinancialYear = (date, resetMonth = 4, resetDay = 1) => {
  const currentYear = date.getFullYear();
  const resetDateThisYear = new Date(currentYear, resetMonth - 1, resetDay);
  if (date >= resetDateThisYear) {
    const nextYearLastTwoDigits = String(currentYear + 1).slice(-2);
    return `${currentYear}-${nextYearLastTwoDigits}`;
  } else {
    const currentYearLastTwoDigits = String(currentYear).slice(-2);
    return `${currentYear - 1}-${currentYearLastTwoDigits}`;
  }
};

// @desc    Add a Payment Transaction (Single or Batch)
// @route   POST /api/transactions
const addTransaction = async (req, res) => {
  try {
    // Sanitize ObjectId fields to handle empty strings from frontend
    const sanitizeObjectId = (val) => (val && val.trim() !== '' ? val : undefined);

    // Load custom sequence configuration settings
    const setting = await Setting.findOne();
    const enableCustom = setting ? setting.enableCustomReceiptSequence : false;
    const separator = setting ? setting.receiptSequenceSeparator : '/';
    const padding = setting ? setting.receiptSequencePadding : 5;
    const resetMonth = setting ? (setting.receiptSequenceResetMonth || 4) : 4;
    const resetDay = setting ? (setting.receiptSequenceResetDay || 1) : 1;
    const financialYear = calculateFinancialYear(new Date(), resetMonth, resetDay);

    // Fetch student's college and course code from SQL database
    const studentId = req.body.transactions && req.body.transactions.length > 0
      ? req.body.transactions[0].studentId
      : req.body.studentId;

    let collegeCode = 'GEN';
    let courseCode = 'GEN';

    if (studentId) {
      const [studentRows] = await db.query(
        'SELECT college, course FROM students WHERE admission_number = ?',
        [studentId]
      );
      if (studentRows && studentRows.length > 0) {
        const studentCollege = studentRows[0].college;
        const studentCourse = studentRows[0].course;

        if (studentCollege) {
          const [collegeRows] = await db.query(
            'SELECT id, code FROM colleges WHERE name = ?',
            [studentCollege]
          );
          let collegeId = null;
          if (collegeRows && collegeRows.length > 0) {
            collegeCode = (collegeRows[0].code || 'GEN').toUpperCase().trim();
            collegeId = collegeRows[0].id;
          } else {
            collegeCode = studentCollege.toUpperCase().trim();
          }

          if (studentCourse) {
            let courseRows = [];
            if (collegeId) {
              [courseRows] = await db.query(
                'SELECT code FROM courses WHERE name = ? AND college_id = ?',
                [studentCourse, collegeId]
              );
            }
            if (courseRows.length === 0) {
              [courseRows] = await db.query(
                'SELECT code FROM courses WHERE name = ?',
                [studentCourse]
              );
            }
            if (courseRows && courseRows.length > 0 && courseRows[0].code) {
              courseCode = courseRows[0].code.toUpperCase().trim();
            } else {
              courseCode = studentCourse.toUpperCase().trim();
            }
          }
        } else {
          if (studentCourse) {
            const [courseRows] = await db.query(
              'SELECT code FROM courses WHERE name = ?',
              [studentCourse]
            );
            if (courseRows && courseRows.length > 0 && courseRows[0].code) {
              courseCode = courseRows[0].code.toUpperCase().trim();
            } else {
              courseCode = studentCourse.toUpperCase().trim();
            }
          }
        }
      }
    }

    // Helper to generate a receipt number
    const generateReceiptNumber = async (feeHeadId) => {
      if (enableCustom) {
        let groupCode = 'GEN';
        if (feeHeadId) {
          const feeGroup = await FeeGroup.findOne({ feeHeads: feeHeadId });
          if (feeGroup && feeGroup.code) {
            groupCode = feeGroup.code.toUpperCase().trim();
          }
        }
        // Retry loop handles the rare upsert race condition (E11000) by falling
        // back to a plain increment on the now-existing document.
        let seq;
        try {
          seq = await ReceiptSequence.findOneAndUpdate(
            { collegeCode, courseCode, groupCode, financialYear },
            { $inc: { nextNumber: 1 } },
            { new: true, upsert: true }
          );
        } catch (err) {
          if (err.code === 11000) {
            // Document was inserted by a concurrent request — just increment it
            seq = await ReceiptSequence.findOneAndUpdate(
              { collegeCode, courseCode, groupCode, financialYear },
              { $inc: { nextNumber: 1 } },
              { new: true }
            );
          } else {
            throw err;
          }
        }
        const sequenceNumber = seq.nextNumber;
        const paddedNum = String(sequenceNumber).padStart(padding, '0');
        return `${collegeCode}${separator}${courseCode}${separator}${groupCode}${separator}${paddedNum}`;
      } else {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(100 + Math.random() * 900).toString();
        return `REC${timestamp}${random}`;
      }
    };

    // CHECK IF BATCH (req.body.transactions array exists)
    if (req.body.transactions && Array.isArray(req.body.transactions)) {
       const collector = getCollectorFromRequest(req);
       
       // Proceeding validation for batch items (per student + share cap)
       for (const item of req.body.transactions) {
         if (!item.proceedingId) continue;
         const check = await validateProceedingPayment({
           proceedingId: item.proceedingId,
           studentId: item.studentId || studentId,
           amount: item.amount,
           feeHeadId: item.feeHeadId,
           studentYear: item.studentYear
         });
         if (!check.ok) {
           return res.status(check.status).json({ message: check.message });
         }
       }

       // Proceeding pool balance (aggregate per proceeding)
       const proceedingAmountsMap = {};
       for (const item of req.body.transactions) {
         if (item.proceedingId) {
           const pId = String(item.proceedingId);
           proceedingAmountsMap[pId] = (proceedingAmountsMap[pId] || 0) + (Number(item.amount) || 0);
         }
       }
       for (const [pId, requestedAmount] of Object.entries(proceedingAmountsMap)) {
         const proc = await Proceeding.findById(pId);
         if (!proc) {
           return res.status(404).json({ message: 'Selected proceeding not found' });
         }
         if (proc.status !== 'Active') {
           return res.status(400).json({
             message: `Proceeding '${proc.proceedingNumber}' is ${proc.status || 'not Active'} and cannot be used for collection until approved.`
           });
         }
         const existingTxns = await Transaction.find({ proceedingId: pId, status: { $ne: 'cancelled' } }).select('amount');
         const totalUsed = existingTxns.reduce((acc, t) => acc + t.amount, 0);
         const remaining = proc.amount - totalUsed;
         if (requestedAmount > remaining) {
           const avail = remaining < 0 ? 0 : remaining;
           return res.status(400).json({
             message: `Proceeding '${proc.proceedingNumber}' amount limit exceeded. Remaining balance is ₹${avail.toLocaleString('en-IN')}, but attempting to collect ₹${requestedAmount.toLocaleString('en-IN')}.`
           });
         }
       }

       // Group transaction items by their fee head group code (or 'GEN' if ungrouped)
       const groupedItems = {};
       for (const item of req.body.transactions) {
         const feeHeadId = sanitizeObjectId(item.feeHeadId);
         let groupCode = 'GEN';
         if (feeHeadId) {
           const feeGroup = await FeeGroup.findOne({ feeHeads: feeHeadId });
           if (feeGroup && feeGroup.code) {
             groupCode = feeGroup.code.toUpperCase().trim();
           }
         }
         if (!groupedItems[groupCode]) {
           groupedItems[groupCode] = [];
         }
         groupedItems[groupCode].push(item);
       }

       const batch = [];
       for (const [groupCode, items] of Object.entries(groupedItems)) {
         // Generate a shared receipt number for this group subset
         const firstFeeHeadId = sanitizeObjectId(items[0].feeHeadId);
         const receiptNumber = await generateReceiptNumber(firstFeeHeadId);

         for (const item of items) {
           const timestamps = resolveCollectionTimestamps(req, item.paymentDate);
           batch.push({
             ...item,
             feeHead: sanitizeObjectId(item.feeHeadId),
             paymentConfigId: sanitizeObjectId(item.paymentConfigId),
             proceedingId: sanitizeObjectId(item.proceedingId),
             concessionRequestId: sanitizeObjectId(item.concessionRequestId),
             receiptNumber, // Shared per group code
             paymentMode: item.transactionType === 'CREDIT' && !item.paymentMode ? 'Waiver' : (item.paymentMode || 'Cash'),
             transactionType: item.transactionType || 'DEBIT',
             remarks: item.remarks,
             referenceDate: item.referenceDate,
             paymentDate: timestamps.paymentDate,
             createdAt: timestamps.createdAt,
             updatedAt: timestamps.updatedAt,
             collectedBy: collector.collectedBy,
             collectedByName: collector.collectedByName,
           });
         }
       }
       
       const createdTransactions = await Transaction.insertMany(batch, { timestamps: false });

       // Sync proceeding student pending flags + completion status
       const proceedingIdsToSync = new Set();
       for (const item of req.body.transactions) {
         if (item.proceedingId && (item.studentId || studentId)) {
           await syncProceedingStudentTxnStatus(item.proceedingId, item.studentId || studentId);
           proceedingIdsToSync.add(String(item.proceedingId));
         }
       }
       for (const pId of proceedingIdsToSync) {
         await syncProceedingCompletionStatus(pId);
       }

       // Populate feeHead for proper display in response
       const populatedTransactions = await Transaction.find({ _id: { $in: createdTransactions.map(t => t._id) } }).populate('feeHead', 'name');
       
       const primary = populatedTransactions[0].toObject();
       primary.relatedTransactions = populatedTransactions; 
       return res.status(201).json(primary);
    }

    // SINGLE TRANSACTION (Backward Compatibility)
    const { studentName, feeHeadId, amount, paymentMode, remarks, semester, studentYear, transactionType, paymentConfigId, depositedToAccount, referenceDate, proceedingId, concessionRequestId, paymentDate } = req.body;
    const { collectedBy, collectedByName } = getCollectorFromRequest(req);

    // Validation
    if (!studentId || !amount || (transactionType !== 'CREDIT' && !feeHeadId)) {
      return res.status(400).json({ message: 'Please provide all required transaction details' });
    }

    if (proceedingId) {
      const check = await validateProceedingPayment({
        proceedingId,
        studentId,
        amount,
        feeHeadId,
        studentYear
      });
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }
    }

    // Default to 'Waiver' if it's a CREDIT (Concession) and no mode provided
    let finalPaymentMode = paymentMode;
    if (transactionType === 'CREDIT' && !finalPaymentMode) {
      finalPaymentMode = 'Waiver';
    }

    const receiptNumber = await generateReceiptNumber(sanitizeObjectId(feeHeadId));
    const timestamps = resolveCollectionTimestamps(req, paymentDate);
    const master = await resolveStudentMaster(studentId, req.body);

    const transactionDoc = new Transaction({
      studentId,
      studentName: master.studentName || studentName,
      college: master.college,
      collegeId: master.collegeId,
      course: master.course,
      courseId: master.courseId,
      branch: master.branch,
      branchId: master.branchId,
      pinNo: master.pinNo,
      studentYear: master.studentYear || studentYear,
      feeHead: sanitizeObjectId(feeHeadId),
      amount,
      paymentMode: finalPaymentMode || 'Cash',
      transactionType: transactionType || 'DEBIT',
      remarks,
      semester,
      receiptNumber,
      collectedBy,
      collectedByName,
      bankName: req.body.bankName,
      instrumentDate: req.body.instrumentDate,
      referenceNo: req.body.referenceNo,
      referenceDate: referenceDate || null,
      paymentConfigId: sanitizeObjectId(paymentConfigId),
      depositedToAccount: req.body.depositedToAccount,
      proceedingId: sanitizeObjectId(proceedingId),
      concessionRequestId: sanitizeObjectId(concessionRequestId),
      paymentDate: timestamps.paymentDate,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt
    });
    const transaction = await transactionDoc.save({ timestamps: false });

    if (proceedingId) {
      await syncProceedingStudentTxnStatus(proceedingId, studentId);
      await syncProceedingCompletionStatus(proceedingId);
    }

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Helper to map cashier username/name from Mongo User ID if stored as ObjectId string
const mapTransactionCashiers = async (transactions) => {
  if (!transactions || transactions.length === 0) return transactions;
  
  try {
    const User = require('../models/User');
    const users = await User.find({}).lean();
    const userIdMap = {};
    const userIdNameMap = {};
    const nameToUsernameMap = {};
    
    users.forEach(u => {
      const uidStr = String(u._id);
      const username = u.username;
      const name = u.name;
      
      if (username) {
        userIdMap[uidStr] = username;
        if (u.sessionId) userIdMap[String(u.sessionId)] = username;
      }
      if (name) {
        userIdNameMap[uidStr] = name;
        if (u.sessionId) userIdNameMap[String(u.sessionId)] = name;
        const norm = name.replace(/\s+/g, ' ').toLowerCase().trim();
        if (username) nameToUsernameMap[norm] = username;
      }
    });

    const list = Array.isArray(transactions) ? transactions : [transactions];
    list.forEach(tx => {
      const cbStr = String(tx.collectedBy || '').trim();
      
      if (userIdMap[cbStr]) {
        tx.collectedBy = userIdMap[cbStr];
        if (userIdNameMap[cbStr]) {
          tx.collectedByName = userIdNameMap[cbStr];
        }
      }
      if (tx.collectedByName) {
        const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
        const resolvedUsername = nameToUsernameMap[normName];
        if (resolvedUsername) {
          tx.collectedBy = resolvedUsername;
        }
      }
    });
  } catch (err) {
    console.error('[mapTransactionCashiers Error]', err);
  }
  return transactions;
};

// @desc    Get Transactions by Student
// @route   GET /api/transactions/student/:admissionNo
const getStudentTransactions = async (req, res) => {
  try {
    const admissionNo = req.params.admissionNo;
    
    // Resolve student's other ID (PIN Number or Admission No) from SQL
    let ids = [admissionNo];
    try {
      const [studentRows] = await db.query(
        'SELECT admission_number, pin_no FROM students WHERE admission_number = ? OR pin_no = ?',
        [admissionNo, admissionNo]
      );
      if (studentRows && studentRows.length > 0) {
        const s = studentRows[0];
        if (s.admission_number) ids.push(s.admission_number);
        if (s.pin_no) ids.push(s.pin_no);
      }
    } catch (sqlErr) {
      console.error('[getStudentTransactions SQL Lookup Error]', sqlErr);
    }
    
    // Normalize IDs and make them unique
    const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))];
    // Create case-insensitive variants
    const idVariants = new Set();
    uniqueIds.forEach(id => {
      idVariants.add(id);
      idVariants.add(id.toLowerCase());
      idVariants.add(id.toUpperCase());
    });
    const finalIds = Array.from(idVariants);

    const transactions = await Transaction.find({
      $or: [
        { studentId: { $in: finalIds } },
        { pinNo: { $in: finalIds } },
        { admissionNumber: { $in: finalIds } }
      ]
    })
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 })
      .lean();

    await mapTransactionCashiers(transactions);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching student transactions:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const previewSequence = async (req, res) => {
  try {
    const { studentId, feeHeadIds } = req.body;
    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    const setting = await Setting.findOne();
    const enableCustom = setting ? setting.enableCustomReceiptSequence : false;
    const separator = setting ? setting.receiptSequenceSeparator : '/';
    const padding = setting ? setting.receiptSequencePadding : 5;
    const resetMonth = setting ? (setting.receiptSequenceResetMonth || 4) : 4;
    const resetDay = setting ? (setting.receiptSequenceResetDay || 1) : 1;
    const financialYear = calculateFinancialYear(new Date(), resetMonth, resetDay);

    if (!enableCustom) {
      return res.json({ enableCustom: false });
    }

    let collegeCode = 'GEN';
    let courseCode = 'GEN';

    const [studentRows] = await db.query(
      'SELECT college, course FROM students WHERE admission_number = ?',
      [studentId]
    );
    if (studentRows && studentRows.length > 0) {
      const studentCollege = studentRows[0].college;
      const studentCourse = studentRows[0].course;

      if (studentCollege) {
        const [collegeRows] = await db.query(
          'SELECT id, code FROM colleges WHERE name = ?',
          [studentCollege]
        );
        let collegeId = null;
        if (collegeRows && collegeRows.length > 0) {
          collegeCode = (collegeRows[0].code || 'GEN').toUpperCase().trim();
          collegeId = collegeRows[0].id;
        } else {
          collegeCode = studentCollege.toUpperCase().trim();
        }

        if (studentCourse) {
          let courseRows = [];
          if (collegeId) {
            [courseRows] = await db.query(
              'SELECT code FROM courses WHERE name = ? AND college_id = ?',
              [studentCourse, collegeId]
            );
          }
          if (courseRows.length === 0) {
            [courseRows] = await db.query(
              'SELECT code FROM courses WHERE name = ?',
              [studentCourse]
            );
          }
          if (courseRows && courseRows.length > 0 && courseRows[0].code) {
            courseCode = courseRows[0].code.toUpperCase().trim();
          } else {
            courseCode = studentCourse.toUpperCase().trim();
          }
        }
      } else {
        if (studentCourse) {
          const [courseRows] = await db.query(
            'SELECT code FROM courses WHERE name = ?',
            [studentCourse]
          );
          if (courseRows && courseRows.length > 0 && courseRows[0].code) {
            courseCode = courseRows[0].code.toUpperCase().trim();
          } else {
            courseCode = studentCourse.toUpperCase().trim();
          }
        }
      }
    }

    const previewSequences = [];
    const distinctGroupCodes = new Set();
    const resolvedHeads = [];

    if (feeHeadIds && Array.isArray(feeHeadIds) && feeHeadIds.length > 0) {
      for (const fhId of feeHeadIds) {
        let groupCode = 'GEN';
        let groupName = 'General';
        if (fhId) {
          const feeGroup = await FeeGroup.findOne({ feeHeads: fhId });
          if (feeGroup && feeGroup.code) {
            groupCode = feeGroup.code.toUpperCase().trim();
            groupName = feeGroup.name;
          }
        }
        resolvedHeads.push({ id: fhId, groupCode, groupName });
        distinctGroupCodes.add(groupCode);
      }
    } else {
      distinctGroupCodes.add('GEN');
    }

    for (const groupCode of distinctGroupCodes) {
      const seq = await ReceiptSequence.findOne({ collegeCode, courseCode, groupCode, financialYear });
      const nextNum = seq ? seq.nextNumber + 1 : 1;
      const paddedNum = String(nextNum).padStart(padding, '0');
      const previewText = `${collegeCode}${separator}${courseCode}${separator}${groupCode}${separator}${paddedNum}`;

      const headsInGroup = resolvedHeads.filter(h => h.groupCode === groupCode);

      previewSequences.push({
        groupCode,
        groupName: headsInGroup[0]?.groupName || 'General',
        nextReceiptNo: previewText
      });
    }

    return res.json({
      enableCustom: true,
      previewSequences
    });
  } catch (error) {
    console.error("Error previewing sequence:", error);
    return res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update Transaction Payment Mode
// @route   PUT /api/transactions/:id
const updateTransactionPaymentMode = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      paymentMode,
      bankName,
      instrumentDate,
      referenceNo,
      referenceDate,
      paymentConfigId,
      depositedToAccount,
      remarks,
      proceedingId
    } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // 30-hour edit window check (superadmin bypasses)
    if (req.user?.role !== 'superadmin') {
      const createdAt = new Date(transaction.createdAt);
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      const EDIT_WINDOW_HOURS = 30;
      if (hoursSinceCreation > EDIT_WINDOW_HOURS) {
        const hoursAgo = Math.floor(hoursSinceCreation);
        return res.status(403).json({
          message: `Edit window expired. This transaction was created ${hoursAgo} hours ago and can only be edited within ${EDIT_WINDOW_HOURS} hours of creation. Please cancel this transaction and create a new one instead.`,
          code: 'EDIT_WINDOW_EXPIRED'
        });
      }
    }

    // Update ONLY payment mode related fields and remarks
    transaction.paymentMode = paymentMode !== undefined ? paymentMode : transaction.paymentMode;
    transaction.bankName = bankName !== undefined ? bankName : transaction.bankName;
    transaction.instrumentDate = instrumentDate !== undefined ? instrumentDate : transaction.instrumentDate;
    transaction.referenceNo = referenceNo !== undefined ? referenceNo : transaction.referenceNo;
    transaction.referenceDate = referenceDate !== undefined ? referenceDate : transaction.referenceDate;
    transaction.depositedToAccount = depositedToAccount !== undefined ? depositedToAccount : transaction.depositedToAccount;
    transaction.remarks = remarks !== undefined ? remarks : transaction.remarks;

    if (paymentConfigId !== undefined) {
      transaction.paymentConfigId = (paymentConfigId === '' || !paymentConfigId) ? null : paymentConfigId;
    }
    if (proceedingId !== undefined) {
      const targetProcId = (proceedingId === '' || !proceedingId) ? null : proceedingId;
      const prevProcId = transaction.proceedingId ? String(transaction.proceedingId) : null;
      if (targetProcId) {
        const check = await validateProceedingPayment({
          proceedingId: targetProcId,
          studentId: transaction.studentId,
          amount: transaction.amount,
          excludeTxnId: transaction._id,
          feeHeadId: transaction.feeHead,
          studentYear: transaction.studentYear
        });
        if (!check.ok) {
          return res.status(check.status).json({ message: check.message });
        }
      }
      transaction.proceedingId = targetProcId;
      await transaction.save({ timestamps: false });
      if (targetProcId) await syncProceedingStudentTxnStatus(targetProcId, transaction.studentId);
      if (prevProcId && prevProcId !== String(targetProcId || '')) {
        await syncProceedingStudentTxnStatus(prevProcId, transaction.studentId);
      }
      if (targetProcId) await syncProceedingCompletionStatus(targetProcId);
      if (prevProcId && prevProcId !== String(targetProcId || '')) {
        await syncProceedingCompletionStatus(prevProcId);
      }
    }

    if (req.body.paymentDate !== undefined && canEditTransactionDate(req.user)) {
      const timestamps = resolveCollectionTimestamps(req, req.body.paymentDate);
      transaction.paymentDate = timestamps.paymentDate;
      transaction.set('createdAt', timestamps.createdAt);
      await transaction.save({ timestamps: false });
      const populated = await Transaction.findById(transaction._id).populate('feeHead', 'name');
      return res.json(populated);
    }

    const updatedTransaction = await transaction.save();
    
    // Populate feeHead for returning to frontend
    const populated = await Transaction.findById(updatedTransaction._id).populate('feeHead', 'name');
    
    res.json(populated);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Error updating transaction details' });
  }
};

// @desc    Get recent transactions (for initial load, respecting role/college/course filters)
// @route   GET /api/transactions/recent
const getRecentTransactions = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'superadmin';
    const isCashier = req.user?.role === 'cashier';
    const username = req.user?.username;

    // Base query filter — exclude cancelled transactions from recent list
    const query = { status: { $ne: 'cancelled' } };

    // 1. Cashier Privacy: Cashier can only see their own collections
    if (isCashier) {
      query.collectedBy = username;
    }

    // 2. College & Course permissions for non-SuperAdmins
    if (!isSuperAdmin) {
      const userColleges = await collegeScope.getUserCollegeNames(req.user);
      const userCourses = req.user?.courses || [];

      if ((userColleges && userColleges.length > 0) || userCourses.length > 0) {
        let sqlQuery = 'SELECT admission_number FROM students WHERE 1=1';
        const params = [];
        
        if (userColleges && userColleges.length > 0) {
          sqlQuery += ` AND college IN (${userColleges.map(() => '?').join(',')})`;
          params.push(...userColleges);
        }
        
        if (userCourses.length > 0) {
          const courseNames = [...new Set(userCourses.map(c => c.split('|')[1]))];
          sqlQuery += ' AND course IN (?)';
          params.push(courseNames);
        }
        
        const [studentRows] = await db.query(sqlQuery, params);
        if (studentRows && studentRows.length > 0) {
          const allowedStudentIds = studentRows.map(row => String(row.admission_number).trim());
          query.studentId = { $in: allowedStudentIds };
        } else {
          return res.json([]);
        }
      }
    }

    // Fetch the 10 most recent transactions
    const recentTxs = await Transaction.find(query)
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    await mapTransactionCashiers(recentTxs);
    res.json(recentTxs);
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ message: 'Error fetching recent transactions' });
  }
};

// @desc    Delete a Transaction by ID (only when receipt sequence is disabled)
// @route   DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Error deleting transaction' });
  }
};

// @desc    Cancel a Transaction by ID (used when receipt sequence is enabled — preserves record)
// @route   PUT /api/transactions/:id/cancel
const cancelTransaction = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    if (transaction.status === 'cancelled') {
      return res.status(400).json({ message: 'Transaction is already cancelled' });
    }

    transaction.status = 'cancelled';
    transaction.cancelledBy = req.user?.username || 'Unknown';
    transaction.cancelledByName = req.user?.name || 'Unknown';
    transaction.cancelledAt = new Date();
    if (cancellationReason) {
      transaction.cancellationReason = cancellationReason;
    }
    await transaction.save();

    if (transaction.proceedingId) {
      await syncProceedingStudentTxnStatus(transaction.proceedingId, transaction.studentId);
      await syncProceedingCompletionStatus(transaction.proceedingId);
    }

    res.json({ message: 'Transaction cancelled successfully', transaction });
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    res.status(500).json({ message: 'Error cancelling transaction' });
  }
};

// @desc    Get transactions by specific date (for Transaction Date Modification page)
// @route   GET /api/transactions/by-date
const getTransactionsByDate = async (req, res) => {
  try {
    const { date, collector } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter (date=YYYY-MM-DD) is required' });
    }

    const { buildCollectionDateMatch } = require('../utils/reportDateFilter');
    const dateQuery = buildCollectionDateMatch(date, date);

    const andConditions = [
      { status: { $ne: 'cancelled' } },
      { remarks: { $ne: 'Concession as per declaration' } },
      dateQuery
    ];

    if (collector && collector !== 'ALL') {
      const User = require('../models/User');
      const isObjectId = mongoose.Types.ObjectId.isValid(collector);
      const matchedUser = await User.findOne({
        $or: [
          { username: collector },
          ...(isObjectId ? [{ _id: collector }] : [])
        ]
      }).lean();

      const collectorIdentifiers = [collector];
      let collectorName = null;

      if (matchedUser) {
        if (matchedUser.username) collectorIdentifiers.push(matchedUser.username);
        collectorIdentifiers.push(String(matchedUser._id));
        if (matchedUser.sessionId) collectorIdentifiers.push(String(matchedUser.sessionId));
        if (matchedUser.name) collectorName = matchedUser.name;
      }

      const uniqueIdentifiers = [...new Set(collectorIdentifiers)];
      const collectorMatchConditions = [{ collectedBy: { $in: uniqueIdentifiers } }];
      if (collectorName) {
        collectorMatchConditions.push({ collectedByName: collectorName });
      }
      andConditions.push({ $or: collectorMatchConditions });
    }

    // Role-based scope filtering for non-superadmin
    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin) {
      const userColleges = await collegeScope.getUserCollegeNames(req.user);
      if (userColleges && userColleges.length > 0) {
        const [studentRows] = await db.query(
          `SELECT admission_number FROM students WHERE college IN (${userColleges.map(() => '?').join(',')})`,
          userColleges
        );
        if (studentRows && studentRows.length > 0) {
          const allowedStudentIds = studentRows.map(row => String(row.admission_number).trim());
          andConditions.push({ studentId: { $in: allowedStudentIds } });
        } else {
          return res.json({
            transactions: [],
            collectors: [],
            courseSummary: {},
            modeSummary: {},
            totalAmount: 0,
            totalCount: 0
          });
        }
      }
    }

    const query = { $and: andConditions };

    const transactions = await Transaction.find(query)
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 })
      .lean();

    await mapTransactionCashiers(transactions);

    // Fetch all distinct collectors for date filter dropdown and normalize by Emp No
    const allDateTxs = await Transaction.find({
      $and: [
        { status: { $ne: 'cancelled' } },
        { remarks: { $ne: 'Concession as per declaration' } },
        dateQuery
      ]
    }).select('collectedBy collectedByName').lean();

    await mapTransactionCashiers(allDateTxs);


    const collectorsMap = {};
    allDateTxs.forEach(t => {
      if (t.collectedBy) {
        collectorsMap[t.collectedBy] = t.collectedByName || t.collectedBy;
      }
    });
    const collectorsList = Object.entries(collectorsMap).map(([username, name]) => ({
      username,
      name
    }));

    // Calculate summaries
    const courseSummary = {};
    const modeSummary = {};
    let totalAmount = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      totalAmount += amt;

      const courseName = t.course || 'Unspecified Course';
      if (!courseSummary[courseName]) {
        courseSummary[courseName] = { count: 0, totalAmount: 0 };
      }
      courseSummary[courseName].count += 1;
      courseSummary[courseName].totalAmount += amt;

      const mode = t.paymentMode || 'Cash';
      if (!modeSummary[mode]) {
        modeSummary[mode] = { count: 0, totalAmount: 0 };
      }
      modeSummary[mode].count += 1;
      modeSummary[mode].totalAmount += amt;
    });

    res.json({
      transactions,
      collectors: collectorsList,
      courseSummary,
      modeSummary,
      totalAmount,
      totalCount: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions by date:', error);
    res.status(500).json({ message: 'Error fetching transactions by date', error: error.message });
  }
};

// @desc    Bulk update transaction dates
// @route   PUT /api/transactions/bulk-date-update
const bulkUpdateTransactionDates = async (req, res) => {
  try {
    const isAuthorized = req.user?.role === 'superadmin' ||
      req.user?.role === 'admin' ||
      (req.user?.permissions && (req.user.permissions.includes('fee_collection_edit') || req.user.permissions.includes('fee_collection_delete')));

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to modify transaction dates' });
    }

    const { updates, transactionIds, destinationDate } = req.body;

    let itemsToUpdate = [];

    if (Array.isArray(updates) && updates.length > 0) {
      itemsToUpdate = updates;
    } else if (Array.isArray(transactionIds) && transactionIds.length > 0 && destinationDate) {
      itemsToUpdate = transactionIds.map(id => ({ id, newDate: destinationDate }));
    } else {
      return res.status(400).json({ message: 'Please provide transaction updates or transactionIds with destinationDate' });
    }

    let updatedCount = 0;
    for (const item of itemsToUpdate) {
      if (!item.id || !item.newDate) continue;
      const tx = await Transaction.findById(item.id);
      if (!tx || tx.status === 'cancelled') continue;

      const timestamps = resolveCollectionTimestamps(req, item.newDate);
      tx.paymentDate = timestamps.paymentDate;
      tx.set('createdAt', timestamps.createdAt);
      tx.set('updatedAt', new Date());
      await tx.save({ timestamps: false });
      updatedCount += 1;
    }

    res.json({
      message: `Successfully updated dates for ${updatedCount} transactions`,
      updatedCount
    });
  } catch (error) {
    console.error('Error bulk updating transaction dates:', error);
    res.status(500).json({ message: 'Error updating transaction dates', error: error.message });
  }
};

// @desc    Transfer a transaction to another fee head
// @route   POST /api/transactions/:id/transfer
const transferTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let { targets, targetFeeHeadId, studentYear, semester, remarks } = req.body;
    const { id } = req.params;

    const transactionA = await Transaction.findById(id).session(session);
    if (!transactionA) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transactionA.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Only active transactions can be transferred. Current status is ${transactionA.status}.` });
    }

    // Build targets array if single values are passed (backward compatibility)
    if (!targets || !Array.isArray(targets)) {
      if (!targetFeeHeadId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Target fee head or targets array is required' });
      }
      targets = [{
        targetFeeHeadId,
        studentYear: studentYear || transactionA.studentYear,
        semester: semester || transactionA.semester,
        amount: transactionA.amount
      }];
    }

    // Validate targets total amount matches source transaction amount exactly
    const totalTargetAmt = targets.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    if (Math.abs(totalTargetAmt - transactionA.amount) > 0.01) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Total transfer amount (₹${totalTargetAmt}) must exactly match the source transaction amount (₹${transactionA.amount}).`
      });
    }

    const FeeHead = require('../models/FeeHead');
    const sourceFeeHead = await FeeHead.findById(transactionA.feeHead).session(session);
    const sourceName = sourceFeeHead ? sourceFeeHead.name : 'Unknown Fee Head';
    const transferDate = new Date();
    const createdTransactions = [];

    // Loop and insert destination transactions
    for (const t of targets) {
      const targetFeeHead = await FeeHead.findById(t.targetFeeHeadId).session(session);
      if (!targetFeeHead) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Target fee head not found for ID: ${t.targetFeeHeadId}` });
      }

      const transactionB = new Transaction({
        studentId: transactionA.studentId,
        studentName: transactionA.studentName,
        college: transactionA.college,
        collegeId: transactionA.collegeId,
        course: transactionA.course,
        courseId: transactionA.courseId,
        branch: transactionA.branch,
        branchId: transactionA.branchId,
        pinNo: transactionA.pinNo,
        admissionNumber: transactionA.admissionNumber,
        feeHead: t.targetFeeHeadId,
        amount: Number(t.amount),
        paymentDate: transactionA.paymentDate, // Preserve original date
        transactionType: 'DEBIT',
        paymentMode: 'Transfer',
        status: 'active',
        semester: t.semester || 'All',
        studentYear: t.studentYear,
        receiptNumber: transactionA.receiptNumber, // Shared receipt number
        collectedBy: req.user?.username || 'Unknown',
        collectedByName: req.user?.name || 'Unknown',
        remarks: remarks || `Transfer from ${sourceName}`,
        transferredFromTransactionId: transactionA._id
      });

      await transactionB.save({ session });
      createdTransactions.push(transactionB);
    }

    // Update Transaction A (the source)
    transactionA.status = 'transferred';
    transactionA.transferredToFeeHead = targets[0].targetFeeHeadId;
    transactionA.transferredToTransactionId = createdTransactions[0]._id;
    transactionA.transferredBy = req.user?.username || 'Unknown';
    transactionA.transferredByName = req.user?.name || 'Unknown';
    transactionA.transferredAt = transferDate;
    transactionA.transferRemarks = remarks || `Transferred to ${createdTransactions.length} head(s)`;

    await transactionA.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Trigger SQL Fee Sync
    try {
      const { syncStudentFeesByAdmissionNumber } = require('../services/studentFeeSyncService');
      await syncStudentFeesByAdmissionNumber(transactionA.studentId);
    } catch (syncErr) {
      console.error('[TransferTransaction] Sync failed (non-fatal):', syncErr);
    }

    res.json({
      message: 'Transaction transferred successfully',
      sourceTransaction: transactionA,
      targetTransactions: createdTransactions
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error transferring transaction:', error);
    res.status(500).json({ message: 'Error transferring transaction', error: error.message });
  }
};

module.exports = {
  addTransaction,
  getStudentTransactions,
  previewSequence,
  updateTransactionPaymentMode,
  getRecentTransactions,
  deleteTransaction,
  cancelTransaction,
  getTransactionsByDate,
  bulkUpdateTransactionDates,
  transferTransaction
};

