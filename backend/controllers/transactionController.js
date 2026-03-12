const Transaction = require('../models/Transaction');

// @desc    Add a Payment Transaction
// @route   POST /api/transactions
// @desc    Add a Payment Transaction (Single or Batch)
// @route   POST /api/transactions
const addTransaction = async (req, res) => {
  try {
    // Generate Receipt Number: REC + Last 6 of TS + Random 3
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900).toString();
    const receiptNumber = `REC${timestamp}${random}`;

    // Sanitize ObjectId fields to handle empty strings from frontend
    const sanitizeObjectId = (val) => (val && val.trim() !== '' ? val : undefined);

    // CHECK IF BATCH (req.body.transactions array exists)
    if (req.body.transactions && Array.isArray(req.body.transactions)) {
       const batch = req.body.transactions.map(item => ({
           ...item,
           feeHead: sanitizeObjectId(item.feeHeadId),
           paymentConfigId: sanitizeObjectId(item.paymentConfigId),
           proceedingId: sanitizeObjectId(item.proceedingId),
           concessionRequestId: sanitizeObjectId(item.concessionRequestId),
           receiptNumber, // Shared Receipt Number
           paymentMode: item.transactionType === 'CREDIT' && !item.paymentMode ? 'Waiver' : (item.paymentMode || 'Cash'),
           transactionType: item.transactionType || 'DEBIT',
           remarks: item.remarks,
           referenceDate: item.referenceDate
       }));
       
       const createdTransactions = await Transaction.insertMany(batch);

       // Populate feeHead for proper display in response
       const populatedTransactions = await Transaction.find({ _id: { $in: createdTransactions.map(t => t._id) } }).populate('feeHead', 'name');
       
       const primary = populatedTransactions[0].toObject();
       primary.relatedTransactions = populatedTransactions; 
       return res.status(201).json(primary);
    }

    // SINGLE TRANSACTION (Backward Compatibility)
    const { studentId, studentName, feeHeadId, amount, paymentMode, remarks, semester, studentYear, collectedBy, collectedByName, transactionType, paymentConfigId, depositedToAccount, referenceDate, proceedingId, concessionRequestId } = req.body;

    // Validation
    if (!studentId || !amount || (transactionType !== 'CREDIT' && !feeHeadId)) {
      return res.status(400).json({ message: 'Please provide all required transaction details' });
    }

    // Default to 'Waiver' if it's a CREDIT (Concession) and no mode provided
    let finalPaymentMode = paymentMode;
    if (transactionType === 'CREDIT' && !finalPaymentMode) {
      finalPaymentMode = 'Waiver';
    }

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

module.exports = {
  addTransaction,
  getStudentTransactions,
};
