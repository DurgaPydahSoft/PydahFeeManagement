const LateFeeConfig = require('../models/LateFeeConfig');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');
const {
  isDeclarationConcessionTxn,
  allocateTermBalances,
  isUnderpaidThroughTerm,
  resolveEffectiveTerms
} = require('../utils/termConcessionAllocation');

/**
 * Build term allocation for one student + fee structure (paid + declaration even + application waterfall).
 */
const buildStudentTermAllocation = async (studentId, struct) => {
  const feeHeadId = struct.feeHead?._id || struct.feeHead;
  const txnFilter = {
    studentId,
    feeHead: feeHeadId,
    studentYear: struct.studentYear,
    status: { $ne: 'cancelled' }
  };
  // Match semester loosely — null demand vs "1" txns still apply to this year head
  if (struct.semester !== null && struct.semester !== undefined && struct.semester !== '') {
    txnFilter.$or = [
      { semester: String(struct.semester) },
      { semester: Number(struct.semester) },
      { semester: null },
      { semester: '' },
      { semester: { $exists: false } }
    ];
  }

  const txns = await Transaction.find(txnFilter).lean();

  let paidAmount = 0;
  let declarationConcession = 0;
  let applicationConcession = 0;
  txns.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.transactionType === 'DEBIT') paidAmount += amt;
    else if (t.transactionType === 'CREDIT') {
      if (isDeclarationConcessionTxn(t)) declarationConcession += amt;
      else applicationConcession += amt;
    }
  });

  // Prefer live StudentFee demand; fall back to structure term amounts
  const demandFilter = {
    studentId,
    feeHead: feeHeadId,
    studentYear: String(struct.studentYear)
  };
  const demands = await StudentFee.find(demandFilter).lean();
  const demandTotal = demands.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const structureTotal = (struct.terms || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalAmount = demandTotal > 0 ? demandTotal : (Number(struct.amount) || structureTotal);
  // Non-divided structures → single Term 1
  const terms = resolveEffectiveTerms(struct.terms, totalAmount);

  return allocateTermBalances({
    totalAmount,
    terms,
    paidAmount,
    declarationConcession,
    applicationConcession
  });
};

// @desc    Get all Late Fee Configurations
// @route   GET /api/late-fees/config
const getConfigs = async (req, res) => {
  try {
    const configs = await LateFeeConfig.find().populate('feeHead', 'name code');
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching late fee configurations', error: error.message });
  }
};

