const ConcessionRequest = require('../models/ConcessionRequest');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const { uploadToS3 } = require('../utils/s3Upload');

// Helper to get next voucher ID for a course
const getNextVoucherId = async (courseName) => {
  const lastRequest = await ConcessionRequest.findOne({ course: courseName })
    .sort({ createdAt: -1 })
    .select('voucherId');
  
  let nextNum = 1;
  if (lastRequest && lastRequest.voucherId) {
    nextNum = parseInt(lastRequest.voucherId, 10) + 1;
  }
  return nextNum.toString().padStart(3, '0');
};

// @desc    Get Next Voucher ID Preview
// @route   GET /api/concessions/next-voucher-id
const getNextVoucherIdPreview = async (req, res) => {
  const { course } = req.query;
  if (!course) return res.status(400).json({ message: 'Course is required' });

  try {
    const nextId = await getNextVoucherId(course);
    res.json({ nextVoucherId: nextId });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a Concession Request
// @route   POST /api/concessions
const createConcessionRequest = async (req, res) => {
  let { students, feeHeadId, amount, reason, studentYear, semester, concessionGivenBy } = req.body;
  
  // Parse students if it comes as a string (FormData)
  if (typeof students === 'string') {
    try {
      students = JSON.parse(students);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid students data' });
    }
  }

  const requestedBy = req.user ? (req.user.name || req.user.username) : 'system';

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: 'No students selected' });
  }

  if (!feeHeadId || !amount || !reason || !studentYear) {
    return res.status(400).json({ message: 'Fee Head, Amount, Year and Reason are required' });
  }

  try {
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToS3(req.file);
    }

    // Cache next IDs to avoid redundant lookups or racing (simplified for now)
    const courseNextIds = {};

    const requests = [];
    for (const s of students) {
      if (!courseNextIds[s.course]) {
        courseNextIds[s.course] = await getNextVoucherId(s.course);
      } else {
        // Increment for subsequent students in the same bulk request
        const nextNum = parseInt(courseNextIds[s.course], 10) + 1;
        courseNextIds[s.course] = nextNum.toString().padStart(3, '0');
      }

      requests.push({
        studentId: s.studentId,
        studentName: s.studentName,
        feeHead: feeHeadId,
        voucherId: courseNextIds[s.course],
        amount: Number(amount),
        reason,
        studentYear,
        semester,
        college: s.college,
        course: s.course,
        branch: s.branch,
        batch: s.batch,
        type: students.length > 1 ? 'Bulk' : 'Single',
        requestedBy,
        imageUrl,
        concessionGivenBy // [NEW]
      });
    }

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
  const { status, college, course, branch, batch, search, studentId, startDate, endDate, concessionGivenBy } = req.query;
  const filter = {};

  if (status && status !== 'ALL') filter.status = status;
  
  if (college) filter.college = college;
  if (course) filter.course = course;
  if (branch) filter.branch = branch;
  if (batch) filter.batch = batch;
  if (studentId) filter.studentId = studentId;
  if (concessionGivenBy) filter.concessionGivenBy = concessionGivenBy;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search) {
      filter.$or = [
          { studentName: { $regex: search, $options: 'i' } },
          { studentId: { $regex: search, $options: 'i' } },
          { voucherId: { $regex: search, $options: 'i' } }
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
  const processedBy = req.user ? (req.user.name || req.user.username) : 'admin';

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

      // Check for EXISTING linked transaction (created via Fee Collection UI)
      const existingTxn = await Transaction.findOne({ concessionRequestId: id });

      if (existingTxn) {
        // Update existing transaction
        existingTxn.amount = finalAmount;
        existingTxn.remarks = `Concession Approved (Modified): ${request.reason}`;
        existingTxn.collectedBy = processedBy;
        await existingTxn.save();
      } else {
        // Create Transaction (Credit) - Standard fallback logic
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(100 + Math.random() * 900).toString();
        const receiptNumber = `CN${timestamp}${random}`; // CN for Concession

        const newTransaction = new Transaction({
          studentId: request.studentId,
          studentName: request.studentName,
          feeHead: request.feeHead,
          amount: finalAmount,
          transactionType: 'CREDIT',
          paymentMode: 'Credit',
          receiptNumber,
          paymentDate: new Date(),
          remarks: `Concession: ${request.reason}`,
          collectedBy: processedBy,
          collectedByName: req.user ? req.user.name : 'Administrator',
          academicYear: request.batch,
          studentYear: request.studentYear,
          college: request.college,
          course: request.course,
          branch: request.branch,
          concessionRequestId: request._id
        });
        await newTransaction.save();
      }
      
      request.status = 'APPROVED';
      request.processedBy = processedBy;
      request.processedAt = new Date();
      await request.save();

      res.json({ message: 'Request approved successfully', data: request });
    } else {
      request.status = 'REJECTED';
      request.rejectionReason = rejectionReason;
      request.processedBy = processedBy;
      request.processedAt = new Date();
      await request.save();
      res.json({ message: 'Request rejected successfully', data: request });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = { 
  createConcessionRequest, 
  getConcessionRequests, 
  processConcessionRequest,
  getNextVoucherIdPreview
};
