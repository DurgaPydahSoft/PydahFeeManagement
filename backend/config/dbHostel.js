const mongoose = require('mongoose');

let hostelConnection = null;

const connectHostelDB = async () => {
  if (hostelConnection) return hostelConnection;
  const uri = process.env.MONGO_HOSTEL_URI;
  if (!uri) {
    console.warn('MONGO_HOSTEL_URI not set – hostel features will be disabled.');
    return null;
  }
  try {
    const conn = mongoose.createConnection(uri);
    await conn.asPromise();
    hostelConnection = conn;
    console.log(`MongoDB Hostel Connected: ${hostelConnection.host}`);
    return hostelConnection;
  } catch (error) {
    console.error('Hostel DB connection error:', error.message);
    return null;
  }
};

const getHostelConnection = () => hostelConnection;

module.exports = { connectHostelDB, getHostelConnection };
