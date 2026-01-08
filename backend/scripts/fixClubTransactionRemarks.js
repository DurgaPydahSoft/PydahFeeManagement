const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Transaction = require('../models/Transaction');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');

dotenv.config();

console.log('Connecting to DB...');
connectDB().then(async () => {
    console.log('DB Connected.');
    await fixTransactions();
}).catch(err => {
    console.error('DB Connection Failed:', err);
    process.exit(1);
});

const fixTransactions = async () => {
    try {
        console.log('Finding "Club Fee" Head...');
        const clubHead = await FeeHead.findOne({ code: 'CF' });
        if (!clubHead) {
            console.error('Club Fee Head (CF) not found!');
            process.exit(1);
        }

        console.log('Finding Generic Club Transactions (Empty Remarks)...');
        // Find transactions for Club Fee that have no remarks or generic remarks
        const transactions = await Transaction.find({
            feeHead: clubHead._id,
            $or: [{ remarks: { $exists: false } }, { remarks: '' }, { remarks: 'Club Fee' }]
        });

        console.log(`Found ${transactions.length} candidate transactions.`);

        let fixedCount = 0;
        let skippedCount = 0;

        for (const txn of transactions) {
            // Find demands for this student and this head
            const demands = await StudentFee.find({
                studentId: txn.studentId,
                feeHead: clubHead._id
            });

            if (demands.length === 1) {
                // Perfect match! Only one club participation.
                const demand = demands[0];
                if (demand.remarks && demand.remarks !== txn.remarks) {
                    console.log(`Fixing Txn ${txn._id} for Student ${txn.studentId}.`);
                    console.log(`  Current: "${txn.remarks || ''}" -> New: "${demand.remarks}"`);
                    
                    txn.remarks = demand.remarks;
                    await txn.save();
                    fixedCount++;
                } else {
                    skippedCount++; // Already correct or generic
                }
            } else if (demands.length > 1) {
                console.warn(`SKIPPING Txn ${txn._id} for Student ${txn.studentId}: Multiple Club Demands found. Cannot infer which one to pay.`);
                skippedCount++;
            } else {
                console.warn(`SKIPPING Txn ${txn._id} for Student ${txn.studentId}: No Club Demand found.`);
                skippedCount++;
            }
        }

        console.log('------------------------------------------------');
        console.log(`Process Complete.`);
        console.log(`Fixed: ${fixedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        
        process.exit();
    } catch (error) {
        console.error('Error fixing transactions:', error);
        process.exit(1);
    }
};
