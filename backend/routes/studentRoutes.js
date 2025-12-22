const express = require('express');
const router = express.Router();
const { getStudents, getStudentMetadata } = require('../controllers/studentController');

router.get('/', getStudents);
router.get('/metadata', getStudentMetadata);

module.exports = router;
