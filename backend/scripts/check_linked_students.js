const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');

async function main() {
    await connectDB();
    console.log("Connected to MongoDB");

    // 1. Find FeeHead for "Tuition Fee"
    const feeHead = await FeeHead.findOne({ name: { $regex: /^tuition fee$/i } });
    if (!feeHead) {
        console.error("FeeHead 'Tuition Fee' not found!");
        await mongoose.connection.close();
        return;
    }

    // 2. Query FeeStructures matching exact course/branch structure
    const searchCriteria = {
        feeHead: feeHead._id,
        college: "Pydah VRT Degree College",
        course: "B.Sc",
        branch: "Agriculture & Rural Development",
        batch: "2024",
        category: "CONV"
    };

    console.log("Searching FeeStructures with criteria:", searchCriteria);
    const structures = await FeeStructure.find(searchCriteria).lean();
    console.log(`Found ${structures.length} matching FeeStructure templates.\n`);

    if (structures.length === 0) {
        console.log("No matching FeeStructures found in database.");
        await mongoose.connection.close();
        return;
    }

    let grandTotalLinked = 0;
    const globalStudents = new Set();
    const studentsByYear = {};

    for (const structure of structures) {
        console.log(`==================================================`);
        console.log(`FEE STRUCTURE TEMPLATE DETAILS:`);
        console.log(`Template ID: ${structure._id}`);
        console.log(`Year: ${structure.studentYear} (Semester: ${structure.semester || 'Year-wise'})`);
        console.log(`Amount configured: ₹${Number(structure.amount).toLocaleString()}`);
        console.log(`--------------------------------------------------`);

        // Find StudentFees linked to this structure ID
        const linkedFees = await StudentFee.find({ structureId: structure._id }).lean();
        console.log(`Linked StudentFees count: ${linkedFees.length}`);

        if (linkedFees.length > 0) {
            console.log("\nLinked Students List:");
            console.log("S.No | Student ID | Student Name | Amount");
            console.log("--------------------------------------------------");
            linkedFees.forEach((fee, idx) => {
                console.log(`${idx + 1}. | ${fee.studentId} | ${fee.studentName || 'N/A'} | ₹${Number(fee.amount).toLocaleString()}`);
                globalStudents.add(fee.studentId);
                
                if (!studentsByYear[structure.studentYear]) {
                    studentsByYear[structure.studentYear] = [];
                }
                studentsByYear[structure.studentYear].push({
                    studentId: fee.studentId,
                    studentName: fee.studentName,
                    amount: fee.amount
                });
            });
        } else {
            console.log("No students explicitly linked via structureId.");
        }
        console.log(`==================================================\n`);
        grandTotalLinked += linkedFees.length;
    }

    // Now let's check for any StudentFee records that match the criteria but do NOT have structureId set
    const untrackedCriteria = {
        feeHead: feeHead._id,
        college: "Pydah VRT Degree College",
        course: "B.Sc",
        branch: "Agriculture & Rural Development",
        stud_type: "CONV", // or maybe empty
        structureId: { $exists: false }
    };
    
    const untrackedFees = await StudentFee.find(untrackedCriteria).lean();
    if (untrackedFees.length > 0) {
        console.log(`==================================================`);
        console.log(`FOUND ${untrackedFees.length} UNTRACKED STUDENT FEES (Matching criteria but no structureId):`);
        untrackedFees.forEach((fee, idx) => {
            console.log(`${idx + 1}. | ${fee.studentId} | ${fee.studentName || 'N/A'} | Year: ${fee.studentYear} | Amount: ₹${Number(fee.amount).toLocaleString()}`);
            globalStudents.add(fee.studentId);
        });
        console.log(`==================================================\n`);
    }

    console.log("=============== GRAND TOTAL SUMMARY ===============");
    console.log(`Total Unique Students Linked: ${globalStudents.size}`);
    console.log(`Unique Student IDs:`, Array.from(globalStudents));
    console.log("===================================================");

    await mongoose.connection.close();
    console.log("Closed MongoDB connection.");
}

main().catch(err => {
    console.error("Execution error:", err);
    process.exit(1);
});
