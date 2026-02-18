const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const cors = require('cors');
const connectDB = require('./config/db');
const { connectHostelDB } = require('./config/dbHostel');
const { connectEmployeeDB } = require('./config/dbEmployee'); // [NEW]
const sqlPool = require('./config/sqlDb');

connectDB();
connectHostelDB();
connectEmployeeDB(); // [NEW]

// Test SQL Connection
sqlPool.query('SELECT 1')
  .then(() => console.log('MySQL Connected'))
  .catch(err => console.error('MySQL Connection Failed:', err));

const { verifyS3Connection } = require('./utils/s3Upload');
verifyS3Connection();

const { initScheduler } = require('./services/scheduler');
initScheduler();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/fee-heads', require('./routes/feeRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/fee-structures', require('./routes/feeStructureRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/transport', require('./routes/transportRoutes'));
app.use('/api/hostels', require('./routes/hostelRoutes'));
app.use('/api/payment-config', require('./routes/paymentConfigRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/bulk-fee', require('./routes/bulkFeeRoutes'));
app.use('/api/concessions', require('./routes/concessionRoutes'));
app.use('/api/permissions', require('./routes/permissionRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes')); // [NEW]
app.use('/api/receipt-settings', require('./routes/receiptSettingRoutes')); // [NEW]

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
