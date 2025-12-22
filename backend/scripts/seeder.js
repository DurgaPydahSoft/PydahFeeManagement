const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    // Check if superadmin already exists
    const existingAdmin = await User.findOne({ username: 'superadmin' });

    if (existingAdmin) {
      console.log('Super Admin already exists!');
      process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('superadmin123', salt);

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
