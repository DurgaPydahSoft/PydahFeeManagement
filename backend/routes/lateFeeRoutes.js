const express = require('express');
const router = express.Router();
const {
  getConfigs,
  saveConfig,
  deleteConfig,
  processLateFees,
  processServiceLateFees,
  getDefaultConfigs,
  saveDefaultConfig,
  deleteDefaultConfig,
  getServiceLateFeeConfigs,
  saveServiceLateFeeConfig,
  saveServiceLateFeeRule,
  deleteServiceLateFeeRule,
  deleteServiceLateFeeConfig
} = require('../controllers/lateFeeController');

router.get('/config', getConfigs);
router.post('/config', saveConfig);
router.delete('/config/:id', deleteConfig);
router.post('/process', processLateFees);
router.post('/process-service', processServiceLateFees);

router.get('/default-config', getDefaultConfigs);
router.post('/default-config', saveDefaultConfig);
router.delete('/default-config/:id', deleteDefaultConfig);

router.get('/service-config', getServiceLateFeeConfigs);
router.post('/service-config', saveServiceLateFeeConfig);
router.post('/service-config/late-fee-rule', saveServiceLateFeeRule);
router.delete('/service-config/:id/late-fee-rule/:termsCount', deleteServiceLateFeeRule);
router.delete('/service-config/:id', deleteServiceLateFeeConfig);

module.exports = router;
