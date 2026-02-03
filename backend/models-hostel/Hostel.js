const mongoose = require('mongoose');
const { getHostelConnection } = require('../config/dbHostel');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

hostelSchema.index({ name: 1 }, { unique: true });

let model = null;

function getModel() {
  const conn = getHostelConnection();
  if (!conn) throw new Error('Hostel DB not connected');
  if (!model) model = conn.model('Hostel', hostelSchema);
  return model;
}

module.exports = { getModel };
