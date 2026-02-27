const express = require('express');
const router = express.Router();
const { getTransactionReports, getDueReports, getDashboardStats } = require('../controllers/reportsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/transactions', protect, getTransactionReports);
router.get('/dues', protect, getDueReports);
router.get('/dashboard-stats', protect, getDashboardStats);

module.exports = router;
