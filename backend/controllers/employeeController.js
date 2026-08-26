const getEmployeeModel = require('../models/Employee');
const getDepartmentModel = require('../models/Department');
const getDivisionModel = require('../models/Division');
const getDesignationModel = require('../models/Designation');

// @desc    Search / list active HRMS employees
// @route   GET /api/employees/search?name=...
// @access  Protected
const searchEmployees = async (req, res) => {
  const { name } = req.query;

  try {
    const Employee = getEmployeeModel();
    if (!Employee) {
      return res.status(503).json({ message: 'Employee DB not connected' });
    }

    getDepartmentModel();
    getDivisionModel();
    getDesignationModel();

    const term = String(name || '').trim();
    const filter = { is_active: true };

    if (term.length >= 1) {
      filter.$or = [
        { employee_name: { $regex: term, $options: 'i' } },
        { emp_no: { $regex: term, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(filter)
      .select('employee_name emp_no designation_id department_id division_id _id')
      .populate('department_id', 'department_name name')
      .populate('division_id', 'division_name name')
      .populate('designation_id', 'designation_name name')
      .sort({ employee_name: 1 })
      .limit(term ? 25 : 50);

    res.json(employees);
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { searchEmployees };
