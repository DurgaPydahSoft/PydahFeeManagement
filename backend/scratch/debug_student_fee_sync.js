const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const db = require('../config/sqlDb');

const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');

const ADMISSION_NO = '20240322'; // From screenshot

async function debugStudentSync() {
  try {
    console.log(`\n==========================================`);
    console.log(`DEBUGGING FEE SYNC FOR ADMISSION NO: ${ADMISSION_NO}`);
    console.log(`==========================================\n`);

    // 1. Fetch student details from SQL
    const [students] = await db.query(
      `SELECT id, admission_number, student_name, current_year, batch, current_semester,
              college, course, branch, stud_type, college_id, course_id, branch_id
       FROM students
       WHERE admission_number = ?`,
      [ADMISSION_NO]
    );

    if (students.length === 0) {
      console.log(`❌ Student with admission number ${ADMISSION_NO} NOT FOUND in SQL database!`);
      process.exit(1);
    }

    const student = students[0];
    console.log(`--- 1. SQL STUDENT RECORD ---`);
    console.log(JSON.stringify(student, null, 2));

    // Resolve names if missing
    if (!student.college && student.college_id) {
      const [cols] = await db.query('SELECT name FROM colleges WHERE id = ?', [student.college_id]);
      if (cols.length > 0) student.college = cols[0].name;
    }
    if (!student.course && student.course_id) {
      const [crs] = await db.query('SELECT name FROM courses WHERE id = ?', [student.course_id]);
      if (crs.length > 0) student.course = crs[0].name;
    }
    if (!student.branch && student.branch_id) {
      const [brs] = await db.query('SELECT name FROM course_branches WHERE id = ?', [student.branch_id]);
      if (brs.length > 0) student.branch = brs[0].name;
    }

    console.log(`\n--- 1b. RESOLVED STUDENT FIELDS ---`);
    console.log({
      college: student.college,
      course: student.course,
      branch: student.branch,
      batch: student.batch,
      stud_type: student.stud_type,
      current_year: student.current_year
    });

    // Connect to Mongo
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.log(`❌ MONGO_URI not found in process.env!`);
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log(`\n✅ Connected to MongoDB.`);

    // 2. Query Fee Structures matching College, Course, Branch
    console.log(`\n--- 2. ALL FEE STRUCTURES MATCHING COLLEGE / COURSE / BRANCH ---`);
    const matchingColCourseBranch = await FeeStructure.find({
      college: student.college,
      course: student.course,
      branch: student.branch
    }).populate('feeHead', 'name code').lean();

    console.log(`Found ${matchingColCourseBranch.length} structure(s) matching college="${student.college}", course="${student.course}", branch="${student.branch}".`);

    matchingColCourseBranch.forEach((fs, i) => {
      console.log(`\n  [Structure #${i + 1}] ID: ${fs._id}`);
      console.log(`    FeeHead: ${fs.feeHead?.name} (${fs.feeHead?.code}) [ID: ${fs.feeHead?._id || fs.feeHead}]`);
      console.log(`    College: "${fs.college}", Course: "${fs.course}", Branch: "${fs.branch}"`);
      console.log(`    Batch: "${fs.batch}", Category: "${fs.category}", StudentYear: ${fs.studentYear}, Semester: ${fs.semester}`);
      console.log(`    Amount: ₹${fs.amount}`);
    });

    // 3. Query Fee Structures matching EXACT category + batch filter
    const category = student.stud_type || 'Regular';
    console.log(`\n--- 3. CHECKING CATEGORY MATCHING (student.stud_type = "${category}") ---`);
    const matchingCategory = matchingColCourseBranch.filter(fs => fs.category === category);
    console.log(`Found ${matchingCategory.length} structure(s) matching category="${category}".`);

    // 4. Query current Student Fees stored in Mongo
    console.log(`\n--- 4. CURRENT STUDENT FEES IN MONGO FOR "${ADMISSION_NO}" ---`);
    const currentStudentFees = await StudentFee.find({ studentId: ADMISSION_NO })
      .populate('feeHead', 'name code')
      .lean();

    console.log(`Found ${currentStudentFees.length} existing StudentFee record(s) for ${ADMISSION_NO}:`);
    currentStudentFees.forEach((sf, i) => {
      console.log(`  [Fee #${i + 1}] ID: ${sf._id}`);
      console.log(`    FeeHead: ${sf.feeHead?.name} (${sf.feeHead?.code})`);
      console.log(`    AcademicYear: "${sf.academicYear}", StudentYear: ${sf.studentYear}, Semester: ${sf.semester}`);
      console.log(`    Amount: ₹${sf.amount}, Remarks: "${sf.remarks || ''}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error during debug script:', err);
    process.exit(1);
  }
}

debugStudentSync();
