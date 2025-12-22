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

    // CHECK IF BATCH (req.body.transactions array exists)
    if (req.body.transactions && Array.isArray(req.body.transactions)) {
       const batch = req.body.transactions.map(item => ({
           ...item,
           feeHead: item.feeHeadId, // Map frontend 'feeHeadId' to schema 'feeHead'
           receiptNumber, // Shared Receipt Number
           paymentMode: item.transactionType === 'CREDIT' && !item.paymentMode ? 'Waiver' : (item.paymentMode || 'Cash'),
           transactionType: item.transactionType || 'DEBIT' 
       }));
       
       const createdTransactions = await Transaction.insertMany(batch);

       // Populate feeHead for proper display in response
       const populatedTransactions = await Transaction.find({ _id: { $in: createdTransactions.map(t => t._id) } }).populate('feeHead', 'name');
       
       // Return the FIRST one for the receipt standard response, or the array
       // Frontend expects an object to show in Modal. Let's return the first one but with a property indicating it's a batch?
       // OR return the list. Current frontend Modal expects `lastTransaction` object. 
       // Let's return the first one, but attach the full list as a property `relatedTransactions`.
       const primary = populatedTransactions[0].toObject();
       primary.relatedTransactions = populatedTransactions; 
       return res.status(201).json(primary);
    }

    // SINGLE TRANSACTION (Backward Compatibility)
    const { studentId, studentName, feeHeadId, amount, paymentMode, remarks, semester, studentYear, collectedBy, collectedByName, transactionType } = req.body;

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
      feeHead: feeHeadId,
      amount,
      paymentMode: finalPaymentMode || 'Cash',
      transactionType: transactionType || 'DEBIT',
      remarks,
      semester,
      semester,
      studentYear,
      receiptNumber,
      collectedBy,
      collectedByName,
      bankName: req.body.bankName,
      instrumentDate: req.body.instrumentDate,
      referenceNo: req.body.referenceNo
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
