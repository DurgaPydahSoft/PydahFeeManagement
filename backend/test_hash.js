const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const testPasswordMatch = async () => {
    try {
        console.log('Connecting to', process.env.MONGO_EMPLOYEE_URI);
        await mongoose.connect(process.env.MONGO_EMPLOYEE_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Use the connection directly to avoid config import issues
        console.log('Fetching user 1434 from employee DB...');
        const hrmsNativeUser = await mongoose.connection.collection('employees').findOne({
          emp_no: '1434'
        });
        
        if (!hrmsNativeUser) {
            console.log('Employee not found!');
            process.exit(1);
        }
        
        console.log(`Found Employee: ${hrmsNativeUser.employee_name}`);
        console.log(`Hash: ${hrmsNativeUser.password}`);
        
        // Let's test the passwords the user might be trying
        const tests = ['1434', '123456', 'password', 'password123', 'admin', 'admin123', '12345678', hrmsNativeUser.employee_name, hrmsNativeUser.employee_name.toLowerCase()];
        
        console.log('\n--- Testing Common Passwords ---');
        for (const pt of tests) {
            const match = await bcrypt.compare(pt, hrmsNativeUser.password);
            console.log(`Testing "${pt}": ${match ? 'MATCH!' : 'No match'}`);
        }

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        process.exit(0);
    }
};

testPasswordMatch();
