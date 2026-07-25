const FeeStructure = require('../models/FeeStructure');
const FeeHead = require('../models/FeeHead');
const Transaction = require('../models/Transaction');
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
  studentYear,
  semester
}) => {
  const sem = normalizeSemester(semester);
  const filter = {
    studentId: admissionNumber,
    feeHead: feeHeadId,
    studentYear: String(studentYear),
    transactionType: 'CREDIT',
    remarks: DECLARATION_CONCESSION_REMARKS,
    status: { $ne: 'cancelled' }
  };

  if (sem === null) {
    filter.$or = [
      { semester: null },
      { semester: '' },
      { semester: { $exists: false } }
    ];
  } else {
    filter.semester = String(sem);
  }

  return filter;
};

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
  const filter = buildDeclarationTxnFilter({
    admissionNumber,
    feeHeadId,
    studentYear,
    semester
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

  if (existing) {
    let changed = false;
    if (Number(existing.amount) !== Number(amount)) {
      existing.amount = amount;
      changed = true;
    }
    if (existing.paymentMode !== 'Waiver') {
      existing.paymentMode = 'Waiver';
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
    paymentMode: 'Waiver',
    receiptNumber: `DECL${timestamp}${random}`,
    paymentDate: new Date(),
    remarks: DECLARATION_CONCESSION_REMARKS,
    studentYear: String(studentYear),
    semester: sem === null ? null : String(sem),
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

    if (!structure) {
      skipped += 1;
      continue;
    }

    const structureAmount = Number(structure.amount) || 0;
    if (revisedAmount > structureAmount) {
      skipped += 1;
      continue;
    }

    const concessionAmount = Math.max(0, structureAmount - revisedAmount);
    const result = await upsertDeclarationConcessionTransaction({
      admissionNumber,
      studentName,
      feeHeadId,
      studentYear,
      semester,
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

module.exports = {
  DECLARATION_CONCESSION_REMARKS,
  findMatchingFeeStructure,
  validateRevisedEntriesAgainstStructures,
  applyRevisedConcessionTransactions,
  cancelDeclarationConcessionTransactions
};
