import React, { forwardRef } from 'react';

const ProceedingsPrint = forwardRef(({ data = [], filters = {}, includeAbstract = true, includeDetailed = false }, ref) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalUsed = data.reduce((sum, item) => sum + (item.totalUsed || 0), 0);
    const totalRemaining = totalAmount - totalUsed;

    return (
        <div ref={ref} className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4 portrait; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 8px; border: 2px solid #000; }
                    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 6px; }
                    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
                    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .compact-row { line-height: 1.2; }
                    .page-break { page-break-before: always; }
                    .info-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px; border: 1.5px solid #000; }
                    .info-table td { border: 1px solid #000; padding: 6px 8px; line-height: 1.4; vertical-align: top; width: 33.33%; }
                    .detail-title { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-top: 25px; margin-bottom: 8px; text-transform: uppercase; }
                `}
            </style>

            {/* Header */}
            <div className="print-header">
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                <p style={{ margin: '4px 0', fontSize: '11px', fontWeight: 'bold' }}>
                    PROCEEDINGS REGISTER REPORT {includeAbstract && includeDetailed ? '(ABSTRACT & DETAILED)' : includeAbstract ? '(ABSTRACT)' : '(DETAILED)'}
                </p>
            </div>

            {/* Info Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '11px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>College:</strong> <span style={{ textTransform: 'uppercase' }}>{filters.collegeFilter || 'ALL'}</span>
                    <strong style={{ marginLeft: '15px' }}>Course:</strong> <span style={{ textTransform: 'uppercase' }}>{filters.courseFilter || 'ALL'}</span>
                </div>
                <div>
                    <strong>Status:</strong> <span style={{ textTransform: 'uppercase' }}>{filters.statusFilter || 'ALL'}</span>
                    {filters.searchTerm && (
                        <>
                            <strong style={{ marginLeft: '15px' }}>Search:</strong> <span>"{filters.searchTerm}"</span>
                        </>
                    )}
                </div>
                <div style={{ color: '#4b5563' }}>
                    <strong>Generated On:</strong> {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                </div>
            </div>

            {/* ABSTRACT SECTION */}
            {includeAbstract && (
                <div style={{ marginBottom: '20px' }}>
                    <h2 className="detail-title" style={{ marginTop: 0 }}>Proceedings Summary</h2>
                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', width: '5%' }}>S.No</th>
                                <th style={{ width: '25%' }}>College / Course / Caste</th>
                                <th style={{ width: '18%' }}>Academic Year</th>
                                <th style={{ width: '12%' }}>Proceeding No</th>
                                <th style={{ width: '12%' }}>Proceeding Date</th>
                                <th style={{ textAlign: 'right', width: '9%' }}>Total (₹)</th>
                                <th style={{ textAlign: 'right', width: '9%' }}>Used (₹)</th>
                                <th style={{ textAlign: 'right', width: '10%' }}>Remaining (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((proc, sIdx) => {
                                const rem = Math.max(0, (proc.amount || 0) - (proc.totalUsed || 0));
                                return (
                                    <tr key={proc._id} className="compact-row">
                                        <td style={{ textAlign: 'center' }}>{sIdx + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 'bold' }}>{proc.college}</div>
                                            <div style={{ fontSize: '8px', color: '#4b5563', textTransform: 'uppercase' }}>
                                                {proc.course} {proc.batch ? `(${proc.batch})` : ''} - {proc.caste || 'ALL'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{proc.academicYear || '-'}</td>
                                        <td style={{ fontWeight: 'bold' }}>{proc.proceedingNumber}</td>
                                        <td>
                                            {new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            ₹{proc.amount?.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#4b5563' }}>
                                            ₹{proc.totalUsed?.toLocaleString('en-IN') || 0}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>
                                            ₹{rem.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                                <td colSpan="5" style={{ textAlign: 'right', fontWeight: 'bold' }}>Grand Total:</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{totalAmount.toLocaleString('en-IN')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{totalUsed.toLocaleString('en-IN')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>₹{totalRemaining.toLocaleString('en-IN')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* DETAILED SECTION */}
            {includeDetailed && data.map((proc, pIdx) => {
                const rem = Math.max(0, (proc.amount || 0) - (proc.totalUsed || 0));
                const studentsList = proc.students || [];

                // Page break before detailed proceeding if we had abstract before, or if this is not the first detailed proceeding
                const needsPageBreak = includeAbstract || pIdx > 0;

                return (
                    <div key={`det-${proc._id}`} className={needsPageBreak ? 'page-break' : ''}>
                        {/* Heading */}
                        <h2 className="detail-title" style={!needsPageBreak ? { marginTop: 0 } : {}}>
                            Proceeding #{proc.proceedingNumber} - Utilization Details
                        </h2>

                        {/* Info Block as Table */}
                        <table className="info-table">
                            <tbody>
                                <tr>
                                    <td><strong>Proceeding No:</strong> {proc.proceedingNumber}</td>
                                    <td><strong>Proceeding Date:</strong> {new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td style={{ textTransform: 'uppercase' }}><strong>College:</strong> {proc.college}</td>
                                </tr>
                                <tr>
                                    <td style={{ textTransform: 'uppercase' }}><strong>Course:</strong> {proc.course} {proc.batch ? `(${proc.batch})` : ''}</td>
                                    <td><strong>Caste Category:</strong> {proc.caste || 'ALL'}</td>
                                    <td><strong>Bank Account:</strong> {proc.bankAccount || '-'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Credited Date:</strong> {proc.bankCreditedDate ? new Date(proc.bankCreditedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'PENDING'}</td>
                                    <td><strong>Proceeding Limit:</strong> ₹{proc.amount?.toLocaleString('en-IN')}</td>
                                    <td><strong>Utilized Amount:</strong> ₹{proc.totalUsed?.toLocaleString('en-IN') || 0}</td>
                                </tr>
                                <tr>
                                    <td colSpan="3" style={{ fontSize: '11px' }}>
                                        <strong>Remaining Balance:</strong> <span style={{ color: '#047857', fontWeight: 'bold' }}>₹{rem.toLocaleString('en-IN')}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Covered Students List */}
                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>Covered Students ({studentsList.length})</div>
                        <table className="print-table" style={{ fontSize: '9px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center', width: '6%' }}>S.No</th>
                                    <th style={{ width: '18%' }}>Admission Number</th>
                                    <th style={{ width: '18%' }}>PIN Number</th>
                                    <th style={{ width: '38%' }}>Student Name</th>
                                    <th style={{ width: '10%' }}>Date Linked</th>
                                    <th style={{ textAlign: 'right', width: '10%' }}>Amount Utilized (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsList.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                            No student transactions linked to this proceeding yet.
                                        </td>
                                    </tr>
                                ) : (
                                    studentsList.map((txn, sIdx) => (
                                        <tr key={txn._id || sIdx} className="compact-row">
                                            <td style={{ textAlign: 'center' }}>{sIdx + 1}</td>
                                            <td style={{ fontWeight: 'bold' }}>{txn.studentId}</td>
                                            <td style={{ fontWeight: 'bold' }}>{txn.pinNo || '-'}</td>
                                            <td>{txn.studentName}</td>
                                            <td>
                                                {new Date(txn.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                ₹{txn.amount?.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {studentsList.length > 0 && (
                                <tfoot>
                                    <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                                        <td colSpan="5" style={{ textAlign: 'right' }}>Total Utilized:</td>
                                        <td style={{ textAlign: 'right' }}>₹{proc.totalUsed?.toLocaleString('en-IN')}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                );
            })}

            {/* Footer Signatures */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', pageBreakInside: 'avoid' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Prepared By</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Accountant/AO</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ borderTop: '1px solid #000', width: '120px', paddingTop: '5px' }}>Principal/Director</p>
                </div>
            </div>
        </div>
    );
});

export default ProceedingsPrint;
