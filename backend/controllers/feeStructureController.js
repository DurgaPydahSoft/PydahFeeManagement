const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const db = require('../config/sqlDb');

// @desc    Create/Update Fee Structure (Single or Bulk)
// @route   POST /api/fee-structures
// @desc    Create/Update Fee Structure (Single or Bulk)
// @route   POST /api/fee-structures
const createFeeStructure = async (req, res) => {
  const { feeHeadId, college, course, branch, batch, category, categories, studentYear, amount, description, semester } = req.body;
  // yearAmounts logic removed for simplifying Semester implementation as per requirement.

  try {
    // Basic Validation
    if (!feeHeadId || !college || !course || !branch || !batch || !studentYear || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ message: 'All fields including Batch, Student Year and Amount are required' });
    }

    // Determine categories to process: either key 'categories' (array) or 'category' (single string)
    let catsToProcess = [];
    if (Array.isArray(categories) && categories.length > 0) {
        catsToProcess = categories;
    } else if (category) {
        catsToProcess = [category];
    } else {
        return res.status(400).json({ message: 'Category is required' });
    }

    const results = [];
    for (const cat of catsToProcess) {
        const structure = await FeeStructure.findOneAndUpdate(
            { feeHead: feeHeadId, college, course, branch, batch, category: cat, studentYear, semester: semester || null },
            { amount, description },
            { new: true, upsert: true }
        );
        results.push(structure);
    }
    
    // Return last created or array? Frontend expects one object usually for single create, but array for multi?
    // Let's just return the last created structure or a success message to avoid breaking standard flow too much,
    // or simply return the list.
    // Given the frontend logic iterates over years and awaits one by one, returning the last one is safe enough 
    // to prevent errors, as the frontend mainly checks 201 status. 
    // But ideally we return list.
    res.status(201).json(results.length === 1 ? results[0] : results);

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
  const { academicYear, studentYear: queryYear } = req.query; // academicYear used as filter if provided

  try {
    // 1. Fetch Student Info (to get current batch and year)
    const [students] = await db.query('SELECT current_year, batch FROM students WHERE admission_number = ?', [admissionNo]);
    const student = students[0];
    const currentYear = student ? Number(student.current_year) : (Number(queryYear) || 1);
    const batch = student ? student.batch : '';

    // 2. Fetch all Demands (StudentFee)
    const studentFees = await StudentFee.find({ studentId: admissionNo }).populate('feeHead', 'name code');

    // 3. Fetch all Transactions (Payments)
    const transactions = await Transaction.find({ studentId: admissionNo });

    // 4. Fetch all Fee Heads (to show defaults)
    const feeHeads = await FeeHead.find().sort({ name: 1 });

    // 5. Data Structures for aggregation
    // Key: [HeadID]-[Year]
    const groupedData = {};

    const getGroupKey = (headId, year) => `${headId}-${year}`;

    // A. Initialize with actual Demands
    studentFees.forEach(fee => {
      const hId = fee.feeHead ? fee.feeHead._id.toString() : 'unknown';
      const year = String(fee.studentYear || 1);
      const key = getGroupKey(hId, year);

      if (!groupedData[key]) {
        groupedData[key] = {
          _id: fee._id, // Keep the actual demand ID if found
          feeHeadId: fee.feeHead ? fee.feeHead._id : null,
          feeHeadName: fee.feeHead ? fee.feeHead.name : 'Unknown',
          feeHeadCode: fee.feeHead ? fee.feeHead.code : '',
          academicYear: fee.academicYear || batch,
          studentYear: year,
          semester: fee.semester,
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0
        };
      }
      groupedData[key].totalAmount += (fee.amount || 0);
    });

    // B. Inject Default Fee Heads for ALL years up to the student's CURRENT YEAR
    // This ensures they show up in the dropdown even with 0 demand for any past/current year.
    feeHeads.forEach(head => {
      const years = [];
      for (let y = 1; y <= currentYear; y++) {
        years.push(String(y));
      }

      years.forEach(year => {
        const key = getGroupKey(head._id.toString(), year);
        if (!groupedData[key]) {
          groupedData[key] = {
            _id: `temp-${head._id}-${year}`,
            feeHeadId: head._id,
            feeHeadName: head.name,
            feeHeadCode: head.code || '',
            academicYear: batch,
            studentYear: year,
            semester: null,
            totalAmount: 0,
            paidAmount: 0,
            dueAmount: 0
          };
        }
      });
    });

    // C. Aggregate Transactions by (Head, Year)
    transactions.forEach(t => {
      if (t.transactionType === 'DEBIT' && t.feeHead) {
        const hId = t.feeHead.toString();
        const year = String(t.studentYear || 1);
        const key = getGroupKey(hId, year);

        // If we have a payment for a head/year that wasn't previously in grouping, add it
        if (!groupedData[key]) {
          const head = feeHeads.find(h => h._id.toString() === hId);
          groupedData[key] = {
            _id: `pay-${hId}-${year}`,
            feeHeadId: hId,
            feeHeadName: head ? head.name : 'Unknown',
            feeHeadCode: head ? head.code : '',
            academicYear: batch,
            studentYear: year,
            semester: t.semester || null,
            totalAmount: 0,
            paidAmount: 0,
            dueAmount: 0
          };
        }
        groupedData[key].paidAmount += (t.amount || 0);
      } else if (t.transactionType === 'CREDIT' || !t.feeHead) {
        // How to distribute Global Credits/Concessions? 
        // For now, let's keep the existing FIFO-ish logic for Global Credits but we need to reconcile with grouped view.
        // Simpler: Just subtract it from the Total Due at the end or apply to Arrears.
        // For this specific 'Collect Fee' screen, we primarily care about specific head payments.
      }
    });

    // D. Final Calculation and Global Credit Distribution
    // This part handles the "fee paid previously have to be deducted from the fee applied" requirement
    // because groupedData[key].paidAmount includes previous transactions, and .totalAmount is the demand.

    let processedResults = Object.values(groupedData).map(item => {
      item.dueAmount = item.totalAmount - item.paidAmount;
      return item;
    });

    // Handle Global Credit Pool (Transactions with no specific head or type CREDIT)
    let globalCreditPool = transactions.reduce((acc, t) => {
      if (t.transactionType === 'CREDIT' || !t.feeHead) return acc + (t.amount || 0);
      return acc;
    }, 0);

    if (globalCreditPool > 0) {
      // Sort by year to apply credit to oldest dues first
      processedResults.sort((a, b) => Number(a.studentYear) - Number(b.studentYear));
      processedResults.forEach(item => {
        if (item.dueAmount > 0 && globalCreditPool > 0) {
          const allocation = Math.min(item.dueAmount, globalCreditPool);
          item.paidAmount += allocation;
          item.dueAmount -= allocation;
          globalCreditPool -= allocation;
        }
      });
    }

    // Filter by academicYear if requested
    if (academicYear) {
      processedResults = processedResults.filter(r => String(r.academicYear) === String(academicYear));
    }

    // Sort for display (Year descending, Name ascending)
    processedResults.sort((a, b) => {
      if (a.studentYear !== b.studentYear) return Number(b.studentYear) - Number(a.studentYear);
      return a.feeHeadName.localeCompare(b.feeHeadName);
    });

    res.json(processedResults);

  } catch (error) {
    console.error("Error in getStudentFeeDetails:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Apply a Template Fee to a Batch (Creates StudentFee records)
// @route   POST /api/fee-structures/apply-batch
const applyFeeToBatch = async (req, res) => {
  const { structureId } = req.body; // targetAcademicYear removed, we assume Batch is enough

  try {
    const structure = await FeeStructure.findById(structureId);
    if (!structure) return res.status(404).json({ message: 'Structure not found' });

    // Fetch Students matching the structure's Batch AND Category (stud_type)
    // Note: Students table has 'batch' and 'stud_type' columns
    const [students] = await db.query(`
            SELECT admission_number, student_name, college, course, branch, current_year, current_semester, batch
            FROM students 
            WHERE college = ? AND course = ? AND branch = ? AND batch = ? AND stud_type = ?
        `, [structure.college, structure.course, structure.branch, structure.batch, structure.category]);

    if (students.length === 0) return res.status(404).json({ message: 'No students found in this batch' });

    // Check if fees are ALREADY applied for this Batch & Structure
    // usage: academicYear stores the batch string
    const existingFees = await StudentFee.findOne({
      feeHead: structure.feeHead,
      academicYear: structure.batch,
      studentYear: structure.studentYear,
      semester: structure.semester,
      college: structure.college,
      course: structure.course,
      branch: structure.branch
    });

    if (existingFees) {
      return res.status(400).json({ message: 'Fee already applied! Use the Excel view to modify individual students.' });
    }

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
    res.status(500).json({ message: 'Error applying to batch' });
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
    res.status(500).json({ message: 'Error saving student fees' });
  }
};

// @desc    Update Fee Structure
// @route   PUT /api/fee-structures/:id
const updateFeeStructure = async (req, res) => {
  const { id } = req.params;
  const { feeHeadId, college, course, branch, batch, category, studentYear, amount, description, semester } = req.body;
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
        category,
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
