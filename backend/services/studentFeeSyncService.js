const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const OverallConcessionRequest = require('../models/OverallConcessionRequest');
const db = require('../config/sqlDb');
const { getHostelConnection } = require('../config/dbHostel');
const { getTransportConnection } = require('../config/dbTransport');
const {
  buildRevisedFeesMap,
  buildConcessionLookupKey,
  resolveStudentFeeAmount,
  buildFeeHeadMaps
} = require('../utils/overallConcessionFees');
const { applyRevisedConcessionTransactions, cancelAllDeclarationConcessionTransactions } = require('./overallConcessionRevisedService');

const STUDENT_SELECT = `
  SELECT id, admission_number, student_name, current_year, batch, current_semester,
         college, course, branch, stud_type
  FROM students
  WHERE admission_number = ?
`;

/**
 * Only APPROVED overall-concession requests drive revised demand + DECL credits
 * during nightly sync. Pending/rejected/direct SQL rows alone are ignored here.
 */
const loadApprovedOverallConcessionEntries = async (admissionNo) => {
  const approved = await OverallConcessionRequest.findOne({
    admissionNumber: admissionNo,
    status: 'APPROVED'
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  if (!approved || !Array.isArray(approved.concessions) || approved.concessions.length === 0) {
    return [];
  }
  return approved.concessions;
};

const loadRevisedFeesMapForStudent = async (admissionNo) => {
  const fees = await loadApprovedOverallConcessionEntries(admissionNo);
  if (fees.length === 0) return {};

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

/** Match Number or String studentYear stored in Mongo. */
const studentYearQuery = (studentYear) => {
  const n = Number(studentYear);
  if (!Number.isFinite(n)) return studentYear;
  return { $in: [n, String(n)] };
};

const isVagueTransportRemarks = (remarks) => {
  const existing = String(remarks || '').trim();
  return !existing || /^transport$/i.test(existing);
};

const isVagueHostelRemarks = (remarks) => {
  const existing = String(remarks || '').trim();
  return !existing || /^hostel$/i.test(existing);
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
  const yearQ = studentYearQuery(studentYear);

  if (matchByRemarks && remarks) {
    const byRemarks = await StudentFee.findOne({
      studentId: admissionNo,
      feeHead: feeHeadId,
      academicYear,
      studentYear: yearQ,
      remarks
    });
    if (byRemarks) return byRemarks;

    // Legacy remarks omitted academic year — e.g. "Hostel: Girls Hostel - B"
    // New format: "Hostel: Girls Hostel - B (2026-2027)"
    const legacyBase = String(remarks).replace(/\s*\(\d{4}-\d{4}\)\s*$/, '').trim();
    const sameYearFees = await StudentFee.find({
      studentId: admissionNo,
      feeHead: feeHeadId,
      academicYear,
      studentYear: yearQ
    }).sort({ createdAt: 1 });

    if (legacyBase) {
      const legacyMatch = sameYearFees.find((f) => {
        const existing = String(f.remarks || '').trim();
        if (!existing) return false;
        if (existing === legacyBase) return true;
        if (existing === remarks) return true;
        // Same hostel/transport base with any year suffix
        const existingBase = existing.replace(/\s*\(\d{4}-\d{4}\)\s*$/, '').trim();
        return existingBase === legacyBase;
      });
      if (legacyMatch) return legacyMatch;
    }

    // Older transport assignments used bare remarks like "Transport"
    const vagueTransport = sameYearFees.find((f) => isVagueTransportRemarks(f.remarks));
    if (vagueTransport) return vagueTransport;

    const vagueHostel = sameYearFees.find((f) => isVagueHostelRemarks(f.remarks));
    if (vagueHostel) return vagueHostel;

    // Broader legacy match: bare "Transport"/"Hostel" often has WRONG or missing academicYear
    // (manual assign / old sync) while studentYear is correct — still upgrade that row.
    const isTransportRemark = /^transport:/i.test(String(remarks).trim()) || /^transport$/i.test(legacyBase);
    const isHostelRemark = /^hostel:/i.test(String(remarks).trim()) || /^hostel$/i.test(legacyBase);

    if (isTransportRemark || isHostelRemark) {
      // 1) Same studentYear, any academicYear, vague remarks
      const byStudentYear = await StudentFee.find({
        studentId: admissionNo,
        feeHead: feeHeadId,
        studentYear: yearQ
      }).sort({ createdAt: 1 });

      const vagueBySy = byStudentYear.find((f) =>
        isTransportRemark ? isVagueTransportRemarks(f.remarks) : isVagueHostelRemarks(f.remarks)
      );
      if (vagueBySy) return vagueBySy;

      // 2) Same academicYear, any studentYear, vague remarks
      const byAy = await StudentFee.find({
        studentId: admissionNo,
        feeHead: feeHeadId,
        academicYear
      }).sort({ createdAt: 1 });

      const vagueByAy = byAy.find((f) =>
        isTransportRemark ? isVagueTransportRemarks(f.remarks) : isVagueHostelRemarks(f.remarks)
      );
      if (vagueByAy) return vagueByAy;
    }

    // Transport/Hostel: never merge onto a different route/hostel demand
    // (would overwrite the request fare with another amount).
    return null;
  }

  const exact = await StudentFee.findOne({
    studentId: admissionNo,
    feeHead: feeHeadId,
    academicYear,
    studentYear: yearQ,
    semester: semester ?? null
  });
  if (exact) return exact;

  const sameYearFees = await StudentFee.find({
    studentId: admissionNo,
    feeHead: feeHeadId,
    academicYear,
    studentYear: yearQ
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
      studentYear: yearQ
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

    if (semester !== undefined && normalizeSemester(existingFee.semester) !== normalizeSemester(semester)) {
      existingFee.semester = semester ?? null;
      changed = true;
    }

    if (academicYear && existingFee.academicYear !== academicYear) {
      existingFee.academicYear = academicYear;
      changed = true;
    }

    if (Number(existingFee.studentYear) !== Number(studentYear)) {
      existingFee.studentYear = studentYear;
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

    // Transport/Hostel request rows are unique by remarks — do not consolidate
    // (would merge routes / take max amount and wipe the request fare).
    if (!matchByRemarks) {
      await consolidateStudentFeeDemands(admissionNo, feeHeadId, academicYear, studentYear);
    }
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

  if (!matchByRemarks) {
    await consolidateStudentFeeDemands(admissionNo, feeHeadId, academicYear, studentYear);
  }
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

const buildTransportRemarks = (routeName, stageName, academicYear) => {
  const route = (routeName || '').trim();
  const stage = (stageName || '').trim();
  const base = `Transport: ${route} - ${stage}`;
  const year = String(academicYear || '').trim();
  return year ? `${base} (${year})` : base;
};

const buildHostelRemarks = (hostelName, categoryName, academicYear) => {
  const hostel = (hostelName || 'Hostel').trim();
  const category = (categoryName || 'Category').trim();
  const base = `Hostel: ${hostel} - ${category}`;
  const year = String(academicYear || '').trim();
  return year ? `${base} (${year})` : base;
};

const syncTransportFees = async (student, admissionNo) => {
  let created = 0;
  let updated = 0;
  const academicYears = new Set();
  /** @type {Map<string, Set<string>>} academicYear -> expected remarks */
  const expectedRemarksByYear = new Map();

  const transportConnection = getTransportConnection();
  if (!transportConnection) {
    return { created, updated, requestsMatched: 0, academicYears: [] };
  }

  const admissionVariants = Array.from(new Set([
    admissionNo,
    String(admissionNo).trim(),
    String(admissionNo).trim().toUpperCase(),
    String(admissionNo).trim().toLowerCase()
  ].filter(Boolean)));

  const requests = await transportConnection.db
    .collection('transport_requests')
    .find({
      admission_number: { $in: admissionVariants },
      status: { $regex: /^approved$/i }
    })
    .sort({ updated_at: -1 })
    .toArray();

  if (requests.length === 0) {
    return { created, updated, requestsMatched: 0, academicYears: [] };
  }

  const transportFeeHead = await findTransportFeeHead();
  if (!transportFeeHead) {
    return { created, updated, requestsMatched: requests.length, academicYears: [] };
  }

  // One demand per academic year — prefer latest updated request
  const latestByYear = new Map();
  for (const request of requests) {
    const academicYear = String(request.academic_year || '').trim();
    if (!academicYear) continue;
    if (!latestByYear.has(academicYear)) latestByYear.set(academicYear, request);
  }

  for (const request of latestByYear.values()) {
    const academicYear = String(request.academic_year || '').trim();
    const yearKey = academicYear;
    academicYears.add(yearKey);

    // Amount source of truth = transport request fare only (never stage/structure amount).
    if (request.fare === null || request.fare === undefined || request.fare === '') {
      console.warn(`[TransportSync] Skipping ${admissionNo} AY ${yearKey}: missing fare on request`);
      continue;
    }
    const amount = Number(request.fare);
    if (!Number.isFinite(amount) || amount < 0) {
      console.warn(`[TransportSync] Skipping ${admissionNo} AY ${yearKey}: invalid fare`, request.fare);
      continue;
    }

    const studentYear = Number(request.year_of_study || student.current_year || 1) || 1;
    const semester = Number(request.semester_number || student.current_semester || 1) || 1;
    const remarks = buildTransportRemarks(request.route_name, request.stage_name, academicYear);

    if (!expectedRemarksByYear.has(yearKey)) expectedRemarksByYear.set(yearKey, new Set());
    expectedRemarksByYear.get(yearKey).add(remarks);

    const result = await upsertStudentFeeDemand({
      admissionNo,
      student,
      feeHeadId: transportFeeHead._id,
      academicYear: yearKey,
      studentYear,
      semester,
      amount,
      remarks,
      matchByRemarks: true
    });
    created += result.created;
    updated += result.updated;
  }

  // Drop unpaid duplicate transport demands for synced years that are not
  // the current approved request (e.g. old remarks "Transport" left after re-sync).
  // Fee Collection groups all TRN rows for a year into one total — duplicates double the fare.
  for (const [yearKey, expectedRemarks] of expectedRemarksByYear.entries()) {
    const existing = await StudentFee.find({
      studentId: admissionNo,
      feeHead: transportFeeHead._id,
      academicYear: yearKey
    });

    for (const fee of existing) {
      const feeRemarks = String(fee.remarks || '').trim();
      const feeBase = feeRemarks.replace(/\s*\(\d{4}-\d{4}\)\s*$/, '').trim();
      const isExpected = [...expectedRemarks].some((expected) => {
        if (feeRemarks === expected) return true;
        const expectedBase = expected.replace(/\s*\(\d{4}-\d{4}\)\s*$/, '').trim();
        return feeBase && feeBase === expectedBase;
      });
      if (isExpected) continue;

      const txs = await Transaction.find({
        studentId: admissionNo,
        feeHead: transportFeeHead._id,
        studentYear: String(fee.studentYear),
        status: { $ne: 'cancelled' },
        transactionType: 'DEBIT'
      }).lean();
      const paid = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      if (paid > 0) continue;

      await StudentFee.deleteOne({ _id: fee._id });
      updated += 1;
    }
  }

  return {
    created,
    updated,
    requestsMatched: requests.length,
    academicYears: Array.from(academicYears).sort()
  };
};

const findHostelFeeHead = async () => {
  let feeHead = await FeeHead.findOne({ name: 'Hostel Fee' });
  if (!feeHead) {
    feeHead = await FeeHead.findOne({ code: { $in: ['HOSTEL', 'HST01'] } });
  }
  if (!feeHead) {
    feeHead = await FeeHead.create({
      name: 'Hostel Fee',
      code: 'HOSTEL',
      description: 'Hostel accommodation fee'
    });
  }
  return feeHead;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findHostelFeeStructure = async (connection, request, student, studentYear) => {
  const baseQuery = {
    academicYear: request.academicYear,
    course: { $regex: new RegExp(`^${escapeRegex(student.course)}$`, 'i') },
    year: Number(studentYear),
    hostelId: request.hostelId,
    categoryId: request.hostelCategoryId,
    feeType: { $regex: /^hostel[ _-]?fee$/i },
    isActive: true
  };

  const structures = connection.db.collection('feestructures');
  if (student.branch) {
    const exactBranch = await structures.findOne({
      ...baseQuery,
      branch: { $regex: new RegExp(`^${escapeRegex(student.branch)}$`, 'i') }
    });
    if (exactBranch) return exactBranch;
  }

  return structures.findOne({
    ...baseQuery,
    $or: [
      { branch: null },
      { branch: { $exists: false } }
    ]
  });
};

const syncHostelFees = async (student, admissionNo) => {
  let created = 0;
  let updated = 0;
  const academicYears = new Set();

  const hostelConnection = getHostelConnection();
  if (!hostelConnection) {
    return { created, updated, requestsMatched: 0, academicYears: [] };
  }

  const requests = await hostelConnection.db
    .collection('hostelrequests')
    .find({
      admissionNumber: admissionNo.toUpperCase(),
      status: 'active'
    })
    .sort({ updatedAt: -1 })
    .toArray();

  if (requests.length === 0) {
    return { created, updated, requestsMatched: 0, academicYears: [] };
  }

  const hostelFeeHead = await findHostelFeeHead();
  const hostels = hostelConnection.db.collection('hostels');
  const categories = hostelConnection.db.collection('hostelcategories');

  for (const request of requests) {
    if (!request.academicYear || !request.hostelId || !request.hostelCategoryId) continue;
    academicYears.add(String(request.academicYear).trim());

    const studentYear = request.sdmsYearOfStudy || student.current_year || 1;
    const structure = await findHostelFeeStructure(
      hostelConnection,
      request,
      student,
      studentYear
    );
    if (!structure) continue;

    const [hostel, category] = await Promise.all([
      hostels.findOne({ _id: request.hostelId }, { projection: { name: 1 } }),
      categories.findOne({ _id: request.hostelCategoryId }, { projection: { name: 1 } })
    ]);

    const amount = Math.max(
      0,
      (Number(structure.amount) || 0) - (Number(request.concession) || 0)
    );
    const remarks = buildHostelRemarks(
      hostel?.name || 'Hostel',
      category?.name || 'Category',
      request.academicYear
    );

    const result = await upsertStudentFeeDemand({
      admissionNo,
      student,
      feeHeadId: hostelFeeHead._id,
      academicYear: request.academicYear,
      studentYear,
      semester: student.current_semester || 1,
      amount,
      remarks,
      matchByRemarks: true
    });
    created += result.created;
    updated += result.updated;
  }

  return {
    created,
    updated,
    requestsMatched: requests.length,
    academicYears: Array.from(academicYears).sort()
  };
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

  // Transport / Hostel amounts come only from approved requests — never from FeeStructure.
  const serviceHeadIds = new Set();
  const transportHead = await findTransportFeeHead();
  const hostelHead = await findHostelFeeHead();
  if (transportHead?._id) serviceHeadIds.add(String(transportHead._id));
  if (hostelHead?._id) serviceHeadIds.add(String(hostelHead._id));

  const revisedFeesMap = await loadRevisedFeesMapForStudent(admissionNo);

  for (const fs of applicableStructures) {
    if (serviceHeadIds.has(String(fs.feeHead))) continue;

    const fsKey = buildConcessionLookupKey(
      fs.feeHead.toString(),
      fs.studentYear,
      fs.semester
    );
    const revisedConcession = revisedFeesMap[fsKey];
    const targetRemarks = revisedConcession ? revisedConcession.remarks : '';

    const targetAmount = resolveTargetAmount(fs.amount, revisedFeesMap, fs);
    const result = await upsertStudentFeeDemand({
      admissionNo,
      student,
      feeHeadId: fs.feeHead,
      academicYear: fs.batch,
      studentYear: fs.studentYear,
      semester: fs.semester || null,
      amount: targetAmount,
      remarks: targetRemarks || undefined,
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

  // DECL credits only when an APPROVED overall-concession request exists.
  // If none, cancel any leftover DECL credits from earlier syncs.
  const approvedEntries = await loadApprovedOverallConcessionEntries(admissionNo);
  if (approvedEntries.length > 0) {
    await applyRevisedConcessionTransactions({
      admissionNumber: admissionNo,
      studentName: student.student_name,
      college: student.college,
      course: student.course,
      branch: student.branch,
      batch: student.batch,
      category: student.stud_type || 'Regular',
      entries: approvedEntries
    });
  } else {
    await cancelAllDeclarationConcessionTransactions({
      admissionNumber: admissionNo,
      reason: 'No approved overall concession request'
    });
  }

  return { created, updated, structuresMatched: applicableStructures.length };
};

const fetchStudentByAdmissionNumber = async (admissionNo) => {
  const [students] = await db.query(STUDENT_SELECT, [admissionNo]);
  return students[0] || null;
};

const syncStudentFeesByAdmissionNumber = async (admissionNo, options = {}) => {
  const {
    skipClub = false,
    skipTransport = false,
    skipHostel = false,
    skipStandard = false
  } = options;

  const student = await fetchStudentByAdmissionNumber(admissionNo);
  if (!student) {
    const error = new Error('Student not found');
    error.statusCode = 404;
    throw error;
  }

  const clubResult = skipClub
    ? { created: 0 }
    : await syncClubFees(student, admissionNo);
  const transportResult = skipTransport
    ? { created: 0, updated: 0, requestsMatched: 0, academicYears: [] }
    : await syncTransportFees(student, admissionNo);
  const hostelResult = skipHostel
    ? { created: 0, updated: 0, requestsMatched: 0, academicYears: [] }
    : await syncHostelFees(student, admissionNo);
  const standardResult = skipStandard
    ? { created: 0, updated: 0, structuresMatched: 0 }
    : await syncStandardFees(student, admissionNo);

  return {
    admissionNumber: admissionNo,
    clubFeesCreated: clubResult.created,
    transportFeesCreated: transportResult.created,
    transportFeesUpdated: transportResult.updated,
    transportRequestsMatched: transportResult.requestsMatched,
    transportAcademicYears: transportResult.academicYears || [],
    hostelFeesCreated: hostelResult.created,
    hostelFeesUpdated: hostelResult.updated,
    hostelRequestsMatched: hostelResult.requestsMatched,
    hostelAcademicYears: hostelResult.academicYears || [],
    standardFeesCreated: standardResult.created,
    standardFeesUpdated: standardResult.updated,
    structuresMatched: standardResult.structuresMatched
  };
};

/**
 * Nightly / bulk sync for all regular students.
 * Standard fee structures (+ club + declaration credits). Transport/hostel skipped by default.
 */
const syncAllRegularStudentFees = async ({
  concurrency = 5,
  skipTransport = true,
  skipHostel = true,
  skipClub = false,
  skipStandard = false
} = {}) => {
  let students = [];
  try {
    const [rows] = await db.query(`
      SELECT admission_number
      FROM students
      WHERE LOWER(COALESCE(student_status, '')) = 'regular'
        AND admission_number IS NOT NULL
        AND TRIM(admission_number) <> ''
    `);
    students = rows || [];
  } catch (err) {
    console.error('[FeeSync] Failed to load regular students list:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    return { total: 0, success: 0, failed: 0, aborted: true };
  }

  const total = students.length;
  let success = 0;
  let failed = 0;
  const limit = Math.max(1, Number(concurrency) || 5);
  const syncOptions = { skipTransport, skipHostel, skipClub, skipStandard };

  console.log(
    `[FeeSync] Starting nightly student fee sync for ${total} regular student(s)` +
    ` (skipTransport=${skipTransport}, skipHostel=${skipHostel})...`
  );

  for (let i = 0; i < students.length; i += limit) {
    const batch = students.slice(i, i + limit);
    await Promise.all(batch.map(async (row) => {
      const admissionNo = String(row.admission_number || '').trim();
      if (!admissionNo) {
        failed += 1;
        return;
      }
      try {
        await syncStudentFeesByAdmissionNumber(admissionNo, syncOptions);
        success += 1;
      } catch (err) {
        failed += 1;
        console.error(`[FeeSync] Failed for ${admissionNo}:`, err?.message || err);
      }
    }));

    const done = Math.min(i + limit, total);
    if (done % 200 === 0 || done === total) {
      console.log(`[FeeSync] Progress ${done}/${total} (ok=${success}, failed=${failed})`);
    }
  }

  console.log(`[FeeSync] Nightly student fee sync finished. total=${total}, ok=${success}, failed=${failed}`);
  return { total, success, failed };
};

module.exports = {
  fetchStudentByAdmissionNumber,
  syncClubFees,
  syncTransportFees,
  syncHostelFees,
  syncStandardFees,
  syncStudentFeesByAdmissionNumber,
  syncAllRegularStudentFees,
  loadRevisedFeesMapForStudent,
  resolveTargetAmount
};
