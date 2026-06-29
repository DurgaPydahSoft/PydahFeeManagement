const express = require('express');
const router = express.Router();
const {
  createFeeStructure,
  getFeeStructures,
  getStudentFeeDetails,
  updateFeeStructure,
  deleteFeeStructure
} = require('../controllers/feeStructureController');

router.route('/').post(createFeeStructure).get(getFeeStructures);
router.route('/:id').put(updateFeeStructure).delete(deleteFeeStructure);
router.route('/student/:admissionNo').get(getStudentFeeDetails);

module.exports = router;
