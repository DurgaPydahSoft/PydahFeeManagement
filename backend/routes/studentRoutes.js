const express = require('express');
const router = express.Router();
const { getStudents, getStudentMetadata, getStudentByAdmissionNumber } = require('../controllers/studentController');

router.get('/', getStudents);
router.get('/metadata', getStudentMetadata);
router.get('/:id', getStudentByAdmissionNumber);


module.exports = router;
