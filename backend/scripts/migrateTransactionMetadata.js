const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected.');

    // Find transactions missing any of the cached fields
    const query = {
      $or: [
        { college: { $exists: false } },
        { college: null },
        { course: { $exists: false } },
        { course: null },
        { branch: { $exists: false } },
        { branch: null },
        { pinNo: { $exists: false } },
        { pinNo: null },
        { admissionNumber: { $exists: false } },
        { admissionNumber: null }
      ]
    };

    const pendingTxns = await Transaction.find(query).select('studentId studentName studentYear').lean();
    console.log(`Found ${pendingTxns.length} transactions needing metadata sync.`);

    if (pendingTxns.length === 0) {
      console.log('No transactions require metadata enrichment.');
      return;
    }

    // Extract unique studentIds
    const studentIds = [...new Set(pendingTxns.map(t => t.studentId).filter(Boolean))];
    console.log(`Resolving details for ${studentIds.length} unique student identifiers from SQL...`);

    // Fetch student info from SQL in chunks of 500 to avoid long query parameters
    const studentMap = {};
    const chunkSize = 500;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      
      const [rows] = await db.query(
        `SELECT admission_number, pin_no, student_name, college, course, branch, current_year FROM students WHERE admission_number IN (${placeholders}) OR pin_no IN (${placeholders})`,
        [...chunk, ...chunk]
      );

      rows.forEach(s => {
        const data = {
          studentName: s.student_name,
          college: s.college,
          course: s.course,
          branch: s.branch,
          pinNo: s.pin_no,
          admissionNumber: s.admission_number,
          studentYear: String(s.current_year)
        };
        if (s.admission_number) studentMap[s.admission_number.trim().toLowerCase()] = data;
        if (s.pin_no) studentMap[s.pin_no.trim().toLowerCase()] = data;
      });
    }

    console.log('Building Mongoose bulk operations...');
    const bulkOps = [];
    let matchCount = 0;

    pendingTxns.forEach(tx => {
      if (!tx.studentId) return;
      const key = tx.studentId.trim().toLowerCase();
      const s = studentMap[key];
      if (s) {
        matchCount++;
        const updateFields = {};
        if (s.college) updateFields.college = s.college;
        if (s.course) updateFields.course = s.course;
        if (s.branch) updateFields.branch = s.branch;
        if (s.pinNo) updateFields.pinNo = s.pinNo;
        if (s.admissionNumber) updateFields.admissionNumber = s.admissionNumber;
        
        // Also sync name/year if missing
        if (!tx.studentName && s.studentName) updateFields.studentName = s.studentName;
        if (!tx.studentYear && s.studentYear) updateFields.studentYear = s.studentYear;

        if (Object.keys(updateFields).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: tx._id },
              update: { $set: updateFields }
            }
          });
        }
      }
    });

    console.log(`Matched metadata for ${matchCount} of ${pendingTxns.length} transactions.`);
    
    if (bulkOps.length > 0) {
      console.log(`Executing ${bulkOps.length} updates in MongoDB...`);
      // Run bulk writes in batches of 1000
      const bulkBatchSize = 1000;
      for (let j = 0; j < bulkOps.length; j += bulkBatchSize) {
        const batch = bulkOps.slice(j, j + bulkBatchSize);
        const res = await Transaction.bulkWrite(batch);
        console.log(`Processed batch: modified=${res.modifiedCount}`);
      }
      console.log('Metadata migration complete.');
    } else {
      console.log('No metadata changes needed to be written.');
    }

  } catch (err) {
    console.error('Error running metadata migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

run();
