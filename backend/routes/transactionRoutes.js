const express = require('express');
const router = express.Router();
const { addTransaction, getStudentTransactions, previewSequence, updateTransactionPaymentMode, getRecentTransactions } = require('../controllers/transactionController');

router.route('/')
  .post(addTransaction);

router.route('/recent')
  .get(getRecentTransactions);

router.route('/:id')
  .put(updateTransactionPaymentMode);

router.route('/preview-sequence')
  .post(previewSequence);

router.route('/student/:admissionNo')
  .get(getStudentTransactions);

module.exports = router;
