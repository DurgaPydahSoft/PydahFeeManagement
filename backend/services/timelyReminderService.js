const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');
const ServiceLateFeeConfig = require('../models/ServiceLateFeeConfig');
const db = require('../config/sqlDb');
const {
  isDeclarationConcessionTxn,
  allocateTermBalances,
  isUnderpaidThroughTerm,
  resolveEffectiveTerms
} = require('../utils/termConcessionAllocation');
const { formatDueDate } = require('../utils/reminderVariables');
// processRemindersBatch required lazily to avoid circular deps with reminderController

const sameDay = (a, b) => a && b && a.getTime() === b.getTime();

const triggerDateFor = (dueDate, triggerType, offsetDays) => {
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const n = Number(offsetDays) || 0;
  if (triggerType === 'AFTER') d.setDate(d.getDate() + n);
  else d.setDate(d.getDate() - n); // BEFORE (offset 0 = on due date)
  return d;
};

const unpaidThroughTerm = (allocation, termNumber) => {
  if (!allocation?.terms?.length) return 0;
  return allocation.terms
    .filter((t) => Number(t.termNumber) <= Number(termNumber))
    .reduce((sum, t) => sum + (Number(t.balance) || 0), 0);
};

const buildStudentTermAllocation = async (studentId, struct) => {
  const feeHeadId = struct.feeHead?._id || struct.feeHead;
  const txnFilter = {
    studentId,
    feeHead: feeHeadId,
    studentYear: struct.studentYear,
    status: { $ne: 'cancelled' }
  };
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

  const demands = await StudentFee.find({
    studentId,
    feeHead: feeHeadId,
    studentYear: String(struct.studentYear)
  }).lean();
  const demandTotal = demands.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const structureTotal = (struct.terms || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalAmount = demandTotal > 0 ? demandTotal : (Number(struct.amount) || structureTotal);
  const terms = resolveEffectiveTerms(struct.terms, totalAmount);

  return allocateTermBalances({
    totalAmount,
    terms,
    paidAmount,
    declarationConcession,
    applicationConcession
  });
};

const resolveAcademicDueDate = async (term, struct, academicYear) => {
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

  const batchKey = String(struct.batch || '').split('-')[0].trim();
  if (!batchKey) return null;

  const query = `
    SELECT s.semester_number, s.start_date
    FROM semesters s
    JOIN academic_years ay ON s.academic_year_id = ay.id
    JOIN courses c ON s.course_id = c.id
    JOIN colleges cl ON s.college_id = cl.id
    WHERE c.name = ?
      AND s.batch = ?
      AND s.year_of_study = ?
      AND cl.name = ?
      AND ay.year_label = ?
      AND s.college_id IS NOT NULL
      AND s.start_date IS NOT NULL
  `;
  const [semesters] = await db.query(query, [
    struct.course,
    batchKey,
    struct.studentYear,
    struct.college,
    academicYear
  ]);

  const targetSem = Number(term.referenceSemester) || Number(struct.semester) || 1;
  const semMatch = (semesters || []).find(
    (s) => Number(s.semester_number) === targetSem && s.start_date
  );
  if (!semMatch) return null;

  const raw = String(semMatch.start_date).slice(0, 10);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dueDate;
  if (parts) dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  else dueDate = new Date(semMatch.start_date);
  dueDate.setDate(dueDate.getDate() + (Number(term.dueOffsetDays) || 0));
  dueDate.setHours(0, 0, 0, 0);
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
};

const resolveServiceTermDueDate = async (term, student, studentYear, academicYear) => {
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
    JOIN academic_years ay ON s.academic_year_id = ay.id
    JOIN courses c ON s.course_id = c.id
    JOIN colleges cl ON s.college_id = cl.id
    WHERE c.name = ?
      AND s.batch = ?
      AND s.year_of_study = ?
      AND cl.name = ?
      AND ay.year_label = ?
      AND s.college_id IS NOT NULL
      AND s.start_date IS NOT NULL
  `;
  const [semesters] = await db.query(query, [
    student.course,
    batchKey,
    studentYear,
    student.college,
    academicYear
  ]);

  const targetSem = Number(term.referenceSemester) || 1;
  const semMatch = (semesters || []).find(
    (s) => Number(s.semester_number) === targetSem && s.start_date
  );
  if (!semMatch) return null;

  const raw = String(semMatch.start_date).slice(0, 10);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dueDate;
  if (parts) dueDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  else dueDate = new Date(semMatch.start_date);
  dueDate.setDate(dueDate.getDate() + (Number(term.dueOffsetDays) || 0));
  dueDate.setHours(0, 0, 0, 0);
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
};

const buildServiceTermAllocation = async ({
  studentId,
  feeHeadId,
  studentYear,
  defaultTerms,
  demandTotal
}) => {
  const txns = await Transaction.find({
    studentId,
    feeHead: feeHeadId,
    studentYear: String(studentYear),
    status: { $ne: 'cancelled' }
  }).lean();

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

const fetchStudentRow = async (admissionNumber) => {
  const [rows] = await db.query(
    `SELECT admission_number, student_name, father_name, pin_no, college, course, branch, batch,
            student_mobile, parent_mobile1, parent_mobile2,
            email, current_year, current_semester, stud_type, student_status
     FROM students WHERE admission_number = ? LIMIT 1`,
    [admissionNumber]
  );
  return rows?.[0] || null;
};

const toRecipient = (student, computed, offsetDays) => ({
  admission_number: student.admission_number,
  student_name: student.student_name,
  email: student.email,
  phone: student.student_mobile,
  student: {
    admission_number: student.admission_number,
    student_name: student.student_name,
    father_name: student.father_name,
    pin_no: student.pin_no,
    college: student.college,
    course: student.course,
    branch: student.branch,
    batch: student.batch,
    student_mobile: student.student_mobile,
    parent_mobile1: student.parent_mobile1 || null,
    parent_mobile2: student.parent_mobile2 || null,
    email: student.email,
    current_year: student.current_year,
    current_semester: student.current_semester,
    stud_type: student.stud_type
  },
  computed: {
    ...computed,
    offset_days: offsetDays,
    due_date: formatDueDate(computed.due_date_raw || computed.due_date),
    due_amount: computed.due_amount,
    late_fee_amount: computed.late_fee_amount
  },
  due_date: formatDueDate(computed.due_date_raw || computed.due_date),
  due_amount: computed.due_amount,
  late_fee_amount: computed.late_fee_amount
});

/**
 * Collect unpaid recipients for an academic rule whose due date matches today±offset.
 */
const collectAcademicRecipients = async (config, today, matchedOffset) => {
  const recipients = [];
  const seen = new Set();

  const structures = await FeeStructure.find({})
    .populate('feeHead', 'name code')
    .lean();
  const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true }).lean();

  // Group group-wise structures
  const processedIds = new Set();

  for (const struct of structures) {
    if (processedIds.has(String(struct._id))) continue;

    let groupStructs = [struct];
    if (struct.isGroupWiseLateFee) {
      groupStructs = structures.filter((s) =>
        s.isGroupWiseLateFee
        && s.college === struct.college
        && s.course === struct.course
        && s.branch === struct.branch
        && s.batch === struct.batch
        && s.category === struct.category
        && Number(s.studentYear) === Number(struct.studentYear)
        && String(s.semester ?? '') === String(struct.semester ?? '')
      );
      groupStructs.forEach((s) => processedIds.add(String(s._id)));
    } else {
      processedIds.add(String(struct._id));
    }

    const firstStruct = groupStructs[0];
    const effectiveTerms = resolveEffectiveTerms(firstStruct.terms, firstStruct.amount || 0);
    const structTermsCount = effectiveTerms.length || 1;
    const defCfg = defaultConfigs.find((c) => Number(c.termsCount) === Number(structTermsCount));

    const activeTerms = effectiveTerms.map((st) => {
      const dt = defCfg ? (defCfg.terms || []).find((t) => Number(t.termNumber) === Number(st.termNumber)) : null;
      return {
        termNumber: st.termNumber,
        amount: st.amount,
        lateFeeAmount: Number(st.lateFeeAmount) || 0,
        dueDateMode: st.dueDateMode || (dt ? dt.dueDateMode : 'offset'),
        referenceSemester: st.referenceSemester || (dt ? dt.referenceSemester : null),
        dueOffsetDays: (st.dueOffsetDays !== undefined && st.dueOffsetDays !== 0)
          ? st.dueOffsetDays
          : (dt ? dt.dueOffsetDays : 0),
        fixedDueDate: st.fixedDueDate || (dt ? dt.fixedDueDate : null),
        dueDescription: st.dueDescription || (dt ? dt.dueDescription : '')
      };
    });

    for (const term of activeTerms) {
      const dueDate = await resolveAcademicDueDate(term, firstStruct, config.academicYear);
      if (!dueDate) continue;

      const trigger = triggerDateFor(dueDate, config.triggerType, matchedOffset);
      if (!sameDay(trigger, today)) continue;

      const [students] = await db.query(
        `SELECT admission_number, student_name, father_name, pin_no, college, course, branch, batch,
                student_mobile, parent_mobile1, parent_mobile2,
                email, current_year, current_semester, stud_type
         FROM students
         WHERE college = ? AND course = ? AND branch = ? AND batch = ?
           AND current_year = ? AND stud_type = ?
           AND LOWER(student_status) = 'regular'`,
        [
          firstStruct.college,
          firstStruct.course,
          firstStruct.branch,
          firstStruct.batch,
          firstStruct.studentYear,
          firstStruct.category
        ]
      );

      for (const student of students || []) {
        let isUnderpaid = false;
        let dueAmount = 0;

        if (firstStruct.isGroupWiseLateFee && groupStructs.length > 1) {
          for (const gs of groupStructs) {
            const allocation = await buildStudentTermAllocation(student.admission_number, gs);
            if (isUnderpaidThroughTerm(allocation, term.termNumber)) {
              isUnderpaid = true;
              dueAmount += unpaidThroughTerm(allocation, term.termNumber);
            }
          }
        } else {
          const allocation = await buildStudentTermAllocation(student.admission_number, firstStruct);
          isUnderpaid = isUnderpaidThroughTerm(allocation, term.termNumber);
          dueAmount = unpaidThroughTerm(allocation, term.termNumber);
        }

        if (!isUnderpaid || dueAmount <= 0) continue;

        const dedupeKey = `${student.admission_number}|${term.termNumber}|${firstStruct._id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const headNames = groupStructs.map((s) => s.feeHead?.name || 'Fee').join(', ');
        recipients.push(toRecipient(student, {
          due_date_raw: dueDate,
          due_amount: dueAmount,
          late_fee_amount: Number(term.lateFeeAmount) || 0,
          term_number: term.termNumber,
          fee_head_name: headNames,
          academic_year: config.academicYear
        }, matchedOffset));
      }
    }
  }

  return recipients;
};

