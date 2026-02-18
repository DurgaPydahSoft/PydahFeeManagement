const mongoose = require('mongoose');
const dotenv = require('dotenv');
const FeeHead = require('./models/FeeHead');
const FeeStructure = require('./models/FeeStructure');

dotenv.config();

const run = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // 1. Get a Fee Head
        const feeHead = await FeeHead.findOne();
        if (!feeHead) {
            console.error('No Fee Heads found!');
            process.exit(1);
        }
        console.log(`Using Fee Head: ${feeHead.name} (${feeHead._id})`);

        // Test Data
        const testBatch = 'DEBUG-BATCH-2025';
        const categories = ['CONV', 'LSPOT', 'TEST-CAT'];
        const commonData = {
            feeHead: feeHead._id,
            college: 'TEST-COLLEGE',
            course: 'TEST-COURSE',
            branch: 'TEST-BRANCH',
            batch: testBatch,
            studentYear: 1,
            amount: 5000,
            semester: null // Explicit null
        };

        // 2. Clean up previous valid runs
        await FeeStructure.deleteMany({ batch: testBatch });
        console.log('Cleaned up previous test data.');

        // 3. Simulate Logic from Controller
        const results = [];
        const errors = [];

        console.log(`Processing categories: ${categories.join(', ')}`);

        for (const cat of categories) {
            try {
                const query = {
                    ...commonData,
                    category: cat,
                    semester: commonData.semester || null // Ensure explicit null matches index
                };

                const update = {
                    $set: {
                        amount: commonData.amount,
                        description: 'Debug Auto Created'
                    }
                };

                const options = { new: true, upsert: true, runValidators: true };

                console.log(`Upserting for cat: ${cat}`);
                const structure = await FeeStructure.findOneAndUpdate(query, update, options);
                results.push(structure);
                console.log(`Saved ID: ${structure._id} for ${cat}`);
            } catch (err) {
                console.error(`Error saving ${cat}:`, err.message);
                errors.push({ category: cat, error: err.message });
            }
        }

        // 4. Verify what is in DB
        const savedStructures = await FeeStructure.find({ batch: testBatch });
        console.log(`\n--- Verification ---`);
        console.log(`Total Found in DB: ${savedStructures.length}`);
        savedStructures.forEach(s => {
            console.log(`- ID: ${s._id}, Category: ${s.category}, Amount: ${s.amount}`);
        });

        if (savedStructures.length !== categories.length) {
            console.error('FAIL: Simulation failed to save all categories!');
        } else {
            console.log('SUCCESS: All categories saved correctly.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
