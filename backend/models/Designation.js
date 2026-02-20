const mongoose = require('mongoose');
const { getEmployeeConnection } = require('../config/dbEmployee');

const designationSchema = new mongoose.Schema({
    designation_name: String,
    name: String
}, { strict: false });

let DesignationModel;

const getDesignationModel = () => {
    const conn = getEmployeeConnection();
    if (conn && !DesignationModel) {
        DesignationModel = conn.model('Designation', designationSchema, 'designations');
    }
    return DesignationModel;
};

module.exports = getDesignationModel;
