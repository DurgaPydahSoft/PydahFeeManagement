const express = require('express');
const router = express.Router();
const { addTransaction, getStudentTransactions } = require('../controllers/transactionController');

router.route('/')
  .post(addTransaction);

router.route('/student/:admissionNo')
  .get(getStudentTransactions);

module.exports = router;
