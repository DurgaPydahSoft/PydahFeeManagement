const mongoose = require('mongoose');
const { getEmployeeConnection } = require('../config/dbEmployee');

const divisionSchema = new mongoose.Schema({
    division_name: String,
    name: String
}, { strict: false });

let DivisionModel;

const getDivisionModel = () => {
    const conn = getEmployeeConnection();
    if (conn && !DivisionModel) {
        DivisionModel = conn.model('Division', divisionSchema, 'divisions');
    }
    return DivisionModel;
};

module.exports = getDivisionModel;
