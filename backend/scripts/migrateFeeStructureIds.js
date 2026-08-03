// Initialize environment variables first
require('dotenv').config();

const mongoose = require('mongoose');
const db = require('../config/sqlDb');
const FeeStructure = require('../models/FeeStructure');

const initMigration = async () => {
    try {
        console.log("Connecting to SQL database...");
        // 1. Fetch reference maps from MySQL
        const [colleges] = await db.query("SELECT id, name FROM colleges");
        const [courses] = await db.query("SELECT id, name, college_id FROM courses");
        const [branches] = await db.query("SELECT id, name, course_id FROM course_branches");

        console.log(`Loaded ${colleges.length} colleges, ${courses.length} courses, ${branches.length} branches from SQL.`);

        // Helper to normalize strings for comparison
        const normalize = (str) => String(str || '').trim().toLowerCase();

        // 2. Fetch all existing Mongo FeeStructures
        console.log("Fetching existing MongoDB FeeStructures...");
        const feeStructures = await FeeStructure.find({});
        console.log(`Found ${feeStructures.length} fee structures to migrate.`);

        let successCount = 0;
        let failCount = 0;

        for (const fs of feeStructures) {
            const normalizedCollege = normalize(fs.college);
            const normalizedCourse = normalize(fs.course);
            const normalizedBranch = normalize(fs.branch);

            // Find matching college ID
            const matchedCollege = colleges.find(c => normalize(c.name) === normalizedCollege);
            if (!matchedCollege) {
                console.warn(`[Warning] No college ID found for name: "${fs.college}". FeeStructure ID: ${fs._id}`);
                failCount++;
                continue;
            }

            // Find matching course ID (scoped by college)
            const matchedCourse = courses.find(c => 
                normalize(c.name) === normalizedCourse && 
                c.college_id === matchedCollege.id
            );
            if (!matchedCourse) {
                console.warn(`[Warning] No course ID found for name: "${fs.course}" in college: "${fs.college}". FeeStructure ID: ${fs._id}`);
                failCount++;
                continue;
            }

            // Find matching branch ID (scoped by course)
            const matchedBranch = branches.find(b => 
                normalize(b.name) === normalizedBranch && 
                b.course_id === matchedCourse.id
            );
            if (!matchedBranch) {
                console.warn(`[Warning] No branch ID found for name: "${fs.branch}" in course: "${fs.course}". FeeStructure ID: ${fs._id}`);
                failCount++;
                continue;
            }

            // Update document with IDs
            fs.collegeId = matchedCollege.id;
            fs.courseId = matchedCourse.id;
            fs.branchId = matchedBranch.id;

            await fs.save();
            successCount++;
        }

        console.log("\n================ MIGRATION COMPLETE ================");
        console.log(`Successfully migrated: ${successCount} documents`);
        console.log(`Failed to migrate:     ${failCount} documents`);
        console.log("====================================================");

    } catch (err) {
        console.error("Migration failed with error:", err);
    }
};

const run = async () => {
    if (mongoose.connection.readyState === 0) {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/fee-management";
        await mongoose.connect(mongoURI);
        console.log("MongoDB Connected for migration.");
    }
    await initMigration();
    process.exit(0);
};

run();
