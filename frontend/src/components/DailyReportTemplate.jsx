import React, { forwardRef } from 'react';
import { isRtfTransaction, isBankCollectionTx } from '../utils/reportTxHelpers';

const DailyReportTemplate = forwardRef(({ data }, ref) => {
    // data is the row object which contains _id (date) and transactions array

    const dateStr = data._id?.day
        ? `${String(data._id.day).padStart(2, '0')}/${String(data._id.month).padStart(2, '0')}/${data._id.year}`
        : 'Date Unknown';

    const allTxs = data.transactions || [];
    const cashTxs = allTxs.filter(tx => tx.paymentMode === 'Cash');
    const rtfTxs = allTxs.filter(tx => isRtfTransaction(tx));
    const bankTxs = allTxs.filter(tx => isBankCollectionTx(tx));

    const rtfTotal = rtfTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return (
        <div ref={ref} style={{ padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <style type="text/css" media="print">
                {`@page { size: A4; margin: 5mm; }`}
            </style>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>PYDAH GROUP OF COLLEGES</h1>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>DAILY COLLECTION REPORT</p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>Date: {dateStr}</p>
            </div>

            {(cashTxs.length > 0 || bankTxs.length > 0) && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '20px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left', width: '30px' }}>S.No</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Receipt No</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Student Name</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Pin Number</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Admiss No</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Course</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Branch</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Year</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Sem</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Mode</th>
                            <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...cashTxs, ...bankTxs].map((tx, idx) => (
                            <tr key={idx}>
                                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.receiptNo || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.studentName || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.pinNo || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.studentId || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.course || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.branch || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.studentYear || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.semester || '-'}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.paymentMode}</td>
                                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>
                                    {tx.transactionType === 'CREDIT' ? `(${Math.abs(tx.amount).toLocaleString('en-IN')})` : `₹${Number(tx.amount).toLocaleString('en-IN')}`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {rtfTxs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        RTF / Proceeding Transactions ({rtfTxs.length}) — ₹{rtfTotal.toLocaleString('en-IN')}
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>S.No</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Proceeding #</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Receipt No</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Student Name</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Pin Number</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Admiss No</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Course</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Approved By</th>
                                <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rtfTxs.map((tx, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px', fontWeight: 'bold' }}>{tx.proceedingNumber || tx.referenceNo || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.receiptNo || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.studentName || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.pinNo || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.studentId || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px' }}>{tx.course || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px', textTransform: 'uppercase' }}>{tx.collectedByName || tx.collectedBy || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>₹{Number(tx.amount || 0).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ backgroundColor: '#f0f0f0', borderTop: '2px solid #000', padding: '8px', textAlign: 'right', fontSize: '13px' }}>
                <span style={{ marginRight: '20px', fontWeight: 'bold' }}>Total Cash: ₹{cashTxs.filter(t => t.transactionType !== 'CREDIT').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}</span>
                <span style={{ marginRight: '20px', fontWeight: 'bold' }}>Total Bank: ₹{bankTxs.filter(t => t.transactionType !== 'CREDIT').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString('en-IN')}</span>
                {rtfTxs.length > 0 && (
                    <span style={{ marginRight: '20px', fontWeight: 'bold' }}>Total RTF: ₹{rtfTotal.toLocaleString('en-IN')}</span>
                )}
                <span style={{ fontWeight: 'bold', color: '#000' }}>Total Collection: ₹{(data.totalAmount || 0).toLocaleString('en-IN')}</span>
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

export default DailyReportTemplate;
