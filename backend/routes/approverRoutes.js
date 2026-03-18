const express = require('express');
const router = express.Router();
const { 
  getApprovers, 
  getAllApprovers, 
  createApprover, 
  toggleApproverStatus, 
  deleteApprover 
} = require('../controllers/approverController');

// All active
router.get('/', getApprovers);

// All including inactive (management)
router.get('/all', getAllApprovers);

// CRUD
router.post('/', createApprover);
router.put('/:id/toggle', toggleApproverStatus);
router.delete('/:id', deleteApprover);

module.exports = router;
