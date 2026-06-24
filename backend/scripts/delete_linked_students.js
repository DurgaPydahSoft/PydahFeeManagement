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

    // 2. Locate target FeeStructures matching batch 2024 criteria
    const searchCriteria = {
        feeHead: feeHead._id,
        college: "Pydah VRT Degree College",
        course: "B.Sc",
        branch: "Agriculture & Rural Development",
        batch: "2024",
        category: "CONV"
    };

    console.log("Locating structures to delete matching criteria:", searchCriteria);
    const structures = await FeeStructure.find(searchCriteria).lean();
    console.log(`Found ${structures.length} structures to delete.`);

    if (structures.length === 0) {
        console.log("No structures found matching the criteria. Nothing to delete.");
        await mongoose.connection.close();
        return;
    }

    const structureIds = structures.map(s => s._id);

    // 3. Find related StudentFee records before deleting
    console.log("\nLocating related StudentFee records...");
    const relatedFees = await StudentFee.find({ structureId: { $in: structureIds } }).lean();
    console.log(`Found ${relatedFees.length} related StudentFee records to delete.`);

    // 4. Perform deletion of StudentFee records
    if (relatedFees.length > 0) {
        console.log(`Deleting ${relatedFees.length} StudentFee records...`);
        const feeDeleteResult = await StudentFee.deleteMany({ structureId: { $in: structureIds } });
        console.log(`Successfully deleted ${feeDeleteResult.deletedCount} StudentFee records.`);
    } else {
        console.log("No StudentFee records found to delete.");
    }

    // 5. Perform deletion of FeeStructure templates
    console.log(`Deleting ${structures.length} FeeStructure templates...`);
    const structureDeleteResult = await FeeStructure.deleteMany({ _id: { $in: structureIds } });
    console.log(`Successfully deleted ${structureDeleteResult.deletedCount} FeeStructure templates.`);

    console.log("\n================ DELETE COMPLETE ================");
    console.log(`Deleted Templates count: ${structureDeleteResult.deletedCount}`);
    console.log(`Deleted Student Fees count: ${relatedFees.length}`);
    console.log("=================================================");

    await mongoose.connection.close();
    console.log("Closed MongoDB connection.");
}

main().catch(err => {
    console.error("Execution error:", err);
    process.exit(1);
});
