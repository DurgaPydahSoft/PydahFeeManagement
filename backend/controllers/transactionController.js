const Transaction = require('../models/Transaction');
const Proceeding = require('../models/Proceeding');
const FeeGroup = require('../models/FeeGroup');
const Setting = require('../models/Setting');
const ReceiptSequence = require('../models/ReceiptSequence');
const db = require('../config/sqlDb');
const collegeScope = require('../utils/collegeScope');

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
  // Expect YYYY-MM-DD from <input type="date">
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return { paymentDate: now, createdAt: now, updatedAt: now };
  }

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  // Keep current clock time on the chosen calendar day (local server/IST wall clock).
  const chosen = new Date(y, mo, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  if (Number.isNaN(chosen.getTime())) {
    return { paymentDate: now, createdAt: now, updatedAt: now };
  }
  return { paymentDate: chosen, createdAt: chosen, updatedAt: chosen };
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
       
       // Proceeding validation for batch items
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
      const proc = await Proceeding.findById(proceedingId);
      if (!proc) {
        return res.status(404).json({ message: 'Selected proceeding not found' });
      }
      const existingTxns = await Transaction.find({ proceedingId, status: { $ne: 'cancelled' } }).select('amount');
      const totalUsed = existingTxns.reduce((acc, t) => acc + t.amount, 0);
      const remaining = proc.amount - totalUsed;
      if (Number(amount) > remaining) {
        const avail = remaining < 0 ? 0 : remaining;
        return res.status(400).json({
          message: `Proceeding '${proc.proceedingNumber}' amount limit exceeded. Remaining balance is ₹${avail.toLocaleString('en-IN')}, but attempting to collect ₹${Number(amount).toLocaleString('en-IN')}.`
        });
      }
    }

    // Default to 'Waiver' if it's a CREDIT (Concession) and no mode provided
    let finalPaymentMode = paymentMode;
    if (transactionType === 'CREDIT' && !finalPaymentMode) {
      finalPaymentMode = 'Waiver';
    }

    const receiptNumber = await generateReceiptNumber(sanitizeObjectId(feeHeadId));
    const timestamps = resolveCollectionTimestamps(req, paymentDate);

    const transactionDoc = new Transaction({
      studentId,
      studentName,
      feeHead: sanitizeObjectId(feeHeadId),
      amount,
      paymentMode: finalPaymentMode || 'Cash',
      transactionType: transactionType || 'DEBIT',
      remarks,
      semester,
      studentYear,
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

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Transactions by Student
// @route   GET /api/transactions/student/:admissionNo
const getStudentTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ studentId: req.params.admissionNo })
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json(transactions);
  } catch (error) {
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
      if (targetProcId) {
        const proc = await Proceeding.findById(targetProcId);
        if (!proc) {
          return res.status(404).json({ message: 'Selected proceeding not found' });
        }
        const existingTxns = await Transaction.find({ proceedingId: targetProcId, _id: { $ne: id }, status: { $ne: 'cancelled' } }).select('amount');
        const totalUsed = existingTxns.reduce((acc, t) => acc + t.amount, 0);
        const remaining = proc.amount - totalUsed;
        if (transaction.amount > remaining) {
          const avail = remaining < 0 ? 0 : remaining;
          return res.status(400).json({
            message: `Proceeding '${proc.proceedingNumber}' amount limit exceeded. Remaining balance is ₹${avail.toLocaleString('en-IN')}, but transaction amount is ₹${transaction.amount.toLocaleString('en-IN')}.`
          });
        }
      }
      transaction.proceedingId = targetProcId;
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

    res.json({ message: 'Transaction cancelled successfully', transaction });
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    res.status(500).json({ message: 'Error cancelling transaction' });
  }
};

module.exports = {
  addTransaction,
  getStudentTransactions,
  previewSequence,
  updateTransactionPaymentMode,
  getRecentTransactions,
  deleteTransaction,
  cancelTransaction
};
