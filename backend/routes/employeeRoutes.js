const express = require('express');
const router = express.Router();
const { searchEmployees } = require('../controllers/employeeController');

router.get('/search', searchEmployees);

module.exports = router;
