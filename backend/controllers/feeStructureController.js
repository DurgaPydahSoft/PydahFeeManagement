const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const db = require('../config/sqlDb');

// @desc    Create/Update Fee Structure (Single or Bulk)
// @route   POST /api/fee-structures
const createFeeStructure = async (req, res) => {
  const { feeHeadId, college, course, branch, academicYear, studentYear, amount, description, yearAmounts } = req.body;

  try {
    // 1. Bulk Mode (if yearAmounts is provided: { "1": 50000, "2": 40000 })
    if (yearAmounts && typeof yearAmounts === 'object') {
      // Validate common fields first
      if (!feeHeadId || !college || !course || !branch || !academicYear) {
          return res.status(400).json({ message: 'Missing required common fields (Fee Head, College, Course, Branch)' });
      }

      const promises = Object.entries(yearAmounts).map(async ([sYear, amt]) => {
          if (amt === '' || amt === null || amt === undefined) return null; // Skip empty
          
          return FeeStructure.findOneAndUpdate(
            { feeHead: feeHeadId, college, course, branch, academicYear, studentYear: parseInt(sYear) },
            { amount: Number(amt), description },
            { new: true, upsert: true }
          );
      });
      await Promise.all(promises);
      return res.status(201).json({ message: 'Bulk Fee Structure Created' });
    }

    // 2. Single Mode (Old Logic)
    if (!feeHeadId || !college || !course || !branch || !academicYear || !studentYear || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ message: 'All fields including Student Year are required' });
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { feeHead: feeHeadId, college, course, branch, academicYear, studentYear },
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
    const structures = await FeeStructure.find().populate('feeHead', 'name').sort({ createdAt: -1 });
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
    const query = { studentId: admissionNo };
    if (academicYear) query.academicYear = academicYear;

    // 1. Get Assigned Fees (StudentFee) - Sort: Oldest Academic Year First
    // Note: academicYear is string "2024-2025", simplistic sort works but might need logic if format varies
    const assignedFees = await StudentFee.find(query).populate('feeHead', 'name').sort({ academicYear: 1 });
    
    // 2. Get All Transactions for this student
    const transactions = await Transaction.find({ studentId: admissionNo });

    // 3. FIFO Logic: Distribute Total Paid per Head across sorted Fees
    // Group Fees by Fee Head ID to handle them together
    const feesByHead = {};
    
    // Initialize groups
    assignedFees.forEach(fee => {
        const headId = fee.feeHead._id.toString();
        if (!feesByHead[headId]) {
            feesByHead[headId] = {
                headName: fee.feeHead.name,
                totalPaidForHead: 0,
                feeRecords: []
            };
        }
        feesByHead[headId].feeRecords.push(fee);
    });

    // Calculate Total Paid for each Head from Transactions
    transactions.forEach(t => {
        if (t.feeHead) {
            const headId = t.feeHead.toString();
            // Only count if we have fees for this head (otherwise it's an orphan payment or for a head we filtered out)
            if (feesByHead[headId]) {
                feesByHead[headId].totalPaidForHead += (t.amount || 0);
            }
        }
    });

    const finalDetails = [];

    // Distribute Payment
    Object.keys(feesByHead).forEach(headId => {
        const group = feesByHead[headId];
        let remainingPaid = group.totalPaidForHead;

        // Records are already sorted by academic year (oldest first)
        group.feeRecords.forEach(fee => {
            const totalDueForThisRecord = fee.amount;
            
            // How much of the 'remainingPaid' covers this record?
            // If remainingPaid >= due, we fully pay this record.
            // If remainingPaid < due, we pay partially.
            const paidForThisRecord = Math.min(totalDueForThisRecord, remainingPaid);
            
            const balanceForThisRecord = totalDueForThisRecord - paidForThisRecord;
            
            // Deduct used payment
            remainingPaid -= paidForThisRecord;

            finalDetails.push({
                 _id: fee._id,
                 feeHeadId: fee.feeHead._id,
                 feeHeadName: fee.feeHead.name,
                 academicYear: fee.academicYear,
                 studentYear: fee.studentYear,
                 totalAmount: fee.amount,
                 paidAmount: paidForThisRecord,
                 dueAmount: balanceForThisRecord,
            });
        });
    });

    // If 'academicYear' filter was applied, we might still want to show fees relative to that year.
    // The loop above processes ALL fees for the filtered heads? No, `assignedFees` already filtered by query.
    // Issue: If we filter by Year 2025, but I paid for 2024, my 'totalPaid' might be huge?
    // Correct FIFO: We must process ALL years to know what's left for 2025.
    // If req.query.academicYear exists, our `assignedFees` only has one year!
    // BUT `transactions` has ALL payments.
    // If I owe 50k (2024) and 50k (2025). I paid 50k.
    // If I request details for 2025:
    // assignedFees = [2025 Record]. transactions = [50k].
    // Logic above: totalPaidForHead = 50k. 
    // It will pay off 2025 Record! This is WRONG. It should have paid off 2024 first.
    
    // FIX: To do FIFO correctly, we must fetch ALL fees for the student initially to calculate the 'waterfall',
    // then filter the RESULT to return only the requested year.
    //
    // However, looking at the code, `academicYear` query is generally NOT used for the main "FeeCollection" view (it shows all dues).
    // If it *is* used, we need to be careful.
    // For safety, I will fetch ALL fees first, process FIFO, then filter output.
    
    // RE-RUN Logic with ALL fees if filter exists
    // Actually, for now, let's assume the user wants full picture (FeeCollection page usually shows all).
    // If specific year filter is critical, we'll need to refactor to fetch all -> calculate -> filter.
    // Given the prompt "fee collection page", it likely shows all.
    // If the frontend sends `academicYear`, we might overpay. 
    // Let's check if `academicYear` is commonly sent. 
    // In `FeeCollection.jsx`: `const academicYear = '2024-2025';` and it IS passed in query params!
    // `params: { ... academicYear }`.
    // This is DANGEROUS for FIFO.
    
    // IMMEDIATE FIX: Ignore `academicYear` filter for the calculation base. 
    // Fetch ALL fees, Calculate FIFO, then filter result if needed.
    
    // Re-querying to get FULL history for accurate FIFO
    const allFees = await StudentFee.find({ studentId: admissionNo }).populate('feeHead', 'name').sort({ academicYear: 1 });
    // Note: We ignore `req.query.academicYear` for the DB fetch to ensure we know about previous dues.

    // 1. Initialize Pools
    const specificHeadPools = {}; // Map<FeeHeadID, Amount>
    let globalCreditPool = 0;

    // 2. Aggregate Transactions
    transactions.forEach(t => {
        // If Type is CREDIT (or FeeHead is missing which implies generic credit/payment), add to Global Pool
        // We assume 'amount' is positive.
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
    // We will attach a temporary '_calculatedPaid' property to the fee objects in memory
    let processedResults = [];

    // allFees is already sorted by academicYear (Ascending/Oldest First)
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

    // Phase B: Apply Global Credits to ANY remaining due (FIFO across all heads)
    // We iterate again because we wanted to prioritize specific heads first.
    // Now we fill holes with global credit.
    allFees.forEach(fee => {
        const totalFeeAmount = fee.amount || 0;
        const currentPaid = fee._tempPaid || 0;
        const currentDue = totalFeeAmount - currentPaid;

        if (currentDue > 0 && globalCreditPool > 0) {
            const creditAllocation = Math.min(currentDue, globalCreditPool);
            fee._tempPaid = currentPaid + creditAllocation;
            globalCreditPool -= creditAllocation;
        }

        // Finalize Result Object
        processedResults.push({
             _id: fee._id,
             feeHeadId: fee.feeHead ? fee.feeHead._id : null,
             feeHeadName: fee.feeHead ? fee.feeHead.name : 'Unknown',
             academicYear: fee.academicYear,
             studentYear: fee.studentYear,
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
    const { structureId } = req.body; // or context

    try {
        const structure = await FeeStructure.findById(structureId);
        if(!structure) return res.status(404).json({message: 'Structure not found'});

        // Fetch Students from SQL
        // Match College, Course, Branch, and current_year == structure.studentYear
        const [students] = await db.query(`
            SELECT admission_number, student_name, college, course, branch, current_year 
            FROM students 
            WHERE college = ? AND course = ? AND branch = ? AND current_year = ?
        `, [structure.college, structure.course, structure.branch, structure.studentYear]);

        if(students.length === 0) return res.status(404).json({message: 'No students found in this batch'});

        const operations = students.map(s => {
            return {
                updateOne: {
                    filter: { 
                        studentId: s.admission_number, 
                        feeHead: structure.feeHead,
                        academicYear: structure.academicYear,
                        studentYear: structure.studentYear 
                    },
                    update: { 
                        $set: {
                            studentName: s.student_name,
                            college: s.college,
                            course: s.course,
                            branch: s.branch,
                            amount: structure.amount,
                            structureId: structure._id
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
                        academicYear: f.academicYear,
                        studentYear: f.studentYear 
                    },
                    update: { 
                        $set: {
                            studentName: f.studentName,
                            college: f.college,
                            course: f.course,
                            branch: f.branch,
                            amount: Number(f.amount)
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
  const { feeHeadId, college, course, branch, academicYear, studentYear, amount, description } = req.body;

  try {
    const updatedStructure = await FeeStructure.findByIdAndUpdate(
      id,
      { 
        feeHead: feeHeadId, 
        college, 
        course, 
        branch, 
        academicYear, 
        studentYear, 
        amount, 
        description 
      },
      { new: true }
    );

    if (!updatedStructure) {
      return res.status(404).json({ message: 'Fee Structure not found' });
    }
    
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

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getStudentFeeDetails,
  updateFeeStructure,
  deleteFeeStructure,
  applyFeeToBatch,
  saveStudentFees
};
