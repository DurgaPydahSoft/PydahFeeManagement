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

    // Cleanup old fee structures created by a late-fee auto-fill bug:
    // if no term has a positive late-fee amount, the structure should not
    // retain a lateFeeHead or group-wise late-fee flag.
    try {
      const result = await conn.connection.collection('feestructures').updateMany(
        {
          lateFeeHead: { $exists: true, $ne: null },
          terms: { $not: { $elemMatch: { lateFeeAmount: { $gt: 0 } } } }
        },
        {
          $set: {
            lateFeeHead: null,
            isGroupWiseLateFee: false
          }
        }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Migration] Cleared stale lateFeeHead on ${result.modifiedCount} fee structure(s) without late-fee amounts`);
      }
    } catch (e) {
      console.error('[Migration] Failed to clean stale lateFeeHead values:', e?.message || e);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
