import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ transaction, transactions, student, totalDue, settings }, ref) => { // Accept settings
    // Determine the list of items to show
    let items = [];
    if (transactions && transactions.length > 0) {
        items = transactions;
    } else if (transaction) {
        items = [transaction];
    } else {
        return null;
    }

    const primary = items[0]; // Shared details
    const totalAmount = items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Apply settings
    const showHeader = settings?.showCollegeHeader !== false; // Default true
    const maskedFeeHeads = settings?.maskedFeeHeads || [];
    const maskName = settings?.maskName || 'Processing Fee';

    // Helper component for a single receipt copy
    const ReceiptOneCopy = ({ copyTitle }) => (
        <div style={{
            padding: '20px 40px',
            height: '48%', // Roughly half page
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            {showHeader ? (
                <div style={{ textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '15px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#000' }}>
                        {student.college || 'PYDAH GROUP OF COLLEGES'}
                    </h1>
                    <p style={{ fontSize: '12px', color: '#555', margin: '2px 0' }}>Kakinada, Andhra Pradesh</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                        <div style={{ fontSize: '11px', fontStyle: 'italic' }}>{copyTitle}</div>
                        <div style={{ border: '1px solid #000', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            Fee Receipt
                        </div>
                        <div style={{ fontSize: '11px', width: '60px' }}></div> {/* Spacer for center alignment */}
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '11px', fontStyle: 'italic' }}>{copyTitle}</div>
                        <h1 style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Fee Receipt</h1>
                        <div style={{ fontSize: '11px' }}>Date: {new Date().toLocaleDateString()}</div>
                    </div>
                </div>
            )}

            {/* Meta Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px' }}>
                <div>
                    <p style={{ margin: '2px 0' }}><strong>Receipt No:</strong> {primary.receiptNumber}</p>
                    <p style={{ margin: '2px 0' }}><strong>Date:</strong> {new Date(primary.createdAt).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '2px 0' }}><strong>Current Year:</strong> {student.current_year}</p>
                    <p style={{ margin: '2px 0' }}><strong>Sem:</strong> {primary.semester || student.current_year}</p>
                </div>
            </div>

            {/* Student Details - Compact grid */}
            <div style={{
                marginBottom: '10px', padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #eee', borderRadius: '4px'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '12px' }}>
                    <div><strong>Name:</strong> {student.student_name}</div>
                    <div><strong>Adm No:</strong> {student.admission_number}</div>
                    <div><strong>Pin No:</strong> {student.pin_no || '-'}</div>
                    <div><strong>Course:</strong> {student.course}</div>
                    <div><strong>Branch:</strong> {student.branch}</div>
                </div>
            </div>

            {/* Table */}
            <div style={{ flexGrow: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f0f0f0' }}>
                            <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '40px' }}>S.No</th>
                            <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>Particulars</th>
                            <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            // Check if this fee head is masked
                            // item.feeHead might be populated object OR just ID. Handle both.
                            const feeHeadId = item.feeHead?._id || item.feeHead;
                            const isMasked = maskedFeeHeads.includes(feeHeadId);
                            const displayName = isMasked ? maskName : (item.feeHead?.name || 'Fee');

                            return (
                                <tr key={index}>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{index + 1}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px' }}>
                                        <div>{displayName}</div>
                                        {item.remarks && <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#666' }}>{item.remarks}</div>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{item.amount}</td>
                                </tr>
                            );
                        })}
                        {/* Fill empty rows to maintain height if needed, OR just let it flex */}

                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                            <td colSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                            <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>₹{totalAmount}</td>
                        </tr>
                        {/* Display Pending Due if available */}
                        {(totalDue !== undefined && totalDue !== null) && (
                            <tr>
                                <td colSpan="3" style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', color: '#dc2626', fontSize: '11px', fontStyle: 'italic' }}>
                                    Total Pending Due: <span style={{ fontWeight: 'bold' }}>₹{Number(totalDue).toLocaleString()}</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    <strong>Mode:</strong> {items[0].paymentMode}
                    {items[0].paymentMode !== 'Cash' && ` (${items[0].bankName || ''} - ${items[0].referenceNo || ''})`}
                </div>
            </div>

            {/* Footer / Sign */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0' }}>{primary.collectedByName || 'Admin'}</p>
                    <p style={{ borderTop: '1px solid #000', paddingTop: '2px', fontSize: '11px', margin: 0, width: '120px' }}>Cashier Sign</p>
                </div>
            </div>
        </div>
    );

    return (
        <div ref={ref} style={{
            width: '100%',
            height: '100%', // Print full page
            backgroundColor: 'white',
            fontFamily: 'Arial, sans-serif',
            color: 'black',
            margin: '0 auto',
            boxSizing: 'border-box'
        }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 0; }
                    body { -webkit-print-color-adjust: exact; margin: 0; height: 100vh; }
                `}
            </style>

            {/* Copy 1: Student Copy */}
            <div style={{ height: '50vh', position: 'relative' }}>
                <ReceiptOneCopy copyTitle="STUDENT COPY" />

                {/* Dotted Separator Line */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '20px',
                    right: '20px',
                    borderBottom: '2px dashed #ccc'
                }}></div>
            </div>

            {/* Copy 2: Office Copy */}
            <div style={{ height: '50vh', paddingTop: '10px' }}>
                <ReceiptOneCopy copyTitle="OFFICE COPY" />
            </div>
        </div>
    );
});

export default ReceiptTemplate;
