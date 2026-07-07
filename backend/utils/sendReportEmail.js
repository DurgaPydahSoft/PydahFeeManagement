const axios = require('axios');

/**
 * sendReportEmail
 * Custom email utility for report PDFs.
 * Supports comma-separated emails and Brevo attachments format.
 *
 * @param {Object} options
 * @param {string|string[]} options.email - Comma-separated list or array of emails
 * @param {string} options.subject - Subject line
 * @param {string} [options.html] - HTML content
 * @param {string} [options.message] - Plain text message
 * @param {Array<{content: string, name: string}>} [options.attachments] - Array of attachments in base64 format
 */
const sendReportEmail = async (options) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
        throw new Error('BREVO_API_KEY or BREVO_SENDER_EMAIL is missing in environment variables.');
    }

    // Format target emails list
    let toEmails = [];
    if (Array.isArray(options.email)) {
        toEmails = options.email.map(e => ({ email: e.trim() }));
    } else if (typeof options.email === 'string') {
        toEmails = options.email.split(',')
            .map(e => e.trim())
            .filter(Boolean)
            .map(email => ({ email }));
    } else if (options.email) {
        toEmails = [{ email: String(options.email).trim() }];
    }

    if (toEmails.length === 0) {
        throw new Error('No valid recipient email addresses provided.');
    }

    const payload = {
        sender: {
            name: process.env.FROM_NAME || 'Pydah Fee Management',
            email: senderEmail
        },
        to: toEmails,
        subject: options.subject,
        htmlContent: options.html || options.message
    };

    if (!options.html && options.message) {
        payload.htmlContent = `<p>${options.message.replace(/\n/g, '<br>')}</p>`;
    }

    // Brevo API attachment support
    if (options.attachments && Array.isArray(options.attachments)) {
        payload.attachment = options.attachments;
    }

    try {
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            }
        });

        console.log(`[sendReportEmail] Report email sent to ${toEmails.map(t => t.email).join(', ')}. MessageId: ${response.data.messageId}`);
        return response.data;
    } catch (error) {
        console.error('[sendReportEmail] Brevo API Error:', error.response ? error.response.data : error.message);
        throw new Error(error.response?.data?.message || 'Failed to send report email via Brevo');
    }
};

module.exports = sendReportEmail;
