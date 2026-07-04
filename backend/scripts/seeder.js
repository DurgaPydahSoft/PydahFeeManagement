const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    // --- Super Admin 1: superadmin ---
    const salt1 = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('superadmin@123', salt1);

    const existingAdmin = await User.findOne({ username: 'superadmin' });

    if (existingAdmin) {
      existingAdmin.password = hashedPassword1;
      await existingAdmin.save();
      console.log('Super Admin password updated successfully!');
    } else {
      const superAdmin = new User({
        name: 'Super Admin',
        username: 'superadmin',
        password: hashedPassword1,
        role: 'superadmin',
      });
      await superAdmin.save();
      console.log('Super Admin Imported!');
    }

    // --- Super Admin 2: superadmin-nitya ---
    const salt2 = await bcrypt.genSalt(10);
    const hashedPassword2 = await bcrypt.hash('nitya@123', salt2);

    const existingNitya = await User.findOne({ username: 'superadmin-nitya' });

    if (existingNitya) {
      existingNitya.password = hashedPassword2;
      await existingNitya.save();
      console.log('Super Admin Nitya password updated successfully!');
    } else {
      const superAdminNitya = new User({
        name: 'Super Admin Nitya',
        username: 'superadmin-nitya',
        password: hashedPassword2,
        role: 'superadmin',
      });
      await superAdminNitya.save();
      console.log('Super Admin Nitya Imported!');
    }

    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

importData();
