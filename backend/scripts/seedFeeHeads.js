const mongoose = require('mongoose');
const dotenv = require('dotenv');
const FeeHead = require('../models/FeeHead');
const connectDB = require('../config/db');

dotenv.config();

console.log('Connecting to DB...');
connectDB().then(() => {
    console.log('DB Connected.');
    importData();
}).catch(err => {
    console.error('DB Connection Failed:', err);
    process.exit(1);
});

const importData = async () => {
  try {
    const feeHeads = [
      { name: 'Tuition Fee', code: 'TUI01', description: 'Academic tuition fee for the year' },
      { name: 'Transport Fee', code: 'TRN01', description: 'Bus transportation fee' },
      { name: 'Library Fee', code: 'LIB01', description: 'Library usage and maintenance' },
      { name: 'Laboratory Fee', code: 'LAB01', description: 'Lab equipment and consumables' },
      { name: 'Exam Fee', code: 'EXM01', description: 'Examination processing fee' },
      { name: 'Hostel Fee', code: 'HST01', description: 'Accommodation and mess charges' },
      { name: 'Admission Fee', code: 'ADM01', description: 'One-time admission charge' },
      { name: 'Building Fund', code: 'BLD01', description: 'Infrastructure development fund' },
      { name: 'Sports Fee', code: 'SPT01', description: 'Sports equipment and facilities' },
      { name: 'Identity Card Fee', code: 'IDC01', description: 'ID Card generation' },
      { name: 'Club Fee', code: 'CF', description: 'Club Fees for all types of clubs.' },
      { name: 'Student Services FEE', code: 'SSF', description: 'Fees For the Student Services' }
    ];

    console.log('Seeding Fee Heads...');

    for (const head of feeHeads) {
      const exists = await FeeHead.findOne({ name: head.name });
      if (!exists) {
        await FeeHead.create(head);
        console.log(`Created: ${head.name} (${head.code})`);
      } else {
        // Update code if missing
        if (!exists.code) {
             exists.code = head.code;
             await exists.save();
             console.log(`Updated Code for: ${head.name}`);
        } else {
             console.log(`Skipped (Exists): ${head.code ? head.name : head.name + ' - Code Missing but name exists'}`);
        }
      }
    }

    console.log('Fee Head Seeding Completed!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
