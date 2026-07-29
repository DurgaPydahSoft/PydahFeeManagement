import React from 'react';

// ─── shared helpers ────────────────────────────────────────────────────────
const fmt  = n => Number(n ?? 0).toLocaleString('en-IN');
const yrSfx = yr => yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : `${yr}th`;

const th = (align = 'left', extra = {}) => ({
    border: '1.5px solid #000', padding: '6px 10px',
    textAlign: align, fontWeight: '900', fontSize: '10px',
    textTransform: 'uppercase', background: '#f0f0f0', ...extra
});
const td = (align = 'left', extra = {}) => ({
    border: '1.5px solid #ccc', padding: '5px 10px',
    textAlign: align, ...extra
});

// ─── CollegeHeader — shared header block ──────────────────────────────────
const Header = ({ subtitle }) => (
    <div style={{ textAlign: 'center', borderBottom: '2.5px solid #000', paddingBottom: '10px', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
            Pydah Group of Colleges
        </h1>
        <p style={{ fontSize: '11px', fontWeight: '700', color: '#444', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {subtitle}
        </p>
    </div>
);

// ─── SINGLE STUDENT VIEW ──────────────────────────────────────────────────
const SingleStudentPrint = ({ request }) => {
    const concessions = request.concessions || [];

    // All distinct years across all fee heads
    const years = [...new Set(concessions.map(c => Number(c.studentYear)))].sort((a, b) => a - b);

    // Group concessions by fee head
    const byHead = {};
    concessions.forEach(c => {
        const key = c.feeHeadId;
        if (!byHead[key]) {
            byHead[key] = {
                name: c.feeHeadName || c.feeHeadCode || key,
                code: c.feeHeadCode || '',
                type: c.concessionType,
                years: {}
            };
        }
        byHead[key].years[Number(c.studentYear)] = Number(c.amount ?? 0);
        byHead[key].type = c.concessionType;
        if (c.feeHeadName) byHead[key].name = c.feeHeadName;
    });

    const grandTotal = concessions.reduce((s, c) => s + Number(c.amount ?? 0), 0);

    const approvedDate = request.updatedAt
        ? new Date(request.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px 30px', color: '#111', background: '#fff', minHeight: '297mm' }}>
            <Header subtitle="Overall Concession (Revised Fees) — Student Register" />

            {/* Student info grid */}
            <div style={{ border: '1.5px solid #ddd', borderRadius: '6px', padding: '12px 16px', marginBottom: '18px', background: '#fafafa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '11px' }}>
                    {[
                        ['Student Name',   request.studentName,                                        true],
                        ['PIN Number',     request.pinNo || '—',                                      false],
                        ['Admission No.',  request.admissionNumber,                                   false],
                        ['College',        request.college,                                           false],
                        ['Course / Branch',`${request.course} — ${request.branch}`,                  false],
                        ['Batch',          request.batch,                                             false],
                        ['Student Quota',  (request.category || request.studentQuota || '—').toUpperCase(), false],
                        ['Approved By',    request.approvedByName || request.approvedBy || '—',       false],
                        ['Approved On',    approvedDate,                                              false],
                    ].map(([label, value, large]) => (
                        <div key={label}>
                            <div style={{ color: '#777', fontWeight: '700', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px' }}>{label}</div>
                            <div style={{ fontWeight: large ? '900' : '700', fontSize: large ? '13px' : '11px', marginTop: '2px' }}>{value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fee head × year table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '2px solid #000', marginBottom: '18px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={th('left')}>S.No</th>
                        <th style={th('left')}>Fee Component</th>
                        <th style={th('center')}>Code</th>
                        <th style={th('center')}>Type</th>
                        {years.map(yr => (
                            <th key={yr} style={th('right')}>{yrSfx(yr)} Yr (₹)</th>
                        ))}
                        <th style={th('right')}>Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(byHead).map(([fhId, row], idx) => {
                        const rowTotal = Object.values(row.years).reduce((s, v) => s + v, 0);
                        return (
                            <tr key={fhId} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                <td style={td('center')}>{idx + 1}</td>
                                <td style={{ ...td('left'), fontWeight: '700' }}>{row.name}</td>
                                <td style={{ ...td('center'), fontFamily: 'monospace', fontSize: '10px' }}>{row.code || '—'}</td>
                                <td style={td('center')}>
                                    <span style={{
                                        background: row.type === 'REVISED' ? '#dcfce7' : '#fef9c3',
                                        color:      row.type === 'REVISED' ? '#166534' : '#854d0e',
                                        padding: '1px 6px', borderRadius: '4px',
                                        fontWeight: '800', fontSize: '9px', textTransform: 'uppercase'
                                    }}>{row.type}</span>
                                </td>
                                {years.map(yr => (
                                    <td key={yr} style={{ ...td('right'), fontWeight: '700' }}>
                                        {row.years[yr] !== undefined ? `₹${fmt(row.years[yr])}` : '—'}
                                    </td>
                                ))}
                                <td style={{ ...td('right'), fontWeight: '800' }}>₹{fmt(rowTotal)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ backgroundColor: '#1e293b', color: '#fff' }}>
                        <td colSpan={years.length + 4} style={{ border: '2px solid #000', padding: '7px 10px', textAlign: 'right', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>
                            Grand Total Concession
                        </td>
                        <td style={{ border: '2px solid #000', padding: '7px 10px', textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>
                            ₹{fmt(grandTotal)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', borderTop: '1px solid #ddd', paddingTop: '8px', marginBottom: '24px' }}>
                <span>Requested by: <strong>{request.requestedByName || request.requestedBy}</strong></span>
                <span>Status: <strong style={{ color: '#166534', textTransform: 'uppercase' }}>{request.status}</strong></span>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', fontSize: '10px' }}>
                {['Prepared By', 'Verified By', 'Principal / HOD'].map(label => (
                    <div key={label} style={{ textAlign: 'center', width: '160px', borderTop: '1.5px solid #000', paddingTop: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555' }}>
                        {label}
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` }} />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// ALL STUDENTS PRINT
// — year-wise columns per student row, no date anywhere
// ══════════════════════════════════════════════════════════════════════════
const AllStudentsPrint = ({ requests, filters }) => {

    // Collect all distinct years across every request
    const allYears = [...new Set(
        requests.flatMap(req => (req.concessions || []).map(c => Number(c.studentYear)))
    )].filter(Boolean).sort((a, b) => a - b);

    const rows = requests.map(req => {
        const concessions = req.concessions || [];
        const totalAmount = concessions.reduce((s, c) => s + Number(c.amount ?? 0), 0);

        // byHead: feeHeadId → { name, type, years: { yr: amount } }
        const byHead = {};
        concessions.forEach(c => {
            const key = c.feeHeadId;
            if (!byHead[key]) byHead[key] = {
                name: c.feeHeadName || c.feeHeadCode || key,
                type: c.concessionType,
                years: {}
            };
            byHead[key].years[Number(c.studentYear)] = (byHead[key].years[Number(c.studentYear)] || 0) + Number(c.amount ?? 0);
            byHead[key].type = c.concessionType;
            if (c.feeHeadName) byHead[key].name = c.feeHeadName;
        });

        // year totals for this student: { yr: sum across all fee heads }
        const yearTotals = {};
        allYears.forEach(yr => {
            yearTotals[yr] = Object.values(byHead).reduce((s, h) => s + (h.years[yr] || 0), 0);
        });

        return { req, totalAmount, byHead, yearTotals };
    });

    const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

    // Grand year totals across all students
    const grandYearTotals = {};
    allYears.forEach(yr => {
        grandYearTotals[yr] = rows.reduce((s, r) => s + (r.yearTotals[yr] || 0), 0);
    });

    // College summary
    const byCollege = {};
    rows.forEach(({ req, totalAmount }) => {
        const col = req.college || 'Unknown';
        if (!byCollege[col]) byCollege[col] = { total: 0, count: 0 };
        byCollege[col].total += totalAmount;
        byCollege[col].count += 1;
    });

    const filterParts = [];
    if (filters.college) filterParts.push(filters.college);
    if (filters.course)  filterParts.push(filters.course);
    if (filters.branch)  filterParts.push(filters.branch);
    if (filters.batch)   filterParts.push(`Batch ${filters.batch}`);
    const filterLabel = filterParts.length ? filterParts.join(' · ') : 'All Colleges / Courses / Branches';

    // Fixed col count: S.No + Name + PIN + Adm + College + Course/Branch + Batch + Approved By + [years] + Total
    const fixedCols = 8;
    const totalCols = fixedCols + allYears.length + 1;

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px 30px', color: '#111', background: '#fff', minHeight: '297mm' }}>
            <Header subtitle="Overall Concession (Revised Fees) — Reports" />

            {/* Meta strip — NO date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '18px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <span>Filter: <span style={{ fontWeight: '900' }}>{filterLabel}</span></span>
                <span>Total Students: <span style={{ fontWeight: '900' }}>{rows.length}</span></span>
            </div>

            {/* College summary */}
            <div style={{ border: '2px solid #000', borderRadius: '4px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ background: '#1e293b', color: '#fff', padding: '6px 14px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
                    Summary
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                            <th style={th('left',   { border: '1.5px solid #000' })}>College</th>
                            <th style={th('center', { border: '1.5px solid #000' })}>Students</th>
                            {allYears.map(yr => (
                                <th key={yr} style={th('right', { border: '1.5px solid #000' })}>{yrSfx(yr)} Yr (₹)</th>
                            ))}
                            <th style={th('right', { border: '1.5px solid #000' })}>Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(byCollege).map(([col, d], idx) => {
                            // year totals per college
                            const colYearTotals = {};
                            allYears.forEach(yr => {
                                colYearTotals[yr] = rows
                                    .filter(r => r.req.college === col)
                                    .reduce((s, r) => s + (r.yearTotals[yr] || 0), 0);
                            });
                            return (
                                <tr key={col} style={{ background: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                    <td style={{ border: '1.5px solid #ccc', padding: '5px 12px', fontWeight: '700' }}>{col}</td>
                                    <td style={{ border: '1.5px solid #ccc', padding: '5px 12px', textAlign: 'center', fontWeight: '700' }}>{d.count}</td>
                                    {allYears.map(yr => (
                                        <td key={yr} style={{ border: '1.5px solid #ccc', padding: '5px 12px', textAlign: 'right', fontWeight: '700' }}>
                                            {colYearTotals[yr] ? `₹${fmt(colYearTotals[yr])}` : '—'}
                                        </td>
                                    ))}
                                    <td style={{ border: '1.5px solid #ccc', padding: '5px 12px', textAlign: 'right', fontWeight: '800' }}>₹{fmt(d.total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#1e293b', color: '#fff' }}>
                            <td colSpan={2} style={{ border: '2px solid #000', padding: '7px 12px', textAlign: 'right', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>
                                Grand Total
                            </td>
                            {allYears.map(yr => (
                                <td key={yr} style={{ border: '2px solid #000', padding: '7px 12px', textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>
                                    ₹{fmt(grandYearTotals[yr] || 0)}
                                </td>
                            ))}
                            <td style={{ border: '2px solid #000', padding: '7px 12px', textAlign: 'right', fontWeight: '900', fontSize: '13px' }}>
                                ₹{fmt(grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Student-wise breakdown with year columns */}
            <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: '#1e293b', color: '#fff', padding: '6px 14px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
                    Student-wise Breakdown
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                            <th style={th('center', { border: '1.5px solid #000', width: '28px' })}>S.No</th>
                            <th style={th('left',   { border: '1.5px solid #000' })}>Student Name</th>
                            <th style={th('center', { border: '1.5px solid #000' })}>PIN</th>
                            <th style={th('left',   { border: '1.5px solid #000' })}>Adm. No.</th>
                            <th style={th('left',   { border: '1.5px solid #000' })}>College</th>
                            <th style={th('left',   { border: '1.5px solid #000' })}>Course / Branch</th>
                            <th style={th('center', { border: '1.5px solid #000' })}>Batch</th>
                            <th style={th('left',   { border: '1.5px solid #000' })}>Fee Components</th>
                            {allYears.map(yr => (
                                <th key={yr} style={th('right', { border: '1.5px solid #000' })}>{yrSfx(yr)} Yr (₹)</th>
                            ))}
                            <th style={th('right', { border: '1.5px solid #000' })}>Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ req, totalAmount, byHead, yearTotals }, idx) => (
                            <tr key={req._id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', verticalAlign: 'top' }}>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', fontWeight: '800' }}>{req.studentName}</td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: '10px' }}>{req.pinNo || '—'}</td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', fontFamily: 'monospace', fontSize: '10px' }}>{req.admissionNumber}</td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', fontSize: '10px' }}>{req.college}</td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', fontSize: '10px' }}>
                                    <div style={{ fontWeight: '700' }}>{req.course}</div>
                                    <div style={{ color: '#555', fontSize: '9px' }}>{req.branch}</div>
                                </td>
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', textAlign: 'center', fontSize: '10px' }}>{req.batch}</td>
                                {/* Fee components: name + type badge, no amount here (amounts in year columns) */}
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', fontSize: '9px' }}>
                                    {Object.entries(byHead).map(([fhId, h]) => (
                                        <div key={fhId} style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontWeight: '700' }}>{h.name}</span>
                                            <span style={{
                                                background: h.type === 'REVISED' ? '#dcfce7' : '#fef9c3',
                                                color:      h.type === 'REVISED' ? '#166534' : '#854d0e',
                                                padding: '0 4px', borderRadius: '3px', fontSize: '8px', fontWeight: '800'
                                            }}>{h.type}</span>
                                        </div>
                                    ))}
                                </td>
                                {/* Year-wise total columns */}
                                {allYears.map(yr => (
                                    <td key={yr} style={{ border: '1.5px solid #ccc', padding: '5px 8px', textAlign: 'right', fontWeight: '700', fontSize: '11px' }}>
                                        {yearTotals[yr] ? `₹${fmt(yearTotals[yr])}` : '—'}
                                    </td>
                                ))}
                                <td style={{ border: '1.5px solid #ccc', padding: '5px 8px', textAlign: 'right', fontWeight: '900', fontSize: '11px' }}>
                                    ₹{fmt(totalAmount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#1e293b', color: '#fff' }}>
                            <td colSpan={8} style={{ border: '2px solid #000', padding: '7px 8px', textAlign: 'right', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>
                                Grand Total — {rows.length} Students
                            </td>
                            {allYears.map(yr => (
                                <td key={yr} style={{ border: '2px solid #000', padding: '7px 8px', textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>
                                    ₹{fmt(grandYearTotals[yr] || 0)}
                                </td>
                            ))}
                            <td style={{ border: '2px solid #000', padding: '7px 8px', textAlign: 'right', fontWeight: '900', fontSize: '13px' }}>
                                ₹{fmt(grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                This is a computer-generated Overall Concession Report for internal records only.
            </div>

            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A3 landscape; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` }} />
        </div>
    );
};

// ─── Single export — handles both modes ───────────────────────────────────
// Props:
//   Single student:  { request, generatedOn }
//   All students:    { requests, filters, generatedOn }
const OverallConcessionRegisterPrint = (props) => {
    if (props.request) {
        return <SingleStudentPrint request={props.request} />;
    }
    return <AllStudentsPrint requests={props.requests || []} filters={props.filters || {}} />;
};

export default OverallConcessionRegisterPrint;
