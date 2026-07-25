const LateFeeConfig = require('../models/LateFeeConfig');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');
const ServiceLateFeeConfig = require('../models/ServiceLateFeeConfig');
const {
  isDeclarationConcessionTxn,
  allocateTermBalances,
  isUnderpaidThroughTerm,
  resolveEffectiveTerms
} = require('../utils/termConcessionAllocation');

const formatLateFeeDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[dt.getMonth()];
  const yyyy = dt.getFullYear();
  return `${dd}-${mon}-${yyyy}`;
};

const extractAppliedDateLabel = (remarks) => {
  const m = String(remarks || '').match(/\|\s*Applied:\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4})/i);
  return m ? m[1] : '';
};

const stripLateFeeDateSuffix = (remarks) =>
  String(remarks || '').replace(/\s*\|\s*Due:.*$/i, '').trim();

const buildLateFeeRemarks = (base, dueDate, options = {}) => {
  const {
    appliedDate = new Date(),
    existingRemarks = ''
  } = options;
  const dueStr = formatLateFeeDate(dueDate);
  const appliedStr = extractAppliedDateLabel(existingRemarks) || formatLateFeeDate(appliedDate);
  let out = stripLateFeeDateSuffix(base);
  if (dueStr) out += ` | Due: ${dueStr}`;
  if (appliedStr) out += ` | Applied: ${appliedStr}`;
  return out;
};

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
          try {
          let isUnderpaid = false;
          let remarks = '';

          let remarksBase = '';
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
            remarksBase = `Group Late Fee (${headNames}) - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;
          } else {
            const allocation = await buildStudentTermAllocation(student.admission_number, firstStruct);
            isUnderpaid = isUnderpaidThroughTerm(allocation, term.termNumber);
            remarksBase = `${firstStruct.feeHead.name} - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;
          }
          remarks = buildLateFeeRemarks(remarksBase, dueDate);

          // Fetch all existing late fee records for this student, term, year, sem under the demand head
          const existingLateFees = await StudentFee.find({
            studentId: student.admission_number,
            feeHead: demandHead._id,
            studentYear: firstStruct.studentYear,
            semester: firstStruct.semester,
            termNumber: term.termNumber
          });

          // Identify matching late fee for the current configuration
          const matchingLateFee = existingLateFees.find(item => {
            if (item.structureId && String(item.structureId) === String(firstStruct._id)) return true;
            const base = stripLateFeeDateSuffix(item.remarks);
            return item.remarks === remarks || base === remarksBase;
          });

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
                const syncedRemarks = buildLateFeeRemarks(remarksBase, dueDate, {
                  appliedDate: matchingLateFee.createdAt || new Date(),
                  existingRemarks: matchingLateFee.remarks
                });
                if (matchingLateFee.remarks !== syncedRemarks) {
                  matchingLateFee.remarks = syncedRemarks;
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
          } catch (studentErr) {
            log(`[ERROR] Late fee failed for student ${student?.admission_number}: ${studentErr?.message || studentErr}`);
            console.error(`[processLateFees] Student ${student?.admission_number} error (continuing):`, studentErr?.message || studentErr);
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

/**
 * Resolve due date for a hostel/transport late-fee term using the student's academic calendar.
 */
const resolveServiceTermDueDate = async (term, student, studentYear) => {
  const mode = term.dueDateMode === 'fixed' ? 'fixed' : 'offset';

  if (mode === 'fixed') {
    if (!term.fixedDueDate) return null;
    const raw = term.fixedDueDate instanceof Date
      ? term.fixedDueDate.toISOString().slice(0, 10)
      : String(term.fixedDueDate).slice(0, 10);
    const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!parts) return null;
    const dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    dueDate.setHours(0, 0, 0, 0);
    return dueDate;
  }

  const batchKey = String(student.batch || '').split('-')[0].trim();
  if (!batchKey || !student.course || !student.college) return null;

  const query = `
    SELECT s.semester_number, s.start_date
    FROM semesters s
    JOIN courses c ON s.course_id = c.id
    JOIN colleges cl ON s.college_id = cl.id
    WHERE c.name = ?
      AND s.batch = ?
      AND s.year_of_study = ?
      AND cl.name = ?
      AND s.college_id IS NOT NULL
      AND s.start_date IS NOT NULL
  `;
  const [semesters] = await db.query(query, [
    student.course,
    batchKey,
    studentYear,
    student.college
  ]);

  const targetSem = Number(term.referenceSemester) || 1;
  const semMatch = (semesters || []).find(
    (s) => Number(s.semester_number) === targetSem && s.start_date
  );
  if (!semMatch) return null;

  const raw = String(semMatch.start_date).slice(0, 10);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dueDate;
  if (parts) {
    dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  } else {
    dueDate = new Date(semMatch.start_date);
  }
  dueDate.setDate(dueDate.getDate() + (Number(term.dueOffsetDays) || 0));
  dueDate.setHours(0, 0, 0, 0);
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
};

