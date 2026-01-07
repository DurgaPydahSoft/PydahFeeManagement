const ConcessionRequest = require('../models/ConcessionRequest');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');

// @desc    Create a Concession Request
// @route   POST /api/concessions
const createConcessionRequest = async (req, res) => {
  const { students, feeHeadId, amount, reason, studentYear, semester } = req.body;
  // students: Array of { studentId, studentName } or just use req.body.studentId for single if preferred.
  // Let's support an array named 'students' for both Single and Bulk to keep it uniform.

  const requestedBy = req.user ? req.user.username : 'system';

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: 'No students selected' });
  }

  if (!feeHeadId || !amount || !reason || !studentYear) {
    return res.status(400).json({ message: 'Fee Head, Amount, Year and Reason are required' });
  }

  try {
    const requests = students.map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      feeHead: feeHeadId,
      amount: Number(amount),
      reason,
      studentYear,
      semester,
      college: s.college,
      course: s.course,
      branch: s.branch,
      batch: s.batch,
      type: students.length > 1 ? 'Bulk' : 'Single',
      requestedBy
    }));

    const created = await ConcessionRequest.insertMany(requests);
    res.status(201).json({ message: `Created ${created.length} concession requests`, data: created });
  } catch (error) {
    console.error("Error creating concession:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get Concession Requests
// @route   GET /api/concessions
// @query   status, college, course, branch, batch
const getConcessionRequests = async (req, res) => {
  const { status, college, course, branch, batch, search } = req.query;
  const filter = {};

  if (status && status !== 'ALL') filter.status = status;
  // If status is not provided, default to PENDING? User asked for "Approved requests should also be visible", implies default might be ALL or selectable.
  // Let's make it strict: if no status param, return ALL? Or stick to PENDING default but allow overriding.
  // Requirement: "Approved requests should also be visible".
  // Let's Default to 'PENDING' if nothing sent, but UI will send 'ALL' or specific.
  
  if (college) filter.college = college;
  if (course) filter.course = course;
  if (branch) filter.branch = branch;
  if (batch) filter.batch = batch;

  if (search) {
      filter.$or = [
          { studentName: { $regex: search, $options: 'i' } },
          { studentId: { $regex: search, $options: 'i' } }
      ];
  }

  try {
    const requests = await ConcessionRequest.find(filter)
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Process Request (Approve/Reject)
// @route   PUT /api/concessions/:id/process
const processConcessionRequest = async (req, res) => {
  const { id } = req.params;
  const { action, rejectionReason, approvedAmount } = req.body; // action: 'APPROVE' or 'REJECT'
  const processedBy = req.user ? req.user.username : 'admin';

  try {
    const request = await ConcessionRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request is already processed' });
    }

    if (action === 'APPROVE') {
      // Allow Admin to update amount during approval
      let finalAmount = request.amount;
      if (approvedAmount !== undefined && approvedAmount !== null) {
          finalAmount = Number(approvedAmount);
          request.amount = finalAmount; // Update the request record with the approved amount
      }

      // 1. Create Transaction (Credit)
      // Generate Receipt Number for Concession (Different series? Or same?)
      // Use "CON-" prefix for internal tracking? Or standard REC?
      // Standard REC to show in ledger uniformly is better, or "WAIV" prefix.
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(100 + Math.random() * 900).toString();
      const receiptNumber = `CN${timestamp}${random}`; // CN for Concession

      await Transaction.create({
        studentId: request.studentId,
        studentName: request.studentName,
        feeHead: request.feeHead,
        amount: finalAmount,
        paymentMode: 'Waiver', // or 'Concession'
        transactionType: 'CREDIT',
        remarks: `Concession Approved: ${request.reason}`,
        semester: request.semester,
        studentYear: request.studentYear,
        receiptNumber,
        collectedBy: processedBy,
        collectedByName: req.user ? req.user.name : 'Administrator'
      });

      // 2. Update Request Status
      request.status = 'APPROVED';
      request.approvedBy = processedBy;
      await request.save();

      res.json({ message: 'Concession Approved and Applied', status: 'APPROVED' });

    } else if (action === 'REJECT') {
      request.status = 'REJECTED';
      request.approvedBy = processedBy;
      request.rejectionReason = rejectionReason || 'No reason provided';
      await request.save();

      res.json({ message: 'Concession Rejected', status: 'REJECTED' });

    } else {
      res.status(400).json({ message: 'Invalid Action' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createConcessionRequest,
  getConcessionRequests,
  processConcessionRequest
};
