const express = require('express');
const router = express.Router();
const {
    getOverallConcessions,
    saveOverallConcession,
    deleteOverallConcession,
    bulkSaveOverallConcessions,
    submitConcessionRequest,
    getConcessionRequests,
    approveConcessionRequest,
    rejectConcessionRequest
} = require('../controllers/overallConcessionController');

// ── Specific string paths MUST come before /:id to avoid param collision ──

// Base routes
router.route('/')
    .get(getOverallConcessions)
    .post(saveOverallConcession);

router.route('/bulk')
    .post(bulkSaveOverallConcessions);

// Request workflow
router.route('/request')
    .post(submitConcessionRequest);

router.route('/requests')
    .get(getConcessionRequests);

router.route('/requests/:id/approve')
    .put(approveConcessionRequest);

router.route('/requests/:id/reject')
    .put(rejectConcessionRequest);

// Param route last — only matches numeric MySQL IDs, not the string paths above
router.route('/:id')
    .delete(deleteOverallConcession);

module.exports = router;
