const Proceeding = require('../models/Proceeding');

// @desc    Get all proceedings
// @route   GET /api/proceedings
// @access  Public (for now)
const getProceedings = async (req, res) => {
    try {
        const { college, course, batch, caste } = req.query;
        let query = {};
        if (college) query.college = college;
        if (course) query.course = course;
        if (batch) query.batch = batch;
        if (caste) query.caste = caste;

        const proceedings = await Proceeding.find(query).sort({ createdAt: -1 });
        
        // Enhance with totalUsed
        const Transaction = require('../models/Transaction');
        
        const proceedingsWithSummary = await Promise.all(proceedings.map(async (p) => {
            const txns = await Transaction.find({ proceedingId: p._id }).select('amount');
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

// @desc    Create a proceeding
// @route   POST /api/proceedings
// @access  Public (for now)
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

        const proceedingExists = await Proceeding.findOne({ proceedingNumber });
        if (proceedingExists) {
            return res.status(400).json({ message: 'Proceeding number already exists' });
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
            academicYear
        });

        res.status(201).json(proceeding);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get single proceeding
// @route   GET /api/proceedings/:id
// @access  Public (for now)
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

// @desc    Update a proceeding
// @route   PUT /api/proceedings/:id
// @access  Public (for now)
const updateProceeding = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) {
            return res.status(404).json({ message: 'Proceeding not found' });
        }

        const updatedProceeding = await Proceeding.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updatedProceeding);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a proceeding
// @route   DELETE /api/proceedings/:id
// @access  Public (for now)
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
// @access  Public (for now)
const getProceedingSummary = async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        const transactions = await Transaction.find({ proceedingId: req.params.id })
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
    deleteProceeding,
    getProceedingSummary
};
