const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('superadmin@123', salt);

    // Check if superadmin already exists
    const existingAdmin = await User.findOne({ username: 'superadmin' });

    if (existingAdmin) {
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('Super Admin password updated successfully!');
      process.exit();
    }

    const superAdmin = new User({
      name: 'Super Admin',
      username: 'superadmin',
      password: hashedPassword,
      role: 'superadmin',
    });

    await superAdmin.save();

    console.log('Super Admin Imported!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

importData();
