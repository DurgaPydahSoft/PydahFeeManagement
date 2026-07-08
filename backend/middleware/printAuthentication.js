const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { permissions } = require('../config/printPermissions');

const printAuthenticate = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    // 1. Check if token is a registered internal print API key
    const primaryKey = process.env.PRINT_API_KEY || 'fee_print_live_default_key';
    const primaryAppName = process.env.PRINT_APP_NAME || 'fee-management';

    if (token === primaryKey) {
        req.printApp = {
            appName: primaryAppName,
            allowedTemplates: permissions[primaryAppName] || []
        };
        return next();
    }

    // Example testing key for Admissions app
    if (token === 'adm_print_live_test') {
        req.printApp = {
            appName: 'admissions',
            allowedTemplates: permissions['admissions'] || []
        };
        return next();
    }

    // 2. Fallback: Validate standard user JWT token for inside-app print requests
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'JWT_SECRET is not configured' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
            // Assign full internal application permissions to logged-in user
            req.printApp = {
                appName: 'fee-management',
                allowedTemplates: permissions['fee-management'] || []
            };
            req.user = user;
            return next();
        }
    } catch (jwtErr) {
        // Fall through to 401
    }

    return res.status(401).json({ message: 'Unauthorized: Invalid print API key or user session' });
};

module.exports = printAuthenticate;
