import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ transaction, student }, ref) => {
    // Safety check just in case, but parent should control rendering
    if (!transaction || !student) return null;

    return (
        <div ref={ref} style={{
            padding: '40px',
            backgroundColor: 'white',
            fontFamily: 'Arial, sans-serif',
            color: 'black',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto'
        }}>
            <style type="text/css" media="print">
                {`
                    @page { size: auto; margin: 20mm; }
                    body { -webkit-print-color-adjust: exact; }
                `}
            </style>

            <div style={{
                textAlign: 'center',
                borderBottom: '2px solid #000',
                paddingBottom: '20px',
                marginBottom: '30px'
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>
                    {student.college || 'PYDAH GROUP OF COLLEGES'}
                </h1>
                <p style={{ fontSize: '14px', color: '#555', marginTop: '5px' }}>Kakinada, Andhra Pradesh</p>
                <div style={{
                    marginTop: '15px',
                    border: '2px solid #000',
                    display: 'inline-block',
                    padding: '5px 20px',
                    borderRadius: '4px'
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Fee Receipt</h2>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '14px' }}>
                <div>
                    <p style={{ margin: '5px 0' }}><strong>Receipt No:</strong> {transaction.receiptNumber}</p>
                    <p style={{ margin: '5px 0' }}><strong>Date:</strong> {new Date(transaction.createdAt).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '5px 0' }}><strong>Academic Year:</strong> {student.current_year}</p>
                    {transaction.semester && <p style={{ margin: '5px 0' }}><strong>Semester:</strong> {transaction.semester}</p>}
                </div>
            </div>

            <div style={{
                marginBottom: '30px',
                padding: '15px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #ddd',
                borderRadius: '4px'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                    <p style={{ margin: 0 }}><strong>Name:</strong> {student.student_name}</p>
                    <p style={{ margin: 0 }}><strong>Admission No:</strong> {student.admission_number}</p>
                    <p style={{ margin: 0 }}><strong>Course:</strong> {student.course}</p>
                    <p style={{ margin: 0 }}><strong>Branch:</strong> {student.branch}</p>
                    <p style={{ margin: 0, gridColumn: '1 / -1' }}><strong>Father Name:</strong> {student.father_name || '-'}</p>
                </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f0f0f0' }}>
                            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', width: '50px' }}>S.No</th>
                            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left' }}>Particulars</th>
                            <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>1</td>
                            <td style={{ border: '1px solid #000', padding: '10px' }}>
                                <div style={{ fontWeight: 'bold' }}>{transaction.feeHead?.name}</div>
                                <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#666' }}>{transaction.remarks}</div>
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{transaction.amount}</td>
                        </tr>
                        <tr>
                            <td colSpan="2" style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Received</td>
                            <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>₹{transaction.amount}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', padding: '5px 30px 0', fontSize: '12px', margin: 0 }}>Accountant</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '30px', margin: '0 0 30px' }}>{transaction.collectedByName || 'Authorized Signature'}</p>
                    <p style={{ borderTop: '1px solid #000', padding: '5px 30px 0', fontSize: '12px', margin: 0 }}>Receiver Signature</p>
                </div>
            </div>

            <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#888' }}>
                <p>This is a computer generated receipt.</p>
            </div>
        </div>
    );
});

export default ReceiptTemplate;
