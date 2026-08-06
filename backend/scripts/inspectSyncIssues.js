const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const FeeStructure = require('../models/FeeStructure');
const sqlDb = require('../config/sqlDb');

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected.');

    console.log('Fetching reference tables from SQL...');
    const [colleges] = await sqlDb.query("SELECT id, name FROM colleges");
    const [courses] = await sqlDb.query("SELECT id, name FROM courses");
    const [branches] = await sqlDb.query("SELECT id, name FROM course_branches");

    const collegeMap = {};
    colleges.forEach(c => collegeMap[c.id] = c.name);
    
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c.name);
    
    const branchMap = {};
    branches.forEach(b => branchMap[b.id] = b.name);

    console.log('Fetching all MongoDB FeeStructures...');
    const structures = await FeeStructure.find({});
    console.log(`Found ${structures.length} FeeStructure documents.\n`);

    const missingIds = [];
    const nameMismatches = [];
    const potentialCollisions = [];

    // Analyze structures
    for (const fs of structures) {
      if (!fs.collegeId || !fs.courseId || !fs.branchId) {
        missingIds.push({
          id: fs._id,
          college: fs.college,
          course: fs.course,
          branch: fs.branch,
          batch: fs.batch,
          missing: [
            !fs.collegeId && 'collegeId',
            !fs.courseId && 'courseId',
            !fs.branchId && 'branchId'
          ].filter(Boolean).join(', ')
        });
        continue; // Skip mismatch check since we don't have IDs to check against SQL map
      }

      const dbCollege = collegeMap[fs.collegeId];
      const dbCourse = courseMap[fs.courseId];
      const dbBranch = branchMap[fs.branchId];

      let collegeChanged = dbCollege && fs.college !== dbCollege;
      let courseChanged = dbCourse && fs.course !== dbCourse;
      let branchChanged = dbBranch && fs.branch !== dbBranch;

      if (collegeChanged || courseChanged || branchChanged) {
        const renamed = {
          college: dbCollege || fs.college,
          course: dbCourse || fs.course,
          branch: dbBranch || fs.branch
        };

        nameMismatches.push({
          id: fs._id,
          batch: fs.batch,
          category: fs.category,
          studentYear: fs.studentYear,
          semester: fs.semester,
          oldName: `${fs.college} | ${fs.course} | ${fs.branch}`,
          newName: `${renamed.college} | ${renamed.course} | ${renamed.branch}`
        });

        // Check if there is already a document under the new name
        const duplicate = structures.find(s => 
          String(s.feeHead) === String(fs.feeHead) &&
          s.college === renamed.college &&
          s.course === renamed.course &&
          s.branch === renamed.branch &&
          s.batch === fs.batch &&
          s.category === fs.category &&
          s.studentYear === fs.studentYear &&
          (s.semester === fs.semester || (!s.semester && !fs.semester)) &&
          String(s._id) !== String(fs._id)
        );

        if (duplicate) {
          potentialCollisions.push({
            oldId: fs._id,
            dupId: duplicate._id,
            batch: fs.batch,
            category: fs.category,
            studentYear: fs.studentYear,
            oldBranch: fs.branch,
            newBranch: duplicate.branch
          });
        }
      }
    }

    // Print Report
    console.log('========================================================================');
    console.log('                       FEE STRUCTURES DIAGNOSTIC REPORT                 ');
    console.log('========================================================================');

    console.log(`\n1. Fee Structures with Missing ID references (${missingIds.length} found):`);
    if (missingIds.length > 0) {
      missingIds.forEach(item => {
        console.log(` - ID: ${item.id} | Batch: ${item.batch} | Branch: "${item.branch}" | Missing: ${item.missing}`);
      });
    } else {
      console.log(' None found.');
    }

    console.log(`\n2. Fee Structures with Renamed Master Names in SQL (${nameMismatches.length} found):`);
    if (nameMismatches.length > 0) {
      nameMismatches.forEach(item => {
        console.log(` - ID: ${item.id} | Batch: ${item.batch} | Year: ${item.studentYear} | Category: ${item.category}`);
        console.log(`   From: ${item.oldName}`);
        console.log(`   To  : ${item.newName}`);
      });
    } else {
      console.log(' None found.');
    }

    console.log(`\n3. Potential Index Collisions on Sync / Duplicate Documents (${potentialCollisions.length} found):`);
    if (potentialCollisions.length > 0) {
      potentialCollisions.forEach(item => {
        console.log(` - Old Doc ID: ${item.oldId} ("${item.oldBranch}") collides with Duplicate Doc ID: ${item.dupId} ("${item.newBranch}")`);
        console.log(`   Context: Batch ${item.batch} | Category: ${item.category} | Student Year: ${item.studentYear}`);
      });
    } else {
      console.log(' None found.');
    }
    console.log('\n========================================================================');

    console.log('\n4. All Fee Structures for Batch 2026:');
    const batch2026 = structures.filter(s => String(s.batch) === '2026');
    console.log(`Found ${batch2026.length} FeeStructure documents for Batch 2026.`);
    console.log('\n========================================================================');

    const StudentFee = require('../models/StudentFee');
    console.log('\n5. Mismatched StudentFee records with branch: "DCSE(AI)":');
    const oldFees = await StudentFee.find({ branch: 'DCSE(AI)' });
    console.log(`Found ${oldFees.length} StudentFee documents with branch: "DCSE(AI)".`);
    if (oldFees.length > 0) {
      oldFees.slice(0, 15).forEach(f => {
        console.log(` - Student: ${f.studentId} (${f.studentName}) | Batch: ${f.academicYear} | Year: ${f.studentYear} | structureId: ${f.structureId || 'null'}`);
      });
      if (oldFees.length > 15) {
        console.log(` ... and ${oldFees.length - 15} more`);
      }
    }
    console.log('\n========================================================================');

  } catch (err) {
    console.error('Error running diagnostic script:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
};

run();
