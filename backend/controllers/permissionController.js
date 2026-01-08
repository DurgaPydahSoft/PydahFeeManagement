const Permission = require('../models/Permission');
const sqlPool = require('../config/sqlDb');

// @desc    Create a new permission entry
// @route   POST /api/permissions
const createPermission = async (req, res) => {
    const { studentId, grantedBy, remarks, validUpto } = req.body;

    if (!studentId || !grantedBy) {
        return res.status(400).json({ message: 'Student ID and Granted By are required' });
    }

    try {
        // Fetch Student Name from SQL to ensure validity and snapshot name
        const [students] = await sqlPool.query('SELECT student_name FROM students WHERE admission_number = ?', [studentId]);
        
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found in SQL database' });
        }

        const studentName = students[0].student_name;

        const permission = await Permission.create({
            studentId,
            studentName,
            grantedBy,
            remarks,
            validUpto: validUpto || null
        });

        res.status(201).json(permission);

    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get permissions (optional filter by studentId)
// @route   GET /api/permissions
const getPermissions = async (req, res) => {
    const { studentId } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;

    try {
        const permissions = await Permission.find(filter).sort({ createdAt: -1 }).limit(50); // Limit to recent 50
        res.json(permissions);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { createPermission, getPermissions };
