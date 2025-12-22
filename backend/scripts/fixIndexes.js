const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: 'backend/.env' });

const logFile = 'backend/scripts/fix_log.txt';
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fee-management');
        log('MongoDB Connected');
    } catch (error) {
        log(`Error: ${error.message}`);
        process.exit(1);
    }
};

const fixIndexes = async () => {
    fs.writeFileSync(logFile, 'Starting Index Fix...\n');
    await connectDB();
    try {
        const collection = mongoose.connection.collection('feestructures');
        
        log('Fetching existing indexes...');
        const indexes = await collection.indexes();
        log('Current Indexes: ' + indexes.map(i => i.name).join(', '));

        const indexesToDrop = [
            'feeHead_1_course_1_academicYear_1',
            'feeHead_1_college_1_course_1_academicYear_1',
            'feeHead_1_college_1_course_1_branch_1_academicYear_1'
        ];

        for (const indexName of indexesToDrop) {
            if (indexes.find(i => i.name === indexName)) {
                log(`Dropping index: ${indexName}...`);
                await collection.dropIndex(indexName);
                log(`Dropped ${indexName}`);
            } else {
                log(`Index ${indexName} not found, skipping.`);
            }
        }

        log('Index fix complete.');
        process.exit(0);
    } catch (error) {
        log('Error fixing indexes: ' + error);
        process.exit(1);
    }
};

fixIndexes();
