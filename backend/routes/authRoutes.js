const express = require('express');
const router = express.Router();
const { loginUser, ssoLogin, logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/sso-login', ssoLogin);
router.post('/logout', protect, logoutUser); // Protected — clears sessionId in DB

module.exports = router;
