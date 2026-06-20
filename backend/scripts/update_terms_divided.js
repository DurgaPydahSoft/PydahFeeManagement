const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const StudentFee = require('../models/StudentFee');
const FeeStructure = require('../models/FeeStructure');

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // 1. Update StudentFee records
    console.log('Updating all StudentFee documents to set isTermsDivided = true...');
    const studentFeeResult = await StudentFee.updateMany({}, { $set: { isTermsDivided: true } });
    console.log(`Updated ${studentFeeResult.modifiedCount} StudentFee documents (Matched: ${studentFeeResult.matchedCount}).`);

    // 2. Update FeeStructure records
    console.log('Updating all FeeStructure documents to set isTermsDivided = true...');
    const feeStructureResult = await FeeStructure.updateMany({}, { $set: { isTermsDivided: true } });
    console.log(`Updated ${feeStructureResult.modifiedCount} FeeStructure documents (Matched: ${feeStructureResult.matchedCount}).`);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

run();
