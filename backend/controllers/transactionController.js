const Transaction = require('../models/Transaction');
const FeeGroup = require('../models/FeeGroup');
const Setting = require('../models/Setting');
const ReceiptSequence = require('../models/ReceiptSequence');
const db = require('../config/sqlDb');

const getCollectorFromRequest = (req) => ({
  collectedBy: req.user?.username || 'Unknown',
  collectedByName: req.user?.name || 'Unknown',
});

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
        courseCode = (studentCourse || 'GEN').toUpperCase().trim();

        if (studentCollege) {
          const [collegeRows] = await db.query(
            'SELECT code FROM colleges WHERE name = ?',
            [studentCollege]
          );
          if (collegeRows && collegeRows.length > 0 && collegeRows[0].code) {
            collegeCode = collegeRows[0].code.toUpperCase().trim();
          } else {
            collegeCode = studentCollege.toUpperCase().trim();
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
        const seq = await ReceiptSequence.findOneAndUpdate(
          { collegeCode, courseCode, groupCode, financialYear },
          { $inc: { nextNumber: 1 } },
          { new: true, upsert: true }
        );
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
             collectedBy: collector.collectedBy,
             collectedByName: collector.collectedByName,
           });
         }
       }
       
       const createdTransactions = await Transaction.insertMany(batch);

       // Populate feeHead for proper display in response
       const populatedTransactions = await Transaction.find({ _id: { $in: createdTransactions.map(t => t._id) } }).populate('feeHead', 'name');
       
       const primary = populatedTransactions[0].toObject();
       primary.relatedTransactions = populatedTransactions; 
       return res.status(201).json(primary);
    }

    // SINGLE TRANSACTION (Backward Compatibility)
    const { studentName, feeHeadId, amount, paymentMode, remarks, semester, studentYear, transactionType, paymentConfigId, depositedToAccount, referenceDate, proceedingId, concessionRequestId } = req.body;
    const { collectedBy, collectedByName } = getCollectorFromRequest(req);

    // Validation
    if (!studentId || !amount || (transactionType !== 'CREDIT' && !feeHeadId)) {
      return res.status(400).json({ message: 'Please provide all required transaction details' });
    }

    // Default to 'Waiver' if it's a CREDIT (Concession) and no mode provided
    let finalPaymentMode = paymentMode;
    if (transactionType === 'CREDIT' && !finalPaymentMode) {
      finalPaymentMode = 'Waiver';
    }

    const receiptNumber = await generateReceiptNumber(sanitizeObjectId(feeHeadId));

    const transaction = await Transaction.create({
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
      concessionRequestId: sanitizeObjectId(concessionRequestId)
    });

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
      .sort({ createdAt: -1 });
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
      courseCode = (studentCourse || 'GEN').toUpperCase().trim();

      if (studentCollege) {
        const [collegeRows] = await db.query(
          'SELECT code FROM colleges WHERE name = ?',
          [studentCollege]
        );
        if (collegeRows && collegeRows.length > 0 && collegeRows[0].code) {
          collegeCode = collegeRows[0].code.toUpperCase().trim();
        } else {
          collegeCode = studentCollege.toUpperCase().trim();
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
      transaction.proceedingId = (proceedingId === '' || !proceedingId) ? null : proceedingId;
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

    // Base query filter
    const query = {};

    // 1. Cashier Privacy: Cashier can only see their own collections
    if (isCashier) {
      query.collectedBy = username;
    }

    // 2. College & Course permissions for non-SuperAdmins
    if (!isSuperAdmin) {
      const userColleges = req.user?.colleges || (req.user?.college ? [req.user.college] : []);
      const userCourses = req.user?.courses || [];

      if (userColleges.length > 0 || userCourses.length > 0) {
        let sqlQuery = 'SELECT admission_number FROM students WHERE 1=1';
        const params = [];
        
        if (userColleges.length > 0) {
          sqlQuery += ' AND college IN (?)';
          params.push(userColleges);
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

module.exports = {
  addTransaction,
  getStudentTransactions,
  previewSequence,
  updateTransactionPaymentMode,
  getRecentTransactions
};
