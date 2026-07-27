const express = require('express');
const router = express.Router();
const {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    sendReminders,
    createConfig,
    getConfigs,
    deleteConfig,
    updateConfig,
    getVariableSources
} = require('../controllers/reminderController');

router.get('/variable-sources', getVariableSources);

router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.delete('/templates/:id', deleteTemplate);

router.post('/send', sendReminders);

router.post('/config', createConfig);
router.get('/config', getConfigs);
router.put('/config/:id', updateConfig);
router.delete('/config/:id', deleteConfig);

module.exports = router;
