const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

require('../models/FeeHead');
const Transaction = require('../models/Transaction');
const { applyReportDateToMatch } = require('../utils/reportDateFilter');

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/fee_management';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    const startDate = '2026-07-07';
    const endDate = '2026-07-07';

    let matchStage = {
      status: { $ne: 'cancelled' },
      remarks: { $ne: 'Concession as per declaration' }
    };

    applyReportDateToMatch(matchStage, startDate, endDate);

    console.log('=== MATCH STAGE FOR AGGREGATION ===');
    console.log(JSON.stringify(matchStage, null, 2));

    const groupId = {
      year: { $year: { date: { $ifNull: ["$paymentDate", "$createdAt"] }, timezone: "Asia/Kolkata" } },
      month: { $month: { date: { $ifNull: ["$paymentDate", "$createdAt"] }, timezone: "Asia/Kolkata" } },
      day: { $dayOfMonth: { date: { $ifNull: ["$paymentDate", "$createdAt"] }, timezone: "Asia/Kolkata" } }
    };

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
    ];

    const results = await Transaction.aggregate(pipeline);
    console.log('\n=== AGGREGATION RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Error running test script:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
};

run();
