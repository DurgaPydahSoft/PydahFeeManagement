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

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Only Fee Management User records may access protected APIs
            let user = await User.findById(decoded.id).select('-password');

            if (!user) {
                user = await User.findOne({
                    $or: [
                        { employeeId: decoded.id },
                        { username: decoded.id },
                    ],
                }).select('-password');
            }

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found in Fee Management' });
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
