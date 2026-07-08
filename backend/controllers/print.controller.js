const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../services/print.service');

const logPrintRequest = (app, template, recordId, user, status, errorMsg = '') => {
    const timestamp = new Date().toISOString();
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'print_requests.log');
    const logEntry = `[${timestamp}] App: ${app} | Template: ${template} | Record: ${recordId} | User: ${user || 'API'} | Status: ${status}${errorMsg ? ` | Error: ${errorMsg}` : ''}\n`;
    fs.appendFile(logPath, logEntry, (err) => {
        if (err) console.error('Failed to write print log:', err);
    });
};

const handlePrintRequest = async (req, res) => {
    const { template, data } = req.body;
    const printApp = req.printApp;
    const loggedInUser = req.user?.username || null;
    const recordId = data ? (data.receiptId || data.receiptNumber || data.date || 'Bulk/N/A') : 'N/A';

    try {
        // 1. Basic Validation
        if (!template) {
            logPrintRequest(printApp?.appName || 'Unknown', 'N/A', recordId, loggedInUser, 'FAIL', 'Missing template name');
            return res.status(400).json({ message: 'Template name is required' });
        }
        if (!data) {
            logPrintRequest(printApp?.appName || 'Unknown', template, recordId, loggedInUser, 'FAIL', 'Missing data');
            return res.status(400).json({ message: 'Data is required' });
        }

        // 2. Permission Check
        const isAllowed = printApp && printApp.allowedTemplates && printApp.allowedTemplates.includes(template);
        if (!isAllowed) {
            const errorMsg = `Application ${printApp?.appName || 'Unknown'} is not authorized to print template '${template}'`;
            logPrintRequest(printApp?.appName || 'Unknown', template, recordId, loggedInUser, 'FORBIDDEN', errorMsg);
            return res.status(403).json({ message: errorMsg });
        }

        // 3. Render Template
        const html = await renderTemplate(template, data);

        // 4. Log Success
        logPrintRequest(printApp.appName, template, recordId, loggedInUser, 'SUCCESS');

        // 5. Send response
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error) {
        console.error('Print Controller Error:', error);
        
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Unsupported template') || error.message.includes('Missing')) {
            statusCode = 400;
        }

        logPrintRequest(printApp?.appName || 'Unknown', template || 'N/A', recordId, loggedInUser, 'ERROR', error.message);
        return res.status(statusCode).json({ message: error.message });
    }
};

module.exports = { handlePrintRequest };
