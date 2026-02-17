const mongoose = require('mongoose');
const { getEmployeeConnection } = require('../config/dbEmployee');

const employeeSchema = new mongoose.Schema({
  emp_no: { type: String, required: true },
  employee_name: { type: String, required: true },
  division_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Division' },
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
  doj: Date,
  dob: Date,
  gross_salary: Number,
  gender: String,
  marital_status: String,
  blood_group: String,
  phone_number: String,
  email: String,
  password: { type: String, select: true }, // Ensure password matches schema for auth
  is_active: Boolean,
  leftDate: Date,
  dynamicFields: mongoose.Schema.Types.Mixed
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } // Match existing schema timestamps
});

let EmployeeModel;

const getEmployeeModel = () => {
  const conn = getEmployeeConnection();
  if (conn && !EmployeeModel) {
    EmployeeModel = conn.model('Employee', employeeSchema, 'employees');
  }
  return EmployeeModel;
};

module.exports = getEmployeeModel;
