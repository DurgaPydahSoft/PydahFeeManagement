const ReceiptSetting = require('../models/ReceiptSetting');

// @desc    Get receipt settings
// @route   GET /api/receipt-settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    let settings = await ReceiptSetting.findOne();
    if (!settings) {
      // Return default if not found
      settings = {
        showCollegeHeader: true,
        maskedFeeHeads: [],
        maskName: 'Processing Fee'
      };
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update receipt settings
// @route   PUT /api/receipt-settings
// @access  Private (Admin)
const updateSettings = async (req, res) => {
  const { showCollegeHeader, maskedFeeHeads, maskName, paperSize, copiesPerPage } = req.body;
  console.log('Update Receipt Settings Body:', req.body);

  try {
    // Upsert: Find the first document and update it, or create if none exists.
    // simple findOneAndUpdate with empty filter works for singleton logic if we only ever access it this way.
    const settings = await ReceiptSetting.findOneAndUpdate(
      {},
      {
        $set: {
          showCollegeHeader: showCollegeHeader,
          maskedFeeHeads: maskedFeeHeads,
          maskName: maskName || 'Processing Fee',
          paperSize: paperSize || 'A4',
          copiesPerPage: copiesPerPage || 2
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getSettings, updateSettings };
