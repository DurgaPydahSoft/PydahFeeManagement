/**
 * sseManager.js
 * In-memory registry of active SSE response objects, keyed by sessionId.
 * Used to push real-time "force_logout" events to displaced sessions.
 *
 * NOTE: This works for single-process deployments. For multi-server setups,
 * migrate to a Redis Pub/Sub channel in the future.
 */

const clients = new Map(); // sessionId -> { res, userId }

/**
 * Register an active SSE connection.
 * @param {string} sessionId - The session UUID from the JWT.
 * @param {string} userId - The user's MongoDB _id (for logging).
 * @param {object} res - Express response object (SSE stream).
 */
const addClient = (sessionId, userId, res) => {
    clients.set(sessionId, { res, userId });
};

/**
 * Remove an SSE connection (on close or logout).
 * @param {string} sessionId
 */
const removeClient = (sessionId) => {
    clients.delete(sessionId);
};

/**
 * Send a force_logout event to a specific session's SSE connection.
 * The client will immediately clear its session and redirect to /login.
 * @param {string} sessionId
 */
const notifyLogout = (sessionId) => {
    const client = clients.get(sessionId);
    if (client) {
        try {
            client.res.write(`event: force_logout\ndata: ${JSON.stringify({ reason: 'displaced' })}\n\n`);
        } catch (err) {
            console.error('[SSE] Failed to notify logout for session:', sessionId, err.message);
        }
        removeClient(sessionId);
    }
};

module.exports = { clients, addClient, removeClient, notifyLogout };
