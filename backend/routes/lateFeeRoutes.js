const express = require('express');
const router = express.Router();
const {
  getConfigs,
  saveConfig,
  deleteConfig,
  processLateFees,
  getDefaultConfigs,
  saveDefaultConfig,
  deleteDefaultConfig
} = require('../controllers/lateFeeController');

router.get('/config', getConfigs);
router.post('/config', saveConfig);
router.delete('/config/:id', deleteConfig);
router.post('/process', processLateFees);

router.get('/default-config', getDefaultConfigs);
router.post('/default-config', saveDefaultConfig);
router.delete('/default-config/:id', deleteDefaultConfig);

module.exports = router;
