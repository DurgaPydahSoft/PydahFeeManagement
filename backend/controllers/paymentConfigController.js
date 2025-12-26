const PaymentConfig = require('../models/PaymentConfig');

// @desc    Get all payment configurations
// @route   GET /api/payment-config
// @access  Private
const getConfigs = async (req, res) => {
    try {
        const configs = await PaymentConfig.find().sort({ createdAt: -1 });
        res.status(200).json(configs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new payment configuration
// @route   POST /api/payment-config
// @access  Private
const createConfig = async (req, res) => {
    try {
        const { college, course, account_name, bank_name, account_number, ifsc_code, upi_id, razorpay_key_id, razorpay_key_secret } = req.body;

        if (!college || !course || !account_name || !bank_name || !account_number || !ifsc_code) {
            return res.status(400).json({ message: 'Please add all required fields (including College and Course)' });
        }

        const config = await PaymentConfig.create({
            college,
            course,
            account_name,
            bank_name,
            account_number,
            ifsc_code,
            upi_id,
            razorpay_key_id,
            razorpay_key_secret
        });

        res.status(201).json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a payment configuration
// @route   PUT /api/payment-config/:id
// @access  Private
const updateConfig = async (req, res) => {
    try {
        const config = await PaymentConfig.findById(req.params.id);

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        const updatedConfig = await PaymentConfig.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });

        res.status(200).json(updatedConfig);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete (Soft Delete) a payment configuration
// @route   DELETE /api/payment-config/:id
// @access  Private
const deleteConfig = async (req, res) => {
    try {
        const config = await PaymentConfig.findById(req.params.id);

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        // Soft delete: Toggle is_active or set to false. 
        // Here we'll set to false as "delete".
        const updatedConfig = await PaymentConfig.findByIdAndUpdate(req.params.id, { is_active: false }, {
            new: true,
        });
        
        // Alternatively, if the user really wants to delete:
        // await config.remove();

        res.status(200).json({ id: req.params.id, message: 'Configuration deactivated', config: updatedConfig });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle Active Status
// @route   PATCH /api/payment-config/:id/toggle
// @access  Private
const toggleConfigStatus = async (req, res) => {
    try {
        const config = await PaymentConfig.findById(req.params.id);

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        const updatedConfig = await PaymentConfig.findByIdAndUpdate(req.params.id, { is_active: !config.is_active }, {
            new: true,
        });

        res.status(200).json(updatedConfig);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    getConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfigStatus
};
