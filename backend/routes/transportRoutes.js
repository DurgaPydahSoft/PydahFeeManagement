const express = require('express');
const router = express.Router();
const {
    getRoutes, createRoute, updateRoute, deleteRoute,
    getStages, createStage, updateStage, deleteStage
} = require('../controllers/transportController');

// Routes
router.get('/routes', getRoutes);
router.post('/routes', createRoute);
router.put('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);

// Stages
router.get('/stages/:routeId', getStages);
router.post('/stages', createStage);
router.put('/stages/:id', updateStage);
router.delete('/stages/:id', deleteStage);

module.exports = router;
