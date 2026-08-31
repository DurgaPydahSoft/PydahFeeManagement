const express = require('express');
const router = express.Router();
const { getReferenceNames } = require('../controllers/admissionsController');

router.get('/reference-names', getReferenceNames);

module.exports = router;
