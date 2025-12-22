const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const FeeHead = require('../models/FeeHead');

dotenv.config();
connectDB();

const seedFeeHeads = async () => {
  try {
    const feeHeads = [
      { name: 'Tuition Fee', description: 'Academic tuition fee for the year' },
      { name: 'Transport Fee', description: 'Bus transportation fee' },
      { name: 'Library Fee', description: 'Library usage and maintenance' },
      { name: 'Laboratory Fee', description: 'Lab equipment and consumables' },
      { name: 'Exam Fee', description: 'Examination processing fee' },
      { name: 'Hostel Fee', description: 'Accommodation and mess charges' },
      { name: 'Admission Fee', description: 'One-time admission charge' },
      { name: 'Building Fund', description: 'Infrastructure development fund' },
      { name: 'Sports Fee', description: 'Sports equipment and facilities' },
      { name: 'Identity Card Fee', description: 'ID Card generation' }
    ];

    console.log('Seeding Fee Heads...');

    for (const head of feeHeads) {
      const exists = await FeeHead.findOne({ name: head.name });
      if (!exists) {
        await FeeHead.create(head);
        console.log(`Created: ${head.name}`);
      } else {
        console.log(`Skipped (Exists): ${head.name}`);
      }
    }

    console.log('Fee Head Seeding Completed!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedFeeHeads();
