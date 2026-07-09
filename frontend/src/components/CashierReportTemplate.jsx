import React, { forwardRef } from 'react';

const SingleCashierReport = ({ data, dateRange, options = {}, hideGeneratedInfo = false }) => {
    if (!data) return null;
    console.log(`SingleCashierReport rendering cashier "${data._id}":`, {
        transactionsCount: data.transactions?.length,
        cashAmount: data.cashAmount,
        bankAmount: data.bankAmount,
        transactions: data.transactions
    });
    const { mode = 'all', showSummary = true, showDetails = true } = options || {};

    // Determine active, cancelled, and edited transactions based on mode selection
    const rawTransactions = data.transactions || [];
    const filteredTransactions = rawTransactions.filter(tx => {
        if (mode === 'all') return true;
        if (mode === 'Cash') return tx.paymentMode === 'Cash';
        if (mode === 'Online') return tx.paymentMode !== 'Cash';
        return true;
    });

    const activeTransactions = filteredTransactions.filter(tx => tx.status !== 'cancelled');
    const cancelledTransactions = filteredTransactions.filter(tx => tx.status === 'cancelled');
    const editedTransactions = filteredTransactions.filter(tx => tx.status !== 'cancelled' && tx.updatedAt && tx.createdAt && (new Date(tx.updatedAt).getTime() - new Date(tx.createdAt).getTime() > 10000));

    // Summary Data for display (using active transactions only)
    const displayData = {
        totalCount: activeTransactions.length,
        debitAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        creditAmount: activeTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        cashAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        bankAmount: activeTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
    };

    // 1. Pivot Data for College-wise Breakdown from filtered transactions
    const collegeData = {};

    filteredTransactions.forEach(tx => {
        if (tx.transactionType === 'DEBIT') {
            const fhName = tx.feeHead || 'Unknown';
            const amount = tx.amount || 0;
            const isCash = tx.paymentMode === 'Cash';

            const colName = tx.college || 'Unknown';
            const courseName = tx.course || 'N/A';

            if (!collegeData[colName]) {
                collegeData[colName] = { total: 0, cash: 0, bank: 0, courses: {} };
            }
            if (!collegeData[colName].courses[courseName]) {
                collegeData[colName].courses[courseName] = { total: 0, cash: 0, bank: 0, feeHeads: {} };
            }
            if (!collegeData[colName].courses[courseName].feeHeads[fhName]) {
                collegeData[colName].courses[courseName].feeHeads[fhName] = { total: 0, cash: 0, bank: 0 };
            }

            const fhEntry = collegeData[colName].courses[courseName].feeHeads[fhName];
            fhEntry.total += amount;
            if (isCash) {
                fhEntry.cash += amount;
                collegeData[colName].courses[courseName].cash += amount;
                collegeData[colName].cash += amount;
            } else {
                fhEntry.bank += amount;
                collegeData[colName].courses[courseName].bank += amount;
                collegeData[colName].bank += amount;
            }
            collegeData[colName].courses[courseName].total += amount;
            collegeData[colName].total += amount;
        }
    });

    // Sort for display
    const sortedColleges = Object.keys(collegeData).sort();

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
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>CASHIER COLLECTION SUMMARY REPORT {mode !== 'all' && `(${mode.toUpperCase()})`}</p>
            </div>

            {/* Info Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>Cashier:</strong> <span style={{ textTransform: 'uppercase' }}>{typeof data._id === 'string' ? data._id : 'N/A'}</span> {data.empNo && `(${data.empNo})`}
                </div>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}
                </div>
                {!hideGeneratedInfo && (
                    <div style={{ color: '#4b5563' }}>
                        <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                )}
            </div>

            {/* 1. Overall Summary Section (Abstract - Single Row) */}
            {showSummary && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Transaction Summary {mode !== 'all' && `[${mode}]`}
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '20%' }}>Total Receipts</th>
                                <th style={{ textAlign: 'right', width: '20%' }}>Cash</th>
                                <th style={{ textAlign: 'right', width: '20%' }}>Bank (Online)</th>
                                <th style={{ textAlign: 'right', width: '20%' }}>Concessions</th>
                                <th style={{ textAlign: 'right', width: '20%', fontWeight: 'bold' }}>Net Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ textAlign: 'center' }}>{displayData.totalCount}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.creditAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#e0e0e0' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}            {/* 2. College-wise Breakdown (Full Width with Cash, Bank, and Net columns) */}
            {showSummary && (
                <div style={{ marginBottom: '25px' }}>
                    {sortedColleges.length > 0 ? (
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                                College-wise Breakdown
                            </h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '55%' }}>College / Course / Fee Head Name</th>
                                        <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>
                                        <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>
                                        <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedColleges.map((collegeName) => {
                                        const colData = collegeData[collegeName];
                                        const rows = [];

                                        // Add College Header Row
                                        rows.push(
                                            <tr key={`col-${collegeName}`} style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                                <td style={{ textTransform: 'uppercase', padding: '5px 8px' }}>
                                                    {collegeName} (Total)
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '5px 8px' }}>
                                                    ₹{Number(colData.cash).toLocaleString()}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '5px 8px' }}>
                                                    ₹{Number(colData.bank).toLocaleString()}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '5px 8px' }}>
                                                    ₹{Number(colData.total).toLocaleString()}
                                                </td>
                                            </tr>
                                        );

                                        // Add Course Rows & Fee Heads
                                        Object.entries(colData.courses)
                                            .sort((a, b) => b[1].total - a[1].total)
                                            .forEach(([courseName, courseData]) => {
                                                // Add Course Row
                                                rows.push(
                                                    <tr key={`crs-${collegeName}-${courseName}`} style={{ fontWeight: 'bold' }}>
                                                        <td style={{ paddingLeft: '15px', paddingTop: '4px', paddingBottom: '4px' }}>
                                                            — {courseName}
                                                        </td>
                                                        <td style={{ textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                                                            ₹{Number(courseData.cash).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                                                            ₹{Number(courseData.bank).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                                                            ₹{Number(courseData.total).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );

                                                // Add Fee Head Rows
                                                Object.entries(courseData.feeHeads)
                                                    .filter(([_, fhVal]) => fhVal.total > 0)
                                                    .sort((a, b) => b[1].total - a[1].total)
                                                    .forEach(([headName, fhVal]) => {
                                                        rows.push(
                                                            <tr key={`fh-${collegeName}-${courseName}-${headName}`} className="compact-row" style={{ fontWeight: 'normal' }}>
                                                                <td style={{ paddingLeft: '30px', paddingTop: '3px', paddingBottom: '3px', fontStyle: 'italic' }}>
                                                                    {headName}
                                                                </td>
                                                                <td style={{ textAlign: 'right', paddingTop: '3px', paddingBottom: '3px' }}>
                                                                    ₹{Number(fhVal.cash).toLocaleString()}
                                                                </td>
                                                                <td style={{ textAlign: 'right', paddingTop: '3px', paddingBottom: '3px' }}>
                                                                    ₹{Number(fhVal.bank).toLocaleString()}
                                                                </td>
                                                                <td style={{ textAlign: 'right', paddingTop: '3px', paddingBottom: '3px' }}>
                                                                    ₹{Number(fhVal.total).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                            });

                                        return rows;
                                    })}
                                    <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                        <td>GRAND TOTAL</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px', border: '2px solid #000', color: '#000', fontWeight: 'bold' }}>
                            No college-wise breakdown available.
                        </div>
                    )}
                </div>
            )}

            {/* 4. Individual Transactions Table — Cash first, then Bank */}
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
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {tx.transactionType === 'CREDIT' ? '-' : ''}₹{Number(tx.amount).toLocaleString()}
                        </td>
                    </tr>
                );
                return (
                    <div style={{ marginTop: '20px' }}>
                        {cashTxs.length > 0 && (
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
                        {bankTxs.length > 0 && (
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
            {cancelledTransactions.length > 0 && (
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
            {editedTransactions.length > 0 && (
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

            {/* Footer Signatures */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Cashier</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Accountant</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Principal/Director</p>
                </div>
            </div>
        </div>
    );
};

const GlobalSummaryPage = ({ data, dateRange, options = {} }) => {
    const { mode = 'all' } = options || {};

    const cashierSummaries = data.map(cashier => {
        const rawTransactions = cashier.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            if (mode === 'all') return true;
            if (mode === 'Cash') return tx.paymentMode === 'Cash';
            if (mode === 'Online') return tx.paymentMode !== 'Cash';
            return true;
        });

        const cashAmt = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const bankAmt = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const concessionAmt = filteredTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0);
        const totalDebit = filteredTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0);

        return {
            username: cashier._id || 'N/A',
            empNo: cashier.empNo || 'N/A',
            receiptsCount: filteredTransactions.length,
            cashAmt,
            bankAmt,
            concessionAmt,
            netTotal: totalDebit
        };
    });

    const allTransactions = [];
    data.forEach(cashier => {
        const rawTransactions = cashier.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            if (mode === 'all') return true;
            if (mode === 'Cash') return tx.paymentMode === 'Cash';
            if (mode === 'Online') return tx.paymentMode !== 'Cash';
            return true;
        });
        allTransactions.push(...filteredTransactions);
    });

    const collegeSummaryMap = {};
    allTransactions.forEach(tx => {
        const collegeName = tx.college || 'N/A';
        if (!collegeSummaryMap[collegeName]) {
            collegeSummaryMap[collegeName] = {
                cashAmt: 0,
                bankAmt: 0,
                concessionAmt: 0,
                netTotal: 0
            };
        }
        
        const amt = tx.amount || 0;
        if (tx.transactionType === 'DEBIT') {
            collegeSummaryMap[collegeName].netTotal += amt;
            if (tx.paymentMode === 'Cash') {
                collegeSummaryMap[collegeName].cashAmt += amt;
            } else {
                collegeSummaryMap[collegeName].bankAmt += amt;
            }
        } else if (tx.transactionType === 'CREDIT') {
            collegeSummaryMap[collegeName].concessionAmt += amt;
        }
    });

    const collegeSummaries = Object.entries(collegeSummaryMap).map(([collegeName, metrics]) => ({
        collegeName,
        ...metrics
    })).sort((a, b) => b.netTotal - a.netTotal);

    const globalTotals = cashierSummaries.reduce((acc, curr) => {
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
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>ALL CASHIERS DAILY FEE COLLECTION REPORT {mode !== 'all' && `(${mode.toUpperCase()})`}</p>
            </div>

            {/* Info Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}
                </div>
                <div style={{ color: '#4b5563' }}>
                    <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
            </div>

            {/* Table 1: Cashier-wise Summary */}
            <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    Cashier-wise Consolidated Collections
                </h3>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>S.No</th>
                            <th style={{ width: '10%' }}>User ID</th>
                            <th style={{ width: '30%' }}>Cashier Name</th>
                            <th style={{ textAlign: 'center', width: '10%' }}>Receipts</th>
                            <th style={{ textAlign: 'right', width: '11%' }}>Cash</th>
                            <th style={{ textAlign: 'right', width: '11%' }}>Bank</th>
                            <th style={{ textAlign: 'right', width: '11%' }}>Concessions</th>
                            <th style={{ textAlign: 'right', width: '12%', fontWeight: 'bold' }}>Collection</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cashierSummaries.map((summary, idx) => (
                            <tr key={idx} className="compact-row">
                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                <td>{summary.empNo || 'N/A'}</td>
                                <td style={{ textTransform: 'uppercase' }}>{summary.username}</td>
                                <td style={{ textAlign: 'center' }}>{summary.receiptsCount}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.cashAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.bankAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.concessionAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(summary.netTotal).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td colSpan={3}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{globalTotals.receiptsCount}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.concessionAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Table 2: College-wise Summary */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    College-wise Breakdown
                </h3>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>College Name</th>
                            <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>
                            <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>
                            <th style={{ textAlign: 'right', width: '15%' }}>Concessions</th>
                            <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collegeSummaries.map((summary, idx) => (
                            <tr key={idx} className="compact-row">
                                <td>{summary.collegeName}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.cashAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.bankAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.concessionAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(summary.netTotal).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.concessionAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Footer Signatures */}
            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Cashier Representative</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Accountant</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Principal/Director</p>
                </div>
            </div>
        </div>
    );
};

const CashierReportTemplate = forwardRef(({ data, dateRange, options = {} }, ref) => {
    if (!data) return null;
    console.log("CashierReportTemplate data received:", data);
    const isArray = Array.isArray(data) && data.length > 0;

    return (
        <div ref={ref}>
            {isArray ? (
                <>
                    {/* Consolidated starting summary page */}
                    <div style={{ pageBreakAfter: 'always' }}>
                        <GlobalSummaryPage data={data} dateRange={dateRange} options={options} />
                    </div>
                    {/* Individual reports */}
                    {data.filter(Boolean).map((cashierRow, index) => (
                        <div key={index} style={{ pageBreakAfter: index === data.length - 1 ? 'auto' : 'always' }}>
                            <SingleCashierReport data={cashierRow} dateRange={dateRange} options={options} hideGeneratedInfo={true} />
                        </div>
                    ))}
                </>
            ) : (
                <SingleCashierReport data={data} dateRange={dateRange} options={options} />
            )}
        </div>
    );
});

export default CashierReportTemplate;
