/**
 * Print one student's due the same way Due Reports page calculates it.
 *
 * Usage (from backend folder):
 *   node scripts/printStudentDueReport.js
 *   node scripts/printStudentDueReport.js 20240132
 *   node scripts/printStudentDueReport.js "24320-M-002"
 *   node scripts/printStudentDueReport.js 20240132 --with-sch
 *
 * Default scholarship mode = Without Sch (excludeScholarship=true), matching the UI toggle.
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
require('../config/sqlDb'); // init MySQL pools
// Register models used by getDueReports (populate / mongoose.model)
require('../models/FeeHead');
require('../models/StudentFee');
require('../models/Transaction');
require('../models/FeeStructure');
require('../models/ServiceLateFeeConfig');
require('../models/DefaultLateFeeConfig');
const { getDueReports } = require('../controllers/reportsController');

const args = process.argv.slice(2).filter((a) => a && !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const search = args[0] || '20240132';
const withScholarship = flags.has('--with-sch'); // UI "With Sch"
const excludeScholarship = !withScholarship; // UI default "Without Sch"

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const applyScholarshipToggle = (student, excludeSch) => {
    if (!excludeSch) return student;

    const isStudentScholarEligible = String(student.scholarshipStatus || '').toLowerCase() === 'eligible';
    // Without-Sch only changes amounts for scholarship-eligible students
    if (!isStudentScholarEligible) return student;

    let totalFee = 0;
    let paidAmount = 0;
    let concessionAmount = 0;
    const studentTermDues = {};
    const feeDetailsMap = {};
    const catSums = {
        academic: { total: 0, paid: 0, concession: 0, due: 0, termsMap: {} },
        hostel: { total: 0, paid: 0, concession: 0, due: 0, termsMap: {} },
        transport: { total: 0, paid: 0, concession: 0, due: 0, termsMap: {} },
    };

    const getCategoryKey = (item) => {
        const code = String(item.feeHeadCode || '').toUpperCase();
        if (code === 'HST01') return 'hostel';
        if (code === 'TRN' || code === 'TRN01') return 'transport';
        return 'academic';
    };

    (student.rawGroupedData || []).forEach((item) => {
        const feeCode = String(item.feeHeadCode || '').toUpperCase();
        const isServiceFee = feeCode === 'HST01' || feeCode === 'TRN' || feeCode === 'TRN01';
        const shouldExclude =
            excludeSch && isStudentScholarEligible && item.isScholarshipApplicable && !isServiceFee;
        if (shouldExclude) return;

        totalFee += item.totalAmount || 0;
        paidAmount += item.paidAmount || 0;
        concessionAmount += item.concessionAmount || 0;

        const itemBalance = Math.max(
            0,
            (item.totalAmount || 0) - (item.paidAmount || 0) - (item.concessionAmount || 0)
        );
        const termsCount = item.terms?.length || 1;
        if (itemBalance > 0) {
            for (let i = 1; i <= termsCount; i++) {
                if (!studentTermDues[i]) studentTermDues[i] = 0;
                const termObj = item.terms?.find((t) => Number(t.termNumber) === i);
                if (termObj) {
                    const termTarget = termObj.amount || 0;
                    const originalTotal = item.totalAmount || 1;
                    studentTermDues[i] += itemBalance * (termTarget / originalTotal);
                } else {
                    studentTermDues[i] += itemBalance / termsCount;
                }
            }
        }

        const headIdStr = String(item.feeHeadId || 'unknown');
        if (!feeDetailsMap[headIdStr]) {
            feeDetailsMap[headIdStr] = {
                total: 0,
                paid: 0,
                due: 0,
                headName: item.feeHeadName || 'Unknown',
                headCode: item.feeHeadCode || '',
            };
        }
        feeDetailsMap[headIdStr].total += item.totalAmount || 0;
        feeDetailsMap[headIdStr].paid += item.paidAmount || 0;
        feeDetailsMap[headIdStr].due += itemBalance;

        const catKey = getCategoryKey(item);
        const catSum = catSums[catKey];
        catSum.total += item.totalAmount || 0;
        catSum.paid += item.paidAmount || 0;
        catSum.concession += item.concessionAmount || 0;
        catSum.due += itemBalance;

        for (let i = 1; i <= termsCount; i++) {
            if (!catSum.termsMap[i]) {
                catSum.termsMap[i] = {
                    termNumber: i,
                    termTarget: 0,
                    balance: 0,
                    dueDate: null,
                    isActiveTerm: false,
                };
            }
            const termObj = item.terms?.find((t) => Number(t.termNumber) === i);
            const termTarget = termObj ? termObj.amount || 0 : 0;
            const originalTotal = item.totalAmount || 1;
            const ratio = termObj ? termTarget / originalTotal : 1 / termsCount;
            catSum.termsMap[i].termTarget += termTarget;
            catSum.termsMap[i].balance += itemBalance * ratio;
            const origTerm = student.groupedFeeDetails?.[catKey]?.terms?.find(
                (t) => Number(t.termNumber) === i
            );
            if (origTerm) {
                catSum.termsMap[i].dueDate = origTerm.dueDate;
                catSum.termsMap[i].isActiveTerm = origTerm.isActiveTerm;
            }
        }
    });

    const maxTermNum = Math.max(1, ...Object.keys(studentTermDues).map(Number), 0);
    const termDues = [];
    const termDueDates = [];
    for (let i = 1; i <= maxTermNum; i++) {
        termDues.push(studentTermDues[i] || 0);
        // Prefer original report dates; fall back to category term dates
        let date = (student.termDueDates || [])[i - 1] || null;
        if (!date) {
            for (const cat of [catSums.academic, catSums.hostel, catSums.transport]) {
                if (cat.termsMap[i]?.dueDate) {
                    date = cat.termsMap[i].dueDate;
                    break;
                }
            }
        }
        termDueDates.push(date);
    }

    // Match DueReports.jsx: when without-sch, keep original totalFee unless fee-head filter
    const dueAmount = Math.max(0, student.totalFee - paidAmount - concessionAmount);

    let activeDue = 0;
    [catSums.academic, catSums.hostel, catSums.transport].forEach((catSum) => {
        Object.values(catSum.termsMap).forEach((term) => {
            if (term.isActiveTerm) activeDue += term.balance || 0;
        });
    });

    return {
        ...student,
        paidAmount,
        concessionAmount,
        dueAmount,
        activeDue,
        termDues,
        termDueDates,
    };
};

const run = async () => {
    console.log('\n======================================================');
    console.log('  STUDENT DUE REPORT (same logic as Due Reports page)');
    console.log(`  Search           : ${search}`);
    console.log(`  Scholarship mode : ${excludeScholarship ? 'Without Sch (default UI)' : 'With Sch'}`);
    console.log('======================================================\n');

    await connectDB();

    const rows = await new Promise((resolve, reject) => {
        const req = {
            query: {
                search,
                // Include all statuses so search finds the student regardless of Regular filter
                studentStatus: 'All',
            },
            user: { role: 'superadmin', permissions: ['/due-reports'] },
        };
        const res = {
            json: (data) => resolve(data),
            status: (code) => ({
                json: (data) => reject(Object.assign(new Error(data?.message || `HTTP ${code}`), { data, code })),
            }),
        };
        getDueReports(req, res).catch(reject);
    });

    if (!Array.isArray(rows) || rows.length === 0) {
        console.log('No student found for this search.');
        await mongoose.connection.close();
        process.exit(0);
    }

    // Prefer exact admission / pin match when multiple rows return
    const needle = String(search).trim().toLowerCase();
    let student =
        rows.find(
            (r) =>
                String(r.admission_number || '').trim().toLowerCase() === needle ||
                String(r.pin_no || '').trim().toLowerCase() === needle
        ) || rows[0];

    if (rows.length > 1) {
        console.log(`Found ${rows.length} row(s); using:`);
        rows.forEach((r, i) => {
            console.log(
                `  [${i}] ${r.admission_number} | ${r.pin_no || '-'} | ${r.student_name} | due=${money(r.dueAmount)}`
            );
        });
        console.log('');
    }

    student = applyScholarshipToggle(student, excludeScholarship);

    const termDues = student.termDues || [];
    const termDueDates = student.termDueDates || [];
    console.log('--- Student (table row) ---');
    console.log(`PIN / Adm No     : ${student.pin_no || '-'}  /  ${student.admission_number || '-'}`);
    console.log(`Name             : ${student.student_name || '-'}`);
    console.log(`College / Course : ${student.college || '-'} / ${student.course || '-'}`);
    console.log(`Branch / Batch   : ${student.branch || '-'} / ${student.batch || '-'}`);
    console.log(`Year / Quota     : ${student.current_year || '-'} / ${student.stud_type || '-'}`);
    console.log(`Scholarship      : ${student.scholarshipStatus || '-'}`);
    console.log('');
    console.log(`Total Fee        : ${money(student.totalFee)}`);
    console.log(`Total Paid       : ${money(student.paidAmount)}`);
    termDues.forEach((amt, i) => {
        const dueDate = termDueDates[i] || '-';
        console.log(`T${i + 1} Due           : ${money(amt)}   (due date: ${dueDate})`);
    });
    console.log(`Active Due       : ${money(student.activeDue)}`);
    console.log(`Due              : ${money(student.dueAmount)}`);
    console.log(`Concession       : ${money(student.concessionAmount)}`);

    console.log('\n--- Term dates (same columns as Due Reports) ---');
    if (termDues.length === 0) {
        console.log('(no terms)');
    } else {
        termDues.forEach((amt, i) => {
            console.log(
                `  T${i + 1}: due date = ${termDueDates[i] || '-'}  |  due amount = ${money(amt)}`
            );
        });
    }

    // Also show category terms (may use mapped columns e.g. T1 + T3)
    console.log('\n--- Term dates by category ---');
    ['academic', 'hostel', 'transport'].forEach((key) => {
        const g = student.groupedFeeDetails?.[key];
        if (!g?.terms?.length) return;
        console.log(`  ${key}:`);
        g.terms.forEach((t) => {
            console.log(
                `    T${t.termNumber}: due date = ${t.dueDate || '-'}  |  target = ${money(t.termTarget)}  |  balance = ${money(t.balance)}  |  active = ${!!t.isActiveTerm}`
            );
        });
    });

    console.log('\n--- Fee head breakdown (rawGroupedData, after sch toggle) ---');
    const isEligible = String(student.scholarshipStatus || '').toLowerCase() === 'eligible';
    const items = (student.rawGroupedData || []).filter((item) => {
        if (!excludeScholarship) return true;
        const feeCode = String(item.feeHeadCode || '').toUpperCase();
        const isServiceFee = feeCode === 'HST01' || feeCode === 'TRN' || feeCode === 'TRN01';
        const shouldExclude = isEligible && item.isScholarshipApplicable && !isServiceFee;
        return !shouldExclude;
    });

    if (items.length === 0) {
        console.log('(no fee lines)');
    } else {
        console.log(
            [
                'Fee Head'.padEnd(28),
                'Code'.padEnd(8),
                'Year'.padEnd(6),
                'Total'.padStart(12),
                'Paid'.padStart(12),
                'Conc.'.padStart(12),
                'Due'.padStart(12),
                'Sch?'.padStart(6),
            ].join(' ')
        );
        console.log('-'.repeat(100));
        items.forEach((item) => {
            const due = Math.max(
                0,
                (item.totalAmount || 0) - (item.paidAmount || 0) - (item.concessionAmount || 0)
            );
            console.log(
                [
                    String(item.feeHeadName || '-').slice(0, 28).padEnd(28),
                    String(item.feeHeadCode || '-').slice(0, 8).padEnd(8),
                    String(item.studentYear || '-').padEnd(6),
                    money(item.totalAmount).padStart(12),
                    money(item.paidAmount).padStart(12),
                    money(item.concessionAmount).padStart(12),
                    money(due).padStart(12),
                    (item.isScholarshipApplicable ? 'Y' : 'N').padStart(6),
                ].join(' ')
            );
        });
    }

    console.log('\n--- Category summary ---');
    ['academic', 'hostel', 'transport'].forEach((key) => {
        const g = student.groupedFeeDetails?.[key];
        if (!g) return;
        console.log(
            `${key.padEnd(10)} total=${money(g.total)} paid=${money(g.paid)} conc=${money(g.concession)} due=${money(g.due)}`
        );
        (g.terms || []).forEach((t) => {
            console.log(
                `  T${t.termNumber}: target=${money(t.termTarget)} balance=${money(t.balance)} active=${!!t.isActiveTerm} dueDate=${t.dueDate || '-'}`
            );
        });
    });

    console.log('\nDone.\n');
    await mongoose.connection.close();
    process.exit(0);
};

run().catch(async (err) => {
    console.error('\nScript failed:', err.message || err);
    if (err.stack) console.error(err.stack);
    try {
        await mongoose.connection.close();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
