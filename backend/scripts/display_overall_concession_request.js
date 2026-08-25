/**
 * Inspect OverallConcessionRequest fee-head ID vs CODE consistency.
 *
 * Each concession stores both feeHeadId (ObjectId) and feeHeadCode.
 * This script looks those up independently in the FeeHead collection:
 *   - ObjectId  → actual name + code
 *   - stored code → actual name + ObjectId
 * and flags rows where they belong to different fee heads.
 *
 * Run from backend/:
 *   node scripts/display_overall_concession_request.js
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const db = require('../config/sqlDb');
const OverallConcessionRequest = require('../models/OverallConcessionRequest');
const FeeHead = require('../models/FeeHead');

const ADMISSION_NUMBER = '20261424';

const pad = (value, width) => {
    const text = value === null || value === undefined || value === '' ? '—' : String(value);
    return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
};

const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const fmtAmount = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(value ?? '—');
};

const normCode = (code) => String(code || '').trim().toUpperCase();

const run = async () => {
    console.log('\n======================================================');
    console.log('  OVERALL CONCESSION REQUESTS  —  ID vs CODE CHECK');
    console.log(`  Admission: ${ADMISSION_NUMBER}`);
    console.log('======================================================\n');

    await connectDB();

    const [studentRows] = await db.query(
        `SELECT admission_number, pin_no, student_name, college, course, branch, batch, stud_type, current_year, current_semester
         FROM students
         WHERE admission_number = ?`,
        [ADMISSION_NUMBER]
    );

    if (studentRows.length === 0) {
        console.log('No matching student in SQL students table.');
    } else {
        const s = studentRows[0];
        console.log('[SQL student]');
        console.log(`  Name     : ${s.student_name}`);
        console.log(`  Pin      : ${s.pin_no || '—'}`);
        console.log(`  College  : ${s.college}`);
        console.log(`  Course   : ${s.course} / ${s.branch}`);
        console.log(`  Batch    : ${s.batch}`);
        console.log(`  Quota    : ${s.stud_type || '—'}`);
        console.log(`  Year/Sem : ${s.current_year || '—'} / ${s.current_semester || '—'}`);
        console.log('');
    }

    const requests = await OverallConcessionRequest.find({
        admissionNumber: ADMISSION_NUMBER
    }).sort({ createdAt: 1 }).lean();

    if (requests.length === 0) {
        console.log('No OverallConcessionRequest documents found for this admission number.');
        await mongoose.connection.close();
        process.exit(0);
    }

    const feeHeads = await FeeHead.find({}).lean();
    const feeHeadById = {};
    const feeHeadsByCode = {};
    feeHeads.forEach((fh) => {
        feeHeadById[String(fh._id)] = fh;
        const code = normCode(fh.code);
        if (!code) return;
        if (!feeHeadsByCode[code]) feeHeadsByCode[code] = [];
        feeHeadsByCode[code].push(fh);
    });

    console.log(`[FeeHead collection] ${feeHeads.length} head(s) loaded`);
    console.log(`[Mongo requests]     ${requests.length} document(s)\n`);

    const mismatches = [];
    const unresolvedIds = [];
    const unresolvedCodes = [];

    requests.forEach((req, idx) => {
        console.log('='.repeat(140));
        console.log(`REQUEST ${idx + 1} of ${requests.length}`);
        console.log('='.repeat(140));
        console.log(`  _id              : ${req._id}`);
        console.log(`  Status           : ${req.status}`);
        console.log(`  Student (stored) : ${req.studentName} | Pin ${req.pinNo || '—'}`);
        console.log(`  Snapshot         : ${req.college} | ${req.course} / ${req.branch} | Batch ${req.batch} | Quota ${req.category || '—'}`);
        console.log(`  Requested by     : ${req.requestedByName || req.requestedBy || '—'}  (${fmtDate(req.createdAt)})`);
        console.log(`  Approved by      : ${req.approvedByName || req.approvedBy || '—'}  given by: ${req.concessionGivenBy || '—'}`);
        console.log(`  Updated at       : ${fmtDate(req.updatedAt)}`);
        if (req.rejectionReason) console.log(`  Rejection reason : ${req.rejectionReason}`);

        const entries = Array.isArray(req.concessions) ? req.concessions : [];
        console.log(`\n  Stored entries: ${entries.length}`);
        console.log('  (ID lookup and CODE lookup are independent — MISMATCH means they point at different fee heads)\n');
        console.log('  ' + '-'.repeat(138));
        console.log(
            '  ' +
            pad('#', 3) +
            pad('Yr', 4) +
            pad('Amt', 12) +
            pad('Type', 10) +
            pad('Stored ID', 26) +
            pad('ID → Name', 22) +
            pad('ID → Code', 12) +
            pad('Stored Code', 12) +
            pad('Code → Name', 22) +
            pad('Code → ID', 26) +
            'Verdict'
        );
        console.log('  ' + '-'.repeat(138));

        if (entries.length === 0) {
            console.log('  (no concession entries on this request)');
        } else {
            entries.forEach((entry, i) => {
                const storedId = String(entry.feeHeadId || '').trim();
                const storedCode = normCode(entry.feeHeadCode);

                const byId = storedId ? feeHeadById[storedId] : null;
                const byCodeList = storedCode ? (feeHeadsByCode[storedCode] || []) : [];
                const byCode = byCodeList[0] || null;

                const idName = byId?.name || (storedId ? 'NOT FOUND' : '—');
                const idCode = byId?.code || (storedId && !byId ? 'NOT FOUND' : '—');
                const codeName = byCode?.name || (storedCode ? 'NOT FOUND' : '—');
                const codeId = byCode ? String(byCode._id) : (storedCode ? 'NOT FOUND' : '—');

                let verdict = 'OK';
                if (!storedId && !storedCode) {
                    verdict = 'BOTH EMPTY';
                } else if (storedId && !byId) {
                    verdict = 'ID NOT IN FEEHEADS';
                    unresolvedIds.push({ storedId, storedCode, year: entry.studentYear });
                } else if (storedCode && !byCode) {
                    verdict = 'CODE NOT IN FEEHEADS';
                    unresolvedCodes.push({ storedId, storedCode, year: entry.studentYear });
                } else if (byId && byCode && String(byId._id) !== String(byCode._id)) {
                    verdict = 'MISMATCH — ID and CODE are different fee heads';
                    mismatches.push({
                        requestId: String(req._id),
                        year: entry.studentYear,
                        amount: entry.amount,
                        storedId,
                        storedCode,
                        idName: byId.name,
                        idCode: byId.code,
                        codeName: byCode.name,
                        codeId: String(byCode._id)
                    });
                } else if (byId && storedCode && normCode(byId.code) !== storedCode) {
                    verdict = 'MISMATCH — ID head code differs from stored code';
                    mismatches.push({
                        requestId: String(req._id),
                        year: entry.studentYear,
                        amount: entry.amount,
                        storedId,
                        storedCode,
                        idName: byId.name,
                        idCode: byId.code,
                        codeName: byCode ? byCode.name : '(no code match)',
                        codeId: byCode ? String(byCode._id) : '—'
                    });
                } else if (byCodeList.length > 1) {
                    verdict = `AMBIGUOUS CODE (${byCodeList.length} heads share this code)`;
                }

                console.log(
                    '  ' +
                    pad(i + 1, 3) +
                    pad(entry.studentYear, 4) +
                    pad(fmtAmount(entry.amount), 12) +
                    pad(entry.concessionType || 'CONCESSION', 10) +
                    pad(storedId || '—', 26) +
                    pad(idName, 22) +
                    pad(idCode, 12) +
                    pad(entry.feeHeadCode || '—', 12) +
                    pad(codeName, 22) +
                    pad(codeId, 26) +
                    verdict
                );
            });
        }
        console.log('  ' + '-'.repeat(138));
        console.log('');
    });

    console.log('='.repeat(140));
    console.log('ID vs CODE MISMATCHES');
    console.log('='.repeat(140));
    if (mismatches.length === 0) {
        console.log('  None. Every stored ObjectId and stored feeHeadCode point at the same FeeHead.');
    } else {
        mismatches.forEach((m, i) => {
            console.log(`\n  ${i + 1}. Year ${m.year}  amount ${fmtAmount(m.amount)}  request ${m.requestId}`);
            console.log(`     Stored feeHeadId   : ${m.storedId}`);
            console.log(`       → FeeHead name   : ${m.idName}`);
            console.log(`       → FeeHead code   : ${m.idCode}`);
            console.log(`     Stored feeHeadCode : ${m.storedCode}`);
            console.log(`       → FeeHead name   : ${m.codeName}`);
            console.log(`       → FeeHead _id    : ${m.codeId}`);
        });
    }

    if (unresolvedIds.length || unresolvedCodes.length) {
        console.log('\n--- Unresolved lookups ---');
        unresolvedIds.forEach((u) => {
            console.log(`  ID not in FeeHeads  : ${u.storedId}  (stored code ${u.storedCode || '—'}, year ${u.year})`);
        });
        unresolvedCodes.forEach((u) => {
            console.log(`  Code not in FeeHeads: ${u.storedCode}  (stored id ${u.storedId || '—'}, year ${u.year})`);
        });
    }

    const duplicateCodes = Object.entries(feeHeadsByCode).filter(([, list]) => list.length > 1);
    console.log('\n' + '='.repeat(140));
    console.log('FEEHEAD COLLECTION — DUPLICATE CODES (can make stored code point at the wrong head)');
    console.log('='.repeat(140));
    if (duplicateCodes.length === 0) {
        console.log('  None. Each fee-head code maps to exactly one FeeHead.');
    } else {
        duplicateCodes.forEach(([code, list]) => {
            console.log(`  Code ${code} is used by ${list.length} fee heads:`);
            list.forEach((fh) => {
                console.log(`    - ${fh.name}  _id=${fh._id}  code=${fh.code}`);
            });
        });
    }

    const requestedIds = new Set();
    const requestedCodes = new Set();
    requests.forEach((req) => {
        (req.concessions || []).forEach((e) => {
            if (e.feeHeadId) requestedIds.add(String(e.feeHeadId).trim());
            if (e.feeHeadCode) requestedCodes.add(normCode(e.feeHeadCode));
        });
    });

    console.log('\n' + '='.repeat(140));
    console.log('CATALOG ROWS FOR IDS / CODES USED IN THIS REQUEST');
    console.log('='.repeat(140));
    console.log(
        pad('Lookup', 10) +
        pad('Key', 28) +
        pad('FeeHead Name', 32) +
        pad('Catalog Code', 14) +
        'Catalog _id'
    );
    console.log('-'.repeat(140));
    requestedIds.forEach((id) => {
        const fh = feeHeadById[id];
        console.log(
            pad('by ID', 10) +
            pad(id, 28) +
            pad(fh?.name || 'NOT FOUND', 32) +
            pad(fh?.code || '—', 14) +
            (fh ? String(fh._id) : '—')
        );
    });
    requestedCodes.forEach((code) => {
        const list = feeHeadsByCode[code] || [];
        if (list.length === 0) {
            console.log(
                pad('by CODE', 10) +
                pad(code, 28) +
                pad('NOT FOUND', 32) +
                pad(code, 14) +
                '—'
            );
        } else {
            list.forEach((fh) => {
                console.log(
                    pad('by CODE', 10) +
                    pad(code, 28) +
                    pad(fh.name, 32) +
                    pad(fh.code, 14) +
                    String(fh._id)
                );
            });
        }
    });
    console.log('-'.repeat(140));
    console.log(`\nDone. mismatches=${mismatches.length}  unresolvedIds=${unresolvedIds.length}  unresolvedCodes=${unresolvedCodes.length}\n`);

    await mongoose.connection.close();
    process.exit(0);
};

run().catch(async (err) => {
    console.error('Script failed:', err);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
