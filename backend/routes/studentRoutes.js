const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentMetadata,
  getStudentByAdmissionNumber,
  searchStudents,
  createStudent,
  syncStudentFeesForCollection
} = require('../controllers/studentController');

router.get('/', getStudents);
router.post('/', createStudent); // Student Creation Route
router.get('/metadata', getStudentMetadata);
router.get('/search', searchStudents);
router.post('/:id/sync-fees', syncStudentFeesForCollection);
router.get('/:id', getStudentByAdmissionNumber);

module.exports = router;
