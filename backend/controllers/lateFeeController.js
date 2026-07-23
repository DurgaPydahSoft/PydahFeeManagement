const LateFeeConfig = require('../models/LateFeeConfig');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');

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
  try {
    // Optional: sync a single structure (manual trigger from UI)
    const structureId = req?.body?.structureId || req?.query?.structureId || null;

    // Load active default configurations
    const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true })
      .populate('lateFeeHead');

    const queryFilter = {};
    if (structureId) {
      queryFilter._id = structureId;
    }

    const structures = await FeeStructure.find(queryFilter)
      .populate('feeHead')
      .populate('lateFeeHead');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];
    let skipped = 0;

    for (const struct of structures) {
      // Late fee is ONLY applicable if the structure has terms with lateFeeAmount > 0
      const hasStructureLateFee = Array.isArray(struct.terms) && struct.terms.some(t => Number(t.lateFeeAmount) > 0);
      
      if (!hasStructureLateFee) {
        skipped += 1;
        continue;
      }

      // Find matching default configuration for timing rules
      const structTermsCount = Array.isArray(struct.terms) ? struct.terms.length : 1;
      const config = defaultConfigs.find(c => Number(c.termsCount) === Number(structTermsCount));

      // Resolve demand head from the structure itself, or fall back to default config's lateFeeHead
      const demandHead = struct.lateFeeHead || (config ? config.lateFeeHead : null);
      if (!demandHead) {
        console.warn(`Skipping structure ${struct._id}: no lateFeeHead configured on structure or default config`);
        skipped += 1;
        continue;
      }

      // Map timing parameters from default config onto structure terms
      const activeTerms = struct.terms.map(st => {
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
      const batchKey = String(struct.batch || '').split('-')[0].trim();
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
        struct.course,
        batchKey,
        struct.studentYear,
        struct.college
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
          const targetSem = term.referenceSemester || struct.semester || 1;
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
        const studentQuery = `
          SELECT admission_number, student_name, college, course, branch, batch, stud_type
          FROM students
          WHERE college = ? AND course = ? AND branch = ? AND batch = ? 
          AND current_year = ?
          AND stud_type = ?
          AND LOWER(student_status) = 'regular'
        `;
        const [students] = await db.query(studentQuery, [
          struct.college, struct.course, struct.branch, struct.batch, 
          struct.studentYear, struct.category
        ]);

        for (const student of students) {
          // Check required amount up to this term
          const relevantTerms = activeTerms.filter(t => t.termNumber <= term.termNumber);
          const requiredAmount = relevantTerms.reduce((sum, t) => sum + t.amount, 0);

          // Fetch total paid for this head/year/sem
          const paidTransactions = await Transaction.find({
            studentId: student.admission_number,
            feeHead: struct.feeHead._id,
            studentYear: struct.studentYear,
            semester: struct.semester,
            status: { $ne: 'cancelled' }
          });
          const totalPaid = paidTransactions.reduce((sum, t) => sum + t.amount, 0);

          const remarks = `${struct.feeHead.name} - ${term.dueDescription || `Term ${term.termNumber}`} - ₹${term.lateFeeAmount}`;

          // Check if already applied using structureId and termNumber
          let existingLateFee = await StudentFee.findOne({
            studentId: student.admission_number,
            feeHead: demandHead._id,
            studentYear: struct.studentYear,
            semester: struct.semester,
            structureId: struct._id,
            termNumber: term.termNumber
          });
          if (!existingLateFee) {
            existingLateFee = await StudentFee.findOne({
              studentId: student.admission_number,
              feeHead: demandHead._id,
              remarks: remarks
            });
          }

          const isOverdue = dueDate && (today > dueDate);
          const isUnderpaid = totalPaid < requiredAmount;

          if (isOverdue && isUnderpaid) {
            if (!existingLateFee) {
              await StudentFee.create({
                studentId: student.admission_number,
                studentName: student.student_name,
                feeHead: demandHead._id,
                structureId: struct._id,
                termNumber: term.termNumber,
                college: student.college,
                course: student.course,
                branch: student.branch,
                academicYear: student.batch,
                studentYear: struct.studentYear,
                semester: struct.semester,
                amount: term.lateFeeAmount,
                remarks: remarks,
                stud_type: student.stud_type
              });
              results.push({ student: student.admission_number, status: 'Generated', amount: term.lateFeeAmount });
            } else {
              // If it already exists but is unpaid, sync updated details/remarks and amount!
              const lateFeePaidTxns = await Transaction.find({
                studentId: student.admission_number,
                feeHead: demandHead._id,
                studentYear: struct.studentYear,
                semester: struct.semester,
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + t.amount, 0);

              if (lateFeePaid === 0) {
                let updated = false;
                if (existingLateFee.remarks !== remarks) {
                  existingLateFee.remarks = remarks;
                  updated = true;
                }
                if (existingLateFee.amount !== term.lateFeeAmount) {
                  existingLateFee.amount = term.lateFeeAmount;
                  updated = true;
                }
                if (updated) {
                  await existingLateFee.save();
                  results.push({ student: student.admission_number, status: 'Updated Details/Amount', amount: term.lateFeeAmount });
                }
              }
            }
          } else {
            // Date mismatch (not overdue anymore / future date) OR main fee fully paid!
            // Remove previously generated unpaid late fee demand if present
            if (existingLateFee) {
              const lateFeePaidTxns = await Transaction.find({
                studentId: student.admission_number,
                feeHead: demandHead._id,
                studentYear: struct.studentYear,
                semester: struct.semester,
                status: { $ne: 'cancelled' }
              });
              const lateFeePaid = lateFeePaidTxns.reduce((sum, t) => sum + t.amount, 0);

              if (lateFeePaid === 0) {
                await StudentFee.findByIdAndDelete(existingLateFee._id);
                results.push({ student: student.admission_number, status: 'Removed (Date/Payment Mismatch)', amount: existingLateFee.amount });
              }
            }
          }
        }
      }
    }

    if (res) {
      res.json({
        message: 'Late fee processing completed',
        generated: results.length,
        skippedWithoutLateFeeHead: skipped,
        results
      });
    }
  } catch (error) {
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
