const mongoose = require('mongoose');
const { getHostelConnection } = require('../config/dbHostel');

const hostelCategorySchema = new mongoose.Schema({
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
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

hostelCategorySchema.index({ hostel: 1, name: 1 }, { unique: true });

let model = null;

function getModel() {
  const conn = getHostelConnection();
  if (!conn) throw new Error('Hostel DB not connected');
  if (!model) model = conn.model('HostelCategory', hostelCategorySchema);
  return model;
}

module.exports = { getModel };
