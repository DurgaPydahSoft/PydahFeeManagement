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

    // Fee components become columns; academic years become rows
    const feeHeadEntries = Object.entries(byHead);

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

            {/* Years (rows) × Fee heads (columns) */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '2px solid #000', marginBottom: '18px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={th('left', { width: '90px' })}>Year</th>
                        {feeHeadEntries.map(([fhId, row]) => (
                            <th
                                key={fhId}
                                style={th('left', {
                                    fontSize: '9px',
                                    textTransform: 'none',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                })}
                            >
                                {row.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {years.map((yr, rowIdx) => (
                        <tr key={yr} style={{ backgroundColor: rowIdx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                            <td style={{ ...td('left'), fontWeight: '900' }}>{yrSfx(yr)} Yr</td>
                            {feeHeadEntries.map(([fhId, row]) => (
                                <td key={`${yr}-${fhId}`} style={{ ...td('right'), fontWeight: '700' }}>
                                    {row.years[yr] !== undefined ? `₹${fmt(row.years[yr])}` : '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
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

            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` }} />
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

    const toSortNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const sortedReqs = [...requests].sort((a, b) => {
        const aCollege = String(a.college || 'Unknown');
        const bCollege = String(b.college || 'Unknown');
        const cCmp = aCollege.localeCompare(bCollege);
        if (cCmp !== 0) return cCmp;

        const aBatchN = toSortNum(a.batch);
        const bBatchN = toSortNum(b.batch);
        if (aBatchN !== null && bBatchN !== null) {
            if (aBatchN !== bBatchN) return aBatchN - bBatchN;
        } else {
            const bCmp = String(a.batch || '').localeCompare(String(b.batch || ''));
            if (bCmp !== 0) return bCmp;
        }

        const aCourse = String(a.course || '');
        const bCourse = String(b.course || '');
        const courseCmp = aCourse.localeCompare(bCourse);
        if (courseCmp !== 0) return courseCmp;

        const aBranch = String(a.branch || '');
        const bBranch = String(b.branch || '');
        return aBranch.localeCompare(bBranch);
    });

    const renderStudentMatrix = (req, yearsOverride, feeHeadEntriesOverride) => {
        const concessions = req.concessions || [];
        const studentYears = yearsOverride || [...new Set(concessions.map(c => Number(c.studentYear)))].filter(Boolean).sort((a, b) => a - b);

        const studentByHead = {};
        concessions.forEach(c => {
            const key = c.feeHeadId;
            if (!studentByHead[key]) {
                studentByHead[key] = {
                    name: c.feeHeadName || c.feeHeadCode || key,
                    code: c.feeHeadCode || '',
                    type: c.concessionType,
                    years: {}
                };
            }
            studentByHead[key].years[Number(c.studentYear)] = Number(c.amount ?? 0);
            studentByHead[key].type = c.concessionType;
            if (c.feeHeadName) studentByHead[key].name = c.feeHeadName;
        });

        const feeHeadEntries = (() => {
            if (Array.isArray(feeHeadEntriesOverride) && feeHeadEntriesOverride.length) {
                // Use group-wide fee-head order, but inject THIS student's per-year amounts.
                return feeHeadEntriesOverride.map(([fhId, base]) => {
                    const key = String(fhId);
                    const studentRow = studentByHead[key];
                    return [
                        key,
                        {
                            ...base,
                            years: studentRow?.years || {},
                            type: studentRow?.type ?? base.type
                        }
                    ];
                });
            }

            // Fallback: student-specific fee-head columns.
            return Object.entries(studentByHead).sort((x, y) => {
                const xn = String(x?.[1]?.name || '');
                const yn = String(y?.[1]?.name || '');
                return xn.localeCompare(yn);
            });
        })();

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', border: '1.5px solid #000', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        {/* Student name as the column header for the Year column */}
                        <th style={th('center', {
                            fontSize: '9px',
                            textTransform: 'uppercase',
                            width: '190px',
                            maxWidth: '190px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        })}>{req.studentName || 'Student'}</th>
                        {feeHeadEntries.map(([fhId, row]) => (
                            <th
                                key={fhId}
                                style={th('center', {
                                    fontSize: '8px',
                                    textTransform: 'none',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                })}
                            >
                                {row.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {studentYears.map((yr, idx) => (
                        <tr key={yr} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                            <td style={td('center', { fontWeight: '900', fontSize: '9px', width: '190px', maxWidth: '190px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', border: '1.5px solid #000' })}>{yrSfx(yr)} Yr</td>
                            {feeHeadEntries.map(([fhId, row]) => (
                                <td key={`${yr}-${fhId}`} style={td('center', { fontWeight: '700', fontSize: '9px', border: '1.5px solid #000' })}>
                                    {row.years[yr] !== undefined ? `₹${fmt(row.years[yr])}` : '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const compactBlocks = [];
    const groupKey = (req) => {
        const college = String(req.college || 'Unknown');
        const batch = String(req.batch || '');
        const course = String(req.course || '');
        const branch = String(req.branch || '');
        return `${college}|${batch}|${course}|${branch}`;
    };

    // Group by: College → Batch → Course → Branch
    const groups = [];
    let currentKey = null;
    let currentGroup = null;

    sortedReqs.forEach((req) => {
        const k = groupKey(req);
        if (k !== currentKey) {
            currentKey = k;
            currentGroup = {
                college: String(req.college || 'Unknown'),
                batch: String(req.batch || ''),
                course: String(req.course || ''),
                branch: String(req.branch || ''),
                reqs: []
            };
            groups.push(currentGroup);
        }
        currentGroup.reqs.push(req);
    });

    let prevCollege = null;
    let prevBatch = null;
    let prevCourse = null;
    let prevBranch = null;

    groups.forEach((group) => {
        // Group-wide union so every student's table has the same column structure.
        const yearsSet = new Set();
        const feeHeadMap = new Map(); // feeHeadId -> { name, code, type }

        group.reqs.forEach((req) => {
            (req.concessions || []).forEach((c) => {
                const yr = Number(c.studentYear);
                if (Number.isFinite(yr) && yr > 0) yearsSet.add(yr);

                const hid = String(c.feeHeadId);
                if (!feeHeadMap.has(hid)) {
                    feeHeadMap.set(hid, {
                        name: c.feeHeadName || c.feeHeadCode || hid,
                        code: c.feeHeadCode || '',
                        type: c.concessionType
                    });
                }
            });
        });

        const groupYears = [...yearsSet].sort((a, b) => a - b);
        const groupFeeHeadEntries = [...feeHeadMap.entries()].sort((a, b) => {
            return String(a[1]?.name || '').localeCompare(String(b[1]?.name || ''));
        });

        if (group.college !== prevCollege) {
            prevCollege = group.college;
            prevBatch = null;
            prevCourse = null;
            prevBranch = null;
            compactBlocks.push(
                <div key={`college-${group.college}`} style={{ marginTop: '14px' }}>
                    <div style={{ background: '#1e293b', color: '#fff', padding: '6px 12px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>
                        {group.college}
                    </div>
                </div>
            );
        }

        if (group.batch !== prevBatch) {
            prevBatch = group.batch;
            prevCourse = null;
            prevBranch = null;
            compactBlocks.push(
                <div key={`batch-${group.college}-${group.batch}`} style={{ marginLeft: '10px', marginTop: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Batch: {group.batch || '—'}</div>
                </div>
            );
        }

        if (group.course !== prevCourse) {
            prevCourse = group.course;
            prevBranch = null;
            compactBlocks.push(
                <div key={`course-${group.college}-${group.batch}-${group.course}`} style={{ marginLeft: '20px', marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Course: {group.course || '—'}</div>
                </div>
            );
        }

        if (group.branch !== prevBranch) {
            prevBranch = group.branch;
            compactBlocks.push(
                <div key={`branch-${group.college}-${group.batch}-${group.course}-${group.branch}`} style={{ marginLeft: '30px', marginTop: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Branch: {group.branch || '—'}</div>
                </div>
            );
        }

        group.reqs.forEach((req) => {
            compactBlocks.push(
                <div key={`student-${req._id || req.admissionNumber}`} style={{ marginLeft: '30px', marginTop: '6px', marginBottom: '12px', pageBreakInside: 'avoid' }}>
                    <div style={{ fontWeight: '900', fontSize: '10px', marginBottom: '2px' }}>
                        {req.studentName} · Adm: {req.admissionNumber}
                    </div>
                    <div style={{ fontSize: '8px', color: '#444', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {req.course || '—'} · {req.branch || '—'} · Batch {req.batch || '—'}
                    </div>
                    {renderStudentMatrix(req, groupYears, groupFeeHeadEntries)}
                </div>
            );
        });
    });

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px 30px', color: '#111', background: '#fff', minHeight: '297mm' }}>
            <Header subtitle="Overall Concession (Revised Fees) — Reports" />

            {/* Meta strip — NO date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '18px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <span>Filter: <span style={{ fontWeight: '900' }}>{filterLabel}</span></span>
                <span>Total Students: <span style={{ fontWeight: '900' }}>{rows.length}</span></span>
            </div>

            {/* Compact grouped student matrices (College → Batch → Course → Branch) */}
            <div>
                {compactBlocks}
            </div>

            <div style={{ marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                This is a computer-generated Overall Concession Report for internal records only.
            </div>

            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` }} />
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
    const reqs = props.requests || [];
    // If only one student is printed from the "All" view, render the single-student layout
    // (no summary + correct orientation).
    if (reqs.length === 1) {
        return <SingleStudentPrint request={reqs[0]} />;
    }
    return <AllStudentsPrint requests={reqs} filters={props.filters || {}} />;
};

export default OverallConcessionRegisterPrint;
