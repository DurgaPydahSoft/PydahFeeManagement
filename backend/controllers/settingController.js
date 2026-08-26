const Setting = require('../models/Setting');
const { schedulePaymentAccessReset, scheduleEmailReport } = require('../services/scheduler');

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
        allowedConcessionFeeHeads: [],
        maskName: 'Processing Fee',
        enableCustomReceiptSequence: false,
        receiptSequenceSeparator: '/',
        receiptSequencePadding: 5,
        receiptSequenceResetMonth: 4,
        receiptSequenceResetDay: 1,
        emailReportEnabled: false,
        emailReportHour: 18,
        emailReportMinute: 0,
        emailReportRecipients: '',
        excessFeeHead: null
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
    allowedConcessionFeeHeads,
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
    paymentAccessResetMinute,
    emailReportEnabled,
    emailReportHour,
    emailReportMinute,
    emailReportRecipients,
    excessFeeHead
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
          allowedConcessionFeeHeads: allowedConcessionFeeHeads || [],
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
          emailReportEnabled: emailReportEnabled !== undefined ? emailReportEnabled : false,
          emailReportHour: emailReportHour !== undefined ? Number(emailReportHour) : 18,
          emailReportMinute: emailReportMinute !== undefined ? Number(emailReportMinute) : 0,
          emailReportRecipients: emailReportRecipients || '',
          excessFeeHead: excessFeeHead || null
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

    // If email report schedule changed, update the running cron job
    try {
      const enabled = settings.emailReportEnabled === true;
      const hour = settings.emailReportHour ?? 18;
      const minute = settings.emailReportMinute ?? 0;
      const recipients = settings.emailReportRecipients || '';
      scheduleEmailReport(hour, minute, enabled, recipients);
    } catch (schedErr) {
      console.error('Error rescheduling email report:', schedErr);
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Manually trigger email report sending
// @route   POST /api/settings/send-test-report
// @access  Private
const sendManualReport = async (req, res) => {
  const { recipients, startDate, endDate } = req.body;
  if (!recipients || recipients.trim() === '') {
    return res.status(400).json({ message: 'No email recipients provided.' });
  }
  try {
    const { sendDailyAllCollegesReportEmail } = require('../services/emailReportService');
    console.log('[ManualReport] Triggering manual Daily Report email to:', recipients, 'Period:', startDate, 'to', endDate);
    await sendDailyAllCollegesReportEmail(recipients, startDate, endDate);
    res.json({ message: 'Report generated and emailed successfully!' });
  } catch (error) {
    console.error('[ManualReport] Failed to trigger manual report:', error);
    res.status(500).json({ message: 'Failed to trigger manual report email dispatch', error: error.message });
  }
};

module.exports = { getSettings, updateSettings, sendManualReport };

