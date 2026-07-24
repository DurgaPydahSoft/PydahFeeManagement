const mongoose = require('mongoose');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');
const db = require('../config/sqlDb');
const { syncClubFees, syncTransportFees, syncStandardFees } = require('../services/studentFeeSyncService');
const {
  resolveStudentFeeAmount,
  buildFeeHeadMaps,
  resolveFeeHeadId
} = require('../utils/overallConcessionFees');

// Helper to automatically apply a fee structure to all students in the batch
const applyFeeStructureToBatchInternal = async (structure) => {
  if (!structure) return;
  try {
    const [students] = await db.query(`
      SELECT admission_number, student_name, college, course, branch, current_year, current_semester, batch
      FROM students 
      WHERE college = ? AND course = ? AND branch = ? AND batch = ? AND stud_type = ?
    `, [structure.college, structure.course, structure.branch, structure.batch, structure.category]);

    if (students.length === 0) return;

    // Fetch revised fees from overall_concessions table
    const [concessions] = await db.query(
        `SELECT admission_number, revised_fees FROM overall_concessions WHERE batch = ?`,
        [structure.batch]
    );
    const feeHeads = await FeeHead.find({}).lean();
    const { codeMap } = buildFeeHeadMaps(feeHeads);
    const revisedFeesMap = {};

    if (concessions.length > 0) {
        concessions.forEach(c => {
            const fees = typeof c.revised_fees === 'string' ? JSON.parse(c.revised_fees) : (c.revised_fees || []);
            if (!Array.isArray(fees)) return;

            const match = fees.find(f => {
                const resolvedId = resolveFeeHeadId(f, codeMap);
                return (
                    resolvedId === structure.feeHead.toString() &&
                    Number(f.studentYear) === Number(structure.studentYear) &&
                    (f.semester === null || f.semester === undefined || Number(f.semester) === Number(structure.semester))
                );
            });

            if (match) {
                revisedFeesMap[c.admission_number] = resolveStudentFeeAmount(structure.amount, match);
            }
        });
    }

    const operations = students.map(s => {
      const targetAmount = revisedFeesMap[s.admission_number] !== undefined 
          ? revisedFeesMap[s.admission_number] 
          : structure.amount;

      return {
        updateOne: {
          filter: {
            studentId: s.admission_number,
            feeHead: structure.feeHead,
            academicYear: structure.batch,
            studentYear: structure.studentYear,
            semester: structure.semester || null,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
          },
          update: {
            $set: {
              studentName: s.student_name,
              college: s.college,
              course: s.course,
              branch: s.branch,
              amount: targetAmount,
              structureId: structure._id,
              semester: structure.semester,
              batch: s.batch,
              stud_type: structure.category,
              isScholarshipApplicable: structure.isScholarshipApplicable || false,
              isTermsDivided: structure.isTermsDivided || false
            }
          },
          upsert: true
        }
      };
    });

    await StudentFee.bulkWrite(operations);
  } catch (error) {
    console.error('Error in applyFeeStructureToBatchInternal:', error);
  }
};