const buildServiceTermAllocation = async ({
  studentId,
  feeHeadId,
  academicYear,
  studentYear,
  defaultTerms,
  demandTotal
}) => {
  const txnFilter = {
    studentId,
    feeHead: feeHeadId,
    studentYear: String(studentYear),
    status: { $ne: 'cancelled' }
  };
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

  const terms = (defaultTerms || []).map((t, idx) => ({
    termNumber: Number(t.termNumber) || idx + 1,
    percentage: Number(t.percentage) || 0
  }));

  return allocateTermBalances({
    totalAmount: demandTotal,
    terms: terms.length ? terms : [{ termNumber: 1, percentage: 100 }],
    paidAmount,
    declarationConcession,
    applicationConcession
  });
};

// @desc    Process Hostel/Transport late fees from ServiceLateFeeConfig
// @route   POST /api/late-fees/process-service
const processServiceLateFees = async (req, res) => {
  try {
    const type = req?.body?.type || req?.query?.type || null;
    const academicYear = req?.body?.academicYear || req?.query?.academicYear || null;
    const configId = req?.body?.configId || req?.query?.configId || null;

    const filter = { isActive: { $ne: false } };
    if (type) filter.type = String(type).toUpperCase();
    if (academicYear) filter.academicYear = String(academicYear).trim();
    if (configId) filter._id = configId;

    const configs = await ServiceLateFeeConfig.find(filter)
      .populate('applicableFeeHead', 'name code')
      .populate('lateFeeRules.lateFeeHead', 'name code');

    const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true })
      .populate('lateFeeHead', 'name code');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];
    let skipped = 0;

    for (const config of configs) {
      try {
      const applicableHead = config.applicableFeeHead;
      if (!applicableHead?._id && !applicableHead) {
        skipped += 1;
        continue;
      }
      const applicableHeadId = applicableHead._id || applicableHead;
      const applicableHeadName = applicableHead.name || config.type;
      const termsCount = Number(config.defaultTermsCount) || (config.defaultTerms || []).length || 1;

      // Stamp term-division flag on applicable head demands for this year so Fee Collection
      // resolves T1/T2/... from ServiceLateFeeConfig default terms (not a single Term 1).
      await StudentFee.updateMany(
        {
          feeHead: applicableHeadId,
          academicYear: config.academicYear,
          isActive: { $ne: false }
        },
        { $set: { isTermsDivided: termsCount > 1 } }
      );

      const rule = (config.lateFeeRules || []).find(
        (r) => Number(r.termsCount) === termsCount
      );
      const fallbackDefault = defaultConfigs.find(
        (c) => Number(c.termsCount) === termsCount
      );

      const demandHead = rule?.lateFeeHead || fallbackDefault?.lateFeeHead || null;
      if (!demandHead) {
        skipped += 1;
        continue;
      }
      const demandHeadId = demandHead._id || demandHead;

      // Amounts must come from the year late-fee rule; timing may fall back to Default Rules
      if (!rule || !(rule.terms || []).some((t) => Number(t.lateFeeAmount) > 0)) {
        skipped += 1;
        continue;
      }

      const activeTerms = (rule.terms || []).map((rt, idx) => {
        const dt = fallbackDefault
          ? (fallbackDefault.terms || []).find((t) => Number(t.termNumber) === Number(rt.termNumber))
          : null;
        return {
          termNumber: Number(rt.termNumber) || idx + 1,
          lateFeeAmount: Number(rt.lateFeeAmount) || 0,
          dueDateMode: rt.dueDateMode || dt?.dueDateMode || 'offset',
          referenceSemester: rt.referenceSemester || dt?.referenceSemester || 1,
          dueOffsetDays: (rt.dueOffsetDays !== undefined && rt.dueOffsetDays !== null)
            ? Number(rt.dueOffsetDays)
            : (Number(dt?.dueOffsetDays) || 0),
          fixedDueDate: rt.fixedDueDate || dt?.fixedDueDate || null,
          dueDescription: rt.dueDescription || dt?.dueDescription || `Term ${Number(rt.termNumber) || idx + 1} Late Fee`
        };
      }).filter((t) => Number(t.lateFeeAmount) > 0);

      if (!activeTerms.length) {
        skipped += 1;
        continue;
      }

      const demands = await StudentFee.find({
        feeHead: applicableHeadId,
        academicYear: config.academicYear,
        isActive: { $ne: false }
      }).lean();

      // Group demands by student + studentYear (sum amounts for the year)
      const byStudent = {};
      for (const d of demands) {
        const key = `${d.studentId}|${d.studentYear}`;
        if (!byStudent[key]) {
          byStudent[key] = {
            studentId: d.studentId,
            studentName: d.studentName,
            college: d.college,
            course: d.course,
            branch: d.branch,
            stud_type: d.stud_type,
            studentYear: d.studentYear,
            semester: d.semester,
            amount: 0
          };
        }
        byStudent[key].amount += Number(d.amount) || 0;
      }

      for (const group of Object.values(byStudent)) {
        if (group.amount <= 0) continue;
        try {

        const [studentRows] = await db.query(
          `SELECT admission_number, student_name, college, course, branch, batch, stud_type, current_year
           FROM students WHERE admission_number = ? LIMIT 1`,
          [group.studentId]
        );
        const student = studentRows?.[0] || {
          admission_number: group.studentId,
          student_name: group.studentName,
          college: group.college,
          course: group.course,
          branch: group.branch,
          batch: null,
          stud_type: group.stud_type,
          current_year: group.studentYear
        };

        const allocation = await buildServiceTermAllocation({
          studentId: group.studentId,
          feeHeadId: applicableHeadId,
          academicYear: config.academicYear,
          studentYear: group.studentYear,
          defaultTerms: config.defaultTerms,
          demandTotal: group.amount
        });

        for (const term of activeTerms) {
          const dueDate = await resolveServiceTermDueDate(term, student, group.studentYear);
          if (!dueDate) continue;

          const isOverdue = today > dueDate;
          const isUnderpaid = isUnderpaidThroughTerm(allocation, term.termNumber);
          const remarksBase = `${applicableHeadName} (${config.academicYear}) - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;
          const remarks = buildLateFeeRemarks(remarksBase, dueDate);

          const existingLateFees = await StudentFee.find({
            studentId: group.studentId,
            feeHead: demandHeadId,
            academicYear: config.academicYear,
            studentYear: group.studentYear,
            termNumber: term.termNumber
          });

          const matchingLateFee = existingLateFees.find((item) => {
            const base = stripLateFeeDateSuffix(item.remarks);
            if (base === remarksBase || item.remarks === remarks) return true;
            const r = String(item.remarks || '');
            return r.includes(`${applicableHeadName} (${config.academicYear})`)
              && Number(item.termNumber) === Number(term.termNumber);
          });

          if (isOverdue && isUnderpaid) {
            if (!matchingLateFee) {
              await StudentFee.create({
                studentId: group.studentId,
                studentName: student.student_name || group.studentName || '',
                feeHead: demandHeadId,
                termNumber: term.termNumber,
                college: student.college || group.college || 'ANY',
                course: student.course || group.course || 'ANY',
                branch: student.branch || group.branch || 'ANY',
                academicYear: config.academicYear,
                studentYear: group.studentYear,
                semester: group.semester || null,
                amount: term.lateFeeAmount,
                remarks,
                stud_type: student.stud_type || group.stud_type
              });
              results.push({
                type: config.type,
                academicYear: config.academicYear,
                student: group.studentId,
                status: 'Generated',
                amount: term.lateFeeAmount,
                term: term.termNumber,
                dueDate: formatLateFeeDate(dueDate),
                appliedDate: formatLateFeeDate(today)
              });
            } else {
              const lateFeePaidTxns = await Transaction.find({
                studentId: group.studentId,
                feeHead: demandHeadId,
                studentYear: String(group.studentYear),
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
              if (lateFeePaid === 0) {
                let updated = false;
                const syncedRemarks = buildLateFeeRemarks(remarksBase, dueDate, {
                  appliedDate: matchingLateFee.createdAt || today,
                  existingRemarks: matchingLateFee.remarks
                });
                if (matchingLateFee.remarks !== syncedRemarks) {
                  matchingLateFee.remarks = syncedRemarks;
                  updated = true;
                }
                if (Number(matchingLateFee.amount) !== Number(term.lateFeeAmount)) {
                  matchingLateFee.amount = term.lateFeeAmount;
                  updated = true;
                }
                if (updated) {
                  await matchingLateFee.save();
                  results.push({
                    type: config.type,
                    academicYear: config.academicYear,
                    student: group.studentId,
                    status: 'Updated',
                    amount: term.lateFeeAmount,
                    term: term.termNumber,
                    dueDate: formatLateFeeDate(dueDate),
                    appliedDate: extractAppliedDateLabel(syncedRemarks) || formatLateFeeDate(matchingLateFee.createdAt || today)
                  });
                }
              }
            }
          } else {
            for (const item of existingLateFees) {
              const base = stripLateFeeDateSuffix(item.remarks);
              const isOurs = base === remarksBase
                || item.remarks === remarks
                || String(item.remarks || '').includes(`${applicableHeadName} (${config.academicYear})`);
              if (!isOurs) continue;
              const lateFeePaidTxns = await Transaction.find({
                studentId: group.studentId,
                feeHead: demandHeadId,
                studentYear: String(group.studentYear),
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
              if (lateFeePaid === 0) {
                await StudentFee.findByIdAndDelete(item._id);
                results.push({
                  type: config.type,
                  academicYear: config.academicYear,
                  student: group.studentId,
                  status: 'Removed (not overdue / paid)',
                  amount: item.amount,
                  term: term.termNumber
                });
              }
            }
          }
        }
        } catch (groupErr) {
          console.error(
            `[processServiceLateFees] Student ${group?.studentId} / ${config?.academicYear} failed (continuing):`,
            groupErr?.message || groupErr
          );
        }
      }
      } catch (configErr) {
        skipped += 1;
        console.error(
          `[processServiceLateFees] Config ${config?.type} ${config?.academicYear} failed (continuing):`,
          configErr?.message || configErr
        );
        if (configErr?.stack) console.error(configErr.stack);
      }
    }

    if (res) {
      res.json({
        message: 'Hostel/Transport late fee processing completed',
        generated: results.filter((r) => r.status === 'Generated').length,
        updated: results.filter((r) => r.status === 'Updated').length,
        skippedConfigs: skipped,
        results
      });
    }
    return results;
  } catch (error) {
    console.error('Service Late Fee Processing Error:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    if (res) {
      return res.status(500).json({ message: 'Error processing hostel/transport late fees', error: error.message });
    }
    // Scheduler / background call — never rethrow (would crash the nightly runner)
    return null;
  }
};

// @desc    Get Hostel/Transport year configs
// @route   GET /api/late-fees/service-config
const getServiceLateFeeConfigs = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = String(type).toUpperCase();

    const configs = await ServiceLateFeeConfig.find(filter)
      .populate('applicableFeeHead', 'name code')
      .populate('lateFeeRules.lateFeeHead', 'name code')
      .sort({ academicYear: -1, type: 1 });

    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching service late fee configs', error: error.message });
  }
};

const equalPctFallback = (mappedTerms) => {
  const hasAll = mappedTerms.every((t) => Number.isFinite(t.percentage) && t.percentage >= 0);
  if (hasAll) return mappedTerms;
  const base = Math.floor(100 / mappedTerms.length);
  const rem = 100 - base * mappedTerms.length;
  return mappedTerms.map((t, i) => ({
    ...t,
    percentage: base + (i === mappedTerms.length - 1 ? rem : 0)
  }));
};

const populateServiceConfig = (id) =>
  ServiceLateFeeConfig.findById(id)
    .populate('applicableFeeHead', 'name code')
    .populate('lateFeeRules.lateFeeHead', 'name code');

// @desc    Save year default terms only (applicable head + terms count + % split)
// @route   POST /api/late-fees/service-config
// Does NOT touch lateFeeRules — those are saved separately.
const saveServiceLateFeeConfig = async (req, res) => {
  try {
    const {
      _id,
      id,
      type,
      academicYear,
      applicableFeeHead,
      defaultTermsCount,
      defaultTerms,
      termsCount, // legacy alias
      terms, // legacy alias for defaultTerms
      isActive
    } = req.body;
    const configId = _id || id;

    if (!type || !['HOSTEL', 'TRANSPORT'].includes(String(type).toUpperCase())) {
      return res.status(400).json({ message: 'type must be HOSTEL or TRANSPORT' });
    }
    if (!academicYear || !String(academicYear).trim()) {
      return res.status(400).json({ message: 'academicYear is required' });
    }
    if (!applicableFeeHead) {
      return res.status(400).json({ message: 'applicableFeeHead is required' });
    }

    const count = Number(defaultTermsCount || termsCount);
    if (!count || count < 1) {
      return res.status(400).json({ message: 'defaultTermsCount must be at least 1' });
    }

    const srcTerms = Array.isArray(defaultTerms) && defaultTerms.length
      ? defaultTerms
      : (Array.isArray(terms) ? terms : []);

    if (!srcTerms.length) {
      return res.status(400).json({ message: 'defaultTerms are required' });
    }

    let mappedTerms = equalPctFallback(
      srcTerms.map((t, idx) => ({
        termNumber: Number(t.termNumber) || idx + 1,
        percentage: Number(t.percentage)
      }))
    ).slice(0, count);

    while (mappedTerms.length < count) {
      mappedTerms.push({ termNumber: mappedTerms.length + 1, percentage: 0 });
    }
    mappedTerms = equalPctFallback(mappedTerms);

    const pctSum = mappedTerms.reduce((s, t) => s + (Number(t.percentage) || 0), 0);
    if (Math.abs(pctSum - 100) > 0.01) {
      return res.status(400).json({
        message: `Default term percentages must total 100% (currently ${pctSum}%)`
      });
    }

    const normalizedType = String(type).toUpperCase();
    const normalizedYear = String(academicYear).trim();

    const yearDefaults = {
      type: normalizedType,
      academicYear: normalizedYear,
      applicableFeeHead,
      defaultTermsCount: count,
      defaultTerms: mappedTerms,
      isActive: isActive !== undefined ? !!isActive : true
    };

    let config;
    if (configId) {
      config = await ServiceLateFeeConfig.findByIdAndUpdate(
        configId,
        { $set: yearDefaults },
        { new: true, runValidators: true }
      );
      if (!config) return res.status(404).json({ message: 'Service config not found' });
    } else {
      config = await ServiceLateFeeConfig.findOneAndUpdate(
        { type: normalizedType, academicYear: normalizedYear },
        {
          $set: yearDefaults,
          $setOnInsert: { lateFeeRules: [] }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const populated = await populateServiceConfig(config._id);

    // Mark applicable-head demands for this year as terms-divided so Fee Collection
    // uses the saved default % split immediately (not only after late-fee sync).
    await StudentFee.updateMany(
      {
        feeHead: applicableFeeHead,
        academicYear: normalizedYear,
        isActive: { $ne: false }
      },
      { $set: { isTermsDivided: count > 1 } }
    );

    res.status(configId ? 200 : 201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A configuration already exists for this type and academic year'
      });
    }
    res.status(500).json({ message: 'Error saving year default terms', error: error.message });
  }
};

// @desc    Upsert one late-fee rule (by termsCount) for a year — independent of defaultTermsCount
// @route   POST /api/late-fees/service-config/late-fee-rule
const saveServiceLateFeeRule = async (req, res) => {
  try {
    const { type, academicYear, termsCount, lateFeeHead, terms } = req.body;

    if (!type || !['HOSTEL', 'TRANSPORT'].includes(String(type).toUpperCase())) {
      return res.status(400).json({ message: 'type must be HOSTEL or TRANSPORT' });
    }
    if (!academicYear || !String(academicYear).trim()) {
      return res.status(400).json({ message: 'academicYear is required' });
    }
    if (!termsCount || Number(termsCount) < 1) {
      return res.status(400).json({ message: 'termsCount must be at least 1' });
    }
    if (!lateFeeHead) {
      return res.status(400).json({ message: 'lateFeeHead is required' });
    }
    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ message: 'At least one late-fee term is required' });
    }

    const normalizedType = String(type).toUpperCase();
    const normalizedYear = String(academicYear).trim();
    const count = Number(termsCount);

    const rule = {
      termsCount: count,
      lateFeeHead,
      terms: terms.map((t, idx) => ({
        termNumber: Number(t.termNumber) || idx + 1,
        lateFeeAmount: Number(t.lateFeeAmount ?? t.amount) || 0,
        dueDateMode: t.dueDateMode || 'offset',
        referenceSemester: Number(t.referenceSemester) || 1,
        dueOffsetDays: Number(t.dueOffsetDays ?? t.offsetDays) || 0,
        fixedDueDate: t.fixedDueDate || null,
        dueDescription: t.dueDescription || `Term ${Number(t.termNumber) || idx + 1} Late Fee`
      }))
    };

    let config = await ServiceLateFeeConfig.findOne({ type: normalizedType, academicYear: normalizedYear });
    if (!config) {
      return res.status(400).json({
        message: 'Save year default terms first (Section 1), then add late-fee rules for any terms count'
      });
    }

    const rules = Array.isArray(config.lateFeeRules) ? [...config.lateFeeRules] : [];
    const existingIdx = rules.findIndex((r) => Number(r.termsCount) === count);
    if (existingIdx >= 0) {
      rules[existingIdx] = { ...rules[existingIdx].toObject?.() || rules[existingIdx], ...rule };
    } else {
      rules.push(rule);
    }
    rules.sort((a, b) => Number(a.termsCount) - Number(b.termsCount));
    config.lateFeeRules = rules;
    await config.save();

    const populated = await populateServiceConfig(config._id);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Error saving late fee rule', error: error.message });
  }
};

// @desc    Delete one late-fee rule by termsCount from a year config
// @route   DELETE /api/late-fees/service-config/:id/late-fee-rule/:termsCount
const deleteServiceLateFeeRule = async (req, res) => {
  try {
    const termsCount = Number(req.params.termsCount);
    const config = await ServiceLateFeeConfig.findById(req.params.id);
    if (!config) return res.status(404).json({ message: 'Service config not found' });

    config.lateFeeRules = (config.lateFeeRules || []).filter(
      (r) => Number(r.termsCount) !== termsCount
    );
    await config.save();

    const populated = await populateServiceConfig(config._id);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Error removing late fee rule', error: error.message });
  }
};

// @desc    Delete entire Hostel/Transport year config
// @route   DELETE /api/late-fees/service-config/:id
const deleteServiceLateFeeConfig = async (req, res) => {
  try {
    const deleted = await ServiceLateFeeConfig.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Service late fee config not found' });
    res.json({ message: 'Service late fee configuration removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing service late fee config', error: error.message });
  }
};

module.exports = {
  getConfigs,
  saveConfig,
  deleteConfig,
  processLateFees,
  processServiceLateFees,
  getDefaultConfigs,
  saveDefaultConfig,
  deleteDefaultConfig,
  getServiceLateFeeConfigs,
  saveServiceLateFeeConfig,
  saveServiceLateFeeRule,
  deleteServiceLateFeeRule,
  deleteServiceLateFeeConfig
};
