const mongoose = require('mongoose');

let employeeConnection = null;

const connectEmployeeDB = async () => {
  if (employeeConnection) return employeeConnection;
  const uri = process.env.MONGO_EMPLOYEE_URI;
  if (!uri) {
    console.warn('MONGO_EMPLOYEE_URI not set – employee integration will be disabled.');
    return null;
  }
  try {
    const conn = mongoose.createConnection(uri);
    await conn.asPromise();
    employeeConnection = conn;
    console.log(`MongoDB Employee DB Connected: ${employeeConnection.host}`);
    return employeeConnection;
  } catch (error) {
    console.error('Employee DB connection error:', error.message);
    return null;
  }
};

const getEmployeeConnection = () => employeeConnection;

module.exports = { connectEmployeeDB, getEmployeeConnection };
