const express = require('express');
const router = express.Router();
const { 
  createConcessionRequest, 
  getConcessionRequests, 
  processConcessionRequest, 
  processBulkConcessionRequests,
  getNextVoucherIdPreview 
} = require('../controllers/concessionController');
const { protect } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', protect, upload.single('image'), createConcessionRequest);
router.get('/', protect, getConcessionRequests);
router.get('/next-voucher-id', protect, getNextVoucherIdPreview);
router.put('/bulk-process', protect, processBulkConcessionRequests);
router.put('/:id/process', protect, processConcessionRequest);

module.exports = router;
