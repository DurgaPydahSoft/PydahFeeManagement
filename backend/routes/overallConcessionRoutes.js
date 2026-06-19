const express = require('express');
const router = express.Router();
const {
    getOverallConcessions,
    saveOverallConcession,
    deleteOverallConcession,
    bulkSaveOverallConcessions
} = require('../controllers/overallConcessionController');

router.route('/')
    .get(getOverallConcessions)
    .post(saveOverallConcession);

router.route('/bulk')
    .post(bulkSaveOverallConcessions);

router.route('/:id')
    .delete(deleteOverallConcession);

module.exports = router;
