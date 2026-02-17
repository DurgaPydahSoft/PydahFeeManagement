const getEmployeeModel = require('../models/Employee');

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

    // Search by name (case-insensitive regex)
    const employees = await Employee.find({
      employee_name: { $regex: name, $options: 'i' },
      is_active: true // Only active employees
    }).select('employee_name emp_no designation_id department_id _id').limit(10);

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
