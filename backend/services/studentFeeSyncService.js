const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
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

const normalizeSemester = (semester) => {
  if (semester === null || semester === undefined || semester === '') return null;
  return Number(semester);
};

const getTransactionsForDemand = async (admissionNo, feeHeadId, studentYear) => (
  Transaction.find({
    studentId: admissionNo,
    feeHead: feeHeadId,
    studentYear: String(studentYear),
    status: { $ne: 'cancelled' }
  }).sort({ paymentDate: 1 })
);

const resolveSemesterForDemand = async (admissionNo, feeHeadId, studentYear, preferredSemester) => {
  const txs = await getTransactionsForDemand(admissionNo, feeHeadId, studentYear);
  if (txs.length > 0) {
    return normalizeSemester(txs[0].semester);
  }
  return preferredSemester ?? null;
};

const findMergeableStudentFee = async ({
  admissionNo,
  feeHeadId,
  academicYear,
  studentYear,
  semester,
  remarks,
  matchByRemarks = false
}) => {
  if (matchByRemarks && remarks) {
    const byRemarks = await StudentFee.findOne({
      studentId: admissionNo,
      feeHead: feeHeadId,
      remarks
    });
    if (byRemarks) return byRemarks;
  }

  const exact = await StudentFee.findOne({
    studentId: admissionNo,
    feeHead: feeHeadId,
    academicYear,
    studentYear,
    semester: semester ?? null
  });
  if (exact) return exact;

  const sameYearFees = await StudentFee.find({
    studentId: admissionNo,
    feeHead: feeHeadId,
    academicYear,
    studentYear
  }).sort({ createdAt: 1 });

  if (sameYearFees.length > 0) {
    const txs = await getTransactionsForDemand(admissionNo, feeHeadId, studentYear);
    if (txs.length > 0) {
      const txSemester = normalizeSemester(txs[0].semester);
      const matched = sameYearFees.find(f => normalizeSemester(f.semester) === txSemester);
      if (matched) return matched;

      const nullSemFee = sameYearFees.find(f => normalizeSemester(f.semester) === null);
      if (nullSemFee) return nullSemFee;

      return sameYearFees[0];
    }

    const sameSemesterFees = sameYearFees.filter(
      f => normalizeSemester(f.semester) === normalizeSemester(semester)
    );
    if (sameSemesterFees.length > 0) return sameSemesterFees[0];
  }

  const txs = await getTransactionsForDemand(admissionNo, feeHeadId, studentYear);
  if (txs.length > 0) {
    const broaderMatch = await StudentFee.findOne({
      studentId: admissionNo,
      feeHead: feeHeadId,
      studentYear
    }).sort({ createdAt: 1 });
    if (broaderMatch) return broaderMatch;
  }

  return null;
};

const consolidateStudentFeeDemands = async (admissionNo, feeHeadId, academicYear, studentYear) => {
  const allFees = await StudentFee.find({
    studentId: admissionNo,
    feeHead: feeHeadId,
    academicYear,
    studentYear
  }).sort({ createdAt: 1 });

  if (allFees.length <= 1) return;

  const txs = await getTransactionsForDemand(admissionNo, feeHeadId, studentYear);
  let fees = allFees;

  if (txs.length === 0) {
    const distinctSemesters = new Set(allFees.map(f => normalizeSemester(f.semester)));
    if (distinctSemesters.size > 1) return;
  } else {
    const txSemester = normalizeSemester(txs[0].semester);
    fees = allFees.filter(f => {
      const feeSemester = normalizeSemester(f.semester);
      return feeSemester === txSemester || feeSemester === null || txSemester === null;
    });
    if (fees.length <= 1) return;
  }

  const txSemester = txs.length > 0 ? normalizeSemester(txs[0].semester) : null;

  let canonical = fees.find(f => normalizeSemester(f.semester) === txSemester)
    || fees.find(f => (f.amount || 0) > 0)
    || fees[0];

  const maxAmount = Math.max(...fees.map(f => Number(f.amount) || 0));
  if (maxAmount > (canonical.amount || 0)) {
    canonical.amount = maxAmount;
  }

  if (txs.length > 0) {
    canonical.semester = txSemester;
  }

  const bestRemarks = fees.find(f => f.remarks)?.remarks;
  if (bestRemarks && !canonical.remarks) {
    canonical.remarks = bestRemarks;
  }

  await canonical.save();

  for (const fee of fees) {
    if (fee._id.equals(canonical._id)) continue;
    await StudentFee.deleteOne({ _id: fee._id });
  }
};

