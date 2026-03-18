const Setting = require('../models/Setting');

// @desc    Get settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      // Return default if not found
      settings = {
        showCollegeHeader: true,
        enableCashPayment: true,
        enableBankPayment: true,
        enableSplitPayment: true,
        maskedFeeHeads: [],
        maskName: 'Processing Fee'
      };
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private (Admin)
const updateSettings = async (req, res) => {
  const { 
    showCollegeHeader, 
    enableCashPayment,
    enableBankPayment,
    enableSplitPayment,
    maskedFeeHeads, 
    maskName, 
    paperSize, 
    copiesPerPage 
  } = req.body;
  console.log('Update Settings Body:', req.body);

  try {
    // Upsert: Find the first document and update it, or create if none exists.
    // simple findOneAndUpdate with empty filter works for singleton logic if we only ever access it this way.
    const settings = await Setting.findOneAndUpdate(
      {},
      {
        $set: {
          showCollegeHeader: showCollegeHeader,
          enableCashPayment: enableCashPayment,
          enableBankPayment: enableBankPayment,
          enableSplitPayment: enableSplitPayment,
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
