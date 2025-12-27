const express = require('express');
const router = express.Router();
const { getTemplates, saveTemplate, deleteTemplate, sendReminders } = require('../controllers/reminderController');

router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/send', sendReminders);

module.exports = router;
