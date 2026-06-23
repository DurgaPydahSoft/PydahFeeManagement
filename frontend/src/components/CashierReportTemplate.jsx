import React, { forwardRef } from 'react';

const SingleCashierReport = ({ data, dateRange, options = {} }) => {
    if (!data) return null;
    const { mode = 'all', showSummary = true, showDetails = true } = options || {};

    // Determine active transactions based on mode selection
    const rawTransactions = data.transactions || [];
    const filteredTransactions = rawTransactions.filter(tx => {
        if (mode === 'all') return true;
        if (mode === 'Cash') return tx.paymentMode === 'Cash';
        if (mode === 'Online') return tx.paymentMode !== 'Cash';
        return true;
    });

    // Summary Data for display
    const displayData = {
        totalCount: filteredTransactions.length,
        debitAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        creditAmount: filteredTransactions.filter(tx => tx.transactionType === 'CREDIT').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        cashAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode === 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
        bankAmount: filteredTransactions.filter(tx => tx.transactionType === 'DEBIT' && tx.paymentMode !== 'Cash').reduce((acc, tx) => acc + (tx.amount || 0), 0),
    };

    // 1. Pivot Data for College-wise Breakdown from filtered transactions
    const collegeData = {};
    const feeHeadTotals = {}; // Aggregated from transactions for Global Summary

    filteredTransactions.forEach(tx => {
        // Track global fee head totals for DEBIT only (consistent with collection report)
        if (tx.transactionType === 'DEBIT') {
            const fhName = tx.feeHead || 'Unknown';
            feeHeadTotals[fhName] = (feeHeadTotals[fhName] || 0) + (tx.amount || 0);

            // College Data
            const colName = tx.college || 'Unknown';
            const courseName = tx.course || 'N/A';
            const amount = tx.amount || 0;

            if (!collegeData[colName]) collegeData[colName] = { total: 0, courses: {} };
            if (!collegeData[colName].courses[courseName]) {
                collegeData[colName].courses[courseName] = { total: 0, feeHeads: {} };
            }

            collegeData[colName].courses[courseName].feeHeads[fhName] = (collegeData[colName].courses[courseName].feeHeads[fhName] || 0) + amount;
            collegeData[colName].courses[courseName].total += amount;
            collegeData[colName].total += amount;
        }
    });

    // Sort for display
    const sortedColleges = Object.keys(collegeData).sort();
    const sortedFeeHeads = Object.entries(feeHeadTotals)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

    return (
        <div className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    .print-table th, .print-table td { border: 1px solid #000; padding: 4px 8px; }
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
                    <strong>Cashier:</strong> <span style={{ textTransform: 'uppercase' }}>{typeof data._id === 'string' ? data._id : 'N/A'}</span>
                </div>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}
                </div>
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
            )}

            {/* 2 & 3. Side-by-Side: Global Fee Head Summary & College-wise breakdown */}
            {showSummary && (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                    {/* Left: Global Fee Head Summary (50% width) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                            Global Fee Head Summary
                        </h3>
                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th>Fee Head</th>
                                    <th style={{ textAlign: 'right', width: '100px' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFeeHeads.map((fh, idx) => (
                                    <tr key={idx} className="compact-row">
                                        <td>{fh.name}</td>
                                        <td style={{ textAlign: 'right' }}>₹{Number(fh.amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                                <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                    <td style={{ textAlign: 'right' }}>Total</td>
                                    <td style={{ textAlign: 'right' }}>₹{Number(displayData.debitAmount || 0).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Right: College-wise Breakdown (50% width) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {sortedColleges.length > 0 ? (
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                                    College-wise Breakdown
                                </h3>
                                {sortedColleges.map((collegeName, cIdx) => {
                                    const colData = collegeData[collegeName];
                                    return (
                                        <div key={cIdx} style={{ breakInside: 'avoid', marginBottom: '15px', border: '1px solid #ddd' }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: '#f0f0f0',
                                                borderBottom: '1px solid #ccc',
                                                padding: '5px 8px',
                                            }}>
                                                <h4 style={{ margin: 0, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                    {collegeName}
                                                </h4>
                                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>₹{Number(colData.total).toLocaleString()}</span>
                                            </div>

                                            {Object.entries(colData.courses)
                                                .sort((a, b) => b[1].total - a[1].total)
                                                .map(([courseName, courseData], crsIdx) => (
                                                    <div key={crsIdx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <div style={{
                                                            backgroundColor: '#fdfdfd',
                                                            padding: '2px 8px',
                                                            fontWeight: 'bold',
                                                            fontSize: '9px',
                                                            color: '#555',
                                                            borderBottom: '1px solid #f0f0f0',
                                                            display: 'flex',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <span>{courseName}</span>
                                                            <span>₹{Number(courseData.total).toLocaleString()}</span>
                                                        </div>
                                                        <table className="print-table" style={{ fontSize: '8px', width: '100%', border: 'none' }}>
                                                            <tbody>
                                                                {Object.entries(courseData.feeHeads)
                                                                    .filter(([_, amt]) => amt > 0)
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .map(([headName, amt], hIdx) => (
                                                                        <tr key={hIdx}>
                                                                            <td style={{ border: 'none', borderBottom: '1px dotted #eee', padding: '2px 10px', color: '#444' }}>{headName}</td>
                                                                            <td style={{ border: 'none', borderBottom: '1px dotted #eee', padding: '2px 8px', textAlign: 'right', width: '70px' }}>₹{Number(amt).toLocaleString()}</td>
                                                                        </tr>
                                                                    ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ))}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', border: '1px solid #ddd', color: '#888' }}>
                                No college-wise breakdown available.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Individual Transactions Table */}
            {showDetails && filteredTransactions.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        Individual Transactions Breakdown
                    </h3>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Receipt #</th>
                                <th>Student Name</th>
                                <th>Pin No</th>
                                <th>Course/Branch</th>
                                <th>Year</th>
                                <th>Type</th>
                                <th>Mode</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((tx, idx) => (
                                <tr key={idx} className="compact-row">
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td>{tx.receiptNo}</td>
                                    <td>{tx.studentName}</td>
                                    <td>{tx.pinNo}</td>
                                    <td>{tx.course} - {tx.branch}</td>
                                    <td>{tx.studentYear}</td>
                                    <td style={{ fontWeight: tx.transactionType === 'CREDIT' ? 'bold' : 'normal', fontStyle: tx.transactionType === 'CREDIT' ? 'italic' : 'normal' }}>
                                        {tx.transactionType === 'CREDIT' ? 'Concession' : 'Payment'}
                                    </td>
                                    <td>{tx.paymentMode}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        {tx.transactionType === 'CREDIT' ? '-' : ''}₹{Number(tx.amount).toLocaleString()}
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

const CashierReportTemplate = forwardRef(({ data, dateRange, options = {} }, ref) => {
    if (!data) return null;
    const isArray = Array.isArray(data);

    return (
        <div ref={ref}>
            {isArray ? (
                data.filter(Boolean).map((cashierRow, index) => (
                    <div key={index} style={{ pageBreakAfter: index === data.length - 1 ? 'auto' : 'always' }}>
                        <SingleCashierReport data={cashierRow} dateRange={dateRange} options={options} />
                    </div>
                ))
            ) : (
                <SingleCashierReport data={data} dateRange={dateRange} options={options} />
            )}
        </div>
    );
});

export default CashierReportTemplate;
