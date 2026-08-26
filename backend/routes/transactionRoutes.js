const express = require('express');
const router = express.Router();
const {
  addTransaction,
  getStudentTransactions,
  previewSequence,
  updateTransactionPaymentMode,
  getRecentTransactions,
  deleteTransaction,
  cancelTransaction,
  getTransactionsByDate,
  bulkUpdateTransactionDates,
  transferTransaction
} = require('../controllers/transactionController');

router.route('/')
  .post(addTransaction);

router.route('/recent')
  .get(getRecentTransactions);

router.route('/by-date')
  .get(getTransactionsByDate);

router.route('/bulk-date-update')
  .put(bulkUpdateTransactionDates);

router.route('/:id/cancel')
  .put(cancelTransaction);

router.route('/:id/transfer')
  .post(transferTransaction);

router.route('/:id')
  .put(updateTransactionPaymentMode)
  .delete(deleteTransaction);

router.route('/preview-sequence')
  .post(previewSequence);

router.route('/student/:admissionNo')
  .get(getStudentTransactions);

module.exports = router;

