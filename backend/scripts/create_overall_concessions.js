const dotenv = require('dotenv');
const path = require('path');

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../config/sqlDb');

const runMigration = async () => {
    try {
        console.log('Running OverallConcessions Table Migration (Refactoring to JSON schema)...');

        // 1. Drop existing table
        console.log('Dropping existing overall_concessions table if it exists...');
        await db.query(`DROP TABLE IF EXISTS overall_concessions;`);

        // 2. Create Table
        console.log('Creating refactored overall_concessions table with JSON column...');
        await db.query(`
            CREATE TABLE overall_concessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admission_number VARCHAR(100) NOT NULL,
                pin_no VARCHAR(255) NOT NULL,
                student_name VARCHAR(255) NOT NULL,
                batch VARCHAR(100) NOT NULL,
                course VARCHAR(100) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                revised_fees JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_admission_number (admission_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Migration Successful: overall_concessions table created.');
        process.exit(0);
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
};

runMigration();
