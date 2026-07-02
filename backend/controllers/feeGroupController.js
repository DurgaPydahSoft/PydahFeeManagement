const FeeGroup = require('../models/FeeGroup');

// @desc    Get all fee groups
// @route   GET /api/fee-groups
// @access  Protected
const getFeeGroups = async (req, res) => {
  try {
    const feeGroups = await FeeGroup.find().populate('feeHeads').sort({ name: 1 });
    res.json(feeGroups);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Create a fee group
// @route   POST /api/fee-groups
// @access  Protected
const createFeeGroup = async (req, res) => {
  const { name, description, feeHeads, isActive } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Please add a group name' });
  }

  try {
    const groupExists = await FeeGroup.findOne({ name });
    if (groupExists) {
      return res.status(400).json({ message: 'Fee Group already exists' });
    }

    const feeGroup = await FeeGroup.create({
      name,
      description,
      feeHeads: feeHeads || [],
      isActive: isActive !== undefined ? isActive : true
    });

    const populatedGroup = await FeeGroup.findById(feeGroup._id).populate('feeHeads');
    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update a fee group
// @route   PUT /api/fee-groups/:id
// @access  Protected
const updateFeeGroup = async (req, res) => {
  const { name, description, feeHeads, isActive } = req.body;

  try {
    const feeGroup = await FeeGroup.findById(req.params.id);

    if (!feeGroup) {
      return res.status(404).json({ message: 'Fee Group not found' });
    }

    if (name) {
      // Check if duplicate name
      const duplicate = await FeeGroup.findOne({ name, _id: { $ne: req.params.id } });
      if (duplicate) {
        return res.status(400).json({ message: 'Another group already has this name' });
      }
      feeGroup.name = name;
    }
    if (description !== undefined) feeGroup.description = description;
    if (feeHeads !== undefined) feeGroup.feeHeads = feeHeads;
    if (isActive !== undefined) feeGroup.isActive = isActive;

    await feeGroup.save();
    const populatedGroup = await FeeGroup.findById(feeGroup._id).populate('feeHeads');
    res.json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a fee group
// @route   DELETE /api/fee-groups/:id
// @access  Protected
const deleteFeeGroup = async (req, res) => {
  try {
    const feeGroup = await FeeGroup.findById(req.params.id);

    if (!feeGroup) {
      return res.status(404).json({ message: 'Fee Group not found' });
    }

    await feeGroup.deleteOne();
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getFeeGroups,
  createFeeGroup,
  updateFeeGroup,
  deleteFeeGroup
};
