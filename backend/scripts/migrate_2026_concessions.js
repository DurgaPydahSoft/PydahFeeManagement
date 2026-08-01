const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const db = require('../config/sqlDb');
const FeeHead = require('../models/FeeHead');
const OverallConcessionRequest = require('../models/OverallConcessionRequest');
const StudentFee = require('../models/StudentFee');
const FeeStructure = require('../models/FeeStructure');
const { buildFeeHeadMaps, resolveStudentFeeAmount } = require('../utils/overallConcessionFees');
const { syncStandardFees } = require('../services/studentFeeSyncService');
const { applyRevisedConcessionTransactions } = require('../services/overallConcessionRevisedService');

const main = async () => {
    const isExecute = process.argv.includes('--execute');
    
    // Default to '2025', but allow override via --prefix=YYYY
    const prefixArg = process.argv.find(arg => arg.startsWith('--prefix='));
    const admissionPrefix = prefixArg ? prefixArg.split('=')[1] : '2025';

    console.log('='.repeat(80));
    console.log(`Starting Concession Migration (${admissionPrefix} Students) - MODE: ${isExecute ? 'EXECUTE/INSERT' : 'DRY RUN'}`);
    console.log('='.repeat(80));

    try {
        // 1. Connect MongoDB
        await connectDB();
        console.log('Connected to MongoDB.');

        // 2. Fetch Fee Heads & build maps
        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);
        console.log(`Loaded ${feeHeads.length} FeeHeads from MongoDB.`);

        // 3. Fetch matching concessions from SQL
        console.log(`Querying SQL for concessions starting with ${admissionPrefix}...`);
        const [rows] = await db.query(
            `SELECT * FROM overall_concessions WHERE admission_number LIKE ? ORDER BY id ASC`,
            [`${admissionPrefix}%`]
        );

        if (rows.length === 0) {
            console.log(`No SQL concessions found for students starting with ${admissionPrefix}.`);
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log(`Found ${rows.length} records in SQL table. Processing details...\n`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
            console.log(`--------------------------------------------------------------------------------`);
            console.log(`Student: ${row.student_name} (${row.admission_number})`);
            console.log(`Batch: ${row.batch} | Course: ${row.course} | Branch: ${row.branch}`);

            // Fetch live student quota (stud_type) and college from MySQL students table
            const [studentRows] = await db.query(
                `SELECT college, stud_type FROM students WHERE admission_number = ?`,
                [row.admission_number]
            );
            const studentDetails = studentRows[0] || {};
            const category = studentDetails.stud_type || 'Regular';
            const college = studentDetails.college || '';

            console.log(`Quota/Category: ${category} | College: ${college}`);

            let revisedFees = [];
            if (row.revised_fees) {
                revisedFees = typeof row.revised_fees === 'string' ? JSON.parse(row.revised_fees) : row.revised_fees;
            }

            if (!Array.isArray(revisedFees) || revisedFees.length === 0) {
                console.log('  -> No revised fees entries found. Skipping.');
                skippedCount++;
                continue;
            }

            // Map and validate fee heads
            const mappedConcessions = [];
            let hasError = false;

            console.log('  Concession Entries:');
            for (const fee of revisedFees) {
                const codeKey = (fee.feeHeadCode || '').trim().toUpperCase();
                let feeHeadId = fee.feeHeadId;

                // Resolve matching Mongo ObjectId from FeeHead code
                if (codeKey && codeMap[codeKey]) {
                    feeHeadId = codeMap[codeKey];
                }

                // Verify resolved ID is a valid MongoDB ObjectId
                if (!feeHeadId || !mongoose.Types.ObjectId.isValid(feeHeadId)) {
                    console.error(`  [ERROR] Cannot resolve Mongo ObjectId for fee head: "${fee.feeHeadCode || fee.feeHeadId}"`);
                    hasError = true;
                    continue;
                }

                mappedConcessions.push({
                    feeHeadId: String(feeHeadId),
                    feeHeadCode: fee.feeHeadCode || '',
                    studentYear: Number(fee.studentYear),
                    semester: fee.semester !== null ? Number(fee.semester) : null,
                    amount: Number(fee.amount),
                    concessionType: fee.concessionType === 'REVISED' ? 'REVISED' : 'CONCESSION'
                });

                console.log(`    - Head: ${fee.feeHeadCode || feeHeadId} | Year: ${fee.studentYear} | Sem: ${fee.semester || 'Year-wise'} | Amt: ₹${fee.amount} | Type: ${fee.concessionType}`);
            }

            if (hasError) {
                console.warn(`  [WARNING] Skipping student ${row.admission_number} due to unresolved fee head mapping.`);
                skippedCount++;
                continue;
            }

            if (isExecute) {
                // Check if MongoDB already has an approved request
                let approvedRequest = await OverallConcessionRequest.findOne({
                    admissionNumber: row.admission_number,
                    status: 'APPROVED'
                }).sort({ updatedAt: -1, createdAt: -1 });

                if (approvedRequest) {
                    approvedRequest.concessions = mappedConcessions;
                    approvedRequest.studentName = row.student_name;
                    approvedRequest.pinNo       = row.pin_no;
                    approvedRequest.college     = college || approvedRequest.college;
                    approvedRequest.course      = row.course;
                    approvedRequest.branch      = row.branch;
                    approvedRequest.batch       = row.batch;
                    approvedRequest.category    = category;
                    approvedRequest.requestedBy  = 'superadmin';
                    approvedRequest.requestedByName = 'Super Admin';
                    approvedRequest.approvedBy  = 'superadmin';
                    approvedRequest.approvedByName = 'Super Admin';
                    await approvedRequest.save();
                    console.log(`  -> Updated existing APPROVED request in MongoDB.`);
                } else {
                    approvedRequest = await OverallConcessionRequest.create({
                        admissionNumber: row.admission_number,
                        pinNo:           row.pin_no || '-',
                        studentName:     row.student_name,
                        college:         college,
                        course:          row.course,
                        branch:          row.branch,
                        batch:           row.batch,
                        category:        category,
                        concessions:     mappedConcessions,
                        status:          'APPROVED',
                        requestedBy:     'superadmin',
                        requestedByName: 'Super Admin',
                        approvedBy:      'superadmin',
                        approvedByName:  'Super Admin'
                    });
                    console.log(`  -> Created new APPROVED request in MongoDB.`);
                }

                // Propagate to StudentFee demands & transactions
                const standardFeesApplied = await StudentFee.exists({
                    studentId: row.admission_number,
                    academicYear: row.batch,
                    $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
                });

                if (standardFeesApplied) {
                    // Fetch full student row from SQL
                    const [students] = await db.query(
                        `SELECT id, admission_number, student_name, current_year, batch, current_semester, college, course, branch, stud_type
                         FROM students WHERE admission_number = ?`,
                        [row.admission_number]
                    );

                    if (students.length > 0) {
                        // Sync MongoDB demands
                        await syncStandardFees(students[0], row.admission_number);

                        // Post waivers for REVISED types
                        await applyRevisedConcessionTransactions({
                            admissionNumber: row.admission_number,
                            studentName: row.student_name,
                            college: college,
                            course: row.course,
                            branch: row.branch,
                            batch: row.batch,
                            category: category,
                            entries: mappedConcessions,
                            collectedBy: 'superadmin',
                            collectedByName: 'Super Admin',
                            codeMap
                        });
                        console.log(`  -> Successfully synced student fee demands and waiver transactions.`);
                    }
                }
            } else {
                console.log(`  -> [Dry Run] Will create/update APPROVED request in MongoDB with ${mappedConcessions.length} concessions.`);
            }

            migratedCount++;
        }

        console.log('\n' + '='.repeat(80));
        console.log(`Migration Summary:`);
        console.log(`- Total eligible students processed: ${rows.length}`);
        console.log(`- Migrated (or ready to migrate): ${migratedCount}`);
        console.log(`- Skipped / Errors: ${skippedCount}`);
        console.log('='.repeat(80));

        if (!isExecute) {
            console.log(`\nNOTE: This was a DRY RUN. No changes were saved to MongoDB.`);
            console.log('To write these records to MongoDB, please run:');
            console.log(`node backend/scripts/migrate_2026_concessions.js --execute --prefix=${admissionPrefix}\n`);
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error during migration:', error);
        process.exit(1);
    }
};

main();
