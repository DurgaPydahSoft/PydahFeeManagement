// Initialize environment variables first
require('dotenv').config();

const mongoose = require('mongoose');
const readline = require('readline');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const runMigration = async () => {
    try {
        console.log("Fetching active fee heads from database...");
        const feeHeads = await FeeHead.find({ isActive: true }).sort({ name: 1 }).lean();

        if (feeHeads.length === 0) {
            console.error("No active fee heads found in database. Cannot proceed.");
            rl.close();
            process.exit(1);
        }

        console.log("\n================ AVAILABLE FEE HEADS ================");
        feeHeads.forEach((fh, index) => {
            console.log(`[${index + 1}] ${fh.name} (${fh.code || 'No Code'}) - ID: ${fh._id}`);
        });
        console.log("====================================================\n");

        // 1. Get Source Fee Head
        let sourceIndex = -1;
        while (true) {
            const answer = await askQuestion("Select the SOURCE (OLD) fee head (enter number): ");
            const parsed = parseInt(answer, 10);
            if (Number.isInteger(parsed) && parsed >= 1 && parsed <= feeHeads.length) {
                sourceIndex = parsed - 1;
                break;
            }
            console.log(`Invalid choice. Please enter a number between 1 and ${feeHeads.length}.`);
        }
        const sourceFeeHead = feeHeads[sourceIndex];
        console.log(`Selected Source: ${sourceFeeHead.name}\n`);

        // 2. Get Destination Fee Head
        let destIndex = -1;
        while (true) {
            const answer = await askQuestion("Select the DESTINATION (NEW) fee head (enter number): ");
            const parsed = parseInt(answer, 10);
            if (Number.isInteger(parsed) && parsed >= 1 && parsed <= feeHeads.length) {
                if (parsed - 1 === sourceIndex) {
                    console.log("Destination fee head cannot be the same as the source fee head.");
                    continue;
                }
                destIndex = parsed - 1;
                break;
            }
            console.log(`Invalid choice. Please enter a number between 1 and ${feeHeads.length}.`);
        }
        const destFeeHead = feeHeads[destIndex];
        console.log(`Selected Destination: ${destFeeHead.name}\n`);

        // 3. Confirm count
        console.log(`Checking matching transactions for "${sourceFeeHead.name}"...`);
        const matchCount = await Transaction.countDocuments({ feeHead: sourceFeeHead._id });

        if (matchCount === 0) {
            console.log(`No transactions found with feeHead "${sourceFeeHead.name}". Nothing to migrate.`);
            rl.close();
            process.exit(0);
        }

        console.log(`Found ${matchCount} transaction(s) under "${sourceFeeHead.name}".`);
        
        // 4. Double confirmation prompt
        const confirm = await askQuestion(`Are you sure you want to change the fee head of these ${matchCount} transaction(s) to "${destFeeHead.name}"? (yes/no): `);
        
        if (confirm.trim().toLowerCase() !== 'yes') {
            console.log("Migration cancelled by user.");
            rl.close();
            process.exit(0);
        }

        console.log("Running update...");
        const result = await Transaction.updateMany(
            { feeHead: sourceFeeHead._id },
            { $set: { feeHead: destFeeHead._id } }
        );

        console.log("\n================ MIGRATION COMPLETE ================");
        console.log(`Transactions matched: ${result.matchedCount}`);
        console.log(`Transactions updated: ${result.modifiedCount}`);
        console.log("====================================================");

    } catch (err) {
        console.error("Migration failed with error:", err);
    } finally {
        rl.close();
    }
};

const run = async () => {
    if (mongoose.connection.readyState === 0) {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/fee-management";
        await mongoose.connect(mongoURI);
        console.log("MongoDB Connected.");
    }
    await runMigration();
    process.exit(0);
};

run();

