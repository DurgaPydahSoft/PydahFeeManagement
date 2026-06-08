const express = require('express');
const router = express.Router();
const { 
  createConcessionRequest, 
  getConcessionRequests, 
  processConcessionRequest, 
  processBulkConcessionRequests,
  getNextVoucherIdPreview,
  modifyApprovedConcession
} = require('../controllers/concessionController');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), createConcessionRequest);
router.get('/', getConcessionRequests);
router.get('/next-voucher-id', getNextVoucherIdPreview);
router.put('/bulk-process', processBulkConcessionRequests);
router.put('/modify-approved/:id', modifyApprovedConcession);
router.put('/:id/process', processConcessionRequest);

module.exports = router;
