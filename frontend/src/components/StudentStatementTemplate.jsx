import React, { forwardRef } from 'react';

const StudentStatementTemplate = forwardRef(({ student, feeDetails, transactions }, ref) => {
    if (!student) return null;

    // Filter active and inactive fees
    const feeDetailsList = feeDetails || [];
    
    // Group by Year
    const yearWiseFees = {};
    for (let i = 1; i <= (student.current_year || 1); i++) {
        yearWiseFees[i] = [];
    }

    feeDetailsList.forEach(fee => {
        const y = fee.studentYear;
        if (!yearWiseFees[y]) {
            yearWiseFees[y] = [];
        }
        yearWiseFees[y].push(fee);
    });

    // Format utility
    const fmtAmount = (value) => Number(value ?? 0).toLocaleString('en-IN');

    // Totals calculation
    let grandDemand = 0;
    let grandPaid = 0;
    let grandConcession = 0;
    let grandDue = 0;

    feeDetailsList.forEach(f => {
        if (f.isActive === false) return;
        grandDemand += Number(f.totalAmount || 0);
        grandPaid += Number(f.paidAmount || 0);
        grandConcession += Number(f.concessionAmount || 0);
        grandDue += Number(f.dueAmount || 0);
    });

    return (
        <div ref={ref} className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 2px solid #000; }
                    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
                    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
                    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .compact-row { line-height: 1.2; }
                `}
            </style>

            {/* Header */}
            <div className="print-header">
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                <p style={{ margin: '4px 0', fontSize: '11px', fontWeight: 'bold' }}>STUDENT FEE STATEMENT & LEDGER</p>
            </div>

            {/* Student Details Grid */}
            <div style={{ display: 'flex', gap: '20px', border: '1.5px solid #000', padding: '14px', marginBottom: '20px', borderRadius: '4px', alignItems: 'center', minHeight: '120px' }}>
                {/* Left: Photo Container */}
                <div style={{ flexShrink: 0, width: '90px', height: '110px', border: '1.5px solid #000', borderRadius: '3px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                    {student.student_photo ? (
                        <img 
                            src={student.student_photo.startsWith('data:') ? student.student_photo : `data:image/jpeg;base64,${student.student_photo}`}
                            alt="Student profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span style={{ fontSize: '7px', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>No Photo</span>
                        </div>
                    )}
                </div>

                {/* Right: Info Details Grid */}
                <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '11px' }}>
                    <div><strong>Student Name:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{student.student_name}</span></div>
                    <div><strong>Admission No (ID):</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.admission_number}</span></div>
                    
                    <div><strong>College Name:</strong> {student.college || 'N/A'}</div>
                    <div><strong>PIN Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.pin_no || '-'}</span></div>
                    
                    <div><strong>Course & Branch:</strong> {student.course} - {student.branch}</div>
                    <div><strong>Academic Year:</strong> Year {student.current_year} (Semester {student.current_semester})</div>
                    
                    <div><strong>Mobile Number:</strong> {student.student_mobile || '-'}</div>
                    <div><strong>Admission Quota:</strong> <span style={{ textTransform: 'uppercase' }}>{student.stud_type || 'Regular'}</span></div>

                    {student.caste && <div><strong>Category/Caste:</strong> <span style={{ textTransform: 'uppercase' }}>{student.caste}</span></div>}
                    {student.student_status && <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase' }}>{student.student_status}</span></div>}
                </div>
            </div>

            {/* Year-wise Fees Table */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    Year-Wise Structured Fees
                </h3>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Fee Head Name / Year</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Actual Demand</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Concessions</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Paid Amount</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(yearWiseFees).sort((a, b) => Number(a[0]) - Number(b[0])).map(([year, fees]) => {
                            // Year Totals
                            const yearDemand = fees.reduce((acc, f) => acc + (f.isActive !== false ? Number(f.totalAmount || 0) : 0), 0);
                            const yearConcession = fees.reduce((acc, f) => acc + (f.isActive !== false ? Number(f.concessionAmount || 0) : 0), 0);
                            const yearPaid = fees.reduce((acc, f) => acc + (f.isActive !== false ? Number(f.paidAmount || 0) : 0), 0);
                            const yearDue = fees.reduce((acc, f) => acc + (f.isActive !== false ? Number(f.dueAmount || 0) : 0), 0);

                            return (
                                <React.Fragment key={year}>
                                    {/* Year Header Row */}
                                    <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                                        <td style={{ fontSize: '10px', textTransform: 'uppercase' }}>YEAR {year} SUMMARY</td>
                                        <td style={{ textAlign: 'right' }}>₹{fmtAmount(yearDemand)}</td>
                                        <td style={{ textAlign: 'right', color: '#7c3aed' }}>₹{fmtAmount(yearConcession)}</td>
                                        <td style={{ textAlign: 'right' }}>₹{fmtAmount(yearPaid)}</td>
                                        <td style={{ textAlign: 'right', color: yearDue > 0 ? '#b91c1c' : '#047857' }}>₹{fmtAmount(yearDue)}</td>
                                    </tr>

                                    {/* Individual Fee Rows */}
                                    {fees.length === 0 ? (
                                        <tr className="compact-row">
                                            <td style={{ paddingLeft: '20px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                No fee structures assigned for this year
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#9ca3af' }}>₹0</td>
                                            <td style={{ textAlign: 'right', color: '#9ca3af' }}>₹0</td>
                                            <td style={{ textAlign: 'right', color: '#9ca3af' }}>₹0</td>
                                            <td style={{ textAlign: 'right', color: '#9ca3af' }}>₹0</td>
                                        </tr>
                                    ) : (
                                        fees.map((fee, idx) => (
                                            <tr key={idx} className="compact-row" style={{ opacity: fee.isActive === false ? 0.6 : 1 }}>
                                                <td style={{ paddingLeft: '20px' }}>
                                                    {fee.feeHeadName}
                                                    {fee.isScholarshipApplicable && ['eligible', 'yes', 'true'].includes(String(fee.studentScholarStatus || '').toLowerCase()) && (
                                                        <span style={{ fontSize: '7.5px', marginLeft: '6px', border: '1px solid #d1d5db', padding: '1px 3px', borderRadius: '2px', textTransform: 'uppercase', fontWeight: 'bold', backgroundColor: '#fffbeb' }}>Scholarship</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>₹{fmtAmount(fee.totalAmount)}</td>
                                                <td style={{ textAlign: 'right', color: fee.concessionAmount > 0 ? '#7c3aed' : 'inherit' }}>₹{fmtAmount(fee.concessionAmount)}</td>
                                                <td style={{ textAlign: 'right' }}>₹{fmtAmount(fee.paidAmount)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: fee.isActive !== false && fee.dueAmount > 0 ? 'bold' : 'normal' }}>
                                                    ₹{fmtAmount(fee.dueAmount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Grand Total Row */}
                        <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                            <td style={{ textTransform: 'uppercase', fontSize: '10px' }}>GRAND TOTAL (ACTIVE FEES)</td>
                            <td style={{ textAlign: 'right' }}>₹{fmtAmount(grandDemand)}</td>
                            <td style={{ textAlign: 'right', color: '#7c3aed' }}>₹{fmtAmount(grandConcession)}</td>
                            <td style={{ textAlign: 'right' }}>₹{fmtAmount(grandPaid)}</td>
                            <td style={{ textAlign: 'right', fontSize: '11px', color: grandDue > 0 ? '#b91c1c' : '#047857' }}>₹{fmtAmount(grandDue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Transaction History Section */}
            <div style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                    Payment & Collection History (Year-Wise)
                </h3>
                
                {Object.entries(yearWiseFees).sort((a, b) => Number(a[0]) - Number(b[0])).map(([year]) => {
                    const yearNumber = Number(year);
                    const yearTxs = (transactions || []).filter(tx => Number(tx.studentYear) === yearNumber);

                    return (
                        <div key={year} style={{ marginBottom: '15px', pageBreakInside: 'avoid' }}>
                            <div style={{ backgroundColor: '#f9fafb', padding: '4px 8px', fontSize: '9px', fontWeight: 'bold', borderLeft: '3px solid #6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Year {yearNumber} Transactions
                            </div>
                            {yearTxs.length === 0 ? (
                                <div style={{ fontSize: '9px', color: '#9ca3af', fontStyle: 'italic', paddingLeft: '8px' }}>
                                    No payments recorded for Year {yearNumber}
                                </div>
                            ) : (
                                <table className="print-table" style={{ fontSize: '8.5px' }}>
                                    <thead>
                                        <tr>
                                             <th style={{ width: '15%' }}>Date</th>
                                             <th style={{ width: '25%' }}>Receipt No</th>
                                             <th style={{ width: '25%' }}>Fee Head</th>
                                             <th style={{ width: '20%', textAlign: 'center' }}>Mode</th>
                                             <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yearTxs.map((tx, idx) => {
                                            const isCancelled = tx.status === 'cancelled';
                                            const isCredit = tx.transactionType === 'CREDIT';
                                            const displayHead = tx.feeHead?.name || tx.feeHead || 'Unknown Fee';
                                            const formattedDate = new Date(tx.paymentDate || tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

                                            return (
                                                <tr key={idx} className="compact-row" style={{ opacity: isCancelled ? 0.5 : 1 }}>
                                                    <td>{formattedDate}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>
                                                        <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>{tx.receiptNumber}</span>
                                                        {isCancelled && <span style={{ color: '#dc2626', fontSize: '7px', fontWeight: 'bold', marginLeft: '4px' }}>[VOID]</span>}
                                                    </td>
                                                    <td>
                                                        <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>{displayHead}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {tx.paymentMode}
                                                        {tx.referenceNo ? ` (${tx.referenceNo})` : ''}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: isCancelled ? 'inherit' : isCredit ? '#7c3aed' : '#047857' }}>
                                                        {isCredit ? '-' : ''}₹{fmtAmount(tx.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Generated Date Footer */}
            <div style={{ marginTop: '30px', fontSize: '9px', color: '#4b5563', textAlign: 'center', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
                Report Generated on: {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
            </div>
        </div>
    );
});

StudentStatementTemplate.displayName = 'StudentStatementTemplate';

export default StudentStatementTemplate;
