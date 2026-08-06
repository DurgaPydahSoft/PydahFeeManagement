// Define allowed print templates for each internal application
module.exports = {
    // Maps application names to their allowed templates
    permissions: {
        'fee-management': ['fee-receipt', 'concession-report', 'cashier-report', 'college-report', 'daily-report', 'fee-configuration-report', 'account-report', 'overall-concession-register', 'overall-concession-list', 'proceedings-report', 'feehead-report', 'student-statement', 'due-report'],
        'admissions': ['fee-receipt'], // example template access for admissions
        'transport': ['fee-receipt']   // example template access for transport
    }
};
