import React, { forwardRef } from 'react';

const DueReportPrintTemplate = forwardRef(({ type = 'overall', reportData = [], filters = {}, summary = {}, student = {}, includeDetails = false, printedOn: printedOnProp }, ref) => {
    const fmtAmount = (val) => Number(val || 0).toLocaleString('en-IN');

    const formatPrintedOn = () => {
        if (printedOnProp) return printedOnProp;
        return `${new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })} IST`;
    };

    const formatTermDate = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTermDateShort = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        return `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'short' })}`;
    };

    // Dynamic term count
    let maxTerms = 1;
    if (type === 'individual') {
        const studentInfo = student || {};
        let maxT = 1;
        ['academic', 'hostel', 'transport'].forEach((c) => {
            const catData = studentInfo.groupedFeeDetails?.[c];
            if (catData?.terms) {
                maxT = Math.max(maxT, ...catData.terms.map((t) => Number(t.termNumber) || 0), catData.terms.length);
            }
        });
        if (studentInfo.termDues?.length > maxT) maxT = studentInfo.termDues.length;
        maxTerms = Math.max(1, maxT);
    } else if (reportData?.length > 0) {
        const counts = reportData.map((st) => st.termDues?.length || 0);
        maxTerms = Math.max(1, ...counts);
    }

    // Most-common due date per term column (same approach as Due Reports grid)
    const termHeaderDates = (() => {
        const source = type === 'individual' ? [student].filter(Boolean) : (reportData || []);
        const dateCounts = {};
        source.forEach((st) => {
            (st.termDueDates || []).forEach((d, i) => {
                if (!d) return;
                const termIdx = i + 1;
                if (!dateCounts[termIdx]) dateCounts[termIdx] = {};
                const key = new Date(d).toISOString().slice(0, 10);
                dateCounts[termIdx][key] = (dateCounts[termIdx][key] || 0) + 1;
            });
            ['academic', 'hostel', 'transport'].forEach((c) => {
                (st.groupedFeeDetails?.[c]?.terms || []).forEach((t) => {
                    if (!t?.dueDate) return;
                    const termIdx = Number(t.termNumber) || 0;
                    if (!termIdx) return;
                    if (!dateCounts[termIdx]) dateCounts[termIdx] = {};
                    const key = new Date(t.dueDate).toISOString().slice(0, 10);
                    dateCounts[termIdx][key] = (dateCounts[termIdx][key] || 0) + 1;
                });
            });
        });
        const result = [];
        for (let i = 1; i <= maxTerms; i++) {
            if (dateCounts[i]) {
                const best = Object.entries(dateCounts[i]).sort((a, b) => b[1] - a[1])[0];
                result.push(formatTermDate(best[0]));
            } else {
                result.push(null);
            }
        }
        return result;
    })();

    // Columns: #, Pin, Adm, Name, Total Fee, Paid, T1..Tn, Active Due  (no Outstanding)
    const baseColCount = 4;
    const totalColCount = baseColCount + 2 + maxTerms + 1;

    const renderColGroup = () => (
        <colgroup>
            <col style={{ width: '26px' }} />
            <col style={{ width: '72px' }} />
            <col style={{ width: '72px' }} />
            <col style={{ width: '170px' }} />
            <col style={{ width: '58px' }} />
            <col style={{ width: '50px' }} />
            {Array.from({ length: maxTerms }).map((_, i) => (
                <col key={i} style={{ width: '58px' }} />
            ))}
            <col style={{ width: '60px' }} />
        </colgroup>
    );

    const thStyle = {
        border: '1px solid #000',
        padding: '4px 3px',
        color: '#000',
        fontWeight: 'bold',
        fontSize: '8.5px',
        backgroundColor: '#fff'
    };
    const tdStyle = {
        border: '1px solid #000',
        padding: '3px 3px',
        color: '#000',
        fontSize: '8.5px',
        backgroundColor: '#fff'
    };

    const renderBreakdownTable = (st, maxTermsVal) => {
        const categories = [
            { key: 'academic', label: 'Academic Fees' },
            { key: 'hostel', label: 'Hostel Fee' },
            { key: 'transport', label: 'Transport Fee' }
        ].filter((c) => st.groupedFeeDetails?.[c.key]);

        if (categories.length === 0) {
            return <div style={{ padding: '6px', fontStyle: 'italic', color: '#000', fontSize: '9px' }}>No breakdown details found.</div>;
        }

        const totalFee = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].total || 0), 0);
        const concession = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].concession || 0), 0);
        const dueAmount = categories.reduce((sum, cat) => sum + Number(st.groupedFeeDetails[cat.key].due || 0), 0);
        const activeDue = categories.reduce((sum, cat) => {
            const catData = st.groupedFeeDetails[cat.key];
            return sum + (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
        }, 0);

        const termTotals = Array.from({ length: maxTermsVal }).map((_, i) =>
            categories.reduce((sum, cat) => {
                const catData = st.groupedFeeDetails[cat.key];
                const termObj = (catData.terms || []).find((t) => Number(t.termNumber) === i + 1);
                return sum + (termObj ? termObj.balance || 0 : 0);
            }, 0)
        );

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '4px', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }}>Fee Category</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000', backgroundColor: '#fff' }}>Total</th>
                        {Array.from({ length: maxTermsVal }).map((_, i) => (
                            <th key={i} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '65px', color: '#000', backgroundColor: '#fff' }}>
                                <div>T{i + 1} Due</div>
                                {termHeaderDates[i] && (
                                    <div style={{ fontSize: '7.5px', fontWeight: 'normal', color: '#000', marginTop: '1px' }}>{termHeaderDates[i]}</div>
                                )}
                            </th>
                        ))}
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000', backgroundColor: '#fff' }}>Active Due</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000', backgroundColor: '#fff' }}>Concession</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '70px', color: '#000', backgroundColor: '#fff' }}>Due</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map((cat) => {
                        const catData = st.groupedFeeDetails[cat.key];
                        const catActiveDue = (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
                        return (
                            <tr key={cat.key}>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold', color: '#000', backgroundColor: '#fff' }}>{cat.label}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(catData.total)}</td>
                                {Array.from({ length: maxTermsVal }).map((_, i) => {
                                    const termObj = (catData.terms || []).find((t) => Number(t.termNumber) === i + 1);
                                    const termBalance = termObj ? termObj.balance || 0 : 0;
                                    const termTarget = termObj ? termObj.termTarget || 0 : 0;
                                    const termConc = termObj ? termObj.concessionShare || 0 : 0;
                                    const fTermDate = formatTermDateShort(termObj?.dueDate);

                                    return (
                                        <td key={i} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', backgroundColor: '#fff' }}>
                                            <div style={{ fontWeight: termBalance > 0 ? 'bold' : 'normal', color: '#000' }}>
                                                ₹{fmtAmount(termBalance)}
                                            </div>
                                            {termTarget > 0 && (
                                                <div style={{ fontSize: '7.5px', color: '#000', fontWeight: 'normal', marginTop: '1px' }}>
                                                    Target: ₹{fmtAmount(termTarget)}
                                                    {termConc > 0 && ` (Conc: ₹${fmtAmount(termConc)})`}
                                                </div>
                                            )}
                                            {termBalance > 0 && fTermDate && (
                                                <div style={{ fontSize: '7.5px', color: '#000', fontWeight: 'normal', fontFamily: 'monospace', marginTop: '1px' }}>{fTermDate}</div>
                                            )}
                                        </td>
                                    );
                                })}
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold', backgroundColor: '#fff' }}>₹{fmtAmount(catActiveDue)}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(catData.concession)}</td>
                                <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold', backgroundColor: '#fff' }}>₹{fmtAmount(catData.due)}</td>
                            </tr>
                        );
                    })}
                    <tr style={{ fontWeight: 'bold' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left', color: '#000', backgroundColor: '#fff' }}>GRAND TOTAL</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(totalFee)}</td>
                        {termTotals.map((termTotal, idx) => (
                            <td key={idx} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(termTotal)}</td>
                        ))}
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(activeDue)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', backgroundColor: '#fff' }}>₹{fmtAmount(concession)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', color: '#000', fontWeight: 'bold', backgroundColor: '#fff' }}>₹{fmtAmount(dueAmount)}</td>
                    </tr>
                </tbody>
            </table>
        );
    };

    if (type === 'individual') {
        const studentInfo = student || {};
        return (
            <div ref={ref} style={{ padding: '24px', fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
                <style type="text/css">
                    {`
                        @page { size: A4 landscape; margin: 8mm; }
                        @media print {
                            @page { size: A4 landscape; margin: 8mm; }
                            body { background-color: #fff; }
                        }
                    `}
                </style>

                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                    <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>INDIVIDUAL DUE STATEMENT</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', border: '1.5px solid #000', padding: '12px', marginBottom: '16px', borderRadius: '4px', fontSize: '11px' }}>
                    <div><strong>Student Name:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{studentInfo.student_name}</span></div>
                    <div><strong>Admission No:</strong> <span style={{ fontWeight: 'bold' }}>{studentInfo.admission_number}</span></div>
                    <div><strong>PIN Number:</strong> <span style={{ fontWeight: 'bold' }}>{studentInfo.pin_no || '-'}</span></div>
                    <div><strong>College:</strong> {studentInfo.college || '-'}</div>
                    <div><strong>Course & Branch:</strong> {studentInfo.course} - {studentInfo.branch}</div>
                    <div><strong>Academic Year / Sem:</strong> Year {studentInfo.current_year || studentInfo.studentYear || studentInfo.year || '-'}</div>
                </div>

                <div style={{ marginTop: '10px' }}>
                    {renderBreakdownTable(studentInfo, maxTerms)}
                </div>
            </div>
        );
    }

    // Overall Dues Report
    const totalStudents = reportData.length;
    const grandFee = summary.totalFee || reportData.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
    const grandCollected = summary.totalCollected || reportData.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const grandActiveDue = reportData.reduce((sum, s) => sum + Number(s.activeDue || 0), 0);
    const grandTermDues = Array.from({ length: maxTerms }).map((_, i) =>
        reportData.reduce((sum, s) => sum + Number(s.termDues?.[i] || 0), 0)
    );

    const isYearFiltered = Boolean(filters.year && String(filters.year).trim() !== '');

    let yearGroups = {};
    if (!isYearFiltered) {
        reportData.forEach((st) => {
            const yr = st.current_year || st.year || st.studentYear || '1';
            const yrKey = `Year ${yr}`;
            if (!yearGroups[yrKey]) yearGroups[yrKey] = [];
            yearGroups[yrKey].push(st);
        });
    } else {
        yearGroups[`Year ${filters.year}`] = [...reportData];
    }

    Object.keys(yearGroups).forEach((yrKey) => {
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

    const printedOn = formatPrintedOn();

    return (
        <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000', backgroundColor: '#fff' }}>
            <style type="text/css">
                {`
                    @page { size: A4 landscape; margin: 6mm; }
                    @media print {
                        @page { size: A4 landscape; margin: 6mm; }
                        body { background-color: #fff; }
                        .page-break { page-break-before: always; break-before: page; }
                    }
                `}
            </style>

            {sortedYearKeys.map((yearKey, yIdx) => {
                const groupStudents = yearGroups[yearKey];
                const yFee = groupStudents.reduce((sum, s) => sum + Number(s.totalFee || 0), 0);
                const yPaid = groupStudents.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
                const yActiveDue = groupStudents.reduce((sum, s) => sum + Number(s.activeDue || 0), 0);
                const yTermDues = Array.from({ length: maxTerms }).map((_, i) =>
                    groupStudents.reduce((sum, s) => sum + Number(s.termDues?.[i] || 0), 0)
                );
                const isLastYear = yIdx === sortedYearKeys.length - 1;
                const showYearSubTotal = sortedYearKeys.length > 1;
                const activeDueCellBg = '#ececec';

                return (
                    <div
                        key={yIdx}
                        className={yIdx > 0 ? 'page-break' : ''}
                        style={{
                            padding: '16px 18px',
                            pageBreakBefore: yIdx > 0 ? 'always' : 'auto',
                            breakBefore: yIdx > 0 ? 'page' : 'auto'
                        }}
                    >
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
                            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Pydah Group of Colleges</h1>
                            <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                ACTIVE DUE AS ON DATE : {printedOn}
                                {!isYearFiltered ? ` — ${yearKey.toUpperCase()}` : ''}
                            </p>
                        </div>

                        <div style={{ border: '1px solid #000', padding: '5px 8px', marginBottom: '8px', fontSize: '9px', display: 'flex', flexWrap: 'wrap', gap: '3px 14px', backgroundColor: '#fff' }}>
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
                            {filters.studentStatus && <div><strong>Status:</strong> {filters.studentStatus}</div>}
                            {filters.scholarshipMode && <div><strong>Scholarship:</strong> {filters.scholarshipMode}</div>}
                            {filters.feeHeads && <div><strong>Fee Heads:</strong> {filters.feeHeads}</div>}
                            {filters.search && <div><strong>Search:</strong> {filters.search}</div>}
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '8.5px' }}>
                            {renderColGroup()}
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Pin No</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Admission No</th>
                                    <th style={{ ...thStyle, textAlign: 'left' }}>Student Name</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Total Fee</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Paid</th>
                                    {Array.from({ length: maxTerms }).map((_, i) => (
                                        <th key={i} style={{ ...thStyle, textAlign: 'center' }}>
                                            <div>T{i + 1} Due</div>
                                            {termHeaderDates[i] && (
                                                <div style={{ fontSize: '7px', fontWeight: 'normal', color: '#000', marginTop: '1px' }}>
                                                    {termHeaderDates[i]}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                    <th style={{ ...thStyle, textAlign: 'center', backgroundColor: activeDueCellBg }}>Active Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupStudents.map((st, idx) => {
                                    const termDues = st.termDues || [];
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.pin_no || '-'}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{st.admission_number || '-'}</td>
                                                <td style={{ ...tdStyle, fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }} title={st.student_name}>
                                                    {st.student_name}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>₹{fmtAmount(st.totalFee)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>₹{fmtAmount(st.paidAmount)}</td>
                                                {Array.from({ length: maxTerms }).map((_, i) => {
                                                    const termDue = Number(termDues[i] || 0);
                                                    return (
                                                        <td
                                                            key={i}
                                                            style={{
                                                                ...tdStyle,
                                                                textAlign: 'center',
                                                                fontWeight: termDue > 0 ? 'bold' : 'normal'
                                                            }}
                                                        >
                                                            ₹{fmtAmount(termDue)}
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: activeDueCellBg }}>
                                                    ₹{fmtAmount(st.activeDue)}
                                                </td>
                                            </tr>
                                            {includeDetails && (
                                                <tr>
                                                    <td colSpan={totalColCount} style={{ padding: '4px 8px 6px 8px', border: '1px solid #000', backgroundColor: '#fff' }}>
                                                        {renderBreakdownTable(st, maxTerms)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Year sub-total only when multiple year pages (avoids duplicate with grand total) */}
                                {showYearSubTotal && (
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td colSpan={baseColCount} style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>
                                            {yearKey} Sub-Total ({groupStudents.length} Students)
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yFee)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>₹{fmtAmount(yPaid)}</td>
                                        {yTermDues.map((amt, i) => (
                                            <td key={i} style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                                                ₹{fmtAmount(amt)}
                                            </td>
                                        ))}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: activeDueCellBg }}>
                                            ₹{fmtAmount(yActiveDue)}
                                        </td>
                                    </tr>
                                )}

                                {/* Grand total only (same table so columns align) */}
                                {isLastYear && (
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td colSpan={baseColCount} style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                            GRAND TOTAL (All Students: {totalStudents})
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandFee)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>₹{fmtAmount(grandCollected)}</td>
                                        {grandTermDues.map((amt, i) => (
                                            <td key={i} style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                                                ₹{fmtAmount(amt)}
                                            </td>
                                        ))}
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold', borderTop: '2px solid #000', backgroundColor: activeDueCellBg }}>
                                            ₹{fmtAmount(grandActiveDue)}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
});

DueReportPrintTemplate.displayName = 'DueReportPrintTemplate';

export default DueReportPrintTemplate;
