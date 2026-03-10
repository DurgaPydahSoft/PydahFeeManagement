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

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

            // Get user from the token
            let user = await User.findById(decoded.id).select('-password');

            if (!user) {
                // FALLBACK: Check if it's an HRMS/SSO user via UserRole
                const UserRole = require('../models/UserRole');
                const userRole = await UserRole.findOne({ employeeId: decoded.id });

                if (userRole) {
                    const { getEmployeeConnection } = require('../config/dbEmployee');
                    const hrmsConn = getEmployeeConnection();

                    if (hrmsConn) {
                        const getEmployeeModel = require('../models/Employee');
                        const Employee = getEmployeeModel();

                        // Try finding in HRMS Employee collection
                        let hrmsEmployee = await Employee.findOne({
                            $or: [
                                { emp_no: decoded.id },
                                { _id: decoded.id }
                            ]
                        });

                        if (hrmsEmployee) {
                            user = {
                                _id: decoded.id,
                                name: hrmsEmployee.employee_name,
                                username: hrmsEmployee.emp_no,
                                role: userRole.role,
                                college: userRole.college,
                                permissions: userRole.permissions
                            };
                        } else {
                            // Try HRMS native users collection
                            let hrmsNativeUser = await hrmsConn.collection('users').findOne({
                                $or: [
                                    { emp_no: decoded.id },
                                    { username: decoded.id }
                                ]
                            });

                            if (hrmsNativeUser) {
                                user = {
                                    _id: decoded.id,
                                    name: hrmsNativeUser.name || hrmsNativeUser.username,
                                    username: hrmsNativeUser.username || hrmsNativeUser.emp_no,
                                    role: userRole.role,
                                    college: userRole.college,
                                    permissions: userRole.permissions
                                };
                            }
                        }
                    }
                }
            }

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth Middleware Error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