const collectServiceRecipients = async (config, today, matchedOffset) => {
  const recipients = [];
  const seen = new Set();
  const type = config.dueSourceType; // HOSTEL | TRANSPORT

  const serviceConfigs = await ServiceLateFeeConfig.find({
    type,
    academicYear: config.academicYear,
    isActive: { $ne: false }
  })
    .populate('applicableFeeHead', 'name code')
    .populate('lateFeeRules.lateFeeHead', 'name code')
    .lean();

  const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true }).lean();

  for (const svc of serviceConfigs) {
    const applicableHead = svc.applicableFeeHead;
    if (!applicableHead) continue;
    const applicableHeadId = applicableHead._id || applicableHead;
    const applicableHeadName = applicableHead.name || type;
    const termsCount = Number(svc.defaultTermsCount) || (svc.defaultTerms || []).length || 1;

    const rule = (svc.lateFeeRules || []).find((r) => Number(r.termsCount) === termsCount);
    const fallbackDefault = defaultConfigs.find((c) => Number(c.termsCount) === termsCount);

    // Timing from late-fee rule terms, or default terms timing; amounts not required for reminders
    const timingTerms = (rule?.terms?.length ? rule.terms : (fallbackDefault?.terms || [])).map((rt, idx) => {
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
        dueDescription: rt.dueDescription || dt?.dueDescription || `Term ${Number(rt.termNumber) || idx + 1}`
      };
    });

    // If only defaultTerms % exist (no timing rule), synthesize term numbers from defaultTerms
    const termsToCheck = timingTerms.length
      ? timingTerms
      : (svc.defaultTerms || []).map((t, idx) => ({
        termNumber: Number(t.termNumber) || idx + 1,
        dueDateMode: 'offset',
        referenceSemester: 1,
        dueOffsetDays: 0,
        fixedDueDate: null,
        dueDescription: `Term ${Number(t.termNumber) || idx + 1}`
      }));

    if (!termsToCheck.length) continue;

    const demands = await StudentFee.find({
      feeHead: applicableHeadId,
      academicYear: config.academicYear,
      isActive: { $ne: false }
    }).lean();

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
          amount: 0
        };
      }
      byStudent[key].amount += Number(d.amount) || 0;
    }

    for (const group of Object.values(byStudent)) {
      if (group.amount <= 0) continue;

      const student = (await fetchStudentRow(group.studentId)) || {
        admission_number: group.studentId,
        student_name: group.studentName,
        college: group.college,
        course: group.course,
        branch: group.branch,
        batch: null,
        stud_type: group.stud_type,
        student_mobile: null,
        email: null
      };

      if (student.student_status && String(student.student_status).toLowerCase() !== 'regular') {
        continue;
      }

      const allocation = await buildServiceTermAllocation({
        studentId: group.studentId,
        feeHeadId: applicableHeadId,
        studentYear: group.studentYear,
        defaultTerms: svc.defaultTerms,
        demandTotal: group.amount
      });

      for (const term of termsToCheck) {
        const dueDate = await resolveServiceTermDueDate(
          term,
          student,
          group.studentYear,
          config.academicYear
        );
        if (!dueDate) continue;

        const trigger = triggerDateFor(dueDate, config.triggerType, matchedOffset);
        if (!sameDay(trigger, today)) continue;

        if (!isUnderpaidThroughTerm(allocation, term.termNumber)) continue;
        const dueAmount = unpaidThroughTerm(allocation, term.termNumber);
        if (dueAmount <= 0) continue;

        const dedupeKey = `${group.studentId}|${term.termNumber}|${applicableHeadId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        recipients.push(toRecipient(student, {
          due_date_raw: dueDate,
          due_amount: dueAmount,
          late_fee_amount: Number(term.lateFeeAmount) || 0,
          term_number: term.termNumber,
          fee_head_name: applicableHeadName,
          academic_year: config.academicYear
        }, matchedOffset));
      }
    }
  }

  return recipients;
};

/**
 * Expand a single recipient into one entry per selected SMS recipient type.
 * Each expanded entry overrides `phone` with the correct mobile field.
 * Entries with no valid mobile number are silently dropped.
 */
const expandSmsRecipients = (recipients, smsRecipients = ['student']) => {
  const MOBILE_FIELD = {
    student: 'student_mobile',
    parent: 'parent_mobile1',
    guardian: 'parent_mobile2'
  };

  const expanded = [];
  for (const r of recipients) {
    for (const type of smsRecipients) {
      const field = MOBILE_FIELD[type];
      if (!field) continue;
      const mobile = r.student?.[field] || r[field];
      if (!mobile || String(mobile).trim().length < 10) continue;
      expanded.push({ ...r, phone: String(mobile).trim() });
    }
  }
  return expanded;
};

const sendForConfigOffset = async (config, recipients) => {
  if (!recipients.length) return 0;
  const { processRemindersBatch } = require('../controllers/reminderController');

  if (config.smsTemplateId) {
    const smsRecipients = config.smsRecipients?.length ? config.smsRecipients : ['student'];
    const expanded = expandSmsRecipients(recipients, smsRecipients);
    if (expanded.length) {
      await processRemindersBatch(config.smsTemplateId, expanded);
    }
  }
  if (config.emailTemplateId) {
    await processRemindersBatch(config.emailTemplateId, recipients);
  }
  return recipients.length;
};

/**
 * Execute one ReminderConfig against today's date (due-date based, unpaid only).
 */
const executeTimelyReminderConfig = async (config, today = new Date()) => {
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);

  if (!config.offsets?.length) return { sent: 0 };

  const dayKey = day.toISOString().slice(0, 10);
  const runKeys = new Set(config.lastRunKeys || []);
  let totalSent = 0;

  for (const offset of config.offsets) {
    const key = `${dayKey}:${offset}`;
    if (runKeys.has(key)) {
      console.log(`[TimelyReminder] Rule ${config._id} offset ${offset} already ran on ${dayKey}, skipping`);
      continue;
    }

    let recipients = [];
    if (config.dueSourceType === 'ACADEMIC') {
      recipients = await collectAcademicRecipients(config, day, offset);
    } else if (config.dueSourceType === 'HOSTEL' || config.dueSourceType === 'TRANSPORT') {
      recipients = await collectServiceRecipients(config, day, offset);
    }

    console.log(
      `[TimelyReminder] Rule ${config._id} (${config.dueSourceType} ${config.academicYear}) ` +
      `offset ${offset} ${config.triggerType}: ${recipients.length} unpaid recipients`
    );

    if (recipients.length) {
      totalSent += await sendForConfigOffset(config, recipients);
    }

    runKeys.add(key);
  }

  // Keep only today's keys + prune old
  const pruned = [...runKeys].filter((k) => k.startsWith(`${dayKey}:`));
  config.lastRunKeys = pruned;
  config.lastExecutedDate = new Date();
  await config.save();

  return { sent: totalSent };
};

module.exports = {
  executeTimelyReminderConfig,
  collectAcademicRecipients,
  collectServiceRecipients
};
