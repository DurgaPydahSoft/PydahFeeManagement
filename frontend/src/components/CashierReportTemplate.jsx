import React, { forwardRef } from 'react';

const CashierReportTemplate = forwardRef(({ data, dateRange }, ref) => {
    // We don't need frontend aggregation for Fee Heads anymore, backend sends it sorted with colleges.
    const feeHeads = data.feeHeads || [];

    return (
        <div ref={ref} style={{ padding: '20px', fontFamily: 'Arial, sans-serif', color: '#000', width: '100%' }}>
            <style type="text/css" media="print">
                {`@page { size: A4; margin: 10mm; }`}
            </style>

            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '15px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold' }}>CASHIER COLLECTION SUMMARY REPORT</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px' }}>
                    <span><strong>Cashier:</strong> {typeof data._id === 'string' ? data._id : 'N/A'}</span>
                    <span><strong>Date:</strong> {dateRange.start.split('-').reverse().join('/')} to {dateRange.end.split('-').reverse().join('/')}</span>
                    <span><strong>Generated:</strong> {new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Layout: Summary Left, Payment Mode Right */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>

                {/* 1. Transaction Summary */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '5px', textTransform: 'uppercase' }}>Summary</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Total Transactions</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{data.totalCount}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Fee Collected (DEBIT)</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right' }}>₹{(data.debitAmount || 0).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Concession (CREDIT)</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right' }}>₹{(data.creditAmount || 0).toLocaleString()}</td>
                            </tr>
                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontWeight: 'bold' }}>NET CASH & BANK</td>
                                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>₹{((data.cashAmount || 0) + (data.bankAmount || 0)).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 2. Payment Modes */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '5px', textTransform: 'uppercase' }}>Payment Details</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Cash In Hand</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right', color: 'green', fontWeight: 'bold' }}>₹{(data.cashAmount || 0).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Bank / Online</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right', color: 'blue', fontWeight: 'bold' }}>₹{(data.bankAmount || 0).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px' }}>Concession / Waiver</td>
                                <td style={{ border: '1px solid #eee', padding: '4px 6px', textAlign: 'right', color: 'orange' }}>₹{(data.creditAmount || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. Fee Head Breakdown with College Stats */}
            <div>
                <h3 style={{ fontSize: '12px', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '5px', textTransform: 'uppercase' }}>Detailed Breakdown</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#eee' }}>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left', width: '30%' }}>Fee Head</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>College Wise Collection</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right', width: '15%' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feeHeads.map((fh, i) => (
                            <tr key={i}>
                                <td style={{ border: '1px solid #ccc', padding: '5px', verticalAlign: 'top', fontWeight: 'bold' }}>{fh.name}</td>
                                <td style={{ border: '1px solid #ccc', padding: '0', verticalAlign: 'top' }}>
                                    {fh.colleges && Object.keys(fh.colleges).length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {Object.entries(fh.colleges).map(([clg, amt], idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ padding: '2px 5px', borderBottom: idx !== Object.keys(fh.colleges).length - 1 ? '1px dashed #eee' : 'none' }}>{clg}</td>
                                                        <td style={{ padding: '2px 5px', textAlign: 'right', borderBottom: idx !== Object.keys(fh.colleges).length - 1 ? '1px dashed #eee' : 'none' }}>₹{amt.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <span style={{ padding: '5px', display: 'block', color: '#888' }}>-</span>
                                    )}
                                </td>
                                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>₹{fh.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                        {/* Grand Total Row */}
                        <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                            <td colSpan="2" style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>GRAND TOTAL COLLECTED</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>₹{data.totalAmount.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Cashier</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Accts. Officer</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Approved By</p>
                </div>
            </div>
        </div>
    );
});

export default CashierReportTemplate;
