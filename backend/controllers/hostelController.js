const { getHostelConnection } = require('../config/dbHostel');

const hostelsUnavailable = (res) => {
  return res.status(503).json({ message: 'Hostel database not configured or unavailable. Set MONGO_HOSTEL_URI.' });
};

// --- Hostels ---

exports.getHostels = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Hostel = require('../models-hostel/Hostel').getModel();
    const hostels = await Hostel.find().sort({ createdAt: -1 });
    res.json(hostels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createHostel = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Hostel = require('../models-hostel/Hostel').getModel();
    const { name, description, isActive } = req.body;
    const existing = await Hostel.findOne({ name: (name || '').trim() });
    if (existing) return res.status(400).json({ message: 'Hostel name already exists' });
    const hostel = new Hostel({ name: (name || '').trim(), description: description || '', isActive: isActive !== false });
    const saved = await hostel.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateHostel = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Hostel = require('../models-hostel/Hostel').getModel();
    const { name, description, isActive } = req.body;
    const hostel = await Hostel.findByIdAndUpdate(
      req.params.id,
      { name: name != null ? name.trim() : undefined, description, isActive },
      { new: true, runValidators: true }
    );
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.json(hostel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteHostel = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Hostel = require('../models-hostel/Hostel').getModel();
    const HostelCategory = require('../models-hostel/HostelCategory').getModel();
    const Room = require('../models-hostel/Room').getModel();
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const hostel = await Hostel.findByIdAndDelete(req.params.id);
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    await HostelCategory.deleteMany({ hostel: req.params.id });
    await Room.deleteMany({ hostel: req.params.id });
    await HostelFeeStructure.deleteMany({ hostel: req.params.id });
    res.json({ message: 'Hostel and associated categories, rooms and fee structures deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Categories (per hostel) ---

exports.getCategories = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelCategory = require('../models-hostel/HostelCategory').getModel();
    const { hostelId } = req.params;
    const categories = await HostelCategory.find({ hostel: hostelId }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelCategory = require('../models-hostel/HostelCategory').getModel();
    const { hostelId, name, description, isActive } = req.body;
    const hostel = req.body.hostel || hostelId;
    if (!hostel) return res.status(400).json({ message: 'Hostel is required' });
    const existing = await HostelCategory.findOne({ hostel, name: (name || '').trim() });
    if (existing) return res.status(400).json({ message: 'Category name already exists for this hostel' });
    const category = new HostelCategory({
      hostel,
      name: (name || '').trim(),
      description: description || '',
      isActive: isActive !== false
    });
    const saved = await category.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelCategory = require('../models-hostel/HostelCategory').getModel();
    const { name, description, isActive } = req.body;
    const category = await HostelCategory.findByIdAndUpdate(
      req.params.id,
      { name: name != null ? name.trim() : undefined, description, isActive },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelCategory = require('../models-hostel/HostelCategory').getModel();
    const Room = require('../models-hostel/Room').getModel();
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const category = await HostelCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    await Room.deleteMany({ category: req.params.id });
    await HostelFeeStructure.deleteMany({ category: req.params.id });
    res.json({ message: 'Category and associated rooms and fee structures deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Rooms (per hostel + category) ---

exports.getRooms = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Room = require('../models-hostel/Room').getModel();
    const { hostelId, categoryId } = req.query;
    const filter = {};
    if (hostelId) filter.hostel = hostelId;
    if (categoryId) filter.category = categoryId;
    const rooms = await Room.find(filter)
      .populate('hostel', 'name')
      .populate('category', 'name')
      .sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRoom = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Room = require('../models-hostel/Room').getModel();
    const { hostel, category, roomNumber, bedCount, meterType, isActive } = req.body;
    if (!hostel || !category || !roomNumber) {
      return res.status(400).json({ message: 'Hostel, category and room number are required' });
    }
    const num = String(roomNumber).trim();
    if (!/^\d{3}$/.test(num)) {
      return res.status(400).json({ message: 'Room number must be 3 digits' });
    }
    const existing = await Room.findOne({ hostel, category, roomNumber: num });
    if (existing) return res.status(400).json({ message: 'Room number already exists for this hostel and category' });
    const room = new Room({
      hostel,
      category,
      roomNumber: num,
      bedCount: bedCount != null ? Number(bedCount) : 1,
      meterType: meterType === 'dual' ? 'dual' : 'single',
      isActive: isActive !== false
    });
    const saved = await room.save();
    const populated = await Room.findById(saved._id).populate('hostel', 'name').populate('category', 'name');
    res.status(201).json(populated || saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateRoom = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Room = require('../models-hostel/Room').getModel();
    const { roomNumber, bedCount, meterType, isActive } = req.body;
    const update = {};
    if (roomNumber != null) {
      const num = String(roomNumber).trim();
      if (!/^\d{3}$/.test(num)) return res.status(400).json({ message: 'Room number must be 3 digits' });
      update.roomNumber = num;
    }
    if (bedCount != null) update.bedCount = Number(bedCount);
    if (meterType != null) update.meterType = meterType === 'dual' ? 'dual' : 'single';
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('hostel', 'name')
      .populate('category', 'name');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteRoom = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const Room = require('../models-hostel/Room').getModel();
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Hostel Fee Structures (academic year + hostel + category → amount) ---

exports.getHostelFeeStructures = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const { hostelId, academicYear, course, studentYear } = req.query;
    const filter = {};
    if (hostelId) filter.hostel = hostelId;
    if (academicYear) filter.academicYear = academicYear;
    if (course) filter.course = course;
    if (studentYear !== undefined && studentYear !== '') filter.studentYear = Number(studentYear);
    const list = await HostelFeeStructure.find(filter)
      .populate('hostel', 'name')
      .populate('category', 'name')
      .sort({ academicYear: -1, hostel: 1, course: 1, studentYear: 1, category: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createHostelFeeStructure = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const { academicYear, hostelId, categoryId, course, studentYear, amount, description } = req.body;
    const hostel = hostelId || req.body.hostel;
    const category = categoryId || req.body.category;
    const courseVal = (course || req.body.course || '').trim();
    const yearNum = studentYear != null && studentYear !== '' ? Number(studentYear) : 1;
    if (!academicYear || !hostel || !category || !courseVal || amount == null || amount === '') {
      return res.status(400).json({ message: 'Academic year, hostel, course, category and amount are required' });
    }
    if (isNaN(yearNum) || yearNum < 1) return res.status(400).json({ message: 'Student year must be at least 1' });
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) return res.status(400).json({ message: 'Amount must be a non-negative number' });
    const existing = await HostelFeeStructure.findOne({ academicYear: academicYear.trim(), hostel, category, course: courseVal, studentYear: yearNum });
    if (existing) return res.status(400).json({ message: 'Fee structure already exists for this academic year, hostel, course, year and category' });
    const structure = new HostelFeeStructure({
      academicYear: academicYear.trim(),
      hostel,
      category,
      course: courseVal,
      studentYear: yearNum,
      amount: amt,
      description: description || ''
    });
    const saved = await structure.save();
    const populated = await HostelFeeStructure.findById(saved._id).populate('hostel', 'name').populate('category', 'name');
    res.status(201).json(populated || saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Bulk upsert: set fees for all categories (academic year + hostel + course + studentYear) in one call
exports.bulkUpsertHostelFeeStructures = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const { academicYear, hostelId, course, studentYear, categoryAmounts, description } = req.body;
    const hostel = hostelId || req.body.hostel;
    const courseVal = (course || '').trim();
    const yearNum = studentYear != null && studentYear !== '' ? Number(studentYear) : 1;
    if (!academicYear || !hostel || !courseVal || !Array.isArray(categoryAmounts) || categoryAmounts.length === 0) {
      return res.status(400).json({ message: 'Academic year, hostel, course and categoryAmounts array are required' });
    }
    if (isNaN(yearNum) || yearNum < 1) return res.status(400).json({ message: 'Student year must be at least 1' });
    const results = [];
    for (const { categoryId, amount } of categoryAmounts) {
      if (!categoryId) continue;
      const amt = Number(amount);
      if (isNaN(amt) || amt < 0) continue;
      const structure = await HostelFeeStructure.findOneAndUpdate(
        { academicYear: academicYear.trim(), hostel, category: categoryId, course: courseVal, studentYear: yearNum },
        { amount: amt, description: description || '' },
        { new: true, upsert: true, runValidators: true }
      );
      const populated = await HostelFeeStructure.findById(structure._id).populate('hostel', 'name').populate('category', 'name');
      results.push(populated || structure);
    }
    res.json(results);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete all fee structures for a row (academic year + hostel + course + studentYear)
exports.deleteHostelFeeStructureByRow = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const { academicYear, hostelId, course, studentYear } = req.body;
    const hostel = hostelId || req.body.hostel;
    const courseVal = (course || '').trim();
    const yearNum = studentYear != null && studentYear !== '' ? Number(studentYear) : null;
    if (!academicYear || !hostel || !courseVal) {
      return res.status(400).json({ message: 'Academic year, hostel and course are required' });
    }
    const filter = { academicYear, hostel, course: courseVal };
    if (yearNum != null && !isNaN(yearNum)) filter.studentYear = yearNum;
    const result = await HostelFeeStructure.deleteMany(filter);
    res.json({ message: `Deleted ${result.deletedCount} fee structure(s)`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHostelFeeStructure = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const { amount, description } = req.body;
    const update = {};
    if (amount != null && amount !== '') update.amount = Number(amount);
    if (description != null) update.description = description;
    const structure = await HostelFeeStructure.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('hostel', 'name')
      .populate('category', 'name');
    if (!structure) return res.status(404).json({ message: 'Fee structure not found' });
    res.json(structure);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteHostelFeeStructure = async (req, res) => {
  if (!getHostelConnection()) return hostelsUnavailable(res);
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const structure = await HostelFeeStructure.findByIdAndDelete(req.params.id);
    if (!structure) return res.status(404).json({ message: 'Fee structure not found' });
    res.json({ message: 'Fee structure deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Apply hostel fee structure to selected students or to all students in selected year(s)
// Body: hostelFeeStructureId, studentIds? (for manual selection), applyToYears? (e.g. [1,2,3,4] – apply to all students in those years for same course/batch)
exports.applyHostelFee = async (req, res) => {
  if (!getHostelConnection()) return res.status(503).json({ message: 'Hostel database not configured.' });
  const { hostelFeeStructureId, studentIds, applyToYears } = req.body;
  if (!hostelFeeStructureId) {
    return res.status(400).json({ message: 'hostelFeeStructureId is required' });
  }
  const useApplyToYears = Array.isArray(applyToYears) && applyToYears.length > 0;
  if (!useApplyToYears && (!Array.isArray(studentIds) || studentIds.length === 0)) {
    return res.status(400).json({ message: 'Either studentIds array or applyToYears array is required' });
  }
  try {
    const HostelFeeStructure = require('../models-hostel/HostelFeeStructure').getModel();
    const FeeHead = require('../models/FeeHead');
    const StudentFee = require('../models/StudentFee');
    const db = require('../config/sqlDb');

    const structure = await HostelFeeStructure.findById(hostelFeeStructureId)
      .populate('hostel', 'name')
      .populate('category', 'name');
    if (!structure) return res.status(404).json({ message: 'Hostel fee structure not found' });

    let feeHead = await FeeHead.findOne({ name: 'Hostel Fee' });
    if (!feeHead) {
      feeHead = await FeeHead.create({ name: 'Hostel Fee', description: 'Hostel accommodation fee', code: 'HOSTEL' });
    }

    const hostelName = structure.hostel?.name || 'Hostel';
    const categoryName = structure.category?.name || 'Category';
    const remarks = `Hostel: ${hostelName} - ${categoryName}`;

    let admissionNumbers = [];
    if (useApplyToYears) {
      const years = applyToYears.map((y) => Number(y)).filter((y) => !isNaN(y) && y >= 1);
      if (years.length === 0) return res.status(400).json({ message: 'applyToYears must contain valid year numbers' });
      const placeholders = years.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT admission_number FROM students WHERE course = ? AND batch = ? AND current_year IN (${placeholders})`,
        [structure.course, structure.academicYear, ...years]
      );
      admissionNumbers = rows.map((r) => r.admission_number);
    } else {
      admissionNumbers = studentIds;
    }

    let applied = 0;
    let skipped = 0;
    for (const admissionNo of admissionNumbers) {
      const [rows] = await db.query(
        'SELECT admission_number, student_name, college, course, branch, current_year, current_semester, batch FROM students WHERE admission_number = ?',
        [admissionNo]
      );
      if (rows.length === 0) {
        skipped++;
        continue;
      }
      const s = rows[0];
      const filter = {
        studentId: s.admission_number,
        feeHead: feeHead._id,
        academicYear: structure.academicYear,
        studentYear: s.current_year,
        semester: s.current_semester || 1,
        remarks
      };
      await StudentFee.findOneAndUpdate(
        filter,
        {
          $set: {
            studentId: s.admission_number,
            studentName: s.student_name,
            feeHead: feeHead._id,
            structureId: null,
            college: s.college,
            course: s.course,
            branch: s.branch,
            academicYear: structure.academicYear,
            studentYear: s.current_year,
            semester: s.current_semester || 1,
            amount: structure.amount,
            remarks
          }
        },
        { upsert: true }
      );
      applied++;
    }
    res.json({ message: `Hostel fee applied to ${applied} student(s)`, applied, skipped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
