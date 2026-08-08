import React, { forwardRef } from 'react';

const DueReportPrintTemplate = forwardRef(({ type = 'overall', reportData = [], filters = {}, summary = {}, student = {}, includeDetails = false }, ref) => {
    // Helper to format currency
    const fmtAmount = (val) => Number(val || 0).toLocaleString('en-IN');

    // Dynamic term count helper
    let maxTerms = 1;
    if (type === 'individual') {
        const studentInfo = student || {};
        let maxT = 1;
        const categories = ['academic', 'hostel', 'transport'];
        categories.forEach(c => {
            const catData = studentInfo.groupedFeeDetails?.[c];
            if (catData && catData.terms) {
                maxT = Math.max(maxT, catData.terms.length);
            }
        });
        if (studentInfo.termDues && studentInfo.termDues.length > maxT) {
            maxT = studentInfo.termDues.length;
        }
        maxTerms = maxT;
    } else {
        if (reportData && reportData.length > 0) {
            const counts = reportData.map(st => st.termDues?.length || 0);
            maxTerms = Math.max(1, ...counts);
        }
    }

    // Breakdown table rendering helper
    const renderBreakdownTable = (st, maxTermsVal) => {
        const categories = [
            { key: 'academic', label: 'Academic Fees' },
            { key: 'hostel', label: 'Hostel Fee' },
            { key: 'transport', label: 'Transport Fee' }
        ].filter(c => st.groupedFeeDetails?.[c.key]);

        if (categories.length === 0) {
            return <div style={{ padding: '6px', fontStyle: 'italic', color: '#666', fontSize: '9px' }}>No breakdown details found.</div>;
        }

        // Totals
        const totalFee = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].total || 0), 0);
        const concession = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].concession || 0), 0);
        const dueAmount = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].due || 0), 0);
        const activeDue = categories.reduce((sum, cat) => {
            const catData = st.groupedFeeDetails[cat.key];
            const catActiveDue = (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
            return sum + catActiveDue;
        }, 0);

        const termTotals = Array.from({ length: maxTermsVal }).map((_, i) => {
            return categories.reduce((sum, cat) => {
                const catData = st.groupedFeeDetails[cat.key];
                const termObj = (catData.terms || []).find(t => Number(t.termNumber) === (i + 1));
                return sum + (termObj ? (termObj.balance || 0) : 0);
            }, 0);
        });

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '4px', border: '1px solid #000' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '2px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', fontWeight: 'bold', color: '#000' }}>Fee Category</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000' }}>Total</th>
                        {Array.from({ length: maxTermsVal }).map((_, i) => (
                            <th key={i} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '65px', color: '#000', backgroundColor: '#f2f2f2' }}>T{i + 1} Due</th>
                        ))}
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000' }}>Active Due</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000' }}>Concession</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000' }}>Due</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map(cat => {
                        const catData = st.groupedFeeDetails[cat.key];
                        const catActiveDue = (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
                        return (
                            <tr key={cat.key} style={{ borderBottom: '1px solid #000' }}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold', color: '#000' }}>{cat.label}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(catData.total)}</td>
                                {Array.from({ length: maxTermsVal }).map((_, i) => {
                                    const termObj = (catData.terms || []).find(t => Number(t.termNumber) === (i + 1));
                                    const termBalance = termObj ? (termObj.balance || 0) : 0;
                                    const termTarget = termObj ? (termObj.termTarget || 0) : 0;
                                    const termConc = termObj ? (termObj.concessionShare || 0) : 0;
                                    
                                    const tDate = termObj?.dueDate ? new Date(termObj.dueDate) : null;
                                    const fTermDate = tDate && !isNaN(tDate.getTime())
                                        ? `${tDate.getDate()} ${tDate.toLocaleString('en-US', { month: 'short' })}`
                                        : null;

                                    return (
                                        <td key={i} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>
                                            <div style={{ fontWeight: termBalance > 0 ? 'bold' : 'normal', color: '#000' }}>
                                                ₹{fmtAmount(termBalance)}
                                            </div>
                                            {termTarget > 0 && (
                                                <div style={{ fontSize: '7.5px', color: '#555', fontWeight: 'normal', marginTop: '1px' }}>
                                                    Target: ₹{fmtAmount(termTarget)}
                                                    {termConc > 0 && ` (Conc: ₹${fmtAmount(termConc)})`}
                                                </div>
                                            )}
                                            {termBalance > 0 && fTermDate && (
                                                <div style={{ fontSize: '7.5px', color: '#555', fontWeight: 'normal', fontFamily: 'monospace', marginTop: '1px' }}>{fTermDate}</div>
                                            )}
                                        </td>
                                    );
                                })}
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold' }}>₹{fmtAmount(catActiveDue)}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(catData.concession)}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold' }}>₹{fmtAmount(catData.due)}</td>
                            </tr>
                        );
                    })}
                    {/* Grand Total Row */}
                    <tr style={{ backgroundColor: '#e6e6e6', borderTop: '2px solid #000', fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left', color: '#000' }}>GRAND TOTAL</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(totalFee)}</td>
                        {termTotals.map((termTotal, idx) => (
                            <td key={idx} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(termTotal)}</td>
                        ))}
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(activeDue)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(concession)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold' }}>₹{fmtAmount(dueAmount)}</td>
                    </tr>
                </tbody>
            </table>
        );
    };

    if (type === 'individual') {
        const studentInfo = student || {};
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

                {/* Breakdown Table */}
                <div style={{ marginTop: '10px' }}>
                    {renderBreakdownTable(studentInfo, maxTerms)}
                </div>

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
                        <div style={{ border: '1px solid #000', padding: '6px 10px', marginBottom: '8px', borderRadius: '4px', fontSize: '9.5px', display: 'flex', flexWrap: 'wrap', gap: '4px 18px', backgroundColor: '#fafafa' }}>
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

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'center', width: '28px', color: '#000' }}>#</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'left', width: '75px', color: '#000' }}>Pin No</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'left', width: '75px', color: '#000' }}>Admission No</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'left', color: '#000' }}>Student Name</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'right', width: '65px', color: '#000' }}>Total Fee</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'right', width: '65px', color: '#000' }}>Paid</th>
                                    <th style={{ border: '1px solid #000', padding: '5px 5px', textAlign: 'right', width: '70px', color: '#000' }}>Outstanding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupStudents.map((st, idx) => {
                                    const due = st.dueAmount || 0;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr style={{ borderBottom: '1px solid #000' }}>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'center', color: '#000' }}>{idx + 1}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', fontFamily: 'monospace', color: '#000' }}>{st.pin_no || '-'}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', fontFamily: 'monospace', color: '#000' }}>{st.admission_number || '-'}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: 'bold', color: '#000' }}>{st.student_name}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(st.totalFee)}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(st.paidAmount)}</td>
                                                <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmtAmount(due)}</td>
                                            </tr>
                                            {includeDetails && (
                                                <tr>
                                                    <td colSpan={7} style={{ padding: '4px 10px 8px 10px', border: '1px solid #000', backgroundColor: '#fff' }}>
                                                        {renderBreakdownTable(st, maxTerms)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {/* Year Subtotal Row */}
                                <tr style={{ backgroundColor: '#f2f2f2', fontWeight: 'bold', borderTop: '1.5px solid #000' }}>
                                    <td colSpan={4} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left', color: '#000' }}>
                                        {yearKey} Sub-Total ({groupStudents.length} Students)
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(yFee)}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(yPaid)}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000' }}>₹{fmtAmount(yDue)}</td>
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
                        <tr style={{ backgroundColor: '#e6e6e6', borderTop: '2.5px solid #000', borderBottom: '2.5px solid #000', fontWeight: 'bold' }}>
                            <td colSpan={4} style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '10.5px', color: '#000' }}>
                                GRAND TOTAL (All Students: {totalStudents})
                            </td>
                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '65px', fontSize: '10.5px', color: '#000' }}>₹{fmtAmount(grandFee)}</td>
                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '65px', color: '#000', fontSize: '10.5px' }}>₹{fmtAmount(grandCollected)}</td>
                            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '70px', color: '#000', fontSize: '10.5px' }}>₹{fmtAmount(grandDue)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Signatures */}
                <div style={{ marginTop: '35px', display: 'flex', justifySelf: 'space-between', fontSize: '10px', width: '100%', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '4px', margin: '0' }}>Accounts Assistant</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ borderTop: '1.5px solid #000', width: '150px', paddingTop: '4px', margin: '0' }}>Accounts Officer</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

DueReportPrintTemplate.displayName = 'DueReportPrintTemplate';

export default DueReportPrintTemplate;
