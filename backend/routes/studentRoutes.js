const express = require('express');
const router = express.Router();
const { getStudents, getStudentMetadata, getStudentByAdmissionNumber, searchStudents } = require('../controllers/studentController');

router.get('/', getStudents);
router.get('/metadata', getStudentMetadata);
router.get('/search', searchStudents); // Added Search Route
router.get('/:id', getStudentByAdmissionNumber);


module.exports = router;
