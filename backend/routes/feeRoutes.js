const express = require('express');
const router = express.Router();
const { getFeeHeads, createFeeHead, deleteFeeHead, updateFeeHead } = require('../controllers/feeController');

router.route('/')
  .get(getFeeHeads)
  .post(createFeeHead);

router.route('/:id')
  .delete(deleteFeeHead)
  .put(updateFeeHead);

module.exports = router;
