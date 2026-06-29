const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');
const db = require('../config/sqlDb');
const {
  buildRevisedFeesMap,
  buildConcessionLookupKey,
  resolveStudentFeeAmount,
  buildFeeHeadMaps
} = require('../utils/overallConcessionFees');

const STUDENT_SELECT = `
  SELECT id, admission_number, student_name, current_year, batch, current_semester,
         college, course, branch, stud_type
  FROM students
  WHERE admission_number = ?
`;

const loadRevisedFeesMapForStudent = async (admissionNo) => {
  const [concessions] = await db.query(
    `SELECT revised_fees FROM overall_concessions WHERE admission_number = ?`,
    [admissionNo]
  );

  if (concessions.length === 0) return {};

  const fees = typeof concessions[0].revised_fees === 'string'
    ? JSON.parse(concessions[0].revised_fees)
    : (concessions[0].revised_fees || []);

  const feeHeads = await FeeHead.find({}).lean();
  const { codeMap } = buildFeeHeadMaps(feeHeads);
  return buildRevisedFeesMap(fees, codeMap);
};

const resolveTargetAmount = (structureAmount, revisedFeesMap, fs) => {
  const fsKey = buildConcessionLookupKey(
    fs.feeHead.toString(),
    fs.studentYear,
    fs.semester
  );

  if (revisedFeesMap[fsKey] === undefined) {
    return structureAmount;
  }

  return resolveStudentFeeAmount(structureAmount, revisedFeesMap[fsKey]);
};

const syncClubFees = async (student, admissionNo) => {
  let created = 0;
  const [approvedClubs] = await db.query(`
    SELECT cm.club_id, c.membership_fee, c.name
    FROM club_members cm
    JOIN clubs c ON cm.club_id = c.id
    WHERE cm.student_id = ? AND cm.status = 'approved'
  `, [student.id]);

  if (approvedClubs.length === 0) return { created };

  const clubFeeHead = await FeeHead.findOne({ code: 'CF' });
  if (!clubFeeHead) return { created };

  for (const club of approvedClubs) {
    const remarksKey = `Club Fee: ${club.name}`;
    const existingFee = await StudentFee.findOne({
      studentId: admissionNo,
      feeHead: clubFeeHead._id,
      remarks: remarksKey
    });

    if (!existingFee) {
      await StudentFee.create({
        studentId: admissionNo,
        studentName: student.student_name || '',
        feeHead: clubFeeHead._id,
        college: student.college || 'ANY',
        course: student.course || 'ANY',
        branch: student.branch || 'ANY',
        academicYear: student.batch,
        studentYear: student.current_year,
        semester: student.current_semester || 1,
        amount: Number(club.membership_fee),
        remarks: remarksKey
      });
      created += 1;
    }
  }

  return { created };
};

const syncStandardFees = async (student, admissionNo) => {
  let created = 0;
  let updated = 0;

  const category = student.stud_type || 'Regular';
  const applicableStructures = await FeeStructure.find({
    college: student.college,
    course: student.course,
    branch: student.branch,
    batch: student.batch,
    category
  }).lean();

  if (applicableStructures.length === 0) {
    return { created, updated, structuresMatched: 0 };
  }

  const revisedFeesMap = await loadRevisedFeesMapForStudent(admissionNo);

  for (const fs of applicableStructures) {
    const targetAmount = resolveTargetAmount(fs.amount, revisedFeesMap, fs);
    const existingFee = await StudentFee.findOne({
      studentId: admissionNo,
      feeHead: fs.feeHead,
      academicYear: fs.batch,
      studentYear: fs.studentYear,
      semester: fs.semester || null,
      $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
    });

    if (!existingFee) {
      await StudentFee.create({
        studentId: admissionNo,
        studentName: student.student_name,
        feeHead: fs.feeHead,
        structureId: fs._id,
        college: student.college,
        course: student.course,
        branch: student.branch,
        academicYear: fs.batch,
        studentYear: fs.studentYear,
        semester: fs.semester || null,
        amount: targetAmount,
        batch: student.batch,
        stud_type: fs.category,
        isScholarshipApplicable: fs.isScholarshipApplicable || false,
        isTermsDivided: fs.isTermsDivided || false
      });
      created += 1;
    } else if (existingFee.amount !== targetAmount) {
      existingFee.amount = targetAmount;
      await existingFee.save();
      updated += 1;
    }
  }

  return { created, updated, structuresMatched: applicableStructures.length };
};

const fetchStudentByAdmissionNumber = async (admissionNo) => {
  const [students] = await db.query(STUDENT_SELECT, [admissionNo]);
  return students[0] || null;
};

const syncStudentFeesByAdmissionNumber = async (admissionNo) => {
  const student = await fetchStudentByAdmissionNumber(admissionNo);
  if (!student) {
    const error = new Error('Student not found');
    error.statusCode = 404;
    throw error;
  }

  const clubResult = await syncClubFees(student, admissionNo);
  const standardResult = await syncStandardFees(student, admissionNo);

  return {
    admissionNumber: admissionNo,
    clubFeesCreated: clubResult.created,
    standardFeesCreated: standardResult.created,
    standardFeesUpdated: standardResult.updated,
    structuresMatched: standardResult.structuresMatched
  };
};

module.exports = {
  fetchStudentByAdmissionNumber,
  syncClubFees,
  syncStandardFees,
  syncStudentFeesByAdmissionNumber,
  loadRevisedFeesMapForStudent,
  resolveTargetAmount
};
