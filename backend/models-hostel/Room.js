const mongoose = require('mongoose');
const { getHostelConnection } = require('../config/dbHostel');

const roomSchema = new mongoose.Schema({
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: [true, 'Hostel is required'],
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HostelCategory',
    required: [true, 'Category is required'],
    index: true
  },
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    trim: true,
    validate: {
      validator: function (v) {
        return /^\d{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid room number! Must be 3 digits.`
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bedCount: {
    type: Number,
    default: 1,
    min: 1
  },
  meterType: {
    type: String,
    enum: ['single', 'dual'],
    default: 'single'
  },
  electricityBills: [
    {
      month: { type: String, required: true, match: [/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'] },
      startUnits: { type: Number, min: 0 },
      endUnits: { type: Number, min: 0 },
      meter1StartUnits: { type: Number, min: 0 },
      meter1EndUnits: { type: Number, min: 0 },
      meter1Consumption: { type: Number, min: 0 },
      meter2StartUnits: { type: Number, min: 0 },
      meter2EndUnits: { type: Number, min: 0 },
      meter2Consumption: { type: Number, min: 0 },
      consumption: { type: Number, required: true, min: 0 },
      rate: { type: Number, required: true, min: 0 },
      total: { type: Number, required: true, min: 0 },
      totalNOCAdjustment: { type: Number, min: 0, default: 0 },
      remainingAmount: { type: Number, min: 0 },
      paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending'], default: 'unpaid' },
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
      paidAt: { type: Date },
      cashfreeOrderId: { type: String, default: null },
      payingStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      studentBills: [
        {
          studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          studentName: { type: String, required: true },
          studentRollNumber: { type: String, required: true },
          amount: { type: Number, required: true, min: 0 },
          nocAdjustment: { type: Number, min: 0, default: 0 },
          paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending'], default: 'unpaid' },
          paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
          paidAt: { type: Date }
        }
      ],
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

roomSchema.index({ hostel: 1, category: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ roomNumber: 1 });

let model = null;

function getModel() {
  const conn = getHostelConnection();
  if (!conn) throw new Error('Hostel DB not connected');
  if (!model) model = conn.model('Room', roomSchema);
  return model;
}

module.exports = { getModel };
