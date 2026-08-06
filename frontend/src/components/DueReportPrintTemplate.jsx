import React, { forwardRef } from 'react';

const DueReportPrintTemplate = forwardRef(({ type = 'overall', reportData = [], filters = {}, summary = {}, student = {}, includeDetails = false }, ref) => {
    // Helper to format currency
    const fmtAmount = (val) => Number(val || 0).toLocaleString('en-IN');

    // Extract unique fee heads for the legend index on top
    const feeHeadLegendMap = {};
    reportData.forEach(st => {
        if (st.feeDetailsArray) {
            st.feeDetailsArray.forEach(d => {
                let code = d.headCode || d.headName || 'FEE';
                if (code.length > 5) {
                    const upper = String(code).toUpperCase();
                    if (upper.includes('TUITION')) code = 'TUT';
                    else if (upper.includes('LAB')) code = 'LAB';
                    else if (upper.includes('SCHOLAR')) code = 'SCH';
                    else if (upper.includes('ADMISSION')) code = 'ADM';
                    else if (upper.includes('REGISTR')) code = 'REG';
                    else if (upper.includes('TRANSPORT') || upper.includes('BUS')) code = 'BUS';
                    else if (upper.includes('HOSTEL')) code = 'HST';
                    else if (upper.includes('EXAM')) code = 'EXM';
                    else if (upper.includes('SPECIAL')) code = 'SPL';
                    else if (upper.includes('CAUTION')) code = 'CTN';
                    else code = upper.slice(0, 4).trim();
                } else {
                    code = String(code).toUpperCase();
                }
                if (!feeHeadLegendMap[code]) {
                    feeHeadLegendMap[code] = d.headName || code;
                }
            });
        }
    });

    // Helper to format fee head details as clean micro-badges
    const renderStudentFeeDetailsBadges = (st) => {
        if (!st.feeDetailsArray || st.feeDetailsArray.length === 0) return <span style={{ color: '#94a3b8' }}>-</span>;

        // Filter only heads with positive outstanding due (> 0)
        const dueHeads = st.feeDetailsArray.filter(d => {
            const headDue = Number(d.due !== undefined ? d.due : ((d.total || 0) - (d.paid || 0)));
            return headDue > 0;
        });

        if (dueHeads.length === 0) return <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '8.5px' }}>CLEARED</span>;

        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 4px', alignItems: 'center' }}>
                {dueHeads.map((d, idx) => {
                    let code = d.headCode || d.headName || 'FEE';
                    if (code.length > 5) {
                        const upper = String(code).toUpperCase();
                        if (upper.includes('TUITION')) code = 'TUT';
                        else if (upper.includes('LAB')) code = 'LAB';
                        else if (upper.includes('SCHOLAR')) code = 'SCH';
                        else if (upper.includes('ADMISSION')) code = 'ADM';
                        else if (upper.includes('REGISTR')) code = 'REG';
                        else if (upper.includes('TRANSPORT') || upper.includes('BUS')) code = 'BUS';
                        else if (upper.includes('HOSTEL')) code = 'HST';
                        else if (upper.includes('EXAM')) code = 'EXM';
                        else if (upper.includes('SPECIAL')) code = 'SPL';
                        else if (upper.includes('CAUTION')) code = 'CTN';
                        else code = upper.slice(0, 4).trim();
                    } else {
                        code = String(code).toUpperCase();
                    }
                    const headDue = Number(d.due !== undefined ? d.due : ((d.total || 0) - (d.paid || 0)));

                    return (
                        <span
                            key={idx}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '3px',
                                padding: '1px 5px',
                                fontSize: '8px',
                                whiteSpace: 'nowrap',
                                lineHeight: '1.2'
                            }}
                        >
                            <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{code}:</span>
                            <span style={{ fontWeight: '700', color: '#dc2626' }}>₹{fmtAmount(headDue)}</span>
                        </span>
                    );
                })}
            </div>
        );
    };

    if (type === 'individual') {
        const studentInfo = student || {};
        const feeDetails = student.feeDetailsArray || [];
        const totalFee = feeDetails.reduce((sum, d) => sum + Number(d.total || 0), 0);
        const paidAmount = feeDetails.reduce((sum, d) => sum + Number(d.paid || 0), 0);
        const dueAmount = totalFee - paidAmount;

        return (
            <div ref={ref} style={{ padding: '24px', fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
                <style type="text/css" media="print">
                    {`
                        @page { size: A4 portrait; margin: 8mm; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #fff; }
                    `}
                </style>

                {/* Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                    <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>INDIVIDUAL DUE STATEMENT</p>
                </div>

                {/* Student Info Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', border: '1.5px solid #000', padding: '12px', marginBottom: '16px', borderRadius: '4px', fontSize: '11px' }}>
                    <div><strong>Student Name:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{studentInfo.student_name}</span></div>
                    <div><strong>Admission No:</strong> <span style={{ fontWeight: 'bold' }}>{studentInfo.admission_number}</span></div>
                    <div><strong>PIN Number:</strong> <span style={{ fontWeight: 'bold' }}>{studentInfo.pin_no || '-'}</span></div>
                    <div><strong>College:</strong> {studentInfo.college || '-'}</div>
                    <div><strong>Course & Branch:</strong> {studentInfo.course} - {studentInfo.branch}</div>
                    <div><strong>Academic Year / Sem:</strong> Year {studentInfo.current_year || studentInfo.studentYear || studentInfo.year || '-'}</div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '40px' }}>S.No</th>
                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>Fee Head Name</th>
                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', width: '100px' }}>Total Fee</th>
                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', width: '100px' }}>Paid</th>
                            <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', width: '100px' }}>Due</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feeDetails.length > 0 ? (
                            feeDetails.map((detail, idx) => {
                                const headDue = Number(detail.total || 0) - Number(detail.paid || 0);
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                                        <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 'bold' }}>{detail.headName}</td>
                                        <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>₹{fmtAmount(detail.total)}</td>
                                        <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>₹{fmtAmount(detail.paid)}</td>
                                        <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>₹{fmtAmount(headDue)}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', color: '#666' }}>No detailed dues available.</td>
                            </tr>
                        )}
                        {/* Totals Row */}
                        <tr style={{ backgroundColor: '#f5f5f5', borderTop: '2px solid #000', fontWeight: 'bold' }}>
                            <td colSpan="2" style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>GRAND TOTAL</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>₹{fmtAmount(totalFee)}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#16a34a' }}>₹{fmtAmount(paidAmount)}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#dc2626' }}>₹{fmtAmount(dueAmount)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Signatures */}
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '5px' }}>Student/Parent Signature</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '5px' }}>Accounts Officer</p>
                    </div>
                </div>
            </div>
        );
    }

    // Overall Dues Report Print Template
    const totalStudents = reportData.length;
    const grandFee = summary.totalFee || reportData.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
    const grandCollected = summary.totalCollected || reportData.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const grandDue = summary.totalDue || reportData.reduce((sum, s) => sum + Number(s.dueAmount || 0), 0);

    // Grouping by Year if filters.year is not specified
    const isYearFiltered = Boolean(filters.year && String(filters.year).trim() !== '');

    let yearGroups = {};
    if (!isYearFiltered) {
        reportData.forEach(student => {
            const yr = student.current_year || student.year || student.studentYear || '1';
            const yrKey = `Year ${yr}`;
            if (!yearGroups[yrKey]) yearGroups[yrKey] = [];
            yearGroups[yrKey].push(student);
        });
    } else {
        const yrKey = `Year ${filters.year}`;
        yearGroups[yrKey] = [...reportData];
    }

    // Sort students inside each year group by Pin Number ascending
    Object.keys(yearGroups).forEach(yrKey => {
        yearGroups[yrKey].sort((a, b) => {
            const pinA = String(a.pin_no || a.admission_number || '').trim();
            const pinB = String(b.pin_no || b.admission_number || '').trim();
            return pinA.localeCompare(pinB, undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    const sortedYearKeys = Object.keys(yearGroups).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });

    return (
        <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
            <style type="text/css" media="print">
                {`
                    @page { size: A4 portrait; margin: 6mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #fff; }
                    .page-break { page-break-before: always; break-before: page; }
                `}
            </style>

            {/* Year-Wise Pages */}
            {sortedYearKeys.map((yearKey, yIdx) => {
                const groupStudents = yearGroups[yearKey];
                const yFee = groupStudents.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
                const yPaid = groupStudents.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
                const yDue = groupStudents.reduce((sum, s) => sum + Number(s.dueAmount || 0), 0);

                return (
                    <div
                        key={yIdx}
                        className={yIdx > 0 ? 'page-break' : ''}
                        style={{
                            padding: '20px 24px',
                            pageBreakBefore: yIdx > 0 ? 'always' : 'auto',
                            breakBefore: yIdx > 0 ? 'page' : 'auto'
                        }}
                    >
                        {/* Header for each Year Page */}
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '10px' }}>
                            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                            <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>
                                OUTSTANDING DUES REPORT {!isYearFiltered ? `- ${yearKey.toUpperCase()}` : ''}
                            </p>
                        </div>

                        {/* Filter Metadata Info Box */}
                        <div style={{ border: '1px solid #bbb', padding: '6px 10px', marginBottom: '8px', borderRadius: '4px', fontSize: '9.5px', display: 'flex', flexWrap: 'wrap', gap: '4px 18px', backgroundColor: '#fafafa' }}>
                            {filters.college && <div><strong>College:</strong> {filters.college}</div>}
                            {filters.course && <div><strong>Course:</strong> {filters.course}</div>}
                            {filters.branch && <div><strong>Branch:</strong> {filters.branch}</div>}
                            {filters.year ? (
                                <div><strong>Year:</strong> Year {filters.year}</div>
                            ) : (
                                <div><strong>Year:</strong> {yearKey}</div>
                            )}
                            {filters.quota && <div><strong>Quota:</strong> {filters.quota}</div>}
                            {filters.batch && <div><strong>Academic Year / Batch:</strong> {filters.batch}</div>}
                        </div>

                        {/* Fee Head Index Legend (Sleek Banner) */}
                        {includeDetails && Object.keys(feeHeadLegendMap).length > 0 && (
                            <div style={{ border: '1px solid #94a3b8', padding: '5px 10px', marginBottom: '10px', borderRadius: '4px', fontSize: '9px', backgroundColor: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
                                <strong style={{ color: '#0f172a', textTransform: 'uppercase', fontSize: '8.5px', letterSpacing: '0.5px' }}>Fee Head Legend:</strong>
                                {Object.entries(feeHeadLegendMap).map(([code, name]) => (
                                    <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontWeight: 'bold', color: '#1e40af', backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: '3px', fontSize: '8.5px', border: '1px solid #bfdbfe' }}>{code}</span>
                                        <span style={{ color: '#334155', fontWeight: '500' }}>= {name}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'center', width: '28px' }}>#</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'left', width: '75px' }}>Pin No</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'left', width: '75px' }}>Admission No</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'left' }}>Student Name</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'right', width: '65px' }}>Total Fee</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'right', width: '65px' }}>Paid</th>
                                    <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'right', width: '70px' }}>Outstanding</th>
                                    {includeDetails && (
                                        <th style={{ border: '1px solid #cbd5e1', padding: '5px 5px', textAlign: 'left', width: '160px' }}>Fee Details (Head:Due)</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {groupStudents.map((st, idx) => {
                                    const due = st.dueAmount || 0;
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', textAlign: 'center' }}>{idx + 1}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', fontFamily: 'monospace' }}>{st.pin_no || '-'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', fontFamily: 'monospace' }}>{st.admission_number || '-'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', fontWeight: 'bold' }}>{st.student_name}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', textAlign: 'right' }}>₹{fmtAmount(st.totalFee)}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', textAlign: 'right', color: '#16a34a' }}>₹{fmtAmount(st.paidAmount)}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>₹{fmtAmount(due)}</td>
                                            {includeDetails && (
                                                <td style={{ border: '1px solid #cbd5e1', padding: '4px 5px' }}>
                                                    {renderStudentFeeDetailsBadges(st)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {/* Year Subtotal Row */}
                                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', borderTop: '1.5px solid #000' }}>
                                    <td colSpan={4} style={{ border: '1px solid #cbd5e1', padding: '5px 6px', textAlign: 'left' }}>
                                        {yearKey} Sub-Total ({groupStudents.length} Students)
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 6px', textAlign: 'right' }}>₹{fmtAmount(yFee)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>₹{fmtAmount(yPaid)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>₹{fmtAmount(yDue)}</td>
                                    {includeDetails && (
                                        <td style={{ border: '1px solid #cbd5e1', padding: '5px 6px' }}></td>
                                    )}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* Grand Total Footer Box (Appears at the end) */}
            <div style={{ padding: '0 24px 20px 24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <tbody>
                        <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2.5px solid #000', borderBottom: '2.5px solid #000', fontWeight: 'bold' }}>
                            <td colSpan={4} style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'left', fontSize: '10.5px' }}>
                                GRAND TOTAL (All Students: {totalStudents})
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', width: '65px', fontSize: '10.5px' }}>₹{fmtAmount(grandFee)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', width: '65px', color: '#16a34a', fontSize: '10.5px' }}>₹{fmtAmount(grandCollected)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', width: '70px', color: '#dc2626', fontSize: '10.5px' }}>₹{fmtAmount(grandDue)}</td>
                            {includeDetails && (
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px', width: '160px' }}></td>
                            )}
                        </tr>
                    </tbody>
                </table>

                {/* Signatures */}
                <div style={{ marginTop: '35px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '4px' }}>Accounts Assistant</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '4px' }}>Accounts Officer</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

DueReportPrintTemplate.displayName = 'DueReportPrintTemplate';

export default DueReportPrintTemplate;
