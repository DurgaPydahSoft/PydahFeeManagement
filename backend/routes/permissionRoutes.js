const express = require('express');
const router = express.Router();
const { createPermission, getPermissions } = require('../controllers/permissionController');

// Basic protection - assuming valid user login required (handled by frontend/other layers or none for now)
router.post('/', createPermission);
router.get('/', getPermissions);

module.exports = router;
