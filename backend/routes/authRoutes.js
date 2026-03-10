const express = require('express');
const router = express.Router();
const { loginUser, ssoLogin } = require('../controllers/authController');

router.post('/login', loginUser);
router.post('/sso-login', ssoLogin);

module.exports = router;
