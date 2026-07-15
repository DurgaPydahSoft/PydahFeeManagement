const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const sqlPool = require('../config/sqlDb');
const Transaction = require('../models/Transaction');
const PaymentConfig = require('../models/PaymentConfig');

async function run() {
    console.log('--- Starting Account Mapping Dry Run Script ---');

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
        console.log(`Fetched ${configs.length} payment configuration accounts from MongoDB.`);
    } catch (err) {
        console.error('Failed to fetch payment configurations:', err);
        mongoose.connection.close();
        process.exit(1);
    }

    // 3. Fetch all Bank Transactions (DEBIT type, not Cash/Waiver/Adjustment/Credit)
    let transactions = [];
    try {
        transactions = await Transaction.find({
            transactionType: 'DEBIT',
            paymentMode: { $nin: ['Cash', 'Adjustment', 'Waiver', 'Refund', 'Credit'] }
        }).lean();
        console.log(`Fetched ${transactions.length} active bank debit transactions from MongoDB.`);
    } catch (err) {
        console.error('Failed to fetch transactions:', err);
        mongoose.connection.close();
        process.exit(1);
    }

    if (transactions.length === 0) {
        console.log('No bank transactions to map. Exiting.');
        mongoose.connection.close();
        process.exit(0);
    }

    // 4. Extract unique student IDs for SQL Lookup
    const studentIds = new Set();
    transactions.forEach(tx => {
        if (tx.studentId) {
            studentIds.add(tx.studentId.trim());
        }
    });
    console.log(`Identified ${studentIds.size} unique student IDs for SQL lookup.`);

    // 5. Query SQL Database in chunks or in one query
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
            console.log(`SQL Lookup completed: mapped details for ${students.length} students.`);
        } catch (sqlErr) {
            console.error('SQL Query failed:', sqlErr);
            mongoose.connection.close();
            process.exit(1);
        }
    }

    // Helper to find matching PaymentConfig
    const findMatchingConfig = (college, course) => {
        if (!college || !course) return null;
        
        const normCol = college.toLowerCase().trim();
        const normCourse = course.toLowerCase().trim();

        // Try exact match first
        let matches = configs.filter(c => 
            (c.college || '').toLowerCase().trim() === normCol && 
            (c.course || '').toLowerCase().trim() === normCourse
        );

        if (matches.length === 0) {
            // Fallback: match by college only if there is a general account
            matches = configs.filter(c => 
                (c.college || '').toLowerCase().trim() === normCol && 
                (!(c.course) || (c.course || '').toLowerCase().trim() === 'all' || (c.course || '').toLowerCase().trim() === '')
            );
        }

        if (matches.length === 0) return null;

        // If multiple matches, prioritize active ones
        const activeMatches = matches.filter(c => c.is_active);
        return activeMatches.length > 0 ? activeMatches[0] : matches[0];
    };

    let wouldUpdateCount = 0;
    let alreadyCorrectCount = 0;
    let noConfigMatchCount = 0;
    let studentNotFoundCount = 0;

    console.log('\n--- SCANNING TRANSACTIONS ---');

    transactions.forEach(tx => {
        const sId = tx.studentId ? tx.studentId.trim() : '';
        const studentInfo = studentMap[sId] || studentMap[sId.toLowerCase()];

        if (!studentInfo) {
            studentNotFoundCount++;
            console.log(`[NO STUDENT DETAIL] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | Current Account: "${tx.depositedToAccount || 'None'}"`);
            return;
        }

        const { college, course } = studentInfo;
        const matchingConfig = findMatchingConfig(college, course);

        if (!matchingConfig) {
            noConfigMatchCount++;
            console.log(`[NO MATCHING CONFIG] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | SQL Scope: College "${college}", Course "${course}" | Current Account: "${tx.depositedToAccount || 'None'}"`);
            return;
        }

        const currentConfigId = tx.paymentConfigId ? tx.paymentConfigId.toString() : '';
        const targetConfigId = matchingConfig._id.toString();

        if (currentConfigId !== targetConfigId) {
            wouldUpdateCount++;
            console.log(`[UPDATE PROPOSED] Receipt: ${tx.receiptNumber || 'N/A'} | Student: ${tx.studentName} (${tx.studentId}) | SQL Scope: College "${college}", Course "${course}" | Current Account: "${tx.depositedToAccount || 'None'}" => Proposed Account: "${matchingConfig.account_name}" (${matchingConfig.bank_name})`);
        } else {
            alreadyCorrectCount++;
        }
    });

    console.log('\n--- SUMMARY STATISTICS ---');
    console.log(`Total scanned transactions:            ${transactions.length}`);
    console.log(`Transactions already correct:          ${alreadyCorrectCount}`);
    console.log(`Transactions proposed for update:      ${wouldUpdateCount}`);
    console.log(`Transactions with no matching config:  ${noConfigMatchCount}`);
    console.log(`Transactions with missing SQL student: ${studentNotFoundCount}`);
    console.log('---------------------------\n');

    // Close connections
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    } catch (e) {}

    process.exit(0);
}

run();
