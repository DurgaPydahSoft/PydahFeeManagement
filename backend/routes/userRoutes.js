const express = require('express');
const router = express.Router();
const { getUsers, createUser, deleteUser, updateUserPermissions, updateUser } = require('../controllers/userController');

router.route('/').get(getUsers).post(createUser);
router.route('/:id').delete(deleteUser).put(updateUser);
router.route('/:id/permissions').put(updateUserPermissions);

module.exports = router;
