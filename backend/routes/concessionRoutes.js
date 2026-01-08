const express = require('express');
const router = express.Router();
const { createConcessionRequest, getConcessionRequests, processConcessionRequest } = require('../controllers/concessionController');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), createConcessionRequest);router.get('/', getConcessionRequests);
router.put('/:id/process', processConcessionRequest);

module.exports = router;
