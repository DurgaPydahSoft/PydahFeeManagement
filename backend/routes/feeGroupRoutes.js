const express = require('express');
const router = express.Router();
const { getFeeGroups, createFeeGroup, updateFeeGroup, deleteFeeGroup } = require('../controllers/feeGroupController');

router.route('/')
  .get(getFeeGroups)
  .post(createFeeGroup);

router.route('/:id')
  .put(updateFeeGroup)
  .delete(deleteFeeGroup);

module.exports = router;
