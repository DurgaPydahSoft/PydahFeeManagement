const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const db = require('../config/sqlDb');

require('../models/FeeHead');
const Transaction = require('../models/Transaction');

const cleanStr = (val) => {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null') return undefined;
  return s;
};

const isDryRun = !process.argv.includes('--apply');
const userArg = process.argv.find(arg => arg.startsWith('--user='))?.split('=')[1];
// Default filter keyword if specified via CLI or if user asks for specific user
const filterKeyword = userArg !== undefined ? userArg : 'sastry';

const run = async () => {
  try {
    console.log(`=== RUNNING IN ${isDryRun ? 'DRY-RUN MODE (No database changes will be made)' : 'LIVE MODE (Applying changes)'} ===`);
    if (filterKeyword) {
      console.log(`=== FILTERING BY COLLECTED BY USER: "${filterKeyword}" ===\n`);
    } else {
      console.log(`=== NO USER FILTER APPLIED (Inspecting all users) ===\n`);
    }

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/fee_management';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    let allTxs = await Transaction.find({
      $or: [
        { collegeId: { $exists: false } },
        { courseId: { $exists: false } },
        { branchId: { $exists: false } },
        { college: 'undefined' },
        { course: 'undefined' },
        { branch: 'undefined' },
        { college: null },
        { course: null },
        { branch: null }
      ]
    }).populate('feeHead', 'name code').lean();

    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase().trim();
      allTxs = allTxs.filter(tx => {
        const cBy = (tx.collectedBy || '').toLowerCase();
        const cByName = (tx.collectedByName || '').toLowerCase();
        return cBy.includes(kw) || cByName.includes(kw);
      });
    }

    console.log(`Found ${allTxs.length} matching existing transactions to inspect and backfill.\n`);

    if (allTxs.length === 0) {
      console.log('No transactions matching the criteria were found!');
      return;
    }

    const studentIds = Array.from(new Set(allTxs.map(t => t.studentId).filter(Boolean)));
    console.log(`Extracting metadata for ${studentIds.length} unique students from MySQL...`);

    // Batch SQL queries in chunks of 500 to prevent oversized SQL queries
    const chunkSize = 500;
    const studentMap = {};

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      const idList = chunk.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      
      const [sqlStudents] = await db.query(
        `SELECT admission_number, pin_no, student_name, college, course, branch, current_year, college_id, course_id, branch_id FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`
      );

      sqlStudents.forEach(s => {
        const data = {
          studentName: cleanStr(s.student_name),
          college: cleanStr(s.college),
          course: cleanStr(s.course),
          branch: cleanStr(s.branch),
          pinNo: cleanStr(s.pin_no),
          studentYear: cleanStr(s.current_year),
          collegeId: s.college_id || undefined,
          courseId: s.course_id || undefined,
          branchId: s.branch_id || undefined
        };
        if (s.admission_number) studentMap[String(s.admission_number).trim().toLowerCase()] = data;
        if (s.pin_no) studentMap[String(s.pin_no).trim().toLowerCase()] = data;
      });
    }

    let updatedCount = 0;
    let bulkOps = [];
    const detailedReport = [];

    for (const tx of allTxs) {
      const sKey = String(tx.studentId || '').trim().toLowerCase();
      const sData = studentMap[sKey] || {};

      const newCollege = cleanStr(tx.college) || sData.college;
      const newCourse = cleanStr(tx.course) || sData.course;
      const newBranch = cleanStr(tx.branch) || sData.branch;
      const newPinNo = cleanStr(tx.pinNo) || sData.pinNo;
      const newYear = cleanStr(tx.studentYear) || sData.studentYear;
      const newName = cleanStr(tx.studentName) || sData.studentName;
      const newCollegeId = tx.collegeId || sData.collegeId;
      const newCourseId = tx.courseId || sData.courseId;
      const newBranchId = tx.branchId || sData.branchId;

      const setPayload = {};
      if (newCollege && newCollege !== tx.college) setPayload.college = newCollege;
      if (newCourse && newCourse !== tx.course) setPayload.course = newCourse;
      if (newBranch && newBranch !== tx.branch) setPayload.branch = newBranch;
      if (newPinNo && newPinNo !== tx.pinNo) setPayload.pinNo = newPinNo;
      if (newYear && newYear !== tx.studentYear) setPayload.studentYear = newYear;
      if (newName && newName !== tx.studentName) setPayload.studentName = newName;
      if (newCollegeId && newCollegeId !== tx.collegeId) setPayload.collegeId = newCollegeId;
      if (newCourseId && newCourseId !== tx.courseId) setPayload.courseId = newCourseId;
      if (newBranchId && newBranchId !== tx.branchId) setPayload.branchId = newBranchId;

      if (Object.keys(setPayload).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: tx._id },
            update: { $set: setPayload }
          }
        });
        updatedCount++;

        const feeHeadName = typeof tx.feeHead === 'object' && tx.feeHead !== null ? (tx.feeHead.name || tx.feeHead.code) : (tx.feeHead || 'N/A');
        const collectedByStr = tx.collectedByName ? `${tx.collectedByName} (${tx.collectedBy || 'N/A'})` : (tx.collectedBy || 'N/A');

        const issuesList = [];
        if (!tx.college || tx.college === 'undefined' || tx.college === 'null') {
          issuesList.push("Missing 'college' (Excludes transaction from report college scope filter)");
        }
        if (!tx.course || tx.course === 'undefined' || tx.course === 'null') {
          issuesList.push("Missing 'course'");
        }
        if (!tx.branch || tx.branch === 'undefined' || tx.branch === 'null') {
          issuesList.push("Missing 'branch'");
        }
        if (!tx.collegeId) issuesList.push("Missing 'collegeId'");
        if (!tx.courseId) issuesList.push("Missing 'courseId'");
        if (!tx.branchId) issuesList.push("Missing 'branchId'");
        if (!tx.pinNo || tx.pinNo === 'undefined' || tx.pinNo === 'null') issuesList.push("Missing 'pinNo'");

        detailedReport.push({
          'Tx ID': String(tx._id),
          'Student ID': tx.studentId || 'N/A',
          'Student Name': newName || 'N/A',
          'Collected By': collectedByStr,
          'Fee Head': feeHeadName,
          'Amount': tx.amount !== undefined ? tx.amount : 'N/A',
          'Exact Issue (Why Missing from Reports)': issuesList.join(' | ') || 'Missing SQL structure IDs',
          'Fields To Backfill': JSON.stringify(setPayload)
        });
      }
    }

    if (detailedReport.length > 0) {
      console.log(`\n================ TRANSACTION ISSUES & DIAGNOSTICS (${detailedReport.length} records) ================`);
      console.table(detailedReport);
    }

    if (isDryRun) {
      console.log(`\n====================================================`);
      console.log(`  DRY RUN COMPLETE: ${updatedCount} transactions WOULD be updated.`);
      console.log(`  No changes were saved to MongoDB.`);
      console.log(`  To apply these changes, run the script with --apply`);
      console.log(`====================================================\n`);
    } else if (bulkOps.length > 0) {
      console.log(`\nExecuting bulk backfill for ${bulkOps.length} transactions...`);
      // Execute bulkWrite in batches of 1000
      for (let i = 0; i < bulkOps.length; i += 1000) {
        const opBatch = bulkOps.slice(i, i + 1000);
        await Transaction.bulkWrite(opBatch);
      }
      console.log(`\n====================================================`);
      console.log(`  BACKFILL COMPLETE: SUCCESSFULLY UPDATED ${updatedCount} TRANSACTIONS`);
      console.log(`  Added collegeId, courseId, branchId & synced text metadata.`);
      console.log(`====================================================\n`);
    }

  } catch (err) {
    console.error('Error running backfill script:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
};

run();
