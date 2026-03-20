const express = require('express');
const router = express.Router();
const { 
    getTemplates, 
    saveTemplate, 
    deleteTemplate, 
    sendReminders, 
    createConfig,
    getConfigs,
    deleteConfig
} = require('../controllers/reminderController');

router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.delete('/templates/:id', deleteTemplate);

router.post('/send', sendReminders);

// Scheduled Reminder Configuration Routes
router.post('/config', createConfig);
router.get('/config', getConfigs);
router.delete('/config/:id', deleteConfig);

module.exports = router;
