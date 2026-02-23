const express = require('express');
const router = express.Router();
const { getConfigs, saveConfig, deleteConfig } = require('../controllers/lateFeeController');

router.get('/config', getConfigs);
router.post('/config', saveConfig);
router.delete('/config/:id', deleteConfig);

module.exports = router;
