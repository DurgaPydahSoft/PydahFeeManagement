import React, { forwardRef } from 'react';

const CashierReportTemplate = forwardRef(({ data, dateRange }, ref) => {
    // 1. Pivot Data for College-wise Breakdown
    // Structure: { "College Name": { total: 0, feeHeads: { "Fee Head Name": amount } } }
    const collegeData = {};
    const allFeeHeadNames = new Set();

    if (data.feeHeads) {
        data.feeHeads.forEach(fh => {
            allFeeHeadNames.add(fh.name);
            if (fh.colleges) {
                Object.entries(fh.colleges).forEach(([colName, amount]) => {
                    if (!collegeData[colName]) {
                        collegeData[colName] = { total: 0, feeHeads: {} };
                    }
                    collegeData[colName].feeHeads[fh.name] = amount;
                    collegeData[colName].total += amount;
                });
            }
        });
    }

    // Sort Colleges and Fee Heads for consistent display
    const sortedColleges = Object.keys(collegeData).sort();
    const sortedFeeHeads = data.feeHeads ? [...data.feeHeads].sort((a, b) => b.amount - a.amount) : [];

    return (
        <div ref={ref} className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
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
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>CASHIER COLLECTION SUMMARY REPORT</p>
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

            {/* 1. Overall Summary Section (Compact Grid) */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    Transaction Summary
                </h3>
                <table className="print-table">
                    <tbody>
                        <tr>
                            <th style={{ width: '25%' }}>Total Receipts</th>
                            <td style={{ width: '25%', textAlign: 'right' }}>{data.totalCount}</td>
                            <th style={{ width: '25%' }}>Total Collected (Debit)</th>
                            <td style={{ width: '25%', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(data.debitAmount || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>Cash Collected</th>
                            <td style={{ textAlign: 'right' }}>₹{Number(data.cashAmount || 0).toLocaleString()}</td>
                            <th>Bank Collected</th>
                            <td style={{ textAlign: 'right' }}>₹{Number(data.bankAmount || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <th>Concessions (Credit)</th>
                            <td style={{ textAlign: 'right' }}>₹{Number(data.creditAmount || 0).toLocaleString()}</td>
                            <th style={{ backgroundColor: '#e0e0e0' }}>NET TOTAL</th>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px', backgroundColor: '#e0e0e0' }}>
                                ₹{Number(data.totalAmount || data.debitAmount || 0).toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 2. Global Fee Head Breakdown */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    Global Fee Head Summary
                </h3>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Fee Head</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>Amount</th>
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
                            <td style={{ textAlign: 'right' }}>₹{Number(data.debitAmount || 0).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 3. College-wise Breakdown (The New Requirement) */}
            {sortedColleges.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        College-wise Detailed Breakdown
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {sortedColleges.map((collegeName, cIdx) => {
                            const colData = collegeData[collegeName];
                            // Filter fee heads that actually have amount for this college
                            const activeFeeHeads = Object.entries(colData.feeHeads)
                                .filter(([_, amt]) => amt > 0)
                                .sort((a, b) => b[1] - a[1]);

                            return (
                                <div key={cIdx} style={{ breakInside: 'avoid', marginBottom: '15px', border: '1px solid #ddd', padding: '0' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        backgroundColor: '#f0f0f0',
                                        borderBottom: '1px solid #ccc',
                                        padding: '5px 8px',
                                        marginBottom: '0'
                                    }}>
                                        <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>
                                            {collegeName}
                                        </h4>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{Number(colData.total).toLocaleString()}</span>
                                    </div>

                                    <table className="print-table" style={{ fontSize: '10px', width: '100%', border: 'none' }}>
                                        <tbody>
                                            {activeFeeHeads.map(([headName, amt], hIdx) => (
                                                <tr key={hIdx}>
                                                    <td style={{ border: 'none', borderBottom: '1px dotted #ccc', padding: '4px 8px' }}>{headName}</td>
                                                    <td style={{ border: 'none', borderBottom: '1px dotted #ccc', padding: '4px 8px', textAlign: 'right' }}>₹{Number(amt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
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
});

export default CashierReportTemplate;
