const LateFeeConfig = require('../models/LateFeeConfig');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');

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

// @desc    Process Late Fees for all active configurations
// @route   POST /api/late-fees/process (Can be triggered manually or by scheduler)
const processLateFees = async (req, res) => {
  try {
    // 1. Fetch all Fee Structures that have at least one term with a late fee configured
    const structures = await FeeStructure.find({ 
      'terms.lateFeeAmount': { $gt: 0 } 
    }).populate('feeHead');

    const lateFeeHead = await FeeHead.findOne({ code: 'LF01' });

    if (!lateFeeHead) {
      if (res) return res.status(500).json({ message: 'Late Fee head (LF01) not found.' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];

    for (const struct of structures) {
      // Fetch semester dates for this struct's context
      const query = `
        SELECT s.student_year, s.semester_number, s.start_date, s.end_date, ay.year_label
        FROM semesters s
        JOIN academic_years ay ON s.academic_year_id = ay.id
        JOIN courses c ON s.course_id = c.id
        WHERE c.name = ? AND ay.year_label LIKE ?
      `;
      const [semesters] = await db.query(query, [struct.course, `${struct.batch}%`]);

      for (const term of struct.terms) {
        if (!term.lateFeeAmount || term.lateFeeAmount <= 0) continue;

        // Find matching semester date based on term's referenceSemester
        // Fallback to structure's semester or semester_number from SQL if not specified
        const targetSem = term.referenceSemester || struct.semester || 1;
        
        const semMatch = semesters.find(s => 
          Number(s.student_year) === Number(struct.studentYear) && 
          Number(s.semester_number) === Number(targetSem)
        );

        if (!semMatch) continue;

        // Note: The user image shows "Days from Semester Start". 
        // We'll use start_date as the reference.
        const eventDateStr = semMatch.start_date;
        if (!eventDateStr) continue;

        const dueDate = new Date(eventDateStr);
        dueDate.setDate(dueDate.getDate() + (term.dueOffsetDays || 0));
        dueDate.setHours(0, 0, 0, 0);

        if (today > dueDate) {
          // TERM IS OVERDUE!
          console.log(`Processing Overdue Term ${term.termNumber} for ${struct.course} - ${struct.category} - Batch ${struct.batch}`);
          
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
            const relevantTerms = struct.terms.filter(t => t.termNumber <= term.termNumber);
            const requiredAmount = relevantTerms.reduce((sum, t) => sum + t.amount, 0);

            // Fetch total paid for this head/year/sem
            const paidTransactions = await Transaction.find({
              studentId: student.admission_number,
              feeHead: struct.feeHead._id,
              studentYear: struct.studentYear,
              semester: struct.semester
            });
            const totalPaid = paidTransactions.reduce((sum, t) => sum + t.amount, 0);

            if (totalPaid < requiredAmount) {
              const remarks = `Late Fee: ${struct.feeHead.name} - Term ${term.termNumber}${term.dueDescription ? ` (${term.dueDescription})` : ''}`;

              // Check if already applied using structureId and termNumber (More robust than checking remarks)
              let existingLateFee = await StudentFee.findOne({
                studentId: student.admission_number,
                feeHead: lateFeeHead._id,
                studentYear: struct.studentYear,
                semester: struct.semester,
                structureId: struct._id,
                termNumber: term.termNumber
              });
              if (!existingLateFee) {
                existingLateFee = await StudentFee.findOne({
                  studentId: student.admission_number,
                  feeHead: lateFeeHead._id,
                  remarks: remarks // Matches the current description exactly
                });
              }

              if (!existingLateFee) {
                await StudentFee.create({
                  studentId: student.admission_number,
                  studentName: student.student_name,
                  feeHead: lateFeeHead._id,
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
              }
            }
          }
        }
      }
    }

    if (res) res.json({ message: 'Late fee processing completed', results });
  } catch (error) {
    if (res) res.status(500).json({ message: 'Error processing late fees', error: error.message });
    console.error('Late Fee Processing Error:', error);
  }
};

module.exports = {
  getConfigs,
  saveConfig,
  deleteConfig,
  processLateFees
};
