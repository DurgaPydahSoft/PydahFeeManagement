const { syncStudentFeesByAdmissionNumber } = require('../services/studentFeeSyncService');

// @desc    Sync fee records for one or more students (called by admissions / external apps)
// @route   POST /api/sync/student-fees
// @access  Sync secret (X-Student-Sync-Secret or Bearer token)
const syncStudentFees = async (req, res) => {
  const { admissionNumber, admissionNumbers } = req.body || {};
  const numbers = [
    ...(Array.isArray(admissionNumbers) ? admissionNumbers : []),
    ...(admissionNumber ? [admissionNumber] : [])
  ]
    .map(n => String(n).trim())
    .filter(Boolean);

  const uniqueNumbers = [...new Set(numbers)];
  if (uniqueNumbers.length === 0) {
    return res.status(400).json({ message: 'Provide admissionNumber or admissionNumbers' });
  }

  const results = [];
  for (const num of uniqueNumbers) {
    try {
      const result = await syncStudentFeesByAdmissionNumber(num);
      results.push({ success: true, ...result });
    } catch (error) {
      results.push({
        success: false,
        admissionNumber: num,
        message: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  res.status(successCount === uniqueNumbers.length ? 200 : 207).json({
    message: `Synced fees for ${successCount} of ${uniqueNumbers.length} student(s)`,
    results
  });
};

module.exports = { syncStudentFees };
