const express = require('express');
const router = express.Router();
const { loginUser, ssoLogin, logoutUser, forgotPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/sso-login', ssoLogin);
router.post('/logout', protect, logoutUser); // Protected — clears sessionId in DB
router.post('/forgot-password', forgotPassword);

module.exports = router;
