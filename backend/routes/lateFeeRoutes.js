const express = require('express');
const router = express.Router();
const { getConfigs, saveConfig, deleteConfig, processLateFees } = require('../controllers/lateFeeController');

router.get('/config', getConfigs);
router.post('/config', saveConfig);
router.delete('/config/:id', deleteConfig);
router.post('/process', processLateFees);

module.exports = router;
