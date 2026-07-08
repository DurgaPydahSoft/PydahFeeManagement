const express = require('express');
const router = express.Router();
const printAuthenticate = require('../middleware/printAuthentication');
const { handlePrintRequest } = require('../controllers/print.controller');

// Expose POST /api/print route for internal applications and frontend client
router.post('/', printAuthenticate, handlePrintRequest);

module.exports = router;
