const Proceeding = require('../models/Proceeding');

const canApproveProceeding = (user) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    const permissions = user.permissions || [];
    return permissions.includes('proceedings_approve');
};

// @desc    Get all proceedings
// @route   GET /api/proceedings
const getProceedings = async (req, res) => {
    try {
        const { college, course, batch, caste, status } = req.query;
        let query = {};
        if (college) query.college = college;
        if (course) query.course = course;
        if (batch) query.batch = batch;
        if (status) query.status = status;
        if (caste) {
            query.$or = [
                { caste: caste },
                { caste: '' },
                { caste: null },
                { caste: { $exists: false } }
            ];
        }

        const proceedings = await Proceeding.find(query).sort({ createdAt: -1 });

        const Transaction = require('../models/Transaction');

        const proceedingsWithSummary = await Promise.all(proceedings.map(async (p) => {
            const txns = await Transaction.find({ proceedingId: p._id, status: { $ne: 'cancelled' } }).select('amount');
            const totalUsed = txns.reduce((acc, t) => acc + t.amount, 0);
            return {
                ...p.toObject(),
                totalUsed
            };
        }));

        res.json(proceedingsWithSummary);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a proceeding (starts as Pending — needs approval to become Active)
// @route   POST /api/proceedings
const createProceeding = async (req, res) => {
    try {
        const {
            proceedingNumber,
            proceedingDate,
            amount,
            bankAccount,
            bankCreditedDate,
            college,
            course,
            caste,
            batch,
            academicYear
        } = req.body;

        if (!proceedingNumber || !proceedingDate || !amount || !college || !course) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const proceedingExists = await Proceeding.findOne({ proceedingNumber, course });
        if (proceedingExists) {
            return res.status(400).json({
                message: `Proceeding number '${proceedingNumber}' already exists for course '${course}'`
            });
        }

        const proceeding = await Proceeding.create({
            proceedingNumber,
            proceedingDate,
            amount,
            bankAccount,
            bankCreditedDate,
            college,
            course,
            caste,
            batch,
            academicYear,
            status: 'Pending',
            requestedBy: req.user?.username || '',
            requestedByName: req.user?.name || ''
        });

        res.status(201).json(proceeding);
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({
                message: `Proceeding number '${req.body.proceedingNumber}' already exists for course '${req.body.course}'`
            });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get single proceeding
// @route   GET /api/proceedings/:id
const getProceedingById = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) {
            return res.status(404).json({ message: 'Proceeding not found' });
        }
        res.json(proceeding);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a proceeding (Pending can be edited; status cannot be set to Active here)
// @route   PUT /api/proceedings/:id
const updateProceeding = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) {
            return res.status(404).json({ message: 'Proceeding not found' });
        }

        const nextProceedingNumber = req.body.proceedingNumber ?? proceeding.proceedingNumber;
        const nextCourse = req.body.course ?? proceeding.course;

        const duplicate = await Proceeding.findOne({
            proceedingNumber: nextProceedingNumber,
            course: nextCourse,
            _id: { $ne: proceeding._id }
        });
        if (duplicate) {
            return res.status(400).json({
                message: `Proceeding number '${nextProceedingNumber}' already exists for course '${nextCourse}'`
            });
        }

        // Never allow activating via normal update — must use approve endpoint
        const updatePayload = { ...req.body };
        if (updatePayload.status === 'Active' && proceeding.status !== 'Active') {
            delete updatePayload.status;
        }

        const updatedProceeding = await Proceeding.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true }
        );

        res.json(updatedProceeding);
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({
                message: `Proceeding number '${req.body.proceedingNumber}' already exists for course '${req.body.course}'`
            });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Approve a pending proceeding → Active
// @route   PUT /api/proceedings/:id/approve
const approveProceeding = async (req, res) => {
    try {
        if (!canApproveProceeding(req.user)) {
            return res.status(403).json({ message: 'Forbidden: proceedings approve permission required' });
        }

        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) {
            return res.status(404).json({ message: 'Proceeding not found' });
        }
        if (proceeding.status !== 'Pending') {
            return res.status(400).json({ message: `Proceeding is already ${proceeding.status}` });
        }

        proceeding.status = 'Active';
        proceeding.approvedBy = req.user?.username || '';
        proceeding.approvedByName = req.user?.name || '';
        proceeding.approvedAt = new Date();
        await proceeding.save();

        res.json({ message: 'Proceeding approved successfully', proceeding });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a proceeding
// @route   DELETE /api/proceedings/:id
const deleteProceeding = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) {
            return res.status(404).json({ message: 'Proceeding not found' });
        }

        await proceeding.deleteOne();
        res.json({ message: 'Proceeding removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get students and amount used for a proceeding
// @route   GET /api/proceedings/:id/summary
const getProceedingSummary = async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find({ proceedingId: req.params.id, status: { $ne: 'cancelled' } })
            .sort({ createdAt: -1 });

        const totalUsed = transactions.reduce((acc, t) => acc + t.amount, 0);

        res.json({
            transactions,
            totalUsed
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    approveProceeding,
    deleteProceeding,
    getProceedingSummary
};
