const express = require('express');
const router = express.Router();
const { getCampuses, getCampusColleges } = require('../controllers/campusController');

router.get('/', getCampuses);
router.get('/:id/colleges', getCampusColleges);

module.exports = router;
