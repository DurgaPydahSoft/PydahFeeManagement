const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const sqlPool = require('../config/sqlDb');
const Transaction = require('../models/Transaction');
const PaymentConfig = require('../models/PaymentConfig');

async function run() {
    await connectDB();

    const configs = await PaymentConfig.find({}).lean();
    const transactions = await Transaction.find({
        transactionType: 'DEBIT',
        paymentMode: { $nin: ['Cash', 'Adjustment', 'Waiver', 'Refund', 'Credit'] }
    }).lean();

    const studentIds = new Set();
    transactions.forEach(tx => {
        if (tx.studentId) studentIds.add(tx.studentId.trim());
    });

    const studentMap = {};
    if (studentIds.size > 0) {
        const idList = Array.from(studentIds).map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const sqlQuery = `SELECT admission_number, pin_no, college, course FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`;
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
    }

    const findMatchingConfig = (college, course) => {
        if (!college || !course) return null;
        const normCol = college.toLowerCase().trim();
        const normCourse = course.toLowerCase().trim();

        let matches = configs.filter(c => 
            (c.college || '').toLowerCase().trim() === normCol && 
            (c.course || '').toLowerCase().trim() === normCourse
        );

        if (matches.length === 0) {
            matches = configs.filter(c => 
                (c.college || '').toLowerCase().trim() === normCol && 
                (!(c.course) || (c.course || '').toLowerCase().trim() === 'all' || (c.course || '').toLowerCase().trim() === '')
            );
        }
        return matches.length > 0 ? matches[0] : null;
    };

    const missingConfigsMap = {};
    transactions.forEach(tx => {
        const sId = tx.studentId ? tx.studentId.trim() : '';
        const studentInfo = studentMap[sId] || studentMap[sId.toLowerCase()];
        if (!studentInfo) return;

        const { college, course } = studentInfo;
        const matchingConfig = findMatchingConfig(college, course);

        if (!matchingConfig) {
            const key = `${college} | ${course}`;
            if (!missingConfigsMap[key]) {
                missingConfigsMap[key] = {
                    college,
                    course,
                    transactionCount: 0,
                    sampleTransactions: []
                };
            }
            const info = missingConfigsMap[key];
            info.transactionCount++;
            if (info.sampleTransactions.length < 3) {
                info.sampleTransactions.push({
                    studentName: tx.studentName,
                    studentId: tx.studentId,
                    receiptNo: tx.receiptNumber,
                    paymentMode: tx.paymentMode,
                    amount: tx.amount
                });
            }
        }
    });

    console.log('\n======================================================');
    console.log('       MISSING PAYMENT CONFIGURATIONS REPORT');
    console.log('======================================================');
    console.log('The following College + Course combinations have transactions');
    console.log('but have NO matching configuration added in Payment Configuration.\n');

    Object.values(missingConfigsMap).forEach((item, idx) => {
        console.log(`${idx + 1}. College: "${item.college}"`);
        console.log(`   Course:  "${item.course}"`);
        console.log(`   Affected Transactions Count: ${item.transactionCount}`);
        console.log(`   Sample Cases:`);
        item.sampleTransactions.forEach(t => {
            console.log(`     - Student: ${t.studentName} (${t.studentId}) | Receipt: ${t.receiptNo} | Amt: ${t.amount} (${t.paymentMode})`);
        });
        console.log('------------------------------------------------------');
    });

    await mongoose.connection.close();
    process.exit(0);
}

run();
