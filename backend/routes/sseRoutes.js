const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { addClient, removeClient } = require('../utils/sseManager');

/**
 * GET /api/sse/session
 *
 * Establishes a Server-Sent Events stream for the authenticated user's current session.
 * Since browser EventSource does not support custom headers, the JWT is passed as
 * a ?token= query parameter exclusively for this endpoint.
 *
 * The client listens for:
 *   - "connected"    event : confirmation the stream is live
 *   - "ping"         event : 30-second keepalive heartbeat
 *   - "force_logout" event : emitted when a new login displaces this session
 */
router.get('/session', async (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.status(401).json({ message: 'Token required' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Validate the session is still active
    const user = await User.findById(decoded.id).select('sessionId');
    if (!user) {
        return res.status(401).json({ message: 'User not found' });
    }
    if (decoded.sessionId && user.sessionId && decoded.sessionId !== user.sessionId) {
        return res.status(401).json({ message: 'Session displaced' });
    }

    const sessionId = decoded.sessionId;

    // --- Set SSE Headers ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Register this client in the SSE manager
    addClient(sessionId, decoded.id, res);
    console.log('[SSE] Client connected: sessionId=' + sessionId);

    // Send initial confirmation
    res.write('event: connected\ndata: ' + JSON.stringify({ sessionId }) + '\n\n');

    // Heartbeat every 30 seconds to keep the connection alive through proxies/firewalls
    const heartbeat = setInterval(() => {
        try {
            res.write('event: ping\ndata: ' + JSON.stringify({ ts: Date.now() }) + '\n\n');
        } catch {
            clearInterval(heartbeat);
        }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        removeClient(sessionId);
        console.log('[SSE] Client disconnected: sessionId=' + sessionId);
    });
});

module.exports = router;
