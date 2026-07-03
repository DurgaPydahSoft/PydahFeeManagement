import React, { forwardRef } from 'react';

const SingleCollegeReport = ({ data, dateRange, options = {}, hideGeneratedInfo = false }) => {
    if (!data) return null;
    const { mode = 'all', showSummary = true, showDetails = true, allowedFeeHeads } = options || {};

    const rawTransactions = data.transactions || [];
    const filteredTransactions = rawTransactions.filter(tx => {
        // Payment Mode Filter
        if (mode === 'Cash' && tx.paymentMode !== 'Cash') return false;
        if (mode === 'Online' && tx.paymentMode === 'Cash') return false;

        // Fee Head Group Filter
        if (allowedFeeHeads && allowedFeeHeads.length > 0) {
            const fhName = (tx.feeHead || '').trim().toLowerCase();
            if (!allowedFeeHeads.includes(fhName)) return false;
        }

        return true;
    });

    // Recompute fee head summary based on filtered transactions for this college
    const feeHeadData = {};
    filteredTransactions.forEach(tx => {
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

    // Recompute cashier breakdown based on filtered transactions for this college
    const cashierData = {};
    filteredTransactions.forEach(tx => {
        const username = tx.collectedBy || 'Unknown';
        const name = tx.collectedByName || 'Unknown';
        const amount = tx.amount || 0;
        const isDebit = tx.transactionType === 'DEBIT';
        const isCredit = tx.transactionType === 'CREDIT';
        const isCash = tx.paymentMode === 'Cash';

        if (!cashierData[username]) {
            cashierData[username] = {
                username,
                name,
                empNo: tx.empNo || username,
                count: 0,
                cashAmt: 0,
                bankAmt: 0,
                concessionAmt: 0,
                netTotal: 0,
                feeHeads: {}
            };
        }

        const entry = cashierData[username];
        entry.count++;
        if (isDebit) {
            entry.netTotal += amount;
            if (isCash) entry.cashAmt += amount;
            else entry.bankAmt += amount;

            const fhName = tx.feeHead || 'Unknown';
            if (!entry.feeHeads[fhName]) {
                entry.feeHeads[fhName] = {
                    name: fhName,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0
                };
            }
            const fhEntry = entry.feeHeads[fhName];
            fhEntry.netTotal += amount;
            if (isCash) fhEntry.cashAmt += amount;
            else fhEntry.bankAmt += amount;
        } else if (isCredit) {
            entry.concessionAmt += amount;
        }
    });

    const sortedCashiers = Object.values(cashierData).map(c => {
        c.sortedFeeHeads = Object.values(c.feeHeads).sort((a, b) => b.netTotal - a.netTotal);
        return c;
    }).sort((a, b) => b.netTotal - a.netTotal);

    // Totals for this college
    const displayData = {
        totalCount: filteredTransactions.length,
        debitAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        creditAmount: filteredTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        cashAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        bankAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
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
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>COLLEGE COLLECTION SUMMARY REPORT {options.selectedGroupName ? `[${options.selectedGroupName.toUpperCase()}]` : ''} {mode !== 'all' && `(${mode.toUpperCase()})`}</p>
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
                        <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
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
                                <th style={{ textAlign: 'right', width: '15%' }}>Cash</th>
                                <th style={{ textAlign: 'right', width: '15%' }}>Bank</th>
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFeeHeads.map((fh, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{fh.name}</td>
                                    <td style={{ textAlign: 'right' }}>₹{Number(fh.cashAmt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>₹{Number(fh.bankAmt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(fh.netTotal).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* 2. Cashier Breakdown for this College (SECOND, with inline fee heads breakdown) */}
            {showSummary && sortedCashiers.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        User-wise Consolidated Collections
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '45%' }}>Cashier Name / Fee Heads Collected</th>
                                <th style={{ textAlign: 'center', width: '10%' }}>Receipts</th>
                                <th style={{ textAlign: 'right', width: '12%' }}>Cash</th>
                                <th style={{ textAlign: 'right', width: '13%' }}>Bank</th>
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCashiers.map((cashier, idx) => {
                                const rows = [];
                                // Add Cashier Total Row
                                rows.push(
                                    <tr key={`cashier-${idx}`} style={{ backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>
                                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ textTransform: 'uppercase' }}>{cashier.name} {cashier.empNo && `(${cashier.empNo})`}</td>
                                        <td style={{ textAlign: 'center' }}>{cashier.count}</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(cashier.cashAmt).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(cashier.bankAmt).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(cashier.netTotal).toLocaleString()}</td>
                                    </tr>
                                );
                                // Add Cashier's Fee Head Breakdown sub-rows
                                cashier.sortedFeeHeads.forEach((fh, fhIdx) => {
                                    rows.push(
                                        <tr key={`cashier-fh-${idx}-${fhIdx}`} className="compact-row" style={{ color: '#333', fontWeight: 'bold' }}>
                                            <td></td>
                                            <td style={{ paddingLeft: '20px', fontSize: '10px' }}>
                                                {fh.name}
                                            </td>
                                            <td></td>
                                            <td style={{ textAlign: 'right', fontSize: '10px' }}>₹{Number(fh.cashAmt).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontSize: '10px' }}>₹{Number(fh.bankAmt).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>₹{Number(fh.netTotal).toLocaleString()}</td>
                                        </tr>
                                    );
                                });
                                return rows;
                            })}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                <td style={{ textAlign: 'center' }}>{displayData.totalCount}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.cashAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.bankAmount || 0).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Individual Transactions for this College */}
            {showDetails && filteredTransactions.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Individual Transactions Breakdown
                    </h3>
                    <table className="print-table" style={{ fontSize: '8px' }}>
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
                        <tbody>
                            {filteredTransactions.map((tx, idx) => (
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
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Signatures (Removed Cashier Sign) */}
            <div style={{ marginTop: '45px', display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Accountant</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Principal/Director</p>
                </div>
            </div>
        </div>
    );
};

const CollegeGlobalSummaryPage = ({ data, dateRange, options = {} }) => {
    const { mode = 'all', allowedFeeHeads } = options || {};

    // Recompute global fee head summary based on all transactions across all colleges
    const globalFeeHeadData = {};
    data.forEach(college => {
        const rawTransactions = college.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            // Payment Mode Filter
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
            if (tx.transactionType === 'DEBIT') {
                const fhName = tx.feeHead || 'Unknown';
                const amount = tx.amount || 0;
                const isCash = tx.paymentMode === 'Cash';

                if (!globalFeeHeadData[fhName]) {
                    globalFeeHeadData[fhName] = {
                        name: fhName,
                        cashAmt: 0,
                        bankAmt: 0,
                        netTotal: 0
                    };
                }
                const entry = globalFeeHeadData[fhName];
                entry.netTotal += amount;
                if (isCash) entry.cashAmt += amount;
                else entry.bankAmt += amount;
            }
        });
    });
    const sortedGlobalFeeHeads = Object.values(globalFeeHeadData).sort((a, b) => b.netTotal - a.netTotal);

    const collegeSummaries = data.map(college => {
        const rawTransactions = college.transactions || [];
        const filteredTransactions = rawTransactions.filter(tx => {
            // Payment Mode Filter
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
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>ALL COLLEGES DAILY FEE COLLECTION REPORT {options.selectedGroupName ? `[${options.selectedGroupName.toUpperCase()}]` : ''} {mode !== 'all' && `(${mode.toUpperCase()})`}</p>
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
                            <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>
                            <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>
                            <th style={{ textAlign: 'right', width: '20%', fontWeight: 'bold' }}>Collection</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collegeSummaries.map((summary, idx) => (
                            <tr key={idx} className="compact-row">
                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ textTransform: 'uppercase' }}>{summary.collegeName}</td>
                                <td style={{ textAlign: 'center' }}>{summary.receiptsCount}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.cashAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(summary.bankAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(summary.netTotal).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{globalTotals.receiptsCount}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 2. Global Fee Head-wise collections (SECOND) */}
            {sortedGlobalFeeHeads.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Fee Head-wise Consolidated Collections (All Colleges)
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>S.No</th>
                                <th style={{ width: '50%' }}>Fee Head Name</th>
                                <th style={{ textAlign: 'right', width: '15%' }}>Cash Amount</th>
                                <th style={{ textAlign: 'right', width: '15%' }}>Bank Amount</th>
                                <th style={{ textAlign: 'right', width: '15%', fontWeight: 'bold' }}>Collection</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedGlobalFeeHeads.map((fh, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{fh.name}</td>
                                    <td style={{ textAlign: 'right' }}>₹{Number(fh.cashAmt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>₹{Number(fh.bankAmt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Number(fh.netTotal).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                                <td colSpan={2}>TOTAL</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.cashAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.bankAmt).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>₹{Number(globalTotals.netTotal).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Signatures (Removed Representative/Cashier Sign, keeping Accountant + Principal/Director) */}
            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Accountant</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Principal/Director</p>
                </div>
            </div>
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
                            <SingleCollegeReport data={collegeRow} dateRange={dateRange} options={options} hideGeneratedInfo={true} />
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
