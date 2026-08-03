const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/db');
const readline = require('readline');

dotenv.config();

connectDB();

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
};

const importData = async () => {
  try {
    console.log('=== Super Admin Seeding/Update Tool ===\n');

    console.log('--- Super Admin 1 (username: superadmin) ---');
    const name1 = await askQuestion('Enter Name for superadmin: ');
    const email1 = await askQuestion('Enter Email/Gmail for superadmin: ');
    const mobile1 = await askQuestion('Enter Mobile number for superadmin: ');

    console.log('\n--- Super Admin 2 (username: superadmin-nitya) ---');
    const name2 = await askQuestion('Enter Name for superadmin-nitya: ');
    const email2 = await askQuestion('Enter Email/Gmail for superadmin-nitya: ');
    const mobile2 = await askQuestion('Enter Mobile number for superadmin-nitya: ');

    // --- Super Admin 1: superadmin ---
    const salt1 = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('superadmin@123', salt1);

    const existingAdmin = await User.findOne({ username: 'superadmin' });

    if (existingAdmin) {
      if (name1) existingAdmin.name = name1;
      existingAdmin.password = hashedPassword1;
      if (email1) existingAdmin.email = email1;
      if (mobile1) existingAdmin.mobile = mobile1;
      await existingAdmin.save();
      console.log('Super Admin updated successfully!');
    } else {
      const superAdmin = new User({
        name: name1 || 'Super Admin',
        username: 'superadmin',
        password: hashedPassword1,
        role: 'superadmin',
        email: email1 || undefined,
        mobile: mobile1 || undefined,
      });
      await superAdmin.save();
      console.log('Super Admin Imported!');
    }

    // --- Super Admin 2: superadmin-nitya ---
    const salt2 = await bcrypt.genSalt(10);
    const hashedPassword2 = await bcrypt.hash('nitya@123', salt2);

    const existingNitya = await User.findOne({ username: 'superadmin-nitya' });

    if (existingNitya) {
      if (name2) existingNitya.name = name2;
      existingNitya.password = hashedPassword2;
      if (email2) existingNitya.email = email2;
      if (mobile2) existingNitya.mobile = mobile2;
      await existingNitya.save();
      console.log('Super Admin Nitya updated successfully!');
    } else {
      const superAdminNitya = new User({
        name: name2 || 'Super Admin Nitya',
        username: 'superadmin-nitya',
        password: hashedPassword2,
        role: 'superadmin',
        email: email2 || undefined,
        mobile: mobile2 || undefined,
      });
      await superAdminNitya.save();
      console.log('Super Admin Nitya Imported!');
    }

    console.log('\nSeeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error seeding database: ${error}`);
    process.exit(1);
  }
};

importData();
