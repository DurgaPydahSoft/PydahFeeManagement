const express = require('express');
const router = express.Router();
const { getTransactionReports, getDueReports } = require('../controllers/reportsController');

router.get('/transactions', getTransactionReports);
router.get('/dues', getDueReports);

module.exports = router;
