const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop the stale 3-field unique index on receiptsequences if it still exists.
    // The correct index is the 4-field one that includes financialYear.
    // This old index (without financialYear) causes E11000 on split/batch payments.
    try {
      await conn.connection.collection('receiptsequences').dropIndex('collegeCode_1_courseCode_1_groupCode_1');
      console.log('[Migration] Dropped stale receiptsequences index (collegeCode+courseCode+groupCode)');
    } catch (e) {
      // index doesn't exist — nothing to do
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
