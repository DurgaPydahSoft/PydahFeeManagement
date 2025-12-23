const TransportRoute = require('../models/TransportRoute');
const RouteStage = require('../models/RouteStage');

// --- Transport Routes ---

// Get all routes
exports.getRoutes = async (req, res) => {
    try {
        const routes = await TransportRoute.find().sort({ createdAt: -1 });
        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new route
exports.createRoute = async (req, res) => {
    try {
        const { name, code, description, status } = req.body;
        
        // Check uniqueness
        const existing = await TransportRoute.findOne({ code });
        if (existing) return res.status(400).json({ message: 'Route Code already exists' });

        const route = new TransportRoute({ name, code, description, status });
        const savedRoute = await route.save();
        res.status(201).json(savedRoute);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update a route
exports.updateRoute = async (req, res) => {
    try {
        const { name, code, description, status } = req.body;
        const route = await TransportRoute.findByIdAndUpdate(
            req.params.id,
            { name, code, description, status },
            { new: true, runValidators: true }
        );
        if (!route) return res.status(404).json({ message: 'Route not found' });
        res.json(route);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a route
exports.deleteRoute = async (req, res) => {
    try {
        const route = await TransportRoute.findByIdAndDelete(req.params.id);
        if (!route) return res.status(404).json({ message: 'Route not found' });
        
        // Also delete associated stages
        await RouteStage.deleteMany({ routeId: req.params.id });
        
        res.json({ message: 'Route and associated stages deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Route Stages ---

// Get stages for a route
exports.getStages = async (req, res) => {
    try {
        const { routeId } = req.params;
        const stages = await RouteStage.find({ routeId }).sort({ stopOrder: 1 });
        res.json(stages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new stage
exports.createStage = async (req, res) => {
    try {
        const { routeId, stageName, stopOrder, amount } = req.body;
        
        const stage = new RouteStage({ routeId, stageName, stopOrder, amount });
        const savedStage = await stage.save();
        res.status(201).json(savedStage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update a stage
exports.updateStage = async (req, res) => {
    try {
        const { stageName, stopOrder, amount } = req.body;
        const stage = await RouteStage.findByIdAndUpdate(
            req.params.id,
            { stageName, stopOrder, amount },
            { new: true, runValidators: true }
        );
        if (!stage) return res.status(404).json({ message: 'Stage not found' });
        res.json(stage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a stage
exports.deleteStage = async (req, res) => {
    try {
        const stage = await RouteStage.findByIdAndDelete(req.params.id);
        if (!stage) return res.status(404).json({ message: 'Stage not found' });
        res.json({ message: 'Stage deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
