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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

const { protect } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/authorizeMiddleware');

// Public auth routes
app.use('/api/auth', require('./routes/authRoutes'));

// Public sync routes (protected by sync secret, not user JWT)
app.use('/api/sync', require('./routes/syncRoutes'));

// Public receipt verification endpoint (NO auth/JWT required)
app.use('/api/public/transactions', require('./routes/publicTransactionRoutes'));

// Secure Internal Print API (utilizes custom print token authentication)
app.use('/api/print', require('./routes/print.routes'));

// All other API routes require authentication + authorization
const protectedApi = express.Router();
protectedApi.use(protect);
protectedApi.use(authorize);

protectedApi.use('/fee-heads', require('./routes/feeRoutes'));
protectedApi.use('/fee-groups', require('./routes/feeGroupRoutes'));
protectedApi.use('/students', require('./routes/studentRoutes'));
protectedApi.use('/campuses', require('./routes/campusRoutes'));
protectedApi.use('/fee-structures', require('./routes/feeStructureRoutes'));
protectedApi.use('/transactions', require('./routes/transactionRoutes'));
protectedApi.use('/users', require('./routes/userRoutes'));
protectedApi.use('/reports', require('./routes/reportRoutes'));
protectedApi.use('/transport', require('./routes/transportRoutes'));
protectedApi.use('/hostels', require('./routes/hostelRoutes'));
protectedApi.use('/payment-config', require('./routes/paymentConfigRoutes'));
protectedApi.use('/reminders', require('./routes/reminderRoutes'));
protectedApi.use('/academic-calendar', require('./routes/academicCalendarRoutes'));
protectedApi.use('/bulk-fee', require('./routes/bulkFeeRoutes'));
protectedApi.use('/concessions', require('./routes/concessionRoutes'));
protectedApi.use('/permissions', require('./routes/permissionRoutes'));
protectedApi.use('/employees', require('./routes/employeeRoutes'));
protectedApi.use('/settings', require('./routes/settingRoutes'));
protectedApi.use('/late-fees', require('./routes/lateFeeRoutes'));
protectedApi.use('/proceedings', require('./routes/proceedingRoutes'));
protectedApi.use('/concession-approvers', require('./routes/approverRoutes'));
protectedApi.use('/overall-concessions', require('./routes/overallConcessionRoutes'));

app.use('/api', protectedApi);

// SSE route is mounted OUTSIDE of protectedApi because EventSource (browser)
// cannot send custom Authorization headers. The SSE route validates the token
// itself via the ?token= query parameter.
app.use('/api/sse', require('./routes/sseRoutes'));


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
