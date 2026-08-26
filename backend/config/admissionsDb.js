const mysql = require('mysql2/promise');

/** Same host/credentials as student SQL; separate database: admissions_db */
const admissionsDbName = process.env.ADMISSIONS_DB_NAME || 'admissions_db';
const required = ['DB_HOST', 'DB_USER'];
const missing = required.filter((key) => !String(process.env[key] || '').trim());

const createDisabledPool = (label, reason) => ({
    isConfigured: false,
    dbLabel: label,
    dbName: admissionsDbName,
    query: async () => {
        throw new Error(`[${label}] SQL unavailable: ${reason}`);
    },
    execute: async () => {
        throw new Error(`[${label}] SQL unavailable: ${reason}`);
    },
    end: async () => {}
});

let admissionsPool;

if (missing.length > 0) {
    const reason = `missing env ${missing.join(', ')}`;
    console.warn(`[SQL] Admissions DB not configured (${reason}) — server will continue without it`);
    admissionsPool = createDisabledPool('admissions', reason);
} else {
    try {
        admissionsPool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || '',
            database: admissionsDbName,
            port: process.env.DB_PORT || 3306,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            dateStrings: true
        });
        admissionsPool.isConfigured = true;
        admissionsPool.dbLabel = 'admissions';
        admissionsPool.dbName = admissionsDbName;
    } catch (err) {
        console.warn(`[SQL] Admissions pool create failed: ${err.message} — server will continue without it`);
        admissionsPool = createDisabledPool('admissions', err.message);
    }
}

module.exports = admissionsPool;
