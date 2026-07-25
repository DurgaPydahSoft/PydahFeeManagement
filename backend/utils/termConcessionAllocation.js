/**
 * Term-wise allocation of paid + concessions for terms-divided fee heads.
 *
 * Declaration concession ("Concession as per declaration"):
 *   split evenly across all terms; remainder on the last term.
 *
 * Application concession (other CREDIT waivers):
 *   applied to the first unpaid term after declaration + paid;
 *   overflow spills to the next unpaid term(s).
 *
 * Order: term targets → declaration → paid waterfall → application waterfall.
 */

const DECLARATION_CONCESSION_REMARKS = 'Concession as per declaration';

const isDeclarationConcessionTxn = (t) =>
  t
  && t.transactionType === 'CREDIT'
  && String(t.remarks || '').trim() === DECLARATION_CONCESSION_REMARKS;

const roundMoney = (n) => Math.round(Number(n) || 0);

/**
 * Build absolute term targets from percentages so they sum exactly to totalAmount.
 */
const buildTermTargets = (totalAmount, terms = []) => {
  const total = roundMoney(totalAmount);
  const list = Array.isArray(terms) ? terms : [];
  if (list.length === 0) {
    return [{ termNumber: 1, percentage: 100, termTarget: total }];
  }

  const targets = [];
  let allocated = 0;
  list.forEach((term, idx) => {
    const isLast = idx === list.length - 1;
    let termTarget;
    if (isLast) {
      termTarget = Math.max(0, total - allocated);
    } else if (term.amount != null && Number(term.amount) > 0 && !term.percentage) {
      termTarget = roundMoney(term.amount);
    } else {
      termTarget = roundMoney((total * (Number(term.percentage) || 0)) / 100);
    }
    allocated += termTarget;
    targets.push({
      termNumber: Number(term.termNumber) || idx + 1,
      percentage: Number(term.percentage) || 0,
      termTarget
    });
  });
  return targets;
};

/**
 * Non–terms-divided fee heads are treated as a single Term 1 (100%).
 * If structure already has terms, keep them; otherwise synthesize Term 1.
 */
const resolveEffectiveTerms = (terms, totalAmount = 0) => {
  const list = Array.isArray(terms) ? terms.filter(Boolean) : [];
  if (list.length > 0) return list;
  const amt = roundMoney(totalAmount);
  return [{
    termNumber: 1,
    percentage: 100,
    amount: amt,
    lateFeeAmount: 0,
    dueDescription: 'Term 1'
  }];
};

/**
 * Split amount evenly across n buckets; remainder goes to the last bucket.
 */
const splitEvenly = (amount, n) => {
  const total = Math.max(0, roundMoney(amount));
  const count = Math.max(1, Number(n) || 1);
  const base = Math.floor(total / count);
  const shares = Array.from({ length: count }, () => base);
  const remainder = total - base * count;
  shares[count - 1] += remainder;
  return shares;
};

/**
 * @param {object} opts
 * @param {number} opts.totalAmount
 * @param {Array}  opts.terms - structure terms with percentage / amount / termNumber
 * @param {number} opts.paidAmount - DEBIT total
 * @param {number} opts.declarationConcession
 * @param {number} opts.applicationConcession
 * @returns {{ terms: Array, declarationConcession: number, applicationConcession: number }}
 */
const allocateTermBalances = ({
  totalAmount = 0,
  terms = [],
  paidAmount = 0,
  declarationConcession = 0,
  applicationConcession = 0
} = {}) => {
  const targets = buildTermTargets(totalAmount, terms);
  const n = targets.length;
  const declShares = splitEvenly(declarationConcession, n);

  // After declaration
  const rows = targets.map((t, i) => {
    const declarationShare = Math.min(declShares[i], t.termTarget);
    const afterDeclaration = Math.max(0, t.termTarget - declarationShare);
    return {
      termNumber: t.termNumber,
      percentage: t.percentage,
      termTarget: t.termTarget,
      declarationShare,
      afterDeclaration,
      paidShare: 0,
      applicationShare: 0,
      balance: afterDeclaration
    };
  });

  // Paid waterfall on post-declaration balances
  let remainingPaid = Math.max(0, roundMoney(paidAmount));
  for (const row of rows) {
    const take = Math.min(remainingPaid, row.balance);
    row.paidShare = take;
    row.balance -= take;
    remainingPaid -= take;
  }

  // Application concession waterfall on first unpaid term(s)
  let remainingApp = Math.max(0, roundMoney(applicationConcession));
  for (const row of rows) {
    if (remainingApp <= 0) break;
    if (row.balance <= 0) continue;
    const take = Math.min(remainingApp, row.balance);
    row.applicationShare = take;
    row.balance -= take;
    remainingApp -= take;
  }

  return {
    terms: rows,
    declarationConcession: roundMoney(declarationConcession),
    applicationConcession: roundMoney(applicationConcession),
    unusedApplication: remainingApp
  };
};

/**
 * Cumulative underpaid check for late fees through termNumber (inclusive).
 * true when any balance remains on terms 1..termNumber after allocation.
 */
const isUnderpaidThroughTerm = (allocation, termNumber) => {
  if (!allocation?.terms?.length) return false;
  return allocation.terms
    .filter((t) => Number(t.termNumber) <= Number(termNumber))
    .some((t) => Number(t.balance) > 0);
};

module.exports = {
  DECLARATION_CONCESSION_REMARKS,
  isDeclarationConcessionTxn,
  buildTermTargets,
  resolveEffectiveTerms,
  splitEvenly,
  allocateTermBalances,
  isUnderpaidThroughTerm
};
