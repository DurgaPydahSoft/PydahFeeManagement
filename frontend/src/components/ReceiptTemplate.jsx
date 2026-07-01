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

    // Dynamic cell padding to ensure responsiveness to table length
    const cellPadding = items.length > 4 ? '3px 8px' : (items.length > 2 ? '4px 8px' : '5px 8px');
    const headerPadding = items.length > 4 ? '4px 8px' : '6px 8px';

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
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start', // Remove vertical gap distribution, elements stack continuously
            boxSizing: 'border-box',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#000' // Sharp black text for printing
        }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '3px solid #000', width: '100%', boxSizing: 'border-box' }}>
                {showHeader ? (
                    <>
                        {/* Left: Logo */}
                        <div style={{ width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 }}>
                            <img src="/PYDAH_LOGO_PHOTO.jpg" alt="Logo" style={{ height: '46px', width: 'auto', objectFit: 'contain' }} />
                        </div>
                        
                        {/* Center: College Name */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 8px' }}>
                            <h1 style={{ 
                                fontFamily: "'Outfit', sans-serif", 
                                fontSize: '14.5px', 
                                fontWeight: '800', 
                                margin: 0, 
                                color: '#000',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2px',
                                lineHeight: '1.2'
                            }}>
                                {student.college || 'PYDAH COLLEGE OF ENGINEERING'}
                            </h1>
                            <p style={{ fontSize: '8.5px', color: '#000', margin: '1px 0 0 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Kakinada, Andhra Pradesh
                            </p>
                        </div>
                        
                        {/* Right: Fee Receipt label */}
                        <div style={{ width: '90px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
                            <h2 style={{ fontSize: '13.5px', fontWeight: '800', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                                Fee Receipt
                            </h2>
                            <p style={{ fontSize: '8.5px', color: '#000', fontWeight: '700', margin: '1px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {copyTitle}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ width: '80px', flexShrink: 0 }}>
                            <span style={{ fontSize: '9px', fontWeight: '700', color: '#000', textTransform: 'uppercase' }}>{copyTitle}</span>
                        </div>
                        <div style={{ flex: 1 }}></div>
                        <div style={{ width: '90px', textAlign: 'right', flexShrink: 0 }}>
                            <h2 style={{ fontSize: '13.5px', fontWeight: '800', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                                Fee Receipt
                            </h2>
                            <p style={{ fontSize: '8.5px', color: '#000', fontWeight: '700', margin: '1px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {copyTitle}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Information Box (Ledger Style) */}
            <div style={{ 
                border: '2px solid #000', 
                borderRadius: '8px', 
                margin: '8px 0',
                fontSize: '9.5px',
                color: '#000',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 12px',
                boxSizing: 'border-box'
            }}>
                {/* Col 1 */}
                <div style={{ flex: '1 1 28%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>Receipt No.</div>
                            <strong style={{ fontSize: '10px' }}>{primary.receiptNumber}</strong>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>Date</div>
                            <strong style={{ fontSize: '10px' }}>{new Date(primary.createdAt).toLocaleDateString('en-IN')}</strong>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ borderLeft: '1.5px dashed #bbb', margin: '0 8px' }}></div>

                {/* Col 2 */}
                <div style={{ flex: '1 1 38%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>Student Name</div>
                            <strong style={{ fontSize: '10px', textTransform: 'uppercase' }}>{student.student_name}</strong>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.378 0 2.5.895 2.5 2v1.5H7.5V16c0-1.105 1.122-2 2.5-2z" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>PIN / Roll No.</div>
                            <strong style={{ fontSize: '10px' }}>{student.pin_no || '-'}</strong>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ borderLeft: '1.5px dashed #bbb', margin: '0 8px' }}></div>

                {/* Col 3 */}
                <div style={{ flex: '1 1 34%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>Admission No.</div>
                            <strong style={{ fontSize: '10px' }}>{student.admission_number}</strong>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '19px', height: '19px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                        </svg>
                        <div>
                            <div style={{ fontSize: '7.5px', color: '#555', fontWeight: '600' }}>Course / Branch</div>
                            <strong style={{ fontSize: '10px' }}>{student.course} - {student.branch}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fees Table */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <div style={{ border: '2px solid #000', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', color: '#000000' }}>
                                <th style={{ padding: headerPadding, textAlign: 'center', fontWeight: '700', width: '45px', borderRight: '1.5px solid #000', borderBottom: '2px solid #000' }}>S.No</th>
                                <th style={{ padding: headerPadding, textAlign: 'left', fontWeight: '700', borderRight: '1.5px solid #000', borderBottom: '2px solid #000' }}>Particulars / Fee Description</th>
                                <th style={{ padding: headerPadding, textAlign: 'right', fontWeight: '700', width: '110px', borderBottom: '2px solid #000' }}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const feeHeadId = item.feeHead?._id || item.feeHead;
                                const isMasked = maskedFeeHeads.includes(feeHeadId);
                                const displayName = isMasked ? maskName : (item.feeHead?.name || 'Fee');

                                return (
                                    <tr key={index} style={{ borderBottom: '1.5px solid #000' }}>
                                        <td style={{ padding: cellPadding, textAlign: 'center', borderRight: '1.5px solid #000', fontWeight: '500' }}>{index + 1}</td>
                                        <td style={{ padding: cellPadding, borderRight: '1.5px solid #000' }}>
                                            <div style={{ fontWeight: '700' }}>{displayName}</div>
                                            {item.remarks && <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#333', marginTop: '1px' }}>{item.remarks}</div>}
                                        </td>
                                        <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: '700', fontSize: '10.5px' }}>{item.amount.toLocaleString('en-IN')}</td>
                                    </tr>
                                );
                            })}

                            {/* TOTAL Row */}
                            <tr style={{ backgroundColor: '#ffffff', fontWeight: '800', borderTop: '2px solid #000' }}>
                                <td colSpan="2" style={{ padding: cellPadding, textAlign: 'right', borderRight: '1.5px solid #000', fontSize: '10.5px', letterSpacing: '0.2px' }}>TOTAL AMOUNT PAID</td>
                                <td style={{ padding: cellPadding, textAlign: 'right', fontSize: '12px', fontWeight: '900' }}>₹{totalAmount.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Outstanding Dues */}
                {(totalDue !== undefined && totalDue !== null) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', fontSize: '9px', marginTop: '4px', color: '#000', fontWeight: '700' }}>
                        <span style={{ fontStyle: 'italic' }}>Total Outstanding Due</span>
                        <span>₹{Number(totalDue).toLocaleString('en-IN')}</span>
                    </div>
                )}
            </div>

            {/* Footer Elements (Verification, Signature & Info) */}
            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', width: '100%' }}>
                {/* Left side: QR Code Verification Box */}
                <div style={{ border: '1.5px solid #000', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/public/verify-receipt/${primary.receiptNumber}`)}`} alt="QR" style={{ width: '48px', height: '48px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '7.5px', fontWeight: '800', color: '#000' }}>SCAN TO VERIFY</div>
                        <div style={{ fontSize: '7px', color: '#555', marginTop: '1px' }}>Receipt No.</div>
                        <strong style={{ fontSize: '8px', color: '#000' }}>{primary.receiptNumber}</strong>
                    </div>
                </div>

                {/* Dotted Divider */}
                <div style={{ borderLeft: '1.5px dotted #000', height: '36px', margin: '0 4px', flexShrink: 0 }}></div>

                {/* Payment Mode */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: '1 1 0%' }}>
                    <div style={{ border: '1.5px solid #000', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800' }}>₹</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '7px', color: '#555', fontWeight: '500', lineHeight: '1.1' }}>Payment Mode</div>
                        <strong style={{ fontSize: '8.5px', color: '#000', marginTop: '1px' }}>{items[0].paymentMode}</strong>
                    </div>
                </div>

                {/* Dotted Divider */}
                <div style={{ borderLeft: '1.5px dotted #000', height: '36px', margin: '0 4px', flexShrink: 0 }}></div>

                {/* Generated On */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: '1.3 1 0%' }}>
                    <svg style={{ width: '24px', height: '24px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '7px', color: '#555', fontWeight: '500', lineHeight: '1.1' }}>Generated On</div>
                        <strong style={{ fontSize: '8.5px', color: '#000', marginTop: '1px', whiteSpace: 'nowrap' }}>
                            {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                    </div>
                </div>

                {/* Dotted Divider */}
                <div style={{ borderLeft: '1.5px dotted #000', height: '36px', margin: '0 4px', flexShrink: 0 }}></div>

                {/* Verified */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flex: '1 1 0%' }}>
                    <svg style={{ width: '24px', height: '24px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '7px', color: '#555', fontWeight: '500', lineHeight: '1.1' }}>Verified</div>
                        <strong style={{ fontSize: '8.5px', color: '#000', marginTop: '1px' }}>Auto Verified</strong>
                    </div>
                </div>

                {/* Solid Separator */}
                <div style={{ borderLeft: '2px solid #000', height: '50px', margin: '0 10px', flexShrink: 0 }}></div>

                {/* Right side: Authorized Signatory */}
                <div style={{ textAlign: 'center', width: '150px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Space for signature */}
                    </div>
                    <div style={{ width: '100%', borderTop: '1.5px solid #000', marginTop: '4px', paddingTop: '2px' }}>
                        <p style={{ fontSize: '9.5px', fontWeight: '800', color: '#000', margin: '0 0 1px 0', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {primary.collectedByName || 'PADALA AJAYAKUMAR'}
                        </p>
                        <p style={{ fontSize: '7.5px', color: '#555', fontWeight: '600', margin: 0 }}>
                            Authorized Signatory
                        </p>
                    </div>
                </div>
            </div>

            {/* Note & Branding Line */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5px', color: '#000', marginTop: '10px', marginBottom: '2px' }}>
                <span style={{ fontStyle: 'italic', fontWeight: '500' }}>Note: Please preserve this receipt for future reference.</span>
            </div>

            {/* Contact Details Bottom Bar */}
            <div style={{ borderTop: '1.5px solid #000', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5px', color: '#000', fontWeight: '600', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <svg style={{ width: '13px', height: '13px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Kakinada, Andhra Pradesh - 533003</span>
                </div>
                <div style={{ fontWeight: '700', textTransform: 'uppercase', color: '#000', fontSize: '7.5px', letterSpacing: '0.3px' }}>
                    Powered by PydahSoft
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <svg style={{ width: '13px', height: '13px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span>www.pydah.edu.in</span>
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
            <style type="text/css">
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800&family=Inter:wght@400;500;600;700;800&display=swap');
                `}
            </style>
            <style type="text/css" media="print">
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800&family=Inter:wght@400;500;600;700;800&display=swap');
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
                        borderBottom: '2px dashed #000' // Bold dashed separation line
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
