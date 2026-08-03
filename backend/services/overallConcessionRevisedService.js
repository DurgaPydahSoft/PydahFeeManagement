const FeeStructure = require('../models/FeeStructure');
const FeeHead = require('../models/FeeHead');
const Transaction = require('../models/Transaction');
const StudentFee = require('../models/StudentFee');
const {
  normalizeSemester,
  normalizeConcessionType,
  getConcessionAmount,
  resolveFeeHeadId,
  buildFeeHeadMaps
} = require('../utils/overallConcessionFees');

const DECLARATION_CONCESSION_REMARKS = 'Concession as per declaration';

const findMatchingFeeStructure = async ({
  feeHeadId,
  college,
  course,
  branch,
  batch,
  category,
  studentYear,
  semester
}) => {
  const sem = normalizeSemester(semester);
  const base = {
    feeHead: feeHeadId,
    college,
    course,
    branch,
    batch,
    category: category || 'Regular',
    studentYear: Number(studentYear)
  };

  let structure = await FeeStructure.findOne({
    ...base,
    semester: sem
  }).lean();

  if (!structure && sem === null) {
    structure = await FeeStructure.findOne({
      ...base,
      $or: [{ semester: null }, { semester: { $exists: false } }]
    }).lean();
  }

  return structure;
};

const validateRevisedEntriesAgainstStructures = async ({
  entries,
  college,
  course,
  branch,
  batch,
  category,
  codeMap = {}
}) => {
  const warnings = [];
  const revisedEntries = (entries || []).filter(
    (e) => normalizeConcessionType(e.concessionType) === 'REVISED'
  );

  for (const entry of revisedEntries) {
    const feeHeadId = resolveFeeHeadId(entry, codeMap) || String(entry.feeHeadId || '');
    const studentYear = Number(entry.studentYear);
    const semester = normalizeSemester(entry.semester);
    const revisedAmount = getConcessionAmount(entry);
    const label = entry.feeHeadCode || feeHeadId;

    if (!feeHeadId || !studentYear) {
      warnings.push(`Invalid REVISED entry for fee head ${label}.`);
      continue;
    }

    const structure = await findMatchingFeeStructure({
      feeHeadId,
      college,
      course,
      branch,
      batch,
      category,
      studentYear,
      semester
    });

    // No structure for this head/year is not a hard failure (e.g. transport/other).
    // Only block when a structure exists and revised fee is higher than it.
    if (!structure) continue;

    const structureAmount = Number(structure.amount) || 0;
    if (revisedAmount > structureAmount) {
      warnings.push(
        `Fee structure for ${label} (Year ${studentYear}) is lower than the revised fee ` +
        `(structure: ${structureAmount}, revised: ${revisedAmount}).`
      );
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
    message: warnings.length
      ? `Cannot approve/save: ${warnings.join(' ')}`
      : ''
  };
};

const buildDeclarationTxnFilter = ({
  admissionNumber,
  feeHeadId,
  studentYear
}) => ({
  studentId: admissionNumber,
  feeHead: feeHeadId,
  studentYear: String(studentYear),
  transactionType: 'CREDIT',
  remarks: DECLARATION_CONCESSION_REMARKS,
  status: { $ne: 'cancelled' }
});

const upsertDeclarationConcessionTransaction = async ({
  admissionNumber,
  studentName,
  feeHeadId,
  studentYear,
  semester,
  amount,
  collectedBy,
  collectedByName
}) => {
  // Match by head + year + declaration remarks only (semester may differ across syncs)
  const filter = buildDeclarationTxnFilter({
    admissionNumber,
    feeHeadId,
    studentYear
  });

  const existing = await Transaction.findOne(filter);

  if (amount <= 0) {
    if (existing) {
      existing.status = 'cancelled';
      existing.cancellationReason = 'Revised fee no longer requires concession';
      existing.cancelledAt = new Date();
      existing.cancelledBy = collectedBy || 'system';
      existing.cancelledByName = collectedByName || 'System';
      await existing.save();
      return { cancelled: 1, created: 0, updated: 0 };
    }
    return { cancelled: 0, created: 0, updated: 0 };
  }

  const sem = normalizeSemester(semester);
  const semValue = sem === null ? null : String(sem);

  if (existing) {
    let changed = false;
    if (Number(existing.amount) !== Number(amount)) {
      existing.amount = amount;
      changed = true;
    }
    if (existing.paymentMode !== 'Credit') {
      existing.paymentMode = 'Credit';
      changed = true;
    }
    const existingSem = normalizeSemester(existing.semester);
    if (existingSem !== sem) {
      existing.semester = semValue;
      changed = true;
    }
    if (collectedBy && existing.collectedBy !== collectedBy) {
      existing.collectedBy = collectedBy;
      changed = true;
    }
    if (collectedByName && existing.collectedByName !== collectedByName) {
      existing.collectedByName = collectedByName;
      changed = true;
    }
    if (changed) await existing.save();
    return { cancelled: 0, created: 0, updated: changed ? 1 : 0 };
  }

  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900).toString();

  await Transaction.create({
    studentId: admissionNumber,
    studentName: studentName || '',
    feeHead: feeHeadId,
    amount,
    transactionType: 'CREDIT',
    paymentMode: 'Credit',
    receiptNumber: `DECL${timestamp}${random}`,
    paymentDate: new Date(),
    remarks: DECLARATION_CONCESSION_REMARKS,
    studentYear: String(studentYear),
    semester: semValue,
    collectedBy: collectedBy || 'system',
    collectedByName: collectedByName || 'System'
  });

  return { cancelled: 0, created: 1, updated: 0 };
};

