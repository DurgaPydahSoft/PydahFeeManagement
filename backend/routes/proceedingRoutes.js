const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    attachProceedingFile,
    verifyProceeding,
    approveProceeding,
    deleteProceeding,
    getProceedingSummary,
    loadStudentsForProceeding,
    syncProceedingIds,
    getScholarshipAnalytics,
    getPendingAutoTxnAlert
} = require('../controllers/proceedingController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

router.route('/')
    .get(getProceedings)
    .post(upload.single('attachment'), createProceeding);
router.get('/pending-auto-txn-alert', getPendingAutoTxnAlert);
router.get('/load-students', loadStudentsForProceeding);
router.post('/load-students', loadStudentsForProceeding);
router.get('/scholarship-analytics', getScholarshipAnalytics);
router.post('/sync-ids', syncProceedingIds);
router.get('/:id/summary', getProceedingSummary);
router.put('/:id/attachment', upload.single('attachment'), attachProceedingFile);
router.put('/:id/verify', verifyProceeding);
router.put('/:id/approve', approveProceeding);
router.route('/:id')
    .get(getProceedingById)
    .put(upload.single('attachment'), updateProceeding)
    .delete(deleteProceeding);

module.exports = router;
