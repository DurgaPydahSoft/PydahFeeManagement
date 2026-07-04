const express = require('express');
const router = express.Router();
const { addTransaction, getStudentTransactions, previewSequence, updateTransactionPaymentMode, getRecentTransactions, deleteTransaction } = require('../controllers/transactionController');

router.route('/')
  .post(addTransaction);

router.route('/recent')
  .get(getRecentTransactions);

router.route('/:id')
  .put(updateTransactionPaymentMode)
  .delete(deleteTransaction);

router.route('/preview-sequence')
  .post(previewSequence);

router.route('/student/:admissionNo')
  .get(getStudentTransactions);

module.exports = router;
