const mongoose = require('mongoose');
const dotenv = require('dotenv');
const FeeStructure = require('./models/FeeStructure');

dotenv.config();

const run = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const collection = FeeStructure.collection;

        // List existing indexes
        const indexes = await collection.indexes();
        console.log('Current Indexes:', indexes.map(i => i.name));

        // Identifier for the bad index (based on the error message: feeHead_1_college_1_course_1_branch_1_batch_1_studentYear_1_semester_1)
        const badIndexName = 'feeHead_1_college_1_course_1_branch_1_batch_1_studentYear_1_semester_1';

        const indexExists = indexes.find(i => i.name === badIndexName);

        if (indexExists) {
            console.log(`Dropping incorrect index: ${badIndexName}`);
            await collection.dropIndex(badIndexName);
            console.log('Dropped.');
        } else {
            console.log('Incorrect index not found (might already be gone).');
        }

        console.log('Syncing Indexes to match Schema...');
        await FeeStructure.syncIndexes();
        console.log('Indexes Synced.');

        const newIndexes = await collection.indexes();
        console.log('New Indexes:', newIndexes.map(i => i.name));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