// @desc    Create/Update Late Fee Configuration
// @route   POST /api/late-fees/config
const saveConfig = async (req, res) => {
  try {
    const { _id, college, course, branch, batch, studentYear, semester, categories, feeHead, termMappings, penaltyType, penaltyValue } = req.body;

    if (!college || !course || !batch || !studentYear || !feeHead || !termMappings || termMappings.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (_id) {
      const updated = await LateFeeConfig.findByIdAndUpdate(_id, {
        college, course, branch, batch, studentYear, semester, categories, feeHead, termMappings, penaltyType, penaltyValue
      }, { new: true });
      return res.json(updated);
    } else {
      const created = await LateFeeConfig.create({
        college, course, branch, batch, studentYear, semester, categories, feeHead, termMappings, penaltyType, penaltyValue
      });
      return res.status(201).json(created);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error saving configuration', error: error.message });
  }
};

// @desc    Delete Late Fee Configuration
// @route   DELETE /api/late-fees/config/:id
const deleteConfig = async (req, res) => {
  try {
    await LateFeeConfig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Configuration removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing configuration' });
  }
};

// @desc    Get all Default Late Fee Configurations
// @route   GET /api/late-fees/default-config
const getDefaultConfigs = async (req, res) => {
  try {
    const configs = await DefaultLateFeeConfig.find()
      .populate('lateFeeHead', 'name code');
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching default late fee configurations', error: error.message });
  }
};

// @desc    Create/Update Default Late Fee Configuration
// @route   POST /api/late-fees/default-config
const saveDefaultConfig = async (req, res) => {
  try {
    const { _id, termsCount, lateFeeHead, terms, isActive } = req.body;

    if (!termsCount || !lateFeeHead || !terms || terms.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const payload = {
      termsCount,
      lateFeeHead,
      terms,
      isActive: isActive !== false
    };

    if (_id) {
      const updated = await DefaultLateFeeConfig.findByIdAndUpdate(_id, payload, { new: true });
      return res.json(updated);
    } else {
      const created = await DefaultLateFeeConfig.create(payload);
      return res.status(201).json(created);
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A default late fee configuration already exists for this terms count.' });
    }
    res.status(500).json({ message: 'Error saving default configuration', error: error.message });
  }
};

// @desc    Delete Default Late Fee Configuration
// @route   DELETE /api/late-fees/default-config/:id
const deleteDefaultConfig = async (req, res) => {
  try {
    await DefaultLateFeeConfig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Default configuration removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing default configuration', error: error.message });
  }
};

// @desc    Process Late Fees for all active configurations (Custom structures or Default configurations fallback)
// @route   POST /api/late-fees/process
const processLateFees = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logFilePath = path.join(__dirname, '../logs/sync_debug.log');
  let logData = '';
  const log = (msg) => {
    console.log(msg);
    logData += msg + '\n';
  };

  try {
    // Optional: sync a single structure (manual trigger from UI)
    const structureId = req?.body?.structureId || req?.query?.structureId || null;
    log(`[DEBUG] Starting processLateFees for structureId: ${structureId}`);

    // Load active default configurations
    const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true })
      .populate('lateFeeHead');

    const queryFilter = {};
    if (structureId) {
      queryFilter._id = structureId;
    }

    let structures = await FeeStructure.find(queryFilter)
      .populate('feeHead')
      .populate('lateFeeHead');
    log(`[DEBUG] Initial structures count: ${structures.length}`);

    // If a single structure is queried, and it is group-wise, load all structures in that group
    if (structureId && structures.length > 0 && structures[0].isGroupWiseLateFee) {
      const target = structures[0];
      log(`[DEBUG] Structure is group-wise. Loading full group context for structure: ${target._id}`);
      structures = await FeeStructure.find({
        college: target.college,
        course: target.course,
        branch: target.branch,
        batch: target.batch,
        category: target.category,
        studentYear: target.studentYear,
        semester: target.semester || null,
        isGroupWiseLateFee: true
      }).populate('feeHead').populate('lateFeeHead');
      log(`[DEBUG] Full group structures loaded: ${structures.length}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];
    let skipped = 0;

    // Group structures by context key if they are group-wise late fees
    const groups = [];
    const groupWiseMap = {};

    for (const struct of structures) {
      if (struct.isGroupWiseLateFee) {
        const batchKey = String(struct.batch || '').split('-')[0].trim();
        const contextKey = `${struct.college}|${struct.course}|${struct.branch}|${batchKey}|${struct.category}|${struct.studentYear}|${struct.semester || 'null'}`;
        if (!groupWiseMap[contextKey]) {
          groupWiseMap[contextKey] = [];
          groups.push({
            isGroupWise: true,
            structures: groupWiseMap[contextKey]
          });
        }
        groupWiseMap[contextKey].push(struct);
      } else {
        groups.push({
          isGroupWise: false,
          structures: [struct]
        });
      }
    }

    for (const groupObj of groups) {
      const { isGroupWise, structures: groupStructs } = groupObj;
      if (groupStructs.length === 0) continue;

      const firstStruct = groupStructs[0];

      // Late fee is ONLY applicable if at least one structure in the group has terms with lateFeeAmount > 0
      const hasLateFee = groupStructs.some(struct => 
        Array.isArray(struct.terms) && struct.terms.some(t => Number(t.lateFeeAmount) > 0)
      );

      if (!hasLateFee) {
        skipped += groupStructs.length;
        continue;
      }

      // Find matching default configuration for timing rules
      // Non-divided structures are treated as Term 1 (termsCount = 1)
      const effectiveTerms = resolveEffectiveTerms(firstStruct.terms, firstStruct.amount || 0);
      const structTermsCount = effectiveTerms.length || 1;
      const config = defaultConfigs.find(c => Number(c.termsCount) === Number(structTermsCount));

      // Resolve demand head from the first structure, or fall back to default config's lateFeeHead
      const demandHead = firstStruct.lateFeeHead || (config ? config.lateFeeHead : null);
      if (!demandHead) {
        console.warn(`Skipping group: no lateFeeHead configured on first structure or default config`);
        skipped += groupStructs.length;
        continue;
      }

      // Map timing parameters from default config onto structure terms (using firstStruct as reference)
      const activeTerms = effectiveTerms.map(st => {
        // Only terms where lateFeeAmount > 0 are processed for penalties
        if (Number(st.lateFeeAmount) <= 0) {
          return {
            termNumber: st.termNumber,
            amount: st.amount,
            lateFeeAmount: 0
          };
        }

        const dt = config ? config.terms.find(t => t.termNumber === st.termNumber) : null;
        return {
          termNumber: st.termNumber,
          amount: st.amount,
          lateFeeAmount: st.lateFeeAmount, // penalty amount ALWAYS comes from the structure term!
          dueDateMode: st.dueDateMode || (dt ? dt.dueDateMode : 'offset'),
          referenceSemester: st.referenceSemester || (dt ? dt.referenceSemester : null),
          dueOffsetDays: (st.dueOffsetDays !== undefined && st.dueOffsetDays !== 0) ? st.dueOffsetDays : (dt ? dt.dueOffsetDays : 0),
          fixedDueDate: st.fixedDueDate || (dt ? dt.fixedDueDate : null),
          dueDescription: st.dueDescription || (dt ? dt.dueDescription : '')
        };
      });

      // semesters.batch stores admission year ("2023"); structure batch may be "2023" or "2023-2027"
      const batchKey = String(firstStruct.batch || '').split('-')[0].trim();
      if (!batchKey) continue;

      // Match by course + batch + year_of_study (and college when present on the semester row)
      const query = `
        SELECT s.year_of_study, s.semester_number, s.start_date, s.end_date, s.batch, cl.name as college_name
        FROM semesters s
        JOIN courses c ON s.course_id = c.id
        JOIN colleges cl ON s.college_id = cl.id
        WHERE c.name = ?
          AND s.batch = ?
          AND s.year_of_study = ?
          AND cl.name = ?
          AND s.college_id IS NOT NULL
      `;
      const [semesters] = await db.query(query, [
        firstStruct.course,
        batchKey,
        firstStruct.studentYear,
        firstStruct.college
      ]);

      for (const term of activeTerms) {
        if (!term.lateFeeAmount || term.lateFeeAmount <= 0) continue;

        let dueDate = null;
        const mode = term.dueDateMode === 'fixed' ? 'fixed' : 'offset';

        if (mode === 'fixed') {
          if (!term.fixedDueDate) continue;
          const raw = term.fixedDueDate instanceof Date
            ? term.fixedDueDate.toISOString().slice(0, 10)
            : String(term.fixedDueDate).slice(0, 10);
          const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!parts) continue;
          dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
          dueDate.setHours(0, 0, 0, 0);
        } else {
          // Semester start + offset days
          const targetSem = term.referenceSemester || firstStruct.semester || 1;
          const semMatch = semesters.find(s =>
            Number(s.semester_number) === Number(targetSem) &&
            s.start_date
          );
          if (!semMatch) continue;

          const eventDateStr = semMatch.start_date;
          if (!eventDateStr) continue;

          const raw = String(eventDateStr).slice(0, 10);
          const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (parts) {
            dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
          } else {
            dueDate = new Date(eventDateStr);
          }
          dueDate.setDate(dueDate.getDate() + (term.dueOffsetDays || 0));
          dueDate.setHours(0, 0, 0, 0);
        }

        if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

        // Fetch Students matching the context
        log(`[DEBUG] Querying students for term ${term.termNumber} with params: college="${firstStruct.college}", course="${firstStruct.course}", branch="${firstStruct.branch}", batch="${firstStruct.batch}", current_year=${firstStruct.studentYear}, category="${firstStruct.category}"`);
        const studentQuery = `
          SELECT admission_number, student_name, college, course, branch, batch, stud_type
          FROM students
          WHERE college = ? AND course = ? AND branch = ? AND batch = ? 
          AND current_year = ?
          AND stud_type = ?
          AND LOWER(student_status) = 'regular'
        `;
        const [students] = await db.query(studentQuery, [
          firstStruct.college, firstStruct.course, firstStruct.branch, firstStruct.batch, 
          firstStruct.studentYear, firstStruct.category
        ]);
        log(`[DEBUG] Found ${students.length} students matching batch/category query`);

        // Check target student directly
        const [direct] = await db.query(`
          SELECT admission_number, student_name, college, course, branch, batch, stud_type, student_status, current_year
          FROM students
          WHERE admission_number = ?
        `, ['20260933']);
        log(`[DEBUG] Direct target student check: ${JSON.stringify(direct)}`);

        for (const student of students) {
          let isUnderpaid = false;
          let remarks = '';

          if (isGroupWise) {
            let anyUnderpaid = false;
            for (const struct of groupStructs) {
              const allocation = await buildStudentTermAllocation(student.admission_number, struct);
              if (isUnderpaidThroughTerm(allocation, term.termNumber)) {
                anyUnderpaid = true;
                break;
              }
            }
            isUnderpaid = anyUnderpaid;
            const headNames = groupStructs.map(s => s.feeHead.name).join(', ');
            remarks = `Group Late Fee (${headNames}) - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;
          } else {
            const allocation = await buildStudentTermAllocation(student.admission_number, firstStruct);
            isUnderpaid = isUnderpaidThroughTerm(allocation, term.termNumber);
            remarks = `${firstStruct.feeHead.name} - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;
          }

          // Fetch all existing late fee records for this student, term, year, sem under the demand head
          const existingLateFees = await StudentFee.find({
            studentId: student.admission_number,
            feeHead: demandHead._id,
            studentYear: firstStruct.studentYear,
            semester: firstStruct.semester,
            termNumber: term.termNumber
          });

          // Identify matching late fee for the current configuration
          const matchingLateFee = existingLateFees.find(item => 
            item.remarks === remarks || 
            (item.structureId && String(item.structureId) === String(firstStruct._id))
          );

          const isOverdue = dueDate && (today > dueDate);

          if (student.admission_number === '20260933') {
            log(`[DEBUG] Student 20260933 target comparison check:`);
            log(`  - isOverdue: ${isOverdue} (today: ${today.toISOString().slice(0, 10)}, dueDate: ${dueDate ? dueDate.toISOString().slice(0, 10) : 'null'})`);
            log(`  - isUnderpaid: ${isUnderpaid} (remarks: "${remarks}")`);
            log(`  - existing late fees count for term ${term.termNumber}: ${existingLateFees.length}`);
            if (existingLateFees.length > 0) {
              log(`  - existing late fees details: ${JSON.stringify(existingLateFees.map(f => ({ id: f._id, amount: f.amount, remarks: f.remarks, structureId: f.structureId })))}`);
            }
          }

          if (isOverdue && isUnderpaid) {
            // Overdue and underpaid: Ensure matching exists, delete obsolete
            if (!matchingLateFee) {
              await StudentFee.create({
                studentId: student.admission_number,
                studentName: student.student_name,
                feeHead: demandHead._id,
                structureId: firstStruct._id,
                termNumber: term.termNumber,
                college: student.college,
                course: student.course,
                branch: student.branch,
                academicYear: student.batch,
                studentYear: firstStruct.studentYear,
                semester: firstStruct.semester,
                amount: term.lateFeeAmount,
                remarks: remarks,
                stud_type: student.stud_type
              });
              results.push({ student: student.admission_number, status: 'Generated', amount: term.lateFeeAmount });
            } else {
              // Sync matching late fee details if unpaid
              const lateFeePaidTxns = await Transaction.find({
                studentId: student.admission_number,
                feeHead: demandHead._id,
                studentYear: firstStruct.studentYear,
                semester: firstStruct.semester,
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + t.amount, 0);

              if (lateFeePaid === 0) {
                let updated = false;
                if (matchingLateFee.remarks !== remarks) {
                  matchingLateFee.remarks = remarks;
                  updated = true;
                }
                if (matchingLateFee.amount !== term.lateFeeAmount) {
                  matchingLateFee.amount = term.lateFeeAmount;
                  updated = true;
                }
                if (updated) {
                  await matchingLateFee.save();
                  results.push({ student: student.admission_number, status: 'Updated Details/Amount', amount: term.lateFeeAmount });
                }
              }
            }

            // Remove any obsolete (non-matching) unpaid late fee records for this term
            const obsoleteFees = existingLateFees.filter(item => 
              !matchingLateFee || String(item._id) !== String(matchingLateFee._id)
            );
            for (const obsolete of obsoleteFees) {
              const lateFeePaidTxns = await Transaction.find({
                studentId: student.admission_number,
                feeHead: demandHead._id,
                studentYear: firstStruct.studentYear,
                semester: firstStruct.semester,
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + t.amount, 0);

              if (lateFeePaid === 0) {
                await StudentFee.findByIdAndDelete(obsolete._id);
                results.push({ student: student.admission_number, status: 'Removed Obsolete Late Fee', amount: obsolete.amount });
              }
            }

          } else {
            // Not overdue or fully paid: Delete ALL unpaid late fee records for this term
            for (const item of existingLateFees) {
              const lateFeePaidTxns = await Transaction.find({
                studentId: student.admission_number,
                feeHead: demandHead._id,
                studentYear: firstStruct.studentYear,
                semester: firstStruct.semester,
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + t.amount, 0);

              if (lateFeePaid === 0) {
                await StudentFee.findByIdAndDelete(item._id);
                results.push({ student: student.admission_number, status: 'Removed (Date/Payment Mismatch)', amount: item.amount });
              }
            }
          }
        }
      }
    }

    if (res) {
      try {
        fs.writeFileSync(logFilePath, logData);
      } catch (err) {
        console.error('Failed to write debug log file:', err);
      }
      res.json({
        message: 'Late fee processing completed',
        generated: results.length,
        skippedWithoutLateFeeHead: skipped,
        results
      });
    }
  } catch (error) {
    log(`[ERROR] Caught exception in processLateFees: ${error.message}\n${error.stack}`);
    try {
      fs.writeFileSync(logFilePath, logData);
    } catch (err) {
      console.error('Failed to write debug log file in catch:', err);
    }
    if (res) res.status(500).json({ message: 'Error processing late fees', error: error.message });
    console.error('Late Fee Processing Error:', error);
  }
};

module.exports = {
  getConfigs,
  saveConfig,
  deleteConfig,
  processLateFees,
  getDefaultConfigs,
  saveDefaultConfig,
  deleteDefaultConfig
};
