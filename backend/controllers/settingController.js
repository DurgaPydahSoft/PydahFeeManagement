const Setting = require('../models/Setting');
const { schedulePaymentAccessReset } = require('../services/scheduler');

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
        maskName: 'Processing Fee',
        enableCustomReceiptSequence: false,
        receiptSequenceSeparator: '/',
        receiptSequencePadding: 5,
        receiptSequenceResetMonth: 4,
        receiptSequenceResetDay: 1
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
    copiesPerPage,
    enableCustomReceiptSequence,
    receiptSequenceSeparator,
    receiptSequencePadding,
    receiptSequenceResetMonth,
    receiptSequenceResetDay,
    paymentAccessAutoReset,
    paymentAccessResetHour,
    paymentAccessResetMinute
  } = req.body;

  try {
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
          copiesPerPage: copiesPerPage || 2,
          enableCustomReceiptSequence: enableCustomReceiptSequence !== undefined ? enableCustomReceiptSequence : false,
          receiptSequenceSeparator: receiptSequenceSeparator || '/',
          receiptSequencePadding: receiptSequencePadding !== undefined ? Number(receiptSequencePadding) : 5,
          receiptSequenceResetMonth: receiptSequenceResetMonth !== undefined ? Number(receiptSequenceResetMonth) : 4,
          receiptSequenceResetDay: receiptSequenceResetDay !== undefined ? Number(receiptSequenceResetDay) : 1,
          paymentAccessAutoReset: paymentAccessAutoReset !== undefined ? paymentAccessAutoReset : true,
          paymentAccessResetHour: paymentAccessResetHour !== undefined ? Number(paymentAccessResetHour) : 9,
          paymentAccessResetMinute: paymentAccessResetMinute !== undefined ? Number(paymentAccessResetMinute) : 0,
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If auto-reset schedule changed, update the running cron job
    try {
      const autoReset = settings.paymentAccessAutoReset !== false;
      const hour = settings.paymentAccessResetHour ?? 9;
      const minute = settings.paymentAccessResetMinute ?? 0;
      if (autoReset) {
        schedulePaymentAccessReset(hour, minute);
      }
    } catch (schedErr) {
      console.error('Error rescheduling payment reset:', schedErr);
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getSettings, updateSettings };
