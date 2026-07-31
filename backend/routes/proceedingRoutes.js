const express = require('express');
const router = express.Router();
const {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    approveProceeding,
    deleteProceeding,
    getProceedingSummary
} = require('../controllers/proceedingController');

router.route('/')
    .get(getProceedings)
    .post(createProceeding);

router.get('/:id/summary', getProceedingSummary);
router.put('/:id/approve', approveProceeding);
router.route('/:id').get(getProceedingById).put(updateProceeding).delete(deleteProceeding);

module.exports = router;
