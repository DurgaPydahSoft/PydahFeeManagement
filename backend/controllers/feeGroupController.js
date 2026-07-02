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
  const { name, code, description, feeHeads, isActive } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: 'Please add a group name and group code' });
  }

  try {
    const groupExists = await FeeGroup.findOne({ name: name.trim() });
    if (groupExists) {
      return res.status(400).json({ message: 'Fee Group name already exists' });
    }

    const codeExists = await FeeGroup.findOne({ code: code.toUpperCase().trim() });
    if (codeExists) {
      return res.status(400).json({ message: 'Group Code already exists' });
    }

    // Mutual Exclusivity Check
    if (feeHeads && feeHeads.length > 0) {
      const overlappingGroup = await FeeGroup.findOne({
        feeHeads: { $in: feeHeads }
      });
      if (overlappingGroup) {
        return res.status(400).json({ message: `One or more selected fee heads already belong to another group: ${overlappingGroup.name}` });
      }
    }

    const feeGroup = await FeeGroup.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
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
  const { name, code, description, feeHeads, isActive } = req.body;

  try {
    const feeGroup = await FeeGroup.findById(req.params.id);

    if (!feeGroup) {
      return res.status(404).json({ message: 'Fee Group not found' });
    }

    if (name) {
      const duplicate = await FeeGroup.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (duplicate) {
        return res.status(400).json({ message: 'Another group already has this name' });
      }
      feeGroup.name = name.trim();
    }

    if (code) {
      const duplicateCode = await FeeGroup.findOne({ code: code.toUpperCase().trim(), _id: { $ne: req.params.id } });
      if (duplicateCode) {
        return res.status(400).json({ message: 'Another group already has this group code' });
      }
      feeGroup.code = code.toUpperCase().trim();
    }

    if (feeHeads !== undefined) {
      if (feeHeads.length > 0) {
        const overlappingGroup = await FeeGroup.findOne({
          _id: { $ne: req.params.id },
          feeHeads: { $in: feeHeads }
        });
        if (overlappingGroup) {
          return res.status(400).json({ message: `One or more selected fee heads already belong to another group: ${overlappingGroup.name}` });
        }
      }
      feeGroup.feeHeads = feeHeads;
    }

    if (description !== undefined) feeGroup.description = description;
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
