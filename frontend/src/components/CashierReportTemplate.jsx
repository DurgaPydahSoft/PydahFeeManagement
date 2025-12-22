import React, { forwardRef } from 'react';

const CashierReportTemplate = forwardRef(({ data, dateRange }, ref) => {
    // Aggregate fee heads for print
    const aggregatedFeeHeads = data.feeHeads ? data.feeHeads.reduce((acc, curr) => {
        if (!acc[curr.name]) acc[curr.name] = 0;
        acc[curr.name] += curr.amount;
        return acc;
    }, {}) : {};

    return (
        <div ref={ref} style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <style type="text/css" media="print">
                {`@page { size: A4; margin: 20mm; }`}
            </style>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>PYDAH GROUP OF COLLEGES</h1>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>CASHIER COLLECTION SUMMARY REPORT</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '14px' }}>
                <div>
                    <strong>Cashier Name:</strong> {typeof data._id === 'string' ? data._id : 'N/A'}
                </div>
                <div>
                    <strong>Date Range:</strong> {dateRange.start.split('-').reverse().join('/')} to {dateRange.end.split('-').reverse().join('/')}
                </div>
            </div>

            {/* Summary Box */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px' }}>
                <tbody>
                    <tr>
                        <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Total Transactions</td>
                        <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{data.totalCount}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Total Collected (DEBIT)</td>
                        <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{(data.debitAmount || 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Total Concession (CREDIT)</td>
                        <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{(data.creditAmount || 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#e0e0e0' }}>NET COLLECTION</td>
                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>₹{data.totalAmount.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            {/* Cash vs Bank */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Payment Mode Summary</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Mode</th>
                            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>Cash</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{(data.cashAmount || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>Bank (UPI/Cheque/DD)</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{(data.bankAmount || 0).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Fee Head Breakdown */}
            <div>
                <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Fee Head Breakdown</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Fee Head</th>
                            <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(aggregatedFeeHeads).map(([name, amount], i) => (
                            <tr key={i}>
                                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{name}</td>
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{amount.toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Total</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{data.totalAmount.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Cashier Signature</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '150px', paddingTop: '5px' }}>Accounts Officer</p>
                </div>
            </div>
        </div>
    );
});

export default CashierReportTemplate;
