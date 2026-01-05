const express = require('express');
const router = express.Router();
const { getTemplates, saveTemplate, deleteTemplate, sendReminders, getAcademicYears } = require('../controllers/reminderController');

router.get('/templates', getTemplates);
router.get('/academic-years', getAcademicYears);
router.post('/templates', saveTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/send', sendReminders);

module.exports = router;
