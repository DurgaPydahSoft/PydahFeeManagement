const mongoose = require('mongoose');
const { getEmployeeConnection } = require('../config/dbEmployee');

const departmentSchema = new mongoose.Schema({
    department_name: String,
    name: String
}, { strict: false });

let DepartmentModel;

const getDepartmentModel = () => {
    const conn = getEmployeeConnection();
    if (conn && !DepartmentModel) {
        DepartmentModel = conn.model('Department', departmentSchema, 'departments');
    }
    return DepartmentModel;
};

module.exports = getDepartmentModel;
