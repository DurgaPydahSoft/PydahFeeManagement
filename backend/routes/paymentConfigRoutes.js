const express = require('express');
const router = express.Router();
const {
    getConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfigStatus
} = require('../controllers/paymentConfigController');

router.route('/').get(getConfigs).post(createConfig);
router.route('/:id').put(updateConfig).delete(deleteConfig);
router.route('/:id/toggle').patch(toggleConfigStatus);

module.exports = router;
