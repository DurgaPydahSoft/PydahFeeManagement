const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const ProceedingStudent = require('../models/ProceedingStudent');
const Proceeding = require('../models/Proceeding');

const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Remaining due for one fee head + student year (same head/year aggregation as Fee Collection).
 */
const getFeeHeadDueForYear = async (admissionNumber, feeHeadId, studentYear) => {
    if (!admissionNumber || !feeHeadId) return 0;
    const headIdStr = String(feeHeadId);
    const yearStr = String(studentYear || 1);

    const studentFees = await StudentFee.find({
        studentId: admissionNumber,
        studentYear: yearStr
    }).populate('feeHead', 'code').lean();

    let totalAmount = 0;
    studentFees.forEach((fee) => {
        const hId = fee.feeHead?._id?.toString?.() || fee.feeHead?.toString?.() || '';
        if (hId === headIdStr) {
            totalAmount += Number(fee.amount) || 0;
        }
    });

    const txns = await Transaction.find({
        studentId: admissionNumber,
        studentYear: yearStr,
        status: { $ne: 'cancelled' }
    }).select('feeHead amount transactionType remarks').lean();

    let paidAmount = 0;
    let concessionAmount = 0;
    txns.forEach((t) => {
        const hId = t.feeHead?.toString?.() || '';
        if (hId !== headIdStr) return;
        if (t.transactionType === 'DEBIT') {
            if (t.remarks === 'Extra Demand as per declaration') {
                totalAmount += Number(t.amount) || 0;
            } else {
                paidAmount += Number(t.amount) || 0;
            }
        } else if (t.transactionType === 'CREDIT') {
            concessionAmount += Number(t.amount) || 0;
        }
    });

    return Math.max(0, roundMoney(totalAmount - paidAmount - concessionAmount));
};

/** Sum of non-cancelled proceeding-linked txns for one student. */
const getStudentProceedingShareUtilized = async (proceedingId, studentId, excludeTxnId = null) => {
    if (!proceedingId || !studentId) return 0;
    const query = {
        proceedingId,
        studentId: String(studentId),
        status: { $ne: 'cancelled' }
    };
    if (excludeTxnId) query._id = { $ne: excludeTxnId };
    const txns = await Transaction.find(query).select('amount').lean();
    return roundMoney(txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
};

const getStudentProceedingShareRemaining = async (proceedingId, studentId, shareAmount, excludeTxnId = null) => {
    const utilized = await getStudentProceedingShareUtilized(proceedingId, studentId, excludeTxnId);
    return Math.max(0, roundMoney(Number(shareAmount) - utilized));
};

/** Recompute txnPending after a proceeding-linked payment. */
const syncProceedingStudentTxnStatus = async (proceedingId, studentId) => {
    const stu = await ProceedingStudent.findOne({ proceedingId, studentId: String(studentId) });
    if (!stu) return;
    const share = roundMoney(stu.shareAmount);
    const remaining = await getStudentProceedingShareRemaining(proceedingId, studentId, share);
    const txnPending = remaining > 0.009;
    await ProceedingStudent.updateOne(
        { _id: stu._id },
        { $set: { txnPending, ...(txnPending ? {} : { txnPendingReason: '' }) } }
    );
};

/**
 * Validate RTF proceeding payment: student mapped, share cap, proceeding balance.
 * Fee head due check is optional (caller may validate separately for selected fee head).
 */
const validateProceedingPayment = async ({
    proceedingId,
    studentId,
    amount,
    excludeTxnId = null,
    feeHeadId = null,
    studentYear = null
}) => {
    const proc = await Proceeding.findById(proceedingId);
    if (!proc) {
        return { ok: false, status: 404, message: 'Selected proceeding not found' };
    }
    if (proc.status !== 'Active') {
        return {
            ok: false,
            status: 400,
            message: `Proceeding '${proc.proceedingNumber}' is ${proc.status || 'not Active'} and cannot be used for collection until approved.`
        };
    }

    const mapping = await ProceedingStudent.findOne({ proceedingId, studentId: String(studentId) });
    if (!mapping) {
        return {
            ok: false,
            status: 400,
            message: `Student is not mapped in proceeding '${proc.proceedingNumber}'.`
        };
    }

    const payAmount = roundMoney(amount);
    const shareRemaining = await getStudentProceedingShareRemaining(
        proceedingId,
        studentId,
        mapping.shareAmount,
        excludeTxnId
    );
    if (payAmount > shareRemaining + 0.009) {
        return {
            ok: false,
            status: 400,
            message: `RTF amount ₹${payAmount.toLocaleString('en-IN')} exceeds this student's remaining proceeding share of ₹${shareRemaining.toLocaleString('en-IN')} (fixed share ₹${roundMoney(mapping.shareAmount).toLocaleString('en-IN')}).`
        };
    }

    const existingTxns = await Transaction.find({
        proceedingId,
        status: { $ne: 'cancelled' },
        ...(excludeTxnId ? { _id: { $ne: excludeTxnId } } : {})
    }).select('amount');
    const totalUsed = existingTxns.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const procRemaining = roundMoney(proc.amount - totalUsed);
    if (payAmount > procRemaining + 0.009) {
        const avail = procRemaining < 0 ? 0 : procRemaining;
        return {
            ok: false,
            status: 400,
            message: `Proceeding '${proc.proceedingNumber}' amount limit exceeded. Remaining balance is ₹${avail.toLocaleString('en-IN')}, but attempting to collect ₹${payAmount.toLocaleString('en-IN')}.`
        };
    }

    if (feeHeadId && studentYear != null && studentYear !== '') {
        const due = await getFeeHeadDueForYear(studentId, feeHeadId, studentYear);
        if (payAmount > due + 0.009) {
            return {
                ok: false,
                status: 400,
                message: `RTF amount ₹${payAmount.toLocaleString('en-IN')} exceeds remaining fee demand of ₹${due.toLocaleString('en-IN')} for the selected fee head.`
            };
        }
    }

    return { ok: true, proceeding: proc, mapping, shareRemaining, procRemaining };
};

/** Mark proceeding Completed when pool is fully used; reopen Active if balance returns. */
const syncProceedingCompletionStatus = async (proceedingId) => {
    if (!proceedingId) return null;
    const proceeding = await Proceeding.findById(proceedingId);
    if (!proceeding) return null;

    // Manually completed without auto txns — do not reopen based on unused pool
    if (proceeding.transactionsSkipped) {
        return proceeding.status;
    }

    const limit = roundMoney(proceeding.amount);
    if (!(limit > 0)) return proceeding.status;

    const txns = await Transaction.find({ proceedingId, status: { $ne: 'cancelled' } }).select('amount');
    const totalUsed = roundMoney(txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
    const remaining = Math.max(0, roundMoney(limit - totalUsed));

    if (proceeding.status === 'Active' && remaining <= 0.009) {
        proceeding.status = 'Completed';
        await proceeding.save();
        return 'Completed';
    }
    if (proceeding.status === 'Completed' && remaining > 0.009) {
        proceeding.status = 'Active';
        await proceeding.save();
        return 'Active';
    }
    return proceeding.status;
};

module.exports = {
    getFeeHeadDueForYear,
    getStudentProceedingShareUtilized,
    getStudentProceedingShareRemaining,
    syncProceedingStudentTxnStatus,
    syncProceedingCompletionStatus,
    validateProceedingPayment,
    roundMoney
};
