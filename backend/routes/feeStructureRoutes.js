const express = require('express');
const router = express.Router();
const { 
  createFeeStructure, 
  getFeeStructures, 
  getStudentFeeDetails,
  updateFeeStructure,
  deleteFeeStructure,
  applyFeeToBatch,
  saveStudentFees,
  getBatchStudentFees // Added this
} = require('../controllers/feeStructureController');

router.route('/apply-batch').post(applyFeeToBatch);
router.route('/save-student-fees').post(saveStudentFees);
router.route('/batch-fees').post(getBatchStudentFees); // Added this route
router.route('/').post(createFeeStructure).get(getFeeStructures);
router.route('/:id').put(updateFeeStructure).delete(deleteFeeStructure);
router.route('/student/:admissionNo').get(getStudentFeeDetails);

module.exports = router;
