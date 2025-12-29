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
        const { routeId, stageCode, stageName, stopOrder, amount } = req.body;

        const stage = new RouteStage({ routeId, stageCode, stageName, stopOrder, amount });
        const savedStage = await stage.save();
        res.status(201).json(savedStage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update a stage
exports.updateStage = async (req, res) => {
    try {
        const { stageCode, stageName, stopOrder, amount } = req.body;
        const stage = await RouteStage.findByIdAndUpdate(
            req.params.id,
            { stageCode, stageName, stopOrder, amount },
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

// --- Allocation Logic ---

const FeeHead = require('../models/FeeHead');
const StudentFee = require('../models/StudentFee');
const db = require('../config/sqlDb');

// Assign Transport to Student
exports.assignTransportToStudent = async (req, res) => {
    const { studentId, routeId, stageId, academicYear } = req.body;

    if (!studentId || !routeId || !stageId || !academicYear) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // 1. Get Stage Details (for Amount)
        const stage = await RouteStage.findById(stageId);
        if (!stage) return res.status(404).json({ message: 'Stage not found' });

        const route = await TransportRoute.findById(routeId);
        if (!route) return res.status(404).json({ message: 'Route not found' });

        // 2. Get Student Details from SQL
        const [students] = await db.query('SELECT student_name, college, course, branch, current_year, current_semester FROM students WHERE admission_number = ?', [studentId]);

        if (students.length === 0) return res.status(404).json({ message: 'Student not found in database' });
        const student = students[0];

        // 3. Find or Create "Transport Fee" Head
        let feeHead = await FeeHead.findOne({ name: 'Transport Fee' });
        if (!feeHead) {
            feeHead = await FeeHead.create({
                name: 'Transport Fee',
                description: 'Fee for Transport Facilities',
                code: 'TRN'
            });
        }

        // 4. Create/Update Student Fee Record
        // We use 'Transport Fee' head. Unique index is on { studentId, feeHead, academicYear, studentYear, semester }
        // We assume transport fee is per year usually, but here we can stick to the passed academicYear.
        // We'll upsert based on this to avoid duplicates for the same year.

        const feePayload = {
            studentId,
            studentName: student.student_name,
            feeHead: feeHead._id,
            structureId: null, // Manual assignment, no structure template
            college: student.college,
            course: student.course,
            branch: student.branch,
            academicYear: academicYear,
            studentYear: student.current_year,
            semester: student.current_semester || 1, // Default if null
            semester: student.current_semester || 1, // Default if null
            amount: req.body.amount || stage.amount, // Allow override
            remarks: `Transport: ${route.name} - ${stage.stageCode ? '[' + stage.stageCode + '] ' : ''}${stage.stageName}`
        };

        await StudentFee.findOneAndUpdate(
            {
                studentId,
                feeHead: feeHead._id,
                academicYear,
                studentYear: student.current_year
                // We intentionally omit semester here if we want one transport fee per year, 
                // OR include it if we want per semester. 
                // Given the schema index includes semester, let's include it for safety, 
                // BUT usually transport is annual. Let's try to match strict index.
                // Re-checking index: { studentId: 1, feeHead: 1, academicYear: 1, studentYear: 1, semester: 1 }
                , semester: student.current_semester || 1
            },
            { $set: feePayload },
            { upsert: true, new: true }
        );

        res.json({ message: 'Transport fee assigned successfully', amount: stage.amount });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Get Transport Allocation for a Student
exports.getStudentTransportAllocation = async (req, res) => {
    const { studentId } = req.params;
    try {
        // We look for a StudentFee record with name "Transport Fee"
        const feeHead = await FeeHead.findOne({ name: 'Transport Fee' });
        if (!feeHead) return res.json(null); // No transport fee system yet

        // Find most recent allocation? Or all? Let's return the latest for the current year context if possible
        // For now, let's return all transport fees for this student
        const allocations = await StudentFee.find({ studentId, feeHead: feeHead._id }).sort({ createdAt: -1 });

        res.json(allocations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Get ALL Transport Allocations (for reporting)
exports.getAllTransportAllocations = async (req, res) => {
    try {
        const feeHead = await FeeHead.findOne({ name: 'Transport Fee' });
        if (!feeHead) return res.json([]);

        // Fetch all student fees linked to this head
        const allocations = await StudentFee.find({ feeHead: feeHead._id })
            .sort({ createdAt: -1 });

        res.json(allocations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
