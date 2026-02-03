const mongoose = require('mongoose');
const { getHostelConnection } = require('../config/dbHostel');

const hostelFeeStructureSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HostelCategory',
    required: true,
    index: true
  },
  course: {
    type: String,
    required: true,
    trim: true,
    index: true,
    default: ''
  },
  studentYear: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

hostelFeeStructureSchema.index({ academicYear: 1, hostel: 1, category: 1, course: 1, studentYear: 1 }, { unique: true });

let model = null;

function getModel() {
  const conn = getHostelConnection();
  if (!conn) throw new Error('Hostel DB not connected');
  if (!model) model = conn.model('HostelFeeStructure', hostelFeeStructureSchema);
  return model;
}

module.exports = { getModel };
