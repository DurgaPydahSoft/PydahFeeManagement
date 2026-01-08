const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

dotenv.config();

console.log('Connecting to DB...');
connectDB().then(async () => {
    console.log('DB Connected.');
    await fixIndexes();
}).catch(err => {
    console.error('DB Connection Failed:', err);
    process.exit(1);
});

const fixIndexes = async () => {
    try {
        const StudentFee = require('../models/StudentFee');
        const collection = StudentFee.collection;

        console.log('Checking indexes...');
        const indexes = await collection.indexes();
        
        const oldIndexName = 'studentId_1_feeHead_1_academicYear_1_studentYear_1_semester_1';
        const exists = indexes.some(idx => idx.name === oldIndexName);

        if (exists) {
            console.log(`Found old index: ${oldIndexName}. Dropping it...`);
            await collection.dropIndex(oldIndexName);
            console.log('Index Dropped Successfully!');
        } else {
            console.log('Old index not found. It might have consistently been removed already.');
        }

        // The new index will be created automatically by Mongoose when the app restarts or usually immediately if ensureIndexes is run
        console.log('Trigering creation of new indexes...');
        await StudentFee.syncIndexes();
        console.log('New indexes synced!');

        process.exit();
    } catch (error) {
        console.error('Error fixing indexes:', error);
        process.exit(1);
    }
};
