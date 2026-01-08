const FeeHead = require('../models/FeeHead');

// @desc    Get all fee heads
// @route   GET /api/fee-heads
// @access  Public (for now)
const getFeeHeads = async (req, res) => {
  try {
    const feeHeads = await FeeHead.find().sort({ name: 1 });
    res.json(feeHeads);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a fee head
// @route   POST /api/fee-heads
// @access  Public (for now)
const createFeeHead = async (req, res) => {
  const { name, description, code } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Please add a fee head name' });
  }

  try {
    const feeHeadExists = await FeeHead.findOne({ name });
    if (feeHeadExists) {
      return res.status(400).json({ message: 'Fee Head already exists' });
    }
    
    // Check code uniqueness if provided
    if (code) {
        const codeExists = await FeeHead.findOne({ code });
        if (codeExists) {
            return res.status(400).json({ message: 'Fee Head Code already exists' });
        }
    }

    const feeHead = await FeeHead.create({
      name,
      description,
      code
    });

    res.status(201).json(feeHead);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a fee head
// @route   DELETE /api/fee-heads/:id
// @access  Public (for now)
const deleteFeeHead = async (req, res) => {
  try {
    const feeHead = await FeeHead.findById(req.params.id);

    if (!feeHead) {
      return res.status(404).json({ message: 'Fee Head not found' });
    }

    await feeHead.deleteOne();

    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a fee head
// @route   PUT /api/fee-heads/:id
// @access  Public (for now)
const updateFeeHead = async (req, res) => {
  const { name, description, code } = req.body;

  try {
    const feeHead = await FeeHead.findById(req.params.id);

    if (!feeHead) {
      return res.status(404).json({ message: 'Fee Head not found' });
    }

    if (name) feeHead.name = name;
    if (description) feeHead.description = description;
    if (code) feeHead.code = code;

    const updatedFeeHead = await feeHead.save();
    res.json(updatedFeeHead);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getFeeHeads,
  createFeeHead,
  deleteFeeHead,
  updateFeeHead,
};
