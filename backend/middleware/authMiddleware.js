const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            if (!token || token === 'null' || token === 'undefined' || token === '') {
                return res.status(401).json({ message: 'Not authorized, invalid token' });
            }

            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not configured');
                return res.status(500).json({ message: 'Server authentication is not configured' });
            }

            // Verify token signature & expiry
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Load the user record from MongoDB
            let user = await User.findById(decoded.id).select('-password');

            if (!user) {
                user = await User.findOne({
                    $or: [
                        { employeeId: decoded.id },
                        { username: decoded.id },
                    ],
                }).select('-password');
            }

            if (user) {
                const Role = require('../models/Role');
                const roleDoc = await Role.findOne({ name: user.role });
                const rolePerms = roleDoc ? roleDoc.permissions : [];
                const merged = [...new Set([...rolePerms, ...(user.permissions || [])])];
                user = user.toObject();
                user.permissions = merged;
                user.id = user._id.toString();
            }

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found in Fee Management' });
            }

            // Check if user is deactivated locally
            if (user.isActive === false) {
                return res.status(401).json({ message: 'Not authorized, your account has been deactivated.' });
            }

            // Check if user is deactivated via HRMS
            if (user.employeeId) {
                try {
                    const getEmployeeModel = require('../models/Employee');
                    const Employee = getEmployeeModel();
                    if (Employee) {
                        const employee = await Employee.findById(user.employeeId).select('is_active');
                        if (employee && employee.is_active === false) {
                            return res.status(401).json({ message: 'Not authorized, your account has been deactivated via HRMS.' });
                        }
                    }
                } catch (err) {
                    console.error('HRMS deactivation check failed:', err);
                }
            }

            // --- Single Active Device Login Check ---
            // Compare the sessionId embedded in the JWT against the one
            // currently stored in the database. A mismatch means another device
            // has logged in and this session has been displaced.
            if (decoded.sessionId && user.sessionId && decoded.sessionId !== user.sessionId) {
                return res.status(401).json({
                    success: false,
                    message: 'Your account has been logged in from another device.',
                    code: 'SESSION_DISPLACED',
                });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth Middleware Error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };

