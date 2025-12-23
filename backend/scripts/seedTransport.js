const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const TransportRoute = require('../models/TransportRoute');

const RouteStage = require('../models/RouteStage');

dotenv.config({ path: '../.env' }); // Adjust path if running from backend root or scripts folder

const seedTransport = async () => {
    try {
        await connectDB();
        console.log('MongoDB Connected');

        // Clear existing data
        await TransportRoute.deleteMany({});
        await RouteStage.deleteMany({});
        console.log('Cleared existing Transport Routes and Stages');

        // Sample Data
        const routes = [
            {
                name: 'Route 1: Kakinada to College',
                code: 'RT-001',
                description: 'Main route covering Kakinada city centers.',
                status: 'Active',
                stages: [
                    { stageName: 'Bhanugudi', stopOrder: 1, amount: 15000 },
                    { stageName: 'Main Road', stopOrder: 2, amount: 14000 },
                    { stageName: 'Jagannaickpur', stopOrder: 3, amount: 13000 },
                    { stageName: 'Madhavapatnam', stopOrder: 4, amount: 10000 }
                ]
            },
            {
                name: 'Route 2: Samalkot to College',
                code: 'RT-002',
                description: 'Covering Samalkot and Peddapuram areas.',
                status: 'Active',
                stages: [
                    { stageName: 'Samalkot Bus Stand', stopOrder: 1, amount: 12000 },
                    { stageName: 'Peddapuram', stopOrder: 2, amount: 11000 },
                    { stageName: 'ADB Road', stopOrder: 3, amount: 8000 }
                ]
            },
            {
                name: 'Route 3: Pithapuram to College',
                code: 'RT-003',
                description: 'Direct route from Pithapuram.',
                status: 'Active',
                stages: [
                    { stageName: 'Pithapuram Market', stopOrder: 1, amount: 14000 },
                    { stageName: 'Gollaprolu', stopOrder: 2, amount: 13000 },
                    { stageName: 'Chebrolu', stopOrder: 3, amount: 12000 }
                ]
            }
        ];

        for (const r of routes) {
            // Create Route
            const route = new TransportRoute({
                name: r.name,
                code: r.code,
                description: r.description,
                status: r.status
            });
            const savedRoute = await route.save();
            console.log(`Created Route: ${savedRoute.name}`);

            // Create Stages
            for (const s of r.stages) {
                await RouteStage.create({
                    routeId: savedRoute._id,
                    stageName: s.stageName,
                    stopOrder: s.stopOrder,
                    amount: s.amount
                });
            }
            console.log(`  - Added ${r.stages.length} stages`);
        }

        console.log('Seeding Completed Successfully');
        process.exit();
    } catch (error) {
        console.error('Seeding Failed:', error);
        process.exit(1);
    }
};

seedTransport();
