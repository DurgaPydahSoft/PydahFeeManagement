const express = require('express');
const router = express.Router();
const { createConcessionRequest, getConcessionRequests, processConcessionRequest } = require('../controllers/concessionController');

router.post('/', createConcessionRequest);
router.get('/', getConcessionRequests);
router.put('/:id/process', processConcessionRequest);

module.exports = router;
