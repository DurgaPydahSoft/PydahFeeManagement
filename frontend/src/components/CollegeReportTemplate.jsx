import React, { forwardRef } from 'react';

const paymentVisibility = (options = {}) => {
    const { mode = 'all', includeCash, includeBank } = options;
    const showCash = includeCash !== undefined ? !!includeCash : (mode === 'all' || mode === 'Cash');
    const showBank = includeBank !== undefined ? !!includeBank : (mode === 'all' || mode === 'Online');
    return { showCash, showBank };
};

const SingleCollegeReport = ({ data, dateRange, options = {}, hideGeneratedInfo = false, hideSignatures = false }) => {
    if (!data) return null;
    const { mode = 'all', showSummary = true, showDetails = true, allowedFeeHeads } = options || {};
    const { showCash, showBank } = paymentVisibility(options);

    const rawTransactions = data.transactions || [];
    const filteredTransactions = rawTransactions.filter(tx => {
        // Payment Mode Filter
        if (mode === 'none') return false;
        if (mode === 'Cash' && tx.paymentMode !== 'Cash') return false;
        if (mode === 'Online' && tx.paymentMode === 'Cash') return false;

        // Fee Head Group Filter
        if (allowedFeeHeads && allowedFeeHeads.length > 0) {
            const fhName = (tx.feeHead || '').trim().toLowerCase();
            if (!allowedFeeHeads.includes(fhName)) return false;
        }

        return true;
    });

    const activeTransactions = filteredTransactions.filter(tx => tx.status !== 'cancelled');
    const cancelledTransactions = filteredTransactions.filter(tx => tx.status === 'cancelled');
    const editedTransactions = filteredTransactions.filter(tx => tx.status !== 'cancelled' && tx.updatedAt && tx.createdAt && (new Date(tx.updatedAt).getTime() - new Date(tx.createdAt).getTime() > 10000));

    // Recompute fee head summary based on active transactions for this college
    const feeHeadData = {};
    activeTransactions.forEach(tx => {
        if (tx.transactionType === 'DEBIT') {
            const fhName = tx.feeHead || 'Unknown';
            const amount = tx.amount || 0;
            const isCash = tx.paymentMode === 'Cash';

            if (!feeHeadData[fhName]) {
                feeHeadData[fhName] = {
                    name: fhName,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0
                };
            }
            const entry = feeHeadData[fhName];
            entry.netTotal += amount;
            if (isCash) entry.cashAmt += amount;
            else entry.bankAmt += amount;
        }
    });
    const sortedFeeHeads = Object.values(feeHeadData).sort((a, b) => b.netTotal - a.netTotal);

    // Recompute Course > User > FeeHead hierarchical breakdown for this college
    const courseHierarchy = {};
    activeTransactions.forEach(tx => {
        if (tx.transactionType === 'DEBIT') {
            const courseName = tx.course || 'Unknown Course';
            const username = tx.collectedBy || 'Unknown';
            const cashierName = tx.collectedByName || 'Unknown';
            const empNo = tx.empNo || username;
            const fhName = tx.feeHead || 'Unknown';
            const amount = tx.amount || 0;
            const isCash = tx.paymentMode === 'Cash';

            if (!courseHierarchy[courseName]) {
                courseHierarchy[courseName] = {
                    courseName,
                    count: 0,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0,
                    cashiers: {}
                };
            }
            const courseEntry = courseHierarchy[courseName];
            courseEntry.count++;
            courseEntry.netTotal += amount;
            if (isCash) courseEntry.cashAmt += amount;
            else courseEntry.bankAmt += amount;

            if (!courseEntry.cashiers[username]) {
                courseEntry.cashiers[username] = {
                    username,
                    name: cashierName,
                    empNo,
                    count: 0,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0,
                    feeHeads: {}
                };
            }
            const cashierEntry = courseEntry.cashiers[username];
            cashierEntry.count++;
            cashierEntry.netTotal += amount;
            if (isCash) cashierEntry.cashAmt += amount;
            else cashierEntry.bankAmt += amount;

            if (!cashierEntry.feeHeads[fhName]) {
                cashierEntry.feeHeads[fhName] = {
                    name: fhName,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0
                };
            }
            const fhEntry = cashierEntry.feeHeads[fhName];
            fhEntry.netTotal += amount;
            if (isCash) fhEntry.cashAmt += amount;
            else fhEntry.bankAmt += amount;
        }
    });

    const sortedHierarchy = Object.values(courseHierarchy).map(course => {
        course.sortedCashiers = Object.values(course.cashiers).map(cashier => {
            cashier.sortedFeeHeads = Object.values(cashier.feeHeads).sort((a, b) => b.netTotal - a.netTotal);
            return cashier;
        }).sort((a, b) => b.netTotal - a.netTotal);
        return course;
    }).sort((a, b) => b.netTotal - a.netTotal);

    // Totals for this college (using active transactions only)
    const displayData = {
        totalCount: activeTransactions.length,
        debitAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        creditAmount: activeTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        cashAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        bankAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
    };

    return (
        <div className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; }
                    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
                    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
                    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .compact-row { line-height: 1.2; }
                `}
            </style>

            {/* Header */}
            <div className="print-header">
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>COLLEGE COLLECTION SUMMARY REPORT {options.selectedGroupName ? `[${options.selectedGroupName.toUpperCase()}]` : ''} {mode !== 'all' && mode !== 'none' && `(${mode === 'Online' ? 'BANK / ONLINE' : mode.toUpperCase()})`}</p>
            </div>

            {/* Info Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>College:</strong> <span style={{ textTransform: 'uppercase' }}>{typeof data._id === 'string' ? data._id : 'N/A'}</span>
                </div>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}
                </div>
                {!hideGeneratedInfo && (
                    <div style={{ color: '#4b5563' }}>
                        <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                    </div>
                )}
            </div>

            {/* Overall College Summary */}
            {showSummary && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        College Collection Summary {mode !== 'all' && `[${mode}]`}
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '20%' }}>Total Receipts</th>
                                {showCash && <th style={{ textAlign: 'right', width: '20%' }}>Cash</th>}
                                {showBank && <th style={{ textAlign: 'right', width: '20%' }}>Bank (Online)</th>}
                                <th style={{ textAlign: 'right', width: '20%' }}>Concessions</th>
                                <th style={{ textAlign: 'right', width: '20%', fontWeight: 'bold' }}>Net Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ textAlign: 'center' }}>{displayData.totalCount}</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.creditAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#e0e0e0' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* 1. Fee Head-wise collections (FIRST) */}
            {showSummary && sortedFeeHeads.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Fee Head-wise Collections
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '50%' }}>Fee Head Name</th>
                                {showCash && <th style={{ textAlign: 'right', width: '15%' }}>Cash</th>}
                                {showBank && <th style={{ textAlign: 'right', width: '15%' }}>Bank</th>}
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFeeHeads.map((fh, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{fh.name}</td>
                                    {showCash && <td style={{ textAlign: 'right' }}>₹{Number(fh.cashAmt).toLocaleString()}</td>}
                                    {showBank && <td style={{ textAlign: 'right' }}>₹{Number(fh.bankAmt).toLocaleString()}</td>}
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(fh.netTotal).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* 2. Course-wise, Cashier-wise & Fee Head-wise Collections for this College (SECOND) */}
            {showSummary && sortedHierarchy.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Course, User & Fee Head Collections
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '45%' }}>Course / Cashier Name / Fee Heads Collected</th>
                                <th style={{ textAlign: 'center', width: '10%' }}>Receipts</th>
                                {showCash && <th style={{ textAlign: 'right', width: '12%' }}>Cash</th>}
                                {showBank && <th style={{ textAlign: 'right', width: '13%' }}>Bank</th>}
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedHierarchy.map((course, cIdx) => {
                                const rows = [];
                                
                                // 1. Course Row (Bold)
                                rows.push(
                                    <tr key={`course-${cIdx}`} style={{ fontWeight: 'bold' }}>
                                        <td style={{ textAlign: 'center' }}>{cIdx + 1}</td>
                                        <td style={{ textTransform: 'uppercase' }}>{course.courseName}</td>
                                        <td style={{ textAlign: 'center' }}>{course.count}</td>
                                        {showCash && <td style={{ textAlign: 'right' }}>₹{Number(course.cashAmt).toLocaleString()}</td>}
                                        {showBank && <td style={{ textAlign: 'right' }}>₹{Number(course.bankAmt).toLocaleString()}</td>}
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(course.netTotal).toLocaleString()}</td>
                                    </tr>
                                );

                                cashierRowsLoop:
                                course.sortedCashiers.forEach((cashier, uIdx) => {
                                    // 2. Cashier Row under the Course (Indented slightly, Bold)
                                    rows.push(
                                        <tr key={`course-cashier-${cIdx}-${uIdx}`} style={{ fontWeight: 'bold' }}>
                                            <td></td>
                                            <td style={{ paddingLeft: '15px', textTransform: 'uppercase' }}>
                                                {cashier.name} {cashier.empNo && `(${cashier.empNo})`}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{cashier.count}</td>
                                            {showCash && <td style={{ textAlign: 'right' }}>₹{Number(cashier.cashAmt).toLocaleString()}</td>}
                                            {showBank && <td style={{ textAlign: 'right' }}>₹{Number(cashier.bankAmt).toLocaleString()}</td>}
                                            <td style={{ textAlign: 'right' }}>₹{Number(cashier.netTotal).toLocaleString()}</td>
                                        </tr>
                                    );

                                    // 3. Fee Head Row under the Cashier (Indented further, oblique/italic)
                                    cashier.sortedFeeHeads.forEach((fh, fhIdx) => {
                                        rows.push(
                                            <tr key={`course-cashier-fh-${cIdx}-${uIdx}-${fhIdx}`} className="compact-row" style={{ fontWeight: 'normal' }}>
                                                <td></td>
                                                <td style={{ paddingLeft: '30px', fontSize: '10px', fontStyle: 'italic' }}>
                                                    {fh.name}
                                                </td>
                                                <td></td>
                                                {showCash && <td style={{ textAlign: 'right', fontSize: '10px' }}>₹{Number(fh.cashAmt).toLocaleString()}</td>}
                                                {showBank && <td style={{ textAlign: 'right', fontSize: '10px' }}>₹{Number(fh.bankAmt).toLocaleString()}</td>}
                                                <td style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>₹{Number(fh.netTotal).toLocaleString()}</td>
                                            </tr>
                                        );
                                    });
                                });

                                return rows;
                            })}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                <td style={{ textAlign: 'center' }}>{displayData.totalCount}</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Individual Transactions for this College — Cash first, then Bank */}
            {showDetails && activeTransactions.length > 0 && (() => {
                const cashTxs = activeTransactions.filter(tx => tx.paymentMode === 'Cash');
                const bankTxs = activeTransactions.filter(tx => tx.paymentMode !== 'Cash');
                const txTableHead = (
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Receipt #</th>
                            <th>Student Name</th>
                            <th>Pin No</th>
                            <th>Course/Branch</th>
                            <th>Year</th>
                            <th>Fee Head</th>
                            <th>Cashier</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                );
                const txRow = (tx, idx) => (
                    <tr key={idx} className="compact-row">
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>{tx.receiptNo}</td>
                        <td>{tx.studentName}</td>
                        <td>{(!tx.pinNo || tx.pinNo === '-' || tx.pinNo === 'null') ? tx.studentId || '-' : tx.pinNo}</td>
                        <td>{tx.course} - {tx.branch}</td>
                        <td>{tx.studentYear}</td>
                        <td>{tx.feeHead}</td>
                        <td style={{ textTransform: 'uppercase' }}>{tx.collectedByName || tx.collectedBy} {tx.empNo && `(${tx.empNo})`}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {tx.transactionType === 'CREDIT' ? '-' : ''}₹{Number(tx.amount).toLocaleString()}
                        </td>
                    </tr>
                );
                return (
                    <div style={{ marginTop: '20px' }}>
                        {showCash && cashTxs.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                                    Cash Transactions ({cashTxs.length}) — ₹{cashTxs.reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()}
                                </h3>
                                <table className="print-table" style={{ fontSize: '8px' }}>
                                    {txTableHead}
                                    <tbody>{cashTxs.map(txRow)}</tbody>
                                </table>
                            </div>
                        )}
                        {showBank && bankTxs.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                                    Bank / Online Transactions ({bankTxs.length}) — ₹{bankTxs.reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()}
                                </h3>
                                <table className="print-table" style={{ fontSize: '8px' }}>
                                    {txTableHead}
                                    <tbody>{bankTxs.map(txRow)}</tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Cancelled Transactions Breakdown */}
            {showDetails && cancelledTransactions.length > 0 && (
                <div style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Cancelled Transactions
                    </h3>
                    <table className="print-table" style={{ fontSize: '8px' }}>
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Receipt #</th>
                                <th>Student Name</th>
                                <th>Pin No</th>
                                <th>Course/Branch</th>
                                <th>Fee Head</th>
                                <th>Cancelled By</th>
                                <th>Cancellation Reason</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cancelledTransactions.map((tx, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{tx.receiptNo}</td>
                                    <td>{tx.studentName}</td>
                                    <td>{(!tx.pinNo || tx.pinNo === '-' || tx.pinNo === 'null') ? tx.studentId || '-' : tx.pinNo}</td>
                                    <td>{tx.course} - {tx.branch}</td>
                                    <td>{tx.feeHead}</td>
                                    <td>{tx.cancelledByName || tx.cancelledBy || 'Unknown'}</td>
                                    <td>{tx.cancellationReason || '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        ₹{Number(tx.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edited Transactions Breakdown */}
            {showDetails && editedTransactions.length > 0 && (
                <div style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Edited Transactions
                    </h3>
                    <table className="print-table" style={{ fontSize: '8px' }}>
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Receipt #</th>
                                <th>Student Name</th>
                                <th>Pin No</th>
                                <th>Course/Branch</th>
                                <th>Fee Head</th>
                                <th>Remarks</th>
                                <th>Last Updated</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editedTransactions.map((tx, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{tx.receiptNo}</td>
                                    <td>{tx.studentName}</td>
                                    <td>{(!tx.pinNo || tx.pinNo === '-' || tx.pinNo === 'null') ? tx.studentId || '-' : tx.pinNo}</td>
                                    <td>{tx.course} - {tx.branch}</td>
                                    <td>{tx.feeHead}</td>
                                    <td>{tx.remarks || '-'}</td>
                                    <td>{tx.updatedAt ? new Date(tx.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        ₹{Number(tx.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Signatures — hidden on combined "print all" documents */}
            {!hideSignatures && (
                <div style={{ marginTop: '45px', display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Cashier</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Administrative Officer (AO)</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Principal/Vice Principal</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const CollegeGlobalSummaryPage = ({ data, dateRange, options = {} }) => {
    const { mode = 'all', allowedFeeHeads } = options || {};
    const { showCash, showBank } = paymentVisibility(options);

    // Recompute global fee head summary based on all transactions across all colleges
    // Recompute global course-wise summary based on all transactions across all colleges
    const globalCourseData = {};
    const globalCashierData = {};
    data.forEach(college => {
        const rawTransactions = college.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            // Payment Mode Filter
            if (mode === 'none') return false;
            if (mode === 'Cash' && tx.paymentMode !== 'Cash') return false;
            if (mode === 'Online' && tx.paymentMode === 'Cash') return false;

            // Fee Head Group Filter
            if (allowedFeeHeads && allowedFeeHeads.length > 0) {
                const fhName = (tx.feeHead || '').trim().toLowerCase();
                if (!allowedFeeHeads.includes(fhName)) return false;
            }

            return true;
        });

        filteredTransactions.forEach(tx => {
            if (tx.status !== 'cancelled') {
                const cashierUsername = tx.collectedBy || 'Unknown';
                const cashierName = tx.collectedByName || tx.collectedBy || 'Unknown';
                const empNo = tx.empNo || cashierUsername;
                const amount = tx.amount || 0;
                const isCash = tx.paymentMode === 'Cash';

                if (!globalCashierData[cashierUsername]) {
                    globalCashierData[cashierUsername] = {
                        username: cashierName,
                        empNo: empNo,
                        receiptsCount: 0,
                        cashAmt: 0,
                        bankAmt: 0,
                        concessionAmt: 0,
                        netTotal: 0
                    };
                }
                const cashierEntry = globalCashierData[cashierUsername];
                cashierEntry.receiptsCount++;
                if (tx.transactionType === 'DEBIT') {
                    cashierEntry.netTotal += amount;
                    if (isCash) cashierEntry.cashAmt += amount;
                    else cashierEntry.bankAmt += amount;
                } else if (tx.transactionType === 'CREDIT') {
                    cashierEntry.concessionAmt += amount;
                }
            }

            if (tx.transactionType === 'DEBIT' && tx.status !== 'cancelled') {
                const courseName = tx.course || 'Unknown Course';
                const amount = tx.amount || 0;
                const isCash = tx.paymentMode === 'Cash';

                if (!globalCourseData[courseName]) {
                    globalCourseData[courseName] = {
                        courseName,
                        cashAmt: 0,
                        bankAmt: 0,
                        netTotal: 0
                    };
                }
                const courseEntry = globalCourseData[courseName];
                courseEntry.netTotal += amount;
                if (isCash) courseEntry.cashAmt += amount;
                else courseEntry.bankAmt += amount;
            }
        });
    });
    const sortedGlobalCourses = Object.values(globalCourseData).sort((a, b) => b.netTotal - a.netTotal);
    const sortedGlobalCashiers = Object.values(globalCashierData).sort((a, b) => b.netTotal - a.netTotal);

    const collegeSummaries = data.map(college => {
        const rawTransactions = college.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            // Payment Mode Filter
            if (mode === 'none') return false;
            if (mode === 'Cash' && tx.paymentMode !== 'Cash') return false;
            if (mode === 'Online' && tx.paymentMode === 'Cash') return false;

            // Fee Head Group Filter
            if (allowedFeeHeads && allowedFeeHeads.length > 0) {
                const fhName = (tx.feeHead || '').trim().toLowerCase();
                if (!allowedFeeHeads.includes(fhName)) return false;
            }

            return true;
        });

        const cashAmt = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const bankAmt = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const concessionAmt = filteredTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const totalDebit = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0);

        return {
            collegeName: college._id || 'N/A',
            receiptsCount: filteredTransactions.length,
            cashAmt,
            bankAmt,
            concessionAmt,
            netTotal: totalDebit
        };
    });

    const globalTotals = collegeSummaries.reduce((acc, curr) => {
        acc.receiptsCount += curr.receiptsCount;
        acc.cashAmt += curr.cashAmt;
        acc.bankAmt += curr.bankAmt;
        acc.concessionAmt += curr.concessionAmt;
        acc.netTotal += curr.netTotal;
        return acc;
    }, { receiptsCount: 0, cashAmt: 0, bankAmt: 0, concessionAmt: 0, netTotal: 0 });

    return (
        <div className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; }
                    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
                    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
                    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .compact-row { line-height: 1.2; }
                `}
            </style>

            {/* Header */}
            <div className="print-header">
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>ALL COLLEGES DAILY FEE COLLECTION REPORT {options.selectedGroupName ? `[${options.selectedGroupName.toUpperCase()}]` : ''} {mode !== 'all' && mode !== 'none' && `(${mode === 'Online' ? 'BANK / ONLINE' : mode.toUpperCase()})`}</p>
            </div>

            {/* Info Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}
                </div>
                <div style={{ color: '#4b5563' }}>
                    <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                </div>
            </div>

            {/* 1. College-wise Abstract (FIRST) */}
            <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    College-wise Consolidated Collections
                </h3>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>S.No</th>
                            <th style={{ width: '35%' }}>College Name</th>
                            <th style={{ textAlign: 'center', width: '10%' }}>Receipts</th>
                            {showCash && <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>}
                            {showBank && <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>}
                            <th style={{ textAlign: 'right', width: '20%', fontWeight: 'bold' }}>Collection</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collegeSummaries.map((summary, idx) => (
                            <tr key={idx} className="compact-row">
                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ textTransform: 'uppercase' }}>{summary.collegeName}</td>
                                <td style={{ textAlign: 'center' }}>{summary.receiptsCount}</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(summary.cashAmt).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(summary.bankAmt).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(summary.netTotal).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{globalTotals.receiptsCount}</td>
                            {showCash && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>}
                            {showBank && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>}
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* User-wise Consolidated Collections (Added before Course-wise) */}
            {sortedGlobalCashiers.length > 0 && (
                <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        User-wise Consolidated Collections
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '10%' }}>User ID</th>
                                <th style={{ width: '35%' }}>Cashier Name</th>
                                <th style={{ textAlign: 'center', width: '10%' }}>Receipts</th>
                                {showCash && <th style={{ textAlign: 'right', width: '12%' }}>Cash</th>}
                                {showBank && <th style={{ textAlign: 'right', width: '12%' }}>Bank</th>}
                                <th style={{ textAlign: 'right', width: '16%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedGlobalCashiers.map((summary, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{summary.empNo || 'N/A'}</td>
                                    <td style={{ textTransform: 'uppercase' }}>{summary.username}</td>
                                    <td style={{ textAlign: 'center' }}>{summary.receiptsCount}</td>
                                    {showCash && <td style={{ textAlign: 'right' }}>₹{Number(summary.cashAmt).toLocaleString()}</td>}
                                    {showBank && <td style={{ textAlign: 'right' }}>₹{Number(summary.bankAmt).toLocaleString()}</td>}
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(summary.netTotal).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={3}>TOTAL</td>
                                <td style={{ textAlign: 'center' }}>{globalTotals.receiptsCount}</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* 2. Global Course-wise collections (SECOND) */}
            {sortedGlobalCourses.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Course-wise Consolidated Collections
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '50%' }}>Course Name</th>
                                {showCash && <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>}
                                {showBank && <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>}
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedGlobalCourses.map((course, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ textTransform: 'uppercase' }}>{course.courseName}</td>
                                    {showCash && <td style={{ textAlign: 'right' }}>₹{Number(course.cashAmt).toLocaleString()}</td>}
                                    {showBank && <td style={{ textAlign: 'right' }}>₹{Number(course.bankAmt).toLocaleString()}</td>}
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(course.netTotal).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                {showCash && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>}
                                {showBank && <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>}
                                <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* No signatures on the all-colleges summary page */}
        </div>
    );
};

const CollegeReportTemplate = forwardRef(({ data, dateRange, options = {} }, ref) => {
    if (!data) return null;
    const isArray = Array.isArray(data) && data.length > 0;

    return (
        <div ref={ref}>
            {isArray ? (
                <>
                    {/* Consolidated starting summary page */}
                    <div style={{ pageBreakAfter: 'always' }}>
                        <CollegeGlobalSummaryPage data={data} dateRange={dateRange} options={options} />
                    </div>
                    {/* Individual college reports */}
                    {data.filter(Boolean).map((collegeRow, index) => (
                        <div key={index} style={{ pageBreakAfter: index === data.length - 1 ? 'auto' : 'always' }}>
                            <SingleCollegeReport data={collegeRow} dateRange={dateRange} options={options} hideGeneratedInfo={true} hideSignatures={true} />
                        </div>
                    ))}
                </>
            ) : (
                <SingleCollegeReport data={data} dateRange={dateRange} options={options} />
            )}
        </div>
    );
});

export default CollegeReportTemplate;
