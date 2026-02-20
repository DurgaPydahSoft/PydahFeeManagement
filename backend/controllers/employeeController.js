const getEmployeeModel = require('../models/Employee');
const getDepartmentModel = require('../models/Department');
const getDivisionModel = require('../models/Division');
const getDesignationModel = require('../models/Designation');

// @desc    Search employees by name
// @route   GET /api/employees/search?name=...
// @access  Admin
const searchEmployees = async (req, res) => {
  const { name } = req.query;

  try {
    const Employee = getEmployeeModel();
    if (!Employee) {
      return res.status(503).json({ message: 'Employee DB not connected' });
    }

    if (!name || name.length < 3) {
      return res.status(400).json({ message: 'Search term must be at least 3 characters' });
    }

    // Initialize models to ensure they are registered on the connection before query
    getDepartmentModel();
    getDivisionModel();
    getDesignationModel();

    // Search by name OR employee ID (case-insensitive regex)
    const employees = await Employee.find({
      $or: [
        { employee_name: { $regex: name, $options: 'i' } },
        { emp_no: { $regex: name, $options: 'i' } }
      ],
      is_active: true // Only active employees
    }).select('employee_name emp_no designation_id department_id division_id _id')
      .populate('department_id', 'department_name name')
      .populate('division_id', 'division_name name')
      .populate('designation_id', 'designation_name name')
      .limit(10);

    // Populate references if possible, or just return raw data
    // Since we might not have the other models (Designation, Department) connected or schema-aware in this app context easily without full setup, 
    // we will return the IDs. The frontend can display raw names or we can try to fetch them if needed. 
    // For now, let's assume raw data is enough for identification.

    res.json(employees);
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { searchEmployees };