const upsertStudentFeeDemand = async ({
  admissionNo,
  student,
  feeHeadId,
  academicYear,
  studentYear,
  semester,
  amount,
  remarks,
  matchByRemarks = false,
  extraFields = {}
}) => {
  let created = 0;
  let updated = 0;

  const existingFee = await findMergeableStudentFee({
    admissionNo,
    feeHeadId,
    academicYear,
    studentYear,
    semester,
    remarks,
    matchByRemarks
  });

  if (existingFee) {
    let changed = false;

    if (Number(existingFee.amount) !== Number(amount)) {
      existingFee.amount = amount;
      changed = true;
    }

    if (remarks && existingFee.remarks !== remarks) {
      existingFee.remarks = remarks;
      changed = true;
    }

    Object.entries(extraFields).forEach(([key, value]) => {
      if (value !== undefined && existingFee[key] !== value) {
        existingFee[key] = value;
        changed = true;
      }
    });

    if (changed) {
      await existingFee.save();
      updated += 1;
    }

    await consolidateStudentFeeDemands(admissionNo, feeHeadId, academicYear, studentYear);
    return { created, updated };
  }

  const resolvedSemester = await resolveSemesterForDemand(
    admissionNo,
    feeHeadId,
    studentYear,
    semester
  );

  await StudentFee.create({
    studentId: admissionNo,
    studentName: student.student_name || '',
    feeHead: feeHeadId,
    college: student.college || 'ANY',
    course: student.course || 'ANY',
    branch: student.branch || 'ANY',
    academicYear,
    studentYear,
    semester: resolvedSemester,
    amount,
    batch: student.batch,
    stud_type: student.stud_type,
    remarks: remarks || undefined,
    ...extraFields
  });
  created += 1;

  await consolidateStudentFeeDemands(admissionNo, feeHeadId, academicYear, studentYear);
  return { created, updated };
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

const findTransportFeeHead = async () => {
  let feeHead = await FeeHead.findOne({ name: 'Transport Fee' });
  if (!feeHead) {
    feeHead = await FeeHead.findOne({ code: { $in: ['TRN', 'TRN01'] } });
  }
  return feeHead;
};

const buildTransportRemarks = (routeName, stageName) => {
  const route = (routeName || '').trim();
  const stage = (stageName || '').trim();
  return `Transport: ${route} - ${stage}`;
};

const syncTransportFees = async (student, admissionNo) => {
  let created = 0;
  let updated = 0;

  const [requests] = await db.query(`
    SELECT route_name, stage_name, fare, academic_year, year_of_study, semester_number
    FROM transport_requests
    WHERE admission_number = ? AND status = 'approved'
    ORDER BY updated_at DESC
  `, [admissionNo]);

  if (requests.length === 0) {
    return { created, updated, requestsMatched: 0 };
  }

  const transportFeeHead = await findTransportFeeHead();
  if (!transportFeeHead) {
    return { created, updated, requestsMatched: requests.length };
  }

  for (const request of requests) {
    const academicYear = request.academic_year;
    if (!academicYear) continue;

    const studentYear = request.year_of_study || student.current_year || 1;
    const semester = request.semester_number || student.current_semester || 1;
    const amount = Number(request.fare) || 0;
    const remarks = buildTransportRemarks(request.route_name, request.stage_name);

    const result = await upsertStudentFeeDemand({
      admissionNo,
      student,
      feeHeadId: transportFeeHead._id,
      academicYear,
      studentYear,
      semester,
      amount,
      remarks,
      matchByRemarks: true
    });
    created += result.created;
    updated += result.updated;
  }

  return { created, updated, requestsMatched: requests.length };
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
    const result = await upsertStudentFeeDemand({
      admissionNo,
      student,
      feeHeadId: fs.feeHead,
      academicYear: fs.batch,
      studentYear: fs.studentYear,
      semester: fs.semester || null,
      amount: targetAmount,
      extraFields: {
        structureId: fs._id,
        stud_type: fs.category,
        isScholarshipApplicable: fs.isScholarshipApplicable || false,
        isTermsDivided: fs.isTermsDivided || false
      }
    });
    created += result.created;
    updated += result.updated;
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
  const transportResult = await syncTransportFees(student, admissionNo);
  const standardResult = await syncStandardFees(student, admissionNo);

  return {
    admissionNumber: admissionNo,
    clubFeesCreated: clubResult.created,
    transportFeesCreated: transportResult.created,
    transportFeesUpdated: transportResult.updated,
    transportRequestsMatched: transportResult.requestsMatched,
    standardFeesCreated: standardResult.created,
    standardFeesUpdated: standardResult.updated,
    structuresMatched: standardResult.structuresMatched
  };
};

module.exports = {
  fetchStudentByAdmissionNumber,
  syncClubFees,
  syncTransportFees,
  syncStandardFees,
  syncStudentFeesByAdmissionNumber,
  loadRevisedFeesMapForStudent,
  resolveTargetAmount
};
