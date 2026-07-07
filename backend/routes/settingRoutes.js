const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, sendManualReport } = require('../controllers/settingController');

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/send-test-report', sendManualReport);

module.exports = router;
