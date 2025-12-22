import React, { forwardRef } from 'react';

const DailyReportTemplate = forwardRef(({ data }, ref) => {
    // data is the row object which contains _id (date) and transactions array

    const dateStr = data._id?.day
        ? `${String(data._id.day).padStart(2, '0')}/${String(data._id.month).padStart(2, '0')}/${data._id.year}`
        : 'Date Unknown';

    return (
        <div ref={ref} style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <style type="text/css" media="print">
                {`@page { size: A4; margin: 20mm; }`}
            </style>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>PYDAH GROUP OF COLLEGES</h1>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>DAILY COLLECTION REPORT</p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>Date: {dateStr}</p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left', width: '50px' }}>S.No</th>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Receipt No</th>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Student Name</th>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Admission No</th>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Mode</th>
                        <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {data.transactions && data.transactions.map((tx, idx) => (
                        <tr key={idx}>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tx.receiptNo || '-'}</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tx.studentName || '-'}</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tx.studentId || '-'}</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tx.paymentMode}</td>
                            <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>
                                {tx.transactionType === 'CREDIT' ? `(${Math.abs(tx.amount).toLocaleString()})` : `₹${tx.amount.toLocaleString()}`}
                            </td>
                        </tr>
                    ))}
                    <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                        <td colSpan="5" style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>Total Collection</td>
                        <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>₹{data.totalAmount.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

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

export default DailyReportTemplate;