// @desc    Create/Update Fee Structure (Single or Bulk)
// @route   POST /api/fee-structures
const createFeeStructure = async (req, res) => {
  const { feeHeadId, college, course, branch, batch, category, categories, studentYear, amount, description, semester, isScholarshipApplicable, isTermsDivided, terms, isGroupWiseLateFee } = req.body;

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

    // Automatically check and apply default late fee configuration if available
    const rawTerms = (isTermsDivided && Array.isArray(terms) && terms.length > 0)
      ? terms
      : [{ termNumber: 1, percentage: 100, amount: Number(amount) }];
    const termsCount = rawTerms.length;

    const defaultConfig = await DefaultLateFeeConfig.findOne({ termsCount, isActive: true });

    let autoLateFeeHead = req.body.lateFeeHead || null;
    if (!autoLateFeeHead && defaultConfig && defaultConfig.lateFeeHead) {
      autoLateFeeHead = defaultConfig.lateFeeHead;
    }

    const processedTerms = rawTerms.map(t => {
      const dTerm = defaultConfig?.terms?.find(dt => Number(dt.termNumber) === Number(t.termNumber));
      return {
        ...t,
        dueDateMode: t.dueDateMode || (dTerm ? dTerm.dueDateMode : 'offset'),
        referenceSemester: t.referenceSemester !== undefined ? t.referenceSemester : (dTerm ? dTerm.referenceSemester : undefined),
        dueOffsetDays: (t.dueOffsetDays !== undefined && t.dueOffsetDays !== 0) ? t.dueOffsetDays : (dTerm ? dTerm.dueOffsetDays : 0),
        fixedDueDate: t.fixedDueDate || (dTerm ? dTerm.fixedDueDate : undefined),
        dueDescription: t.dueDescription || (dTerm ? dTerm.dueDescription : '')
      };
    });

    const results = [];
    const errors = [];

    for (const cat of catsToProcess) {
      try {
        // Build clear query and update objects
        // Strict Type Casting to ensure we match the unique index exactly
        const sYear = Number(studentYear);
        const sem = semester ? Number(semester) : null;

        const query = {
          feeHead: mongoose.Types.ObjectId.isValid(feeHeadId) ? new mongoose.Types.ObjectId(feeHeadId) : feeHeadId,
          college,
          course,
          branch,
          batch,
          category: cat,
          studentYear: sYear,
          semester: sem // Explicitly null if falsy to match index
        };

        const update = {
          $set: {
            amount: Number(amount),
            description,
            isScholarshipApplicable: isScholarshipApplicable || false,
            isTermsDivided: isTermsDivided || false,
            terms: processedTerms,
            semester: sem, // Explicitly set/update semester in document to match index
            isGroupWiseLateFee: !!isGroupWiseLateFee,
            ...(autoLateFeeHead ? { lateFeeHead: autoLateFeeHead } : {})
          }
        };

        const options = { new: true, upsert: true, runValidators: true };

        const structure = await FeeStructure.findOneAndUpdate(query, update, options);
        
        await StudentFee.updateMany(
          {
            $and: [
              {
                $or: [
                  { structureId: structure._id },
                  {
                    feeHead: feeHeadId,
                    college,
                    course,
                    branch,
                    academicYear: batch, // academicYear stores batch string
                    studentYear: sYear,
                    semester: sem,
                    stud_type: cat
                  }
                ]
              },
              {
                $or: [
                  { remarks: { $exists: false } },
                  { remarks: null },
                  { remarks: '' }
                ]
              }
            ]
          },
          {
            $set: {
              isScholarshipApplicable: isScholarshipApplicable || false,
              isTermsDivided: isTermsDivided || false
            }
          }
        );

        await applyFeeStructureToBatchInternal(structure);
        results.push(structure);
      } catch (err) {
        console.error(`Error saving fee structure for category ${cat}:`, err.message);
        if (err.code === 11000) {
          console.error("Duplicate Key Collision Details:", err.keyValue);
        }
        errors.push({ category: cat, error: err.message });
      }
    }

    // Consolidated Response
    if (results.length > 0) {
      const msg = errors.length > 0
        ? `Saved for ${results.length} categories. Failed for ${errors.length}.`
        : `Fee definitions created successfully for ${results.length} categories.`;

      return res.status(201).json({
        message: msg,
        results,
        errors
      });
    } else {
      // All failed
      return res.status(500).json({
        message: 'Failed to create fee structures.',
        errors
      });
    }

  } catch (error) {
    console.error("Error creating fee structure:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get All Fee Structures
// @route   GET /api/fee-structures
const getFeeStructures = async (req, res) => {
  try {
    const structures = await FeeStructure.find()
      .populate('feeHead', 'name code')
      .populate('lateFeeHead', 'name code')
      .sort({ createdAt: -1 });
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
    const [students] = await db.query('SELECT id, student_name, current_year, batch, current_semester, scholar_status, college, course, branch, stud_type FROM students WHERE admission_number = ?', [admissionNo]);
    const student = students[0];
    const currentYear = (student && student.current_year) ? Number(student.current_year) : (Number(queryYear) || 1);
    const batch = student ? student.batch : '';
    const college = student ? student.college : '';
    const course = student ? student.course : '';
    const branch = student ? student.branch : '';
    const category = student ? student.stud_type : 'Regular';

    if (student) {
      try {
        await syncClubFees(student, admissionNo);
        await syncTransportFees(student, admissionNo);
        await syncStandardFees(student, admissionNo);
      } catch (syncError) {
        console.error('Fee sync error:', syncError);
      }
    }

    // 2. Fetch applicable Fee Structures for term definitions
    const applicableStructures = await FeeStructure.find({
      college,
      course,
      branch,
      batch,
      category
    }).lean();

    // 3. Fetch all Demands (StudentFee) - including any that were just synced
    const studentFees = await StudentFee.find({ studentId: admissionNo }).populate('feeHead', 'name code');

    // 4. Fetch all Transactions (Payments)
    const transactions = await Transaction.find({ studentId: admissionNo, status: { $ne: 'cancelled' } });

    // Map structures by [headId-year-semester] for quick lookup
    const structureMap = {};
    applicableStructures.forEach(fs => {
      const key = `${fs.feeHead.toString()}-${fs.studentYear}-${fs.semester || 'null'}`;
      structureMap[key] = fs;
    });

    // 5. Fetch all Fee Heads (for display convenience)
    const feeHeads = await FeeHead.find().sort({ name: 1 });

    // 5. Data Structures for aggregation
    // Key: [HeadID]-[Year]

    const groupedData = {};

    const getGroupKey = (headId, year, feeCode, remarks, semester) => {
      const semKey = semester ? `S${semester}` : 'Y';
      if (feeCode === 'CF' || feeCode === 'SSF') {
        return `${headId}-${year}-${semKey}-${remarks || 'General'}`;
      }
      if (feeCode === 'TRN' || feeCode === 'TRN01') {
        return `${headId}-${year}-transport`;
      }
      return `${headId}-${year}-${semKey}`;
    };

    const formatServiceFeeName = (headName, remarks) => {
      if (!remarks) return headName;
      // Clean "Service Request: Name (Ref: 123)" -> "Name"
      let name = remarks.replace(/^Service Request:\s*/i, '').replace(/\s*\(Ref:.*?\)\s*$/i, '');
      return `${headName} - ${name.trim()}`;
    };

    // A. Initialize with actual Demands
    studentFees.forEach(fee => {
      const hId = fee.feeHead ? fee.feeHead._id.toString() : 'unknown';
      const hCode = fee.feeHead ? fee.feeHead.code : '';
      const year = String(fee.studentYear || 1);
      const key = getGroupKey(hId, year, hCode, fee.remarks, fee.semester);

      if (!groupedData[key]) {
        // Find matching structure for terms
        const structKey = `${hId}-${year}-${fee.semester || 'null'}`;
        const matchedStructure = structureMap[structKey];

        groupedData[key] = {
          _id: fee._id, // Keep the actual demand ID if found
          feeHeadId: fee.feeHead ? fee.feeHead._id : null,
          feeHeadName: (fee.feeHead && (fee.feeHead.code === 'CF' || fee.feeHead.code === 'SSF')) ? formatServiceFeeName(fee.feeHead.name, fee.remarks) : (fee.feeHead ? fee.feeHead.name : 'Unknown'),
          feeHeadCode: fee.feeHead ? fee.feeHead.code : '',
          academicYear: fee.academicYear || batch,
          studentYear: year,
          semester: fee.semester,
          totalAmount: 0,
          concessionAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          isActive: fee.isActive !== false,
          remarks: fee.remarks, // Important to pass back to frontend for correct payment matching
          remarksList: fee.remarks ? [fee.remarks] : [],
          isScholarshipApplicable: fee.isScholarshipApplicable || false,
          isTermsDivided: fee.isTermsDivided !== undefined ? fee.isTermsDivided : (matchedStructure ? matchedStructure.isTermsDivided : false),
          studentScholarStatus: student ? student.scholar_status : null,
          terms: ((fee.isTermsDivided !== undefined ? fee.isTermsDivided : (matchedStructure ? matchedStructure.isTermsDivided : false)) && matchedStructure) ? matchedStructure.terms : [] // Attach terms ONLY if terms divided!
        };
      } else {
        if (fee.remarks && !groupedData[key].remarksList.includes(fee.remarks)) {
          groupedData[key].remarksList.push(fee.remarks);
          groupedData[key].remarks = groupedData[key].remarksList.join('\n');
        }
      }
      groupedData[key].totalAmount += (fee.amount || 0);
    });

    // B. Inject Default Fee Heads ONLY for years where a FeeStructure exists
    // This ensures that if a structure is deleted, it doesn't show up as an "empty" due
    applicableStructures.forEach(fs => {
      const hId = fs.feeHead.toString();
      const year = String(fs.studentYear);
      const head = feeHeads.find(h => h._id.toString() === hId);
      if (!head) return;

      const key = getGroupKey(hId, year, head.code, null, fs.semester);
      if (!groupedData[key]) {
        groupedData[key] = {
          _id: `temp-${hId}-${year}-${fs.semester || 'null'}`,
          feeHeadId: hId,
          feeHeadName: head.name,
          feeHeadCode: head.code || '',
          academicYear: batch,
          studentYear: year,
          semester: fs.semester || null,
          totalAmount: 0,
          concessionAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          isActive: true,
          isScholarshipApplicable: fs.isScholarshipApplicable || false,
          isTermsDivided: fs.isTermsDivided || false,
          terms: fs.isTermsDivided ? (fs.terms || []) : []
        };
      }
    });

    // C. Aggregate Transactions by (Head, Year)
    transactions.forEach(t => {
      if (t.feeHead) {
        const hId = t.feeHead.toString();
        const year = String(t.studentYear || 1);

        const head = feeHeads.find(h => h._id.toString() === hId);
        const hCode = head ? head.code : '';
        const key = getGroupKey(hId, year, hCode, t.remarks, t.semester);

        // If we have a payment for a head/year that wasn't previously in grouping, add it
        if (!groupedData[key]) {
          const head = feeHeads.find(h => h._id.toString() === hId);
          const structKey = `${hId}-${year}-${t.semester || 'null'}`;
          const matchedStructure = structureMap[structKey];

          groupedData[key] = {
            _id: `pay-${hId}-${year}-${t.semester || 'null'}`,
            feeHeadId: hId,
            feeHeadName: (head && (head.code === 'CF' || head.code === 'SSF')) ? formatServiceFeeName(head.name, t.remarks) : (head ? head.name : 'Unknown'),
            feeHeadCode: head ? head.code : '',
            academicYear: batch,
            studentYear: year,
            semester: t.semester || null,
            totalAmount: 0,
            concessionAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            isActive: true,
            terms: matchedStructure ? matchedStructure.terms : []
          };
        }
        if (t.transactionType === 'DEBIT') {
          groupedData[key].paidAmount += (t.amount || 0);
        } else if (t.transactionType === 'CREDIT') {
          groupedData[key].concessionAmount += (t.amount || 0);
        }
      } else {
        // Global Credits/Concessions (no specific feeHead)
      }
    });

    // D. Final Calculation
    let processedResults = Object.values(groupedData).map(item => {
      item.dueAmount = Math.max(0, item.totalAmount - item.paidAmount - item.concessionAmount);
      return item;
    });

    // Apply global credits (not tied to a specific fee head) as concessions only — never as paid
    let globalCreditPool = transactions.reduce((acc, t) => {
      if (!t.feeHead && t.transactionType === 'CREDIT') {
        return acc + (t.amount || 0);
      }
      return acc;
    }, 0);

    if (globalCreditPool > 0) {
      // Sort by year to apply credit to oldest dues first
      processedResults.sort((a, b) => Number(a.studentYear) - Number(b.studentYear));
      processedResults.forEach(item => {
        if (item.dueAmount > 0 && globalCreditPool > 0) {
          const allocation = Math.min(item.dueAmount, globalCreditPool);
          item.concessionAmount += allocation;
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

// @desc    Update Fee Structure
// @route   PUT /api/fee-structures/:id
const updateFeeStructure = async (req, res) => {
  const { id } = req.params;
  const { feeHeadId, college, course, branch, batch, category, studentYear, amount, description, semester, isScholarshipApplicable, isTermsDivided, terms, lateFeeHead } = req.body;
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

    const fHead = feeHeadId || req.body.feeHead;
    const finalFeeHead = mongoose.Types.ObjectId.isValid(fHead) ? new mongoose.Types.ObjectId(fHead) : (fHead?._id || fHead);

    let finalLateFeeHead = existing.lateFeeHead;
    if (lateFeeHead !== undefined) {
      if (!lateFeeHead) {
        finalLateFeeHead = null;
      } else {
        const lfHead = lateFeeHead?._id || lateFeeHead;
        finalLateFeeHead = mongoose.Types.ObjectId.isValid(lfHead) ? new mongoose.Types.ObjectId(lfHead) : lfHead;
      }
    }

    const updatedStructure = await FeeStructure.findByIdAndUpdate(
      id,
      {
        feeHead: finalFeeHead,
        college,
        course,
        branch,
        batch,
        category,
        studentYear,
        semester,
        amount,
        description,
        isScholarshipApplicable,
        isTermsDivided: isTermsDivided || false,
        lateFeeHead: finalLateFeeHead,
        terms: (isTermsDivided && terms) ? terms : [],
        $push: { history: historyEntry }
      },
      { new: true }
    );

    await StudentFee.updateMany(
      {
        $and: [
          {
            $or: [
              { structureId: existing._id },
              {
                feeHead: existing.feeHead,
                college: existing.college,
                course: existing.course,
                branch: existing.branch,
                academicYear: existing.batch, // academicYear stores batch string
                studentYear: existing.studentYear,
                semester: existing.semester,
                stud_type: existing.category
              }
            ]
          },
          {
            $or: [
              { remarks: { $exists: false } },
              { remarks: null },
              { remarks: '' }
            ]
          }
        ]
      },
      {
        $set: {
          isScholarshipApplicable: isScholarshipApplicable || false,
          isTermsDivided: isTermsDivided || false
        }
      }
    );

    await applyFeeStructureToBatchInternal(updatedStructure);
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
    const structure = await FeeStructure.findById(id);
    if (!structure) {
      return res.status(404).json({ message: 'Fee Structure not found' });
    }

    // Cascading Deletion: Remove StudentFee assignments matching this structure's context
    // We match by the primary fields that define the structure's applicability
    const deleteCount = await StudentFee.deleteMany({
      feeHead: structure.feeHead,
      college: structure.college,
      course: structure.course,
      branch: structure.branch,
      academicYear: structure.batch, // academicYear stores batch string
      studentYear: structure.studentYear,
      semester: structure.semester,
      stud_type: structure.category
    });

    console.log(`Cascading Deletion: Removed ${deleteCount.deletedCount} student fee records for structure ${id}`);

    await FeeStructure.findByIdAndDelete(id);
    res.json({ message: 'Fee Structure and related student assignments removed' });
  } catch (error) {
    console.error("Error in deleteFeeStructure:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getStudentFeeDetails,
  updateFeeStructure,
  deleteFeeStructure
};
