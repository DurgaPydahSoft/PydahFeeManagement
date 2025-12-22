const Transaction = require('../models/Transaction');

// @desc    Add a Payment Transaction
// @route   POST /api/transactions
const addTransaction = async (req, res) => {
  const { studentId, studentName, feeHeadId, amount, paymentMode, remarks, semester, academicYear, collectedBy, collectedByName, transactionType } = req.body;

  // Validation: Fee Head is required for DEBIT, but optional for CREDIT
  if (!studentId || !amount || (transactionType !== 'CREDIT' && !feeHeadId)) {
    return res.status(400).json({ message: 'Please provide all required transaction details' });
  }

  try {
    // Generate Receipt Number: REC + Last 6 of TS + Random 3
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900).toString();
    const receiptNumber = `REC${timestamp}${random}`;

    const transaction = await Transaction.create({
      studentId,
      studentName,
      feeHead: feeHeadId,
      amount,
      paymentMode,
      transactionType: transactionType || 'DEBIT',
      remarks,
      semester,
      academicYear,
      receiptNumber,
      collectedBy,
      collectedByName
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
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
