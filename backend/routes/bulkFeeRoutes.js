const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processBulkUpload, saveBulkData, downloadTemplate } = require('../controllers/bulkFeeController');

// Configure Multer for Memory Storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes
router.post('/upload', upload.single('file'), processBulkUpload);
router.post('/save', saveBulkData);
router.get('/template', downloadTemplate);

module.exports = router;