const applyRevisedConcessionTransactions = async ({
  admissionNumber,
  studentName,
  college,
  course,
  branch,
  batch,
  category,
  entries,
  collectedBy,
  collectedByName,
  codeMap = null
}) => {
  let maps = codeMap;
  if (!maps) {
    const feeHeads = await FeeHead.find({}).lean();
    maps = buildFeeHeadMaps(feeHeads).codeMap;
  }

  const revisedEntries = (entries || []).filter(
    (e) => normalizeConcessionType(e.concessionType) === 'REVISED'
  );

  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const entry of revisedEntries) {
    const feeHeadId = resolveFeeHeadId(entry, maps) || String(entry.feeHeadId || '');
    const studentYear = Number(entry.studentYear);
    const semester = normalizeSemester(entry.semester);
    const revisedAmount = getConcessionAmount(entry);

    if (!feeHeadId || !studentYear) {
      skipped += 1;
      continue;
    }

    const structure = await findMatchingFeeStructure({
      feeHeadId,
      college,
      course,
      branch,
      batch,
      category,
      studentYear,
      semester
    });

    let structureAmount = 0;
    let liveDemand = null;

    if (structure) {
      structureAmount = Number(structure.amount) || 0;
    } else {
      // Fallback for heads without fixed structures (e.g. transport, hostel)
      liveDemand = await StudentFee.findOne({
        studentId: admissionNumber,
        feeHead: feeHeadId,
        studentYear: String(studentYear)
      }).lean();

      if (liveDemand) {
        structureAmount = Number(liveDemand.amount) || 0;
      } else {
        skipped += 1;
        continue;
      }
    }

    if (revisedAmount > structureAmount) {
      skipped += 1;
      continue;
    }

    // Align txn semester with the live StudentFee demand so it groups with the due row
    let effectiveSemester = semester;
    if (effectiveSemester === null || effectiveSemester === undefined || effectiveSemester === '') {
      const demand = liveDemand || await StudentFee.findOne({
        studentId: admissionNumber,
        feeHead: feeHeadId,
        studentYear: String(studentYear)
      }).select('semester').lean();
      if (demand && demand.semester !== undefined && demand.semester !== null && demand.semester !== '') {
        effectiveSemester = demand.semester;
      } else if (structure && structure.semester !== undefined && structure.semester !== null) {
        effectiveSemester = structure.semester;
      }
    }

    const concessionAmount = Math.max(0, structureAmount - revisedAmount);
    const result = await upsertDeclarationConcessionTransaction({
      admissionNumber,
      studentName,
      feeHeadId,
      studentYear,
      semester: effectiveSemester,
      amount: concessionAmount,
      collectedBy,
      collectedByName
    });

    created += result.created;
    updated += result.updated;
    cancelled += result.cancelled;
  }

  return { created, updated, cancelled, skipped };
};

const cancelDeclarationConcessionTransactions = async ({
  admissionNumber,
  entries,
  collectedBy,
  collectedByName,
  codeMap = null
}) => {
  let maps = codeMap;
  if (!maps) {
    const feeHeads = await FeeHead.find({}).lean();
    maps = buildFeeHeadMaps(feeHeads).codeMap;
  }

  let cancelled = 0;
  for (const entry of entries || []) {
    if (normalizeConcessionType(entry.concessionType) !== 'REVISED') continue;
    const feeHeadId = resolveFeeHeadId(entry, maps) || String(entry.feeHeadId || '');
    if (!feeHeadId) continue;

    const result = await upsertDeclarationConcessionTransaction({
      admissionNumber,
      feeHeadId,
      studentYear: Number(entry.studentYear),
      semester: entry.semester,
      amount: 0,
      collectedBy,
      collectedByName
    });
    cancelled += result.cancelled;
  }
  return { cancelled };
};

/** Permanently delete DECL "Concession as per declaration" credits for a student. */
const cancelAllDeclarationConcessionTransactions = async ({
  admissionNumber
}) => {
  const result = await Transaction.deleteMany({
    studentId: admissionNumber,
    transactionType: 'CREDIT',
    remarks: DECLARATION_CONCESSION_REMARKS
  });

  return { cancelled: result.deletedCount || 0, deleted: result.deletedCount || 0 };
};

module.exports = {
  DECLARATION_CONCESSION_REMARKS,
  findMatchingFeeStructure,
  validateRevisedEntriesAgainstStructures,
  applyRevisedConcessionTransactions,
  cancelDeclarationConcessionTransactions,
  cancelAllDeclarationConcessionTransactions
};
