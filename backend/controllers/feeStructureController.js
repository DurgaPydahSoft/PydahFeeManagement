const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const db = require('../config/sqlDb');

// @desc    Create/Update Fee Structure (Single or Bulk)
// @route   POST /api/fee-structures
const createFeeStructure = async (req, res) => {
  const { feeHeadId, college, course, branch, batch, studentYear, amount, description, semester } = req.body;
  // yearAmounts logic removed for simplifying Semester implementation as per requirement "semester heading... not display all eight semesters" in matrix.
  // We focus on single create or toggle-based create from UI.

  try {
    if (!feeHeadId || !college || !course || !branch || !batch || !studentYear || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ message: 'All fields including Batch and Student Year are required' });
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { feeHead: feeHeadId, college, course, branch, batch, studentYear, semester: semester || null },
      { amount, description },
      { new: true, upsert: true }
    );
    res.status(201).json(structure);

  } catch (error) {
    console.error("Error creating fee structure:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get All Fee Structures
// @route   GET /api/fee-structures
const getFeeStructures = async (req, res) => {
  try {
    const structures = await FeeStructure.find().populate('feeHead', 'name code').sort({ createdAt: -1 });
    res.json(structures);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Student Fee Details (Due vs Paid) from StudentFee table (Explicit Assignment)
// @route   GET /api/fee-structures/student/:admissionNo
// @query   college, course, branch, academicYear, studentYear
const getStudentFeeDetails = async (req, res) => {
  const { admissionNo } = req.params;
  const { academicYear } = req.query;

  try {
    // Fetch ALL fees for FIFO logic
    const allFees = await StudentFee.find({ studentId: admissionNo }).populate('feeHead', 'name code').sort({ academicYear: 1, semester: 1 });
    
    // 2. Get All Transactions for this student
    const transactions = await Transaction.find({ studentId: admissionNo });

    // 1. Initialize Pools
    const specificHeadPools = {}; // Map<FeeHeadID, Amount>
    let globalCreditPool = 0;

    // 2. Aggregate Transactions
    transactions.forEach(t => {
        if (t.transactionType === 'CREDIT' || !t.feeHead) {
             globalCreditPool += (t.amount || 0);
        } else {
             // Specific Fee Head Payment (DEBIT)
             const hId = t.feeHead.toString();
             if (!specificHeadPools[hId]) specificHeadPools[hId] = 0;
             specificHeadPools[hId] += (t.amount || 0);
        }
    });

    // 3. Calculation Phase
    let processedResults = [];

    allFees.forEach(fee => {
        const hId = fee.feeHead ? fee.feeHead._id.toString() : 'unknown';
        const totalFeeAmount = fee.amount || 0;
        let paidSoFar = 0;

        // Phase A: Apply Specific Fee Head Payments first
        if (hId !== 'unknown' && specificHeadPools[hId] > 0) {
            const allocation = Math.min(totalFeeAmount, specificHeadPools[hId]);
            paidSoFar += allocation;
            specificHeadPools[hId] -= allocation;
        }

        fee._tempPaid = paidSoFar; 
    });

    // Phase B: Apply Global Credits
    allFees.forEach(fee => {
        const totalFeeAmount = fee.amount || 0;
        const currentPaid = fee._tempPaid || 0;
        const currentDue = totalFeeAmount - currentPaid;

        if (currentDue > 0 && globalCreditPool > 0) {
            const creditAllocation = Math.min(currentDue, globalCreditPool);
            fee._tempPaid = currentPaid + creditAllocation;
            globalCreditPool -= creditAllocation;
        }

        processedResults.push({
             _id: fee._id,
             feeHeadId: fee.feeHead ? fee.feeHead._id : null,
             feeHeadName: fee.feeHead ? fee.feeHead.name : 'Unknown',
             feeHeadCode: fee.feeHead ? fee.feeHead.code : '',
             academicYear: fee.academicYear,
             studentYear: fee.studentYear,
             semester: fee.semester,
             totalAmount: totalFeeAmount,
             paidAmount: fee._tempPaid,
             dueAmount: totalFeeAmount - fee._tempPaid
        });
    });

    // NOW apply the filter if requested
    if (academicYear) {
        processedResults = processedResults.filter(r => r.academicYear === academicYear);
    }

    res.json(processedResults);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Apply a Template Fee to a Batch (Creates StudentFee records)
// @route   POST /api/fee-structures/apply-batch
const applyFeeToBatch = async (req, res) => {
    const { structureId } = req.body; // targetAcademicYear removed, we assume Batch is enough

    try {
        const structure = await FeeStructure.findById(structureId);
        if(!structure) return res.status(404).json({message: 'Structure not found'});

        // Fetch Students matching the structure's Batch
        // Note: Students table has 'batch' column now
        const [students] = await db.query(`
            SELECT admission_number, student_name, college, course, branch, current_year, current_semester, batch
            FROM students 
            WHERE college = ? AND course = ? AND branch = ? AND batch = ?
        `, [structure.college, structure.course, structure.branch, structure.batch]);

        if(students.length === 0) return res.status(404).json({message: 'No students found in this batch'});

        const operations = students.map(s => {
            return {
                updateOne: {
                    filter: { 
                        studentId: s.admission_number, 
                        feeHead: structure.feeHead,
                        // We still store academicYear for historical reference if needed, 
                        // BUT for now let's just use "Batch Mode" storage or keep it simple.
                        // Actually, StudentFee likely needs an 'academicYear' to know WHICH year this fee belongs to?
                        // If we are moving to Batch Based, maybe we don't 'academicYear' on StudentFee 
                        // OR we calculate it: Batch 2024 + Year 1 = 2024-2025.
                        // For SAFETY, let's store the Batch in StudentFee too if possible, OR just use 'batch' as the key.
                        // To allow the system to work without breaking 'getStudentFeeDetails' (which uses academicYear),
                        // We might need to infer academicYear. 
                        // Let's store 'batch' in academicYear field for now to represent "This fee is for this Batch".
                        academicYear: structure.batch, 
                        studentYear: structure.studentYear,
                        semester: structure.semester 
                    },
                    update: { 
                        $set: {
                            studentName: s.student_name,
                            college: s.college,
                            course: s.course,
                            branch: s.branch,
                            amount: structure.amount,
                            structureId: structure._id,
                            semester: structure.semester,
                            batch: s.batch // Store the batch from the student
                        }
                    },
                    upsert: true
                }
            };
        });

        await StudentFee.bulkWrite(operations);
        res.json({ message: `Applied fee to ${students.length} students` });

    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Error applying to batch'});
    }
};

// @desc    Save/Update Individual Student Fees
// @route   POST /api/fee-structures/save-student-fees
const saveStudentFees = async (req, res) => {
    const { fees } = req.body; // Array of objects
    
    try {
        const operations = fees.map(f => {
            return {
                updateOne: {
                    filter: { 
                        studentId: f.studentId, 
                        feeHead: f.feeHeadId,
                        academicYear: f.batch, // Use Batch here
                        studentYear: f.studentYear,
                        semester: f.semester
                    },
                    update: { 
                        $set: {
                            studentName: f.studentName,
                            college: f.college,
                            course: f.course,
                            branch: f.branch,
                            amount: Number(f.amount),
                            semester: f.semester,
                            academicYear: f.batch, // Ensure it is saved
                            batch: f.batch // Also save batch explicitly
                        }
                    },
                    upsert: true
                }
            };
        });

        await StudentFee.bulkWrite(operations);
        res.json({ message: 'Student fees updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Error saving student fees'});
    }
};

// @desc    Update Fee Structure
// @route   PUT /api/fee-structures/:id
const updateFeeStructure = async (req, res) => {
  const { id } = req.params;
  const { feeHeadId, college, course, branch, batch, studentYear, amount, description, semester } = req.body;
  const user = req.user ? req.user.username : 'system'; 

  try {
    const existing = await FeeStructure.findById(id);
    if (!existing) return res.status(404).json({ message: 'Fee Structure not found' });

    // History Logic
    const historyEntry = {
        updatedBy: user,
        updatedAt: new Date(),
        changeDescription: `Updated amount from ${existing.amount} to ${amount}`
    };

    const updatedStructure = await FeeStructure.findByIdAndUpdate(
      id,
      { 
        feeHead: feeHeadId, 
        college, 
        course, 
        branch, 
        batch, 
        studentYear, 
        semester,
        amount, 
        description,
        $push: { history: historyEntry }
      },
      { new: true }
    );
    
    res.json(updatedStructure);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete Fee Structure
// @route   DELETE /api/fee-structures/:id
const deleteFeeStructure = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await FeeStructure.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Fee Structure not found' });
    }
    res.json({ message: 'Fee Structure removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Batch Student Fees (for Excel View)
// @route   POST /api/fee-structures/batch-fees
const getBatchStudentFees = async (req, res) => {
    const { college, course, branch, batch, feeHeadId } = req.body;

    try {
        // Query by Batch (stored in academicYear field of StudentFee for compatibility)
        const query = { college, course, branch, academicYear: batch };
        if (feeHeadId) query.feeHead = feeHeadId;

        const fees = await StudentFee.find(query);
        res.json(fees);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching batch fees' });
    }
};

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getStudentFeeDetails,
  updateFeeStructure,
  deleteFeeStructure,
  applyFeeToBatch,
  saveStudentFees,
  getBatchStudentFees
};
