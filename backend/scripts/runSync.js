const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { syncFeeStructureNamesWithSql } = require('../services/feeStructureSyncService');

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected.');

    console.log('Starting Startup Name Sync...');
    await syncFeeStructureNamesWithSql();
    console.log('Startup Name Sync completed.');

  } catch (err) {
    console.error('Error running sync:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
};

run();
