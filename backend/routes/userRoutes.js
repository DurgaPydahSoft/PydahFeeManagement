const express = require('express');
const router = express.Router();
const { getUsers, getMe, createUser, deleteUser, updateUserPermissions, updateUser, updateUserPaymentAccess } = require('../controllers/userController');

router.route('/me').get(getMe);
router.route('/').get(getUsers).post(createUser);
router.route('/:id').delete(deleteUser).put(updateUser);
router.route('/:id/permissions').put(updateUserPermissions);
router.route('/:id/payment-access').put(updateUserPaymentAccess);

module.exports = router;
