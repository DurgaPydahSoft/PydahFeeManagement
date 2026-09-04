/** RTF / proceeding receipts — show in RTF tables only, never in Cash/Bank collection totals. */
export const isRtfTransaction = (tx) =>
    !!tx && (tx.paymentMode === 'RTF' || !!tx.proceedingId);

/** Normal bank/online collection (excludes Cash and RTF). */
export const isBankCollectionTx = (tx) =>
    !!tx && tx.paymentMode !== 'Cash' && !isRtfTransaction(tx);

export const isCashCollectionTx = (tx) =>
    !!tx && tx.paymentMode === 'Cash';

/** Add amount into cash/bank collection buckets; skip RTF for collection. */
export const addToCollectionBuckets = (buckets, tx, amount) => {
    const amt = Number(amount) || 0;
    if (isCashCollectionTx(tx)) {
        buckets.cash = (buckets.cash || 0) + amt;
        return 'cash';
    }
    if (isBankCollectionTx(tx)) {
        buckets.bank = (buckets.bank || 0) + amt;
        return 'bank';
    }
    return 'rtf';
};
