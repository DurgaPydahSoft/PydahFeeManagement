const express = require('express');
const router = express.Router();
const {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    verifyProceeding,
    approveProceeding,
    deleteProceeding,
    getProceedingSummary,
    loadStudentsForProceeding,
    syncProceedingIds,
    getScholarshipAnalytics
} = require('../controllers/proceedingController');

router.route('/').get(getProceedings).post(createProceeding);
router.get('/load-students', loadStudentsForProceeding);
router.get('/scholarship-analytics', getScholarshipAnalytics);
router.post('/sync-ids', syncProceedingIds);
router.get('/:id/summary', getProceedingSummary);
router.put('/:id/verify', verifyProceeding);
router.put('/:id/approve', approveProceeding);
router.route('/:id').get(getProceedingById).put(updateProceeding).delete(deleteProceeding);

module.exports = router;
