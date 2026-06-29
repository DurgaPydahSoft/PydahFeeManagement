const normalizeSemester = (semester) => {
  if (semester === null || semester === undefined || semester === '') return null;
  return Number(semester);
};

const getConcessionAmount = (entry) => {
  if (!entry) return 0;
  const raw = entry.amount ?? entry.revisedAmount;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const normalizeConcessionType = (type) => {
  const normalized = String(type ?? 'CONCESSION').trim().toUpperCase();
  return normalized === 'REVISED' ? 'REVISED' : 'CONCESSION';
};

const formatConcessionEntry = ({ feeHeadId, feeHeadCode, studentYear, semester, amount, concessionType }) => ({
  semester: normalizeSemester(semester),
  feeHeadId: String(feeHeadId),
  feeHeadCode: feeHeadCode || '',
  studentYear: Number(studentYear),
  concessionType: normalizeConcessionType(concessionType),
  amount: Number(amount)
});

const resolveFeeHeadId = (entry, codeMap = {}) => {
  let resolvedId = entry.feeHeadId ? String(entry.feeHeadId) : '';
  const codeKey = entry.feeHeadCode ? entry.feeHeadCode.trim().toUpperCase() : '';
  if (codeKey && codeMap[codeKey]) {
    resolvedId = codeMap[codeKey];
  }
  return resolvedId;
};

const buildConcessionLookupKey = (feeHeadId, studentYear, semester) =>
  `${feeHeadId}-${Number(studentYear)}-${normalizeSemester(semester) ?? 'null'}`;

const resolveStudentFeeAmount = (structureAmount, entry) => {
  const standardAmount = Number(structureAmount) || 0;
  const concessionAmount = getConcessionAmount(entry);
  const type = normalizeConcessionType(entry?.concessionType);

  if (type === 'CONCESSION') {
    return Math.max(0, standardAmount - concessionAmount);
  }

  // REVISED: amount is the final fee (replaces standard)
  return concessionAmount;
};

const buildRevisedFeesMap = (feesArray, codeMap = {}) => {
  const revisedFeesMap = {};
  if (!Array.isArray(feesArray)) return revisedFeesMap;

  feesArray.forEach((entry) => {
    const resolvedId = resolveFeeHeadId(entry, codeMap);
    if (!resolvedId) return;

    const key = buildConcessionLookupKey(
      resolvedId,
      entry.studentYear,
      entry.semester
    );

    revisedFeesMap[key] = {
      amount: getConcessionAmount(entry),
      concessionType: normalizeConcessionType(entry.concessionType)
    };
  });

  return revisedFeesMap;
};

const mapStoredEntryForResponse = (entry, feeHeads = [], codeMap = {}) => {
  const resolvedId = resolveFeeHeadId(entry, codeMap);
  const resolvedFh = feeHeads.find(fh => fh._id.toString() === resolvedId);

  return {
    feeHeadId: resolvedId || String(entry.feeHeadId),
    feeHeadCode: resolvedFh ? resolvedFh.code : (entry.feeHeadCode || ''),
    studentYear: Number(entry.studentYear),
    semester: normalizeSemester(entry.semester),
    concessionType: normalizeConcessionType(entry.concessionType),
    amount: getConcessionAmount(entry)
  };
};

const buildFeeHeadMaps = (feeHeads = []) => {
  const feeHeadMap = {};
  const codeMap = {};
  feeHeads.forEach((fh) => {
    feeHeadMap[fh._id.toString()] = fh.code || '';
    if (fh.code) {
      codeMap[fh.code.trim().toUpperCase()] = fh._id.toString();
    }
  });
  return { feeHeadMap, codeMap };
};

module.exports = {
  normalizeSemester,
  normalizeConcessionType,
  getConcessionAmount,
  formatConcessionEntry,
  resolveFeeHeadId,
  buildConcessionLookupKey,
  resolveStudentFeeAmount,
  buildRevisedFeesMap,
  mapStoredEntryForResponse,
  buildFeeHeadMaps
};
