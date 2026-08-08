const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const db = require('../config/sqlDb');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const FeeHead = require('../models/FeeHead');

const run = async () => {
  const searchName = 'KONDREDDI JAGADEESH SAI TEJA';
  const searchAdmn = '20261013';

  console.log(`\n======================================================`);
  console.log(`   FETCHING TRANSACTIONS FOR STUDENT`);
  console.log(`   Name: ${searchName}`);
  console.log(`   Admn: ${searchAdmn}`);
  console.log(`======================================================`);

  console.log('Connecting to databases...');
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB Connection Failed:', err);
    process.exit(1);
  }

  try {
    // 1. Resolve student info from SQL
    console.log('\n[1/3] Querying Student details in SQL database...');
    const [sqlRows] = await db.query(
      `SELECT admission_number, pin_no, student_name, college, course, branch, current_year 
       FROM students 
       WHERE admission_number = ? OR student_name LIKE ?`,
      [searchAdmn, `%${searchName}%`]
    );

    if (!sqlRows || sqlRows.length === 0) {
      console.log('❌ No student found in SQL matching these criteria.');
      mongoose.connection.close();
      process.exit(0);
    }

    const student = sqlRows[0];
    const admnNo = (student.admission_number || '').trim();
    const pinNo = (student.pin_no || '').trim();

    console.log(`   ✅ Found Student in SQL:`);
    console.log(`      Name        : ${student.student_name}`);
    console.log(`      Admn No     : ${admnNo}`);
    console.log(`      PIN No      : ${pinNo || 'N/A'}`);
    console.log(`      College     : ${student.college}`);
    console.log(`      Course/Branch: ${student.course} - ${student.branch} (Year: ${student.current_year})`);

    // 2. Fetch cashiers for mapping
    console.log('\n[2/3] Fetching users list for cashier mapping...');
    const users = await User.find({}).lean();
    const userIdMap = {};
    const userIdNameMap = {};
    users.forEach(u => {
      const uid = String(u._id);
      if (u.username) userIdMap[uid] = u.username;
      if (u.name) userIdNameMap[uid] = u.name;
    });

    // 3. Query transactions in MongoDB matching the student
    console.log('\n[3/3] Querying MongoDB Transactions...');
    const queryIds = new Set();
    [admnNo, pinNo, searchAdmn].filter(Boolean).forEach(id => {
      queryIds.add(id.trim());
      queryIds.add(id.trim().toLowerCase());
      queryIds.add(id.trim().toUpperCase());
    });
    const finalQueryIds = Array.from(queryIds);

    const txns = await Transaction.find({
      $or: [
        { studentId: { $in: finalQueryIds } },
        { pinNo: { $in: finalQueryIds } },
        { admissionNumber: { $in: finalQueryIds } }
      ]
    })
      .populate('feeHead', 'name')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`   Found ${txns.length} total transactions in MongoDB.`);

    if (txns.length === 0) {
      console.log('   ℹ️ No transactions exist for this student in MongoDB.');
    } else {
      console.log(`\n------------------------------------------------------`);
      console.log(`   MONGODB TRANSACTIONS LIST`);
      console.log(`------------------------------------------------------`);
      txns.forEach((tx, idx) => {
        const dateStr = tx.paymentDate ? new Date(tx.paymentDate).toLocaleDateString('en-IN') : 'N/A';
        const feeHeadName = tx.feeHead ? tx.feeHead.name : 'Unknown';
        
        // Resolve cashier details
        const cbStr = String(tx.collectedBy || '');
        let collectorName = tx.collectedByName || tx.collectedBy || 'Unknown';
        if (userIdMap[cbStr]) {
          collectorName = userIdNameMap[cbStr] || userIdMap[cbStr];
        }

        console.log(`\n[${idx + 1}] Receipt No   : ${tx.receiptNumber || 'N/A'}`);
        console.log(`    Date         : ${dateStr}`);
        console.log(`    Amount       : Rs. ${tx.amount}`);
        console.log(`    Fee Head     : ${feeHeadName}`);
        console.log(`    Payment Mode : ${tx.paymentMode}`);
        console.log(`    Status       : ${tx.status ? tx.status.toUpperCase() : 'ACTIVE'}`);
        console.log(`    Collected By : ${collectorName}`);
        if (tx.remarks) {
          console.log(`    Remarks      : "${tx.remarks}"`);
        }
      });
      console.log(`------------------------------------------------------\n`);
    }

  } catch (err) {
    console.error('Error executing query script:', err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

run();
