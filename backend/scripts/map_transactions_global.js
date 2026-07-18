const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const sqlPool = require('../config/sqlDb');
const Transaction = require('../models/Transaction');
const PaymentConfig = require('../models/PaymentConfig');

// Check if we should execute or just dry-run
const executeUpdate = process.argv.includes('--execute');

async function run() {
    console.log(`======================================================`);
    console.log(`   GLOBAL TRANSACTION ACCOUNT MAPPING SCRIPT`);
    console.log(`   Mode: ${executeUpdate ? '🔴 EXECUTE (WRITING TO DB)' : '🟢 DRY RUN (NO CHANGES)'}`);
    console.log(`======================================================`);

    // 1. Connect MongoDB
    try {
        await connectDB();
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }

    // 2. Fetch all Payment Configurations
    let configs = [];
    try {
        configs = await PaymentConfig.find({}).lean();
        console.log(`Loaded ${configs.length} active payment configurations from MongoDB.`);
    } catch (err) {
        console.error('Failed to fetch payment configurations:', err);
        mongoose.connection.close();
        process.exit(1);
    }

    // Find the global config as a final fallback if any
    const globalConfig = configs.find(c => c.is_global);
    if (globalConfig) {
        console.log(`Global Fallback Config detected: "${globalConfig.account_name}" (${globalConfig.bank_name})`);
    }

    // 3. Fetch all active unmapped bank debit transactions
    // Conditions: DEBIT type, not Cash/Adjustments/Credits, and paymentConfigId is null or missing.
    let transactions = [];
    try {
        transactions = await Transaction.find({
            transactionType: 'DEBIT',
            paymentMode: { $nin: ['Cash', 'Adjustment', 'Waiver', 'Refund', 'Credit'] },
            $or: [
                { paymentConfigId: null },
                { paymentConfigId: { $exists: false } }
            ]
        }).lean();
        console.log(`Found ${transactions.length} unmapped bank debit transactions in MongoDB.`);
    } catch (err) {
        console.error('Failed to fetch unmapped transactions:', err);
        mongoose.connection.close();
        process.exit(1);
    }

    if (transactions.length === 0) {
        console.log('No unmapped bank transactions found. Exiting.');
        mongoose.connection.close();
        process.exit(0);
    }

    // 4. Gather unique student IDs for SQL lookup
    const studentIds = new Set();
    transactions.forEach(tx => {
        if (tx.studentId) {
            studentIds.add(String(tx.studentId).trim());
        }
    });
    console.log(`Identified ${studentIds.size} unique student IDs for SQL details retrieval.`);

    // 5. Query SQL for student details
    const studentMap = {};
    if (studentIds.size > 0) {
        const idList = Array.from(studentIds).map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const sqlQuery = `SELECT admission_number, pin_no, college, course FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`;
        
        try {
            const [students] = await sqlPool.query(sqlQuery);
            students.forEach(s => {
                const sData = {
                    college: (s.college || '').trim(),
                    course: (s.course || '').trim()
                };
                const adm = String(s.admission_number).trim();
                studentMap[adm] = sData;
                studentMap[adm.toLowerCase()] = sData;
                if (s.pin_no) {
                    const pin = String(s.pin_no).trim();
                    studentMap[pin] = sData;
                    studentMap[pin.toLowerCase()] = sData;
                }
            });
            console.log(`SQL query completed: mapped details for ${students.length} student records.`);
        } catch (sqlErr) {
            console.error('SQL query failed:', sqlErr);
            mongoose.connection.close();
            process.exit(1);
        }
    }

    // Helper to find the matching payment config
    const findMatchingConfig = (college, course) => {
        if (!college || !course) return null;
        
        const normCol = college.toLowerCase().trim();
        const normCourse = course.toLowerCase().trim();

        // Exact Match: College + Course
        let matches = configs.filter(c => 
            (c.college || '').toLowerCase().trim() === normCol && 
            (c.course || '').toLowerCase().trim() === normCourse
        );

        // Fallback: College Only (Global/All Course configuration)
        if (matches.length === 0) {
            matches = configs.filter(c => 
                (c.college || '').toLowerCase().trim() === normCol && 
                (!(c.course) || (c.course || '').toLowerCase().trim() === 'all' || (c.course || '').toLowerCase().trim() === '')
            );
        }

        if (matches.length === 0) return null;

        // Prioritize active matched config
        const activeMatches = matches.filter(c => c.is_active);
        return activeMatches.length > 0 ? activeMatches[0] : matches[0];
    };

    let successfullyMapped = 0;
    let successfullyMappedAmount = 0;
    let noConfigMatch = 0;
    let noConfigMatchAmount = 0;
    let studentNotFound = 0;
    let studentNotFoundAmount = 0;

    const totalScannedAmount = transactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);

    console.log('\n--- SCANNING UNMAPPED TRANSACTIONS ---');

    for (const tx of transactions) {
        const sId = tx.studentId ? String(tx.studentId).trim() : '';
        const studentInfo = studentMap[sId] || studentMap[sId.toLowerCase()];

        if (!studentInfo) {
            studentNotFound++;
            studentNotFoundAmount += (tx.amount || 0);
            console.log(`[NO STUDENT DETAIL] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | Mapped By Cashier: ${tx.collectedByName || tx.collectedBy}`);
            continue;
        }

        const { college, course } = studentInfo;
        const matchingConfig = findMatchingConfig(college, course);

        if (!matchingConfig) {
            noConfigMatch++;
            noConfigMatchAmount += (tx.amount || 0);
            console.log(`[NO CONFIG MATCH] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | SQL Scope: College "${college}", Course "${course}"`);
            continue;
        }

        successfullyMapped++;
        successfullyMappedAmount += (tx.amount || 0);
        console.log(`[MAPPING PROPOSED] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | Scope: "${college}" - "${course}" => Config: "${matchingConfig.account_name}" (${matchingConfig.bank_name})`);

        if (executeUpdate) {
            try {
                await Transaction.updateOne(
                    { _id: tx._id },
                    { 
                        $set: { 
                            paymentConfigId: matchingConfig._id,
                            depositedToAccount: matchingConfig.account_name 
                        } 
                    }
                );
            } catch (updateErr) {
                console.error(`Error updating transaction ${tx.receiptNumber}:`, updateErr.message);
            }
        }
    }

    console.log('\n======================================================');
    console.log(`   SUMMARY STATISTICS`);
    console.log(`======================================================`);
    console.log(`Total scanned unmapped transactions:   ${transactions.length} (Amt: ₹${totalScannedAmount.toLocaleString('en-IN')})`);
    console.log(`Proposed to map to config account:     ${successfullyMapped} (Amt: ₹${successfullyMappedAmount.toLocaleString('en-IN')})`);
    console.log(`No config matching college/course:     ${noConfigMatch} (Amt: ₹${noConfigMatchAmount.toLocaleString('en-IN')})`);
    console.log(`Student details missing in SQL:        ${studentNotFound} (Amt: ₹${studentNotFoundAmount.toLocaleString('en-IN')})`);
    console.log(`======================================================\n`);

    // Close MongoDB connection
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    } catch (e) {}

    process.exit(0);
}

run();
