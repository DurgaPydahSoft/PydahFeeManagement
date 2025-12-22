const express = require('express');
const router = express.Router();
const { getTransactionReports } = require('../controllers/reportsController');

router.get('/transactions', getTransactionReports);

module.exports = router;
