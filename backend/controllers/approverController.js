const ConcessionApprover = require('../models/ConcessionApprover');

// @desc    Get all active concession approvers
// @route   GET /api/concession-approvers
const getApprovers = async (req, res) => {
  try {
    const approvers = await ConcessionApprover.find({ isActive: true });
    res.json(approvers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all concession approvers (for management)
// @route   GET /api/concession-approvers/all
const getAllApprovers = async (req, res) => {
  try {
    const approvers = await ConcessionApprover.find().sort({ name: 1 });
    res.json(approvers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new concession approver
// @route   POST /api/concession-approvers
const createApprover = async (req, res) => {
  const { name, designation } = req.body;
  if (!name || !designation) {
    return res.status(400).json({ message: 'Name and Designation are required' });
  }
  try {
    const approver = await ConcessionApprover.create({ name, designation });
    res.status(201).json(approver);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Toggle approver status
// @route   PUT /api/concession-approvers/:id/toggle
const toggleApproverStatus = async (req, res) => {
  try {
    const approver = await ConcessionApprover.findById(req.params.id);
    if (!approver) return res.status(404).json({ message: 'Approver not found' });
    approver.isActive = !approver.isActive;
    await approver.save();
    res.json(approver);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete an approver
// @route   DELETE /api/concession-approvers/:id
const deleteApprover = async (req, res) => {
  try {
    const approver = await ConcessionApprover.findByIdAndDelete(req.params.id);
    if (!approver) return res.status(404).json({ message: 'Approver not found' });
    res.json({ message: 'Approver removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getApprovers,
  getAllApprovers,
  createApprover,
  toggleApproverStatus,
  deleteApprover
};
