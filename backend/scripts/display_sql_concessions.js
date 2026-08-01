const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../config/sqlDb');

const displayConcessions = async () => {
    try {
        console.log('Fetching overall concessions from MySQL database...');
        const [rows] = await db.query('SELECT * FROM overall_concessions ORDER BY id ASC');

        if (rows.length === 0) {
            console.log('\n--- No concessions found in the SQL table overall_concessions. ---\n');
            process.exit(0);
        }

        console.log(`\nFound ${rows.length} student concession record(s):\n`);
        console.log('='.repeat(100));
        console.log(
            'ID'.padEnd(6) +
            'Admission #'.padEnd(15) +
            'Student Name'.padEnd(25) +
            'Batch'.padEnd(10) +
            'Course'.padEnd(10) +
            'Branch'.padEnd(20)
        );
        console.log('='.repeat(100));

        for (const row of rows) {
            console.log(
                String(row.id).padEnd(6) +
                String(row.admission_number).padEnd(15) +
                String(row.student_name).padEnd(25) +
                String(row.batch).padEnd(10) +
                String(row.course).padEnd(10) +
                String(row.branch).padEnd(20)
            );

            let revisedFees = [];
            if (row.revised_fees) {
                revisedFees = typeof row.revised_fees === 'string' ? JSON.parse(row.revised_fees) : row.revised_fees;
            }

            if (Array.isArray(revisedFees) && revisedFees.length > 0) {
                console.log('  Revised Fees:');
                console.log('  ' + '-'.repeat(80));
                console.log(
                    '    ' +
                    'Fee Head Code/ID'.padEnd(25) +
                    'Year'.padEnd(10) +
                    'Semester'.padEnd(12) +
                    'Amount'.padEnd(15) +
                    'Type'
                );
                console.log('  ' + '-'.repeat(80));
                
                revisedFees.forEach(fee => {
                    console.log(
                        '    ' +
                        String(fee.feeHeadCode || fee.feeHeadId).padEnd(25) +
                        String(fee.studentYear).padEnd(10) +
                        String(fee.semester !== null ? fee.semester : 'Year-wise').padEnd(12) +
                        `₹${fee.amount}`.padEnd(15) +
                        String(fee.concessionType || 'CONCESSION')
                    );
                });
                console.log('  ' + '-'.repeat(80));
            } else {
                console.log('  Revised Fees: None');
            }
            console.log('='.repeat(100));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error fetching concessions:', error);
        process.exit(1);
    }
};

displayConcessions();
