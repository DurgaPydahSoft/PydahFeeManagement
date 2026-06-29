const express = require('express');
const router = express.Router();
const { verifySyncSecret } = require('../middleware/syncAuthMiddleware');
const { syncStudentFees } = require('../controllers/studentSyncController');

router.post('/student-fees', verifySyncSecret, syncStudentFees);

module.exports = router;
