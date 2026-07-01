import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ transaction, transactions, relatedTransactions, student, totalDue, settings }, ref) => { // Accept settings
    // Determine the list of items to show
    let items = [];
    const list = relatedTransactions || transactions;
    if (list && list.length > 0) {
        items = list;
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

    // Configuration defaults if undefined
    const copies = settings?.copiesPerPage || 2;
    // Helper component for a single receipt copy
    const ReceiptOneCopy = ({ copyTitle }) => (
        <div style={{
            padding: '3mm 6mm', // Compressed vertical and horizontal padding
            height: '100%', // Take full height of the parent copy container
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#000' // Sharp black text for printing
        }}>
            {/* Header Section */}
            {showHeader ? (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <h1 style={{ 
                        fontFamily: "'Georgia', serif", 
                        fontSize: '16px', 
                        fontWeight: '700', 
                        letterSpacing: '0.3px', 
                        margin: 0, 
                        color: '#000' // Pure Black
                    }}>
                        {student.college || 'PYDAH GROUP OF COLLEGES'}
                    </h1>
                    <p style={{ fontSize: '9px', color: '#000', margin: '2px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Kakinada, Andhra Pradesh
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderBottom: '2px double #000', paddingBottom: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            {copyTitle}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            Official Fee Receipt
                        </span>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom: '10px', borderBottom: '2px double #000', paddingBottom: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#000', textTransform: 'uppercase' }}>{copyTitle}</span>
                        <h1 style={{ fontFamily: "'Georgia', serif", fontSize: '14px', fontWeight: '700', color: '#000', margin: 0, textTransform: 'uppercase' }}>Fee Receipt</h1>
                        <span style={{ fontSize: '10px', color: '#000', fontWeight: '600' }}>Date: {new Date().toLocaleDateString()}</span>
                    </div>
                </div>
            )}

            {/* Information Grid Container */}
            <div style={{ 
                border: '2px solid #000', // Thick black border
                borderRadius: '4px', 
                marginBottom: '8px',
                fontSize: '10.5px',
                color: '#000',
                backgroundColor: '#ffffff'
            }}>
                {/* Receipt Details Row */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '5px 8px', 
                    borderBottom: '2px solid #000', // Thick bottom border
                    backgroundColor: '#f3f4f6' // Light grey contrast highlight
                }}>
                    <div><span style={{ fontWeight: '500' }}>Receipt No:</span> <strong>{primary.receiptNumber}</strong></div>
                    <div><span style={{ fontWeight: '500' }}>Date:</span> <strong>{new Date(primary.createdAt).toLocaleDateString()}</strong></div>
                </div>

                {/* Student Details Row */}
                <div style={{ 
                    padding: '6px 8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px 12px'
                }}>
                    <div><span style={{ fontWeight: '500' }}>Student Name:</span> <strong>{student.student_name}</strong></div>
                    <div><span style={{ fontWeight: '500' }}>Admission No:</span> <strong>{student.admission_number}</strong></div>
                    <div><span style={{ fontWeight: '500' }}>PIN / Roll No:</span> <strong>{student.pin_no || '-'}</strong></div>
                    <div><span style={{ fontWeight: '500' }}>Course / Branch:</span> <strong>{student.course} - {student.branch}</strong></div>
                </div>
            </div>

            {/* Fees Table */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', color: '#000', border: '2px solid #000' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6', color: '#000' }}>
                            <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: '700', width: '45px', borderRight: '1.5px solid #000', borderBottom: '2px solid #000' }}>S.No</th>
                            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '700', borderRight: '1.5px solid #000', borderBottom: '2px solid #000' }}>Particulars / Fee Description</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', width: '110px', borderBottom: '2px solid #000' }}>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const feeHeadId = item.feeHead?._id || item.feeHead;
                            const isMasked = maskedFeeHeads.includes(feeHeadId);
                            const displayName = isMasked ? maskName : (item.feeHead?.name || 'Fee');

                            return (
                                <tr key={index} style={{ borderBottom: '1.5px solid #000' }}>
                                    <td style={{ padding: '5px 8px', textAlign: 'center', borderRight: '1.5px solid #000' }}>{index + 1}</td>
                                    <td style={{ padding: '5px 8px', borderRight: '1.5px solid #000' }}>
                                        <div style={{ fontWeight: '600' }}>{displayName}</div>
                                        {item.remarks && <div style={{ fontSize: '8.5px', fontStyle: 'italic', color: '#333', marginTop: '1px' }}>{item.remarks}</div>}
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600' }}>{item.amount.toLocaleString()}</td>
                                </tr>
                            );
                        })}

                        {/* TOTAL Row */}
                        <tr style={{ backgroundColor: '#f3f4f6', fontWeight: '700', borderTop: '2px solid #000' }}>
                            <td colSpan="2" style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1.5px solid #000' }}>TOTAL AMOUNT PAID</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11.5px' }}>₹{totalAmount.toLocaleString()}</td>
                        </tr>

                        {/* Outstanding dues row (Optional) */}
                        {(totalDue !== undefined && totalDue !== null) && (
                            <tr style={{ backgroundColor: '#ffffff', borderTop: '1.5px solid #000' }}>
                                <td colSpan="3" style={{ padding: '4px 8px', textAlign: 'right', color: '#000', fontSize: '9.5px', fontWeight: '700', fontStyle: 'italic' }}>
                                    Total Outstanding Due: ₹{Number(totalDue).toLocaleString()}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Mode of Payment & Remarks Info */}
                <div style={{ fontSize: '9.5px', marginTop: '4px', color: '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {(() => {
                            const modes = [...new Set(items.map(i => i.paymentMode))];
                            const totalCash = items.filter(i => i.paymentMode === 'Cash').reduce((sum, i) => sum + i.amount, 0);
                            const totalBank = items.filter(i => i.paymentMode !== 'Cash').reduce((sum, i) => sum + i.amount, 0);
                            const bankTxn = items.find(i => i.paymentMode !== 'Cash');

                            if (modes.length > 1) {
                                return (
                                    <>
                                        <strong>Payment Mode:</strong> Split (Cash: ₹{totalCash.toLocaleString()} / Bank: ₹{totalBank.toLocaleString()})
                                        {bankTxn && (
                                            <span style={{ marginLeft: '4px', fontStyle: 'italic' }}>
                                                ({bankTxn.paymentMode}: {bankTxn.bankName || ''} - {bankTxn.referenceNo || ''})
                                            </span>
                                        )}
                                    </>
                                );
                            } else {
                                return (
                                    <>
                                        <strong>Payment Mode:</strong> {items[0].paymentMode}
                                        {items[0].paymentMode !== 'Cash' && (
                                            ` (${items[0].bankName || ''} - ${items[0].referenceNo || ''}${items[0].referenceDate ? ` on ${new Date(items[0].referenceDate).toLocaleDateString()}` : ''})`
                                        )}
                                    </>
                                );
                            }
                        })()}
                    </div>
                    <div style={{ fontSize: '9px', color: '#000', fontWeight: '500' }}>
                        Generated on: {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Footer Signatures */}
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '8.5px', color: '#000', fontWeight: '600' }}>
                        Note: Please preserve this receipt for future reference.
                    </div>
                    <div style={{ fontSize: '8px', color: '#000', fontStyle: 'italic', letterSpacing: '0.2px' }}>
                        Software designed & developed by PydahSoft
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '10.5px', fontWeight: '700', color: '#000', margin: '0 0 2px 0' }}>{primary.collectedByName || 'Admin'}</p>
                    <p style={{ borderTop: '1.5px solid #000', paddingTop: '2px', fontSize: '9px', color: '#000', fontWeight: '600', margin: 0, width: '120px' }}>Authorized Signatory</p>
                </div>
            </div>
        </div>
    );

    // Configuration defaults if undefined
    const paperSizeStr = settings?.paperSize || 'A4';

    // Determine layout variables
    // For A5, we use 'auto' to enable the browser's native print dialog options (Layout & Paper Size),
    // allowing the operator to adjust orientation to match physical paper feeding (e.g. horizontal feed).
    const pageCssSize = paperSizeStr === 'A5' ? 'auto' : 'A4';

    // For container heights in percentages to prevent page-overflow in print media
    const copyHeight = copies === 1 ? '100%' : '49%';

    return (
        <div ref={ref} style={{
            width: '100%',
            height: '100%', // Print full page
            backgroundColor: 'white',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#000', // Set default color to black for B&W printing
            margin: '0 auto',
            boxSizing: 'border-box'
        }}>
            <style type="text/css" media="print">
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    @page { size: ${pageCssSize}; margin: 5mm; }
                    html, body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
                `}
            </style>

            {/* Copy 1: Student Copy */}
            <div style={{ height: copyHeight, position: 'relative', boxSizing: 'border-box' }}>
                <ReceiptOneCopy copyTitle="STUDENT COPY" />

                {/* Dotted Separator Line (Only show if we have a second copy below) */}
                {copies === 2 && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '20px',
                        right: '20px',
                        borderBottom: '1.5px dashed #000' // Bold dashed separation line
                    }}></div>
                )}
            </div>

            {/* Copy 2: Office Copy (Only if requested) */}
            {copies === 2 && (
                <div style={{ height: copyHeight, paddingTop: '15px', boxSizing: 'border-box' }}>
                    <ReceiptOneCopy copyTitle="OFFICE COPY" />
                </div>
            )}
        </div>
    );
});

export default ReceiptTemplate;
