const express = require('express');
const router = express.Router();
const { addTransaction, getStudentTransactions, previewSequence } = require('../controllers/transactionController');

router.route('/')
  .post(addTransaction);

router.route('/preview-sequence')
  .post(previewSequence);

router.route('/student/:admissionNo')
  .get(getStudentTransactions);

module.exports = router;
