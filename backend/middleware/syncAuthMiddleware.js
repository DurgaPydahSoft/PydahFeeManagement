const verifySyncSecret = (req, res, next) => {
  const secret = process.env.STUDENT_FEE_SYNC_SECRET;
  if (!secret) {
    return res.status(503).json({ message: 'Student fee sync is not configured on the server' });
  }

  const headerSecret = req.headers['x-student-sync-secret'];
  const bearerSecret = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (headerSecret !== secret && bearerSecret !== secret) {
    return res.status(401).json({ message: 'Invalid sync credentials' });
  }

  next();
};

module.exports = { verifySyncSecret };
