const express = require('express');
const router = express.Router();
const { 
    getAcademicYears,
    getCalendarMetadata,
    createAcademicYear,
    updateAcademicYear,
    deleteAcademicYear,
    getTermDates,
    updateTermDates
} = require('../controllers/academicCalendarController');

router.get('/academic-years', getAcademicYears);
router.post('/academic-years', createAcademicYear);
router.put('/academic-years/:id', updateAcademicYear);
router.delete('/academic-years/:id', deleteAcademicYear);
router.get('/metadata', getCalendarMetadata);
router.get('/term-dates', getTermDates);
router.put('/term-dates', updateTermDates);

module.exports = router;
