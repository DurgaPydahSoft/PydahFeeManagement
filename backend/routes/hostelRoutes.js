const express = require('express');
const router = express.Router();
const {
  getHostels,
  createHostel,
  updateHostel,
  deleteHostel,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  getHostelFeeStructures,
  createHostelFeeStructure,
  updateHostelFeeStructure,
  deleteHostelFeeStructure,
  bulkUpsertHostelFeeStructures,
  deleteHostelFeeStructureByRow,
  applyHostelFee
} = require('../controllers/hostelController');

// Hostels (base path when mounted: /api/hostels)
router.get('/', getHostels);
router.post('/', createHostel);

// Rooms and categories (specific paths before /:id)
router.get('/rooms', getRooms);
router.post('/rooms', createRoom);
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/:hostelId/categories', getCategories);

// Hostel fee structures (academic year + hostel + course + category → amount)
router.get('/fee-structures', getHostelFeeStructures);
router.post('/fee-structures/apply', applyHostelFee);
router.post('/fee-structures/bulk-upsert', bulkUpsertHostelFeeStructures);
router.delete('/fee-structures/by-row', deleteHostelFeeStructureByRow);
router.post('/fee-structures', createHostelFeeStructure);
router.put('/fee-structures/:id', updateHostelFeeStructure);
router.delete('/fee-structures/:id', deleteHostelFeeStructure);

// Hostel update/delete (parametric last)
router.put('/:id', updateHostel);
router.delete('/:id', deleteHostel);

module.exports = router;
