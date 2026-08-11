const mongoose = require('mongoose');

let transportConnection = null;

const connectTransportDB = async () => {
  if (transportConnection && transportConnection.readyState === 1) return transportConnection;

  const uri = process.env.MONGO_TRANSPORT_URI;
  if (!uri) {
    console.warn('MONGO_TRANSPORT_URI not set – transport fee sync will be disabled.');
    return null;
  }

  try {
    const connection = mongoose.createConnection(uri);
    await connection.asPromise();
    transportConnection = connection;
    console.log(`MongoDB Transport Connected: ${transportConnection.host}`);
    return transportConnection;
  } catch (error) {
    console.error('Transport DB connection error:', error.message);
    return null;
  }
};

const getTransportConnection = () => transportConnection;

module.exports = { connectTransportDB, getTransportConnection };
