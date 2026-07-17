const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Transaction = require('../models/Transaction');
const PaymentConfig = require('../models/PaymentConfig');

async function run() {
    console.log('--- STARTING TRANSACTION TO GLOBAL CONFIG MAPPING ---');
    
    // 1. Connect to Database
    try {
        await connectDB();
        console.log('Successfully connected to MongoDB.');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }

    // 2. Fetch the Global Payment Config
    let globalConfig;
    try {
        globalConfig = await PaymentConfig.findOne({ is_global: true });
        if (!globalConfig) {
            console.error('CRITICAL: No global payment configuration found in the database. Exiting.');
            await mongoose.connection.close();
            process.exit(1);
        }
        console.log(`Found Global Payment Config: "${globalConfig.account_name}" (${globalConfig.bank_name}) | ID: ${globalConfig._id}`);
    } catch (err) {
        console.error('Failed to fetch global config:', err);
        await mongoose.connection.close();
        process.exit(1);
    }

    // 3. Define Target Users
    const targetUsers = [
        'MIDDI GANGA DURGA BHAVANI',
        'SHAIK BABA ROSHINI BEGUM',
        'BALA SARASWATHI THOTAKURA'
    ];

    // Find and map matching transactions
    console.log('\nSearching for target transactions to map...');
    try {
        // Query to match transactions that are:
        // - Not Cash
        // - Lack a paymentConfigId (missing, null, or undefined)
        // - Collected by one of the target users
        const query = {
            paymentMode: { $ne: 'Cash' },
            $and: [
                {
                    $or: [
                        { paymentConfigId: null },
                        { paymentConfigId: { $exists: false } }
                    ]
                },
                {
                    $or: [
                        { collectedByName: { $in: targetUsers.map(name => new RegExp(`^${name}$`, 'i')) } },
                        { collectedBy: { $in: targetUsers.map(name => new RegExp(`^${name}$`, 'i')) } }
                    ]
                }
            ]
        };

        const matchingTxs = await Transaction.find(query).lean();
        console.log(`Found ${matchingTxs.length} matching transactions ready to map.`);

        if (matchingTxs.length === 0) {
            console.log('No transactions matching the criteria found to map.');
        } else {
            // Group by collector name for logging
            const userCounts = {};
            targetUsers.forEach(u => userCounts[u] = 0);

            // Update each matching transaction
            const txIds = matchingTxs.map(tx => tx._id);
            const updateResult = await Transaction.updateMany(
                { _id: { $in: txIds } },
                { 
                    $set: { 
                        paymentConfigId: globalConfig._id,
                        depositedToAccount: globalConfig.account_name
                    } 
                }
            );

            console.log(`Successfully mapped ${updateResult.modifiedCount} transactions to global account.`);

            // Log details by user
            matchingTxs.forEach(tx => {
                const name = tx.collectedByName || tx.collectedBy || '';
                const matchedUser = targetUsers.find(u => new RegExp(`^${u}$`, 'i').test(name));
                if (matchedUser) {
                    userCounts[matchedUser]++;
                }
            });

            console.log('\nMapping breakdown by user:');
            targetUsers.forEach(u => {
                console.log(`- ${u}: ${userCounts[u]} transactions mapped`);
            });
        }

    } catch (err) {
        console.error('Error during transaction mapping:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed.');
    }

    console.log('--- COMPLETED TRANSACTION TO GLOBAL CONFIG MAPPING ---');
    process.exit(0);
}

run();
