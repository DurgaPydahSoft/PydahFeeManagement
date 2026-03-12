const express = require('express');
const router = express.Router();
const proceedingController = require('../controllers/proceedingController');

const {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    deleteProceeding
} = proceedingController;

router.route('/')
    .get(getProceedings)
    .post(createProceeding);

router.get('/:id/summary', proceedingController.getProceedingSummary);
router.route('/:id').get(proceedingController.getProceedingById).put(proceedingController.updateProceeding).delete(proceedingController.deleteProceeding);

module.exports = router;
