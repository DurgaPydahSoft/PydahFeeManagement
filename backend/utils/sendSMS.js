const axios = require('axios');

const BULKSMS_API_KEY = process.env.BULKSMS_API_KEY || "7c9c967a-4ce9-4748-9dc7-d2aaef847275";
const BULKSMS_SENDER_ID = process.env.BULKSMS_SENDER_ID || "PYDAHK";
// API URLs based on BulkSMS documentation
// For English SMS (regular)
const BULKSMS_ENGLISH_API_URL = process.env.BULKSMS_ENGLISH_API_URL || "https://www.bulksmsapps.com/api/apismsv2.aspx";
// For Unicode/Non-English SMS (Telugu)
const BULKSMS_UNICODE_API_URL = process.env.BULKSMS_UNICODE_API_URL || "https://www.bulksmsapps.com/api/apibulkv2.aspx";
const BULKSMS_DLT_TEMPLATE_ID = process.env.BULKSMS_DLT_TEMPLATE_ID || "1707175151835691501";
const BULKSMS_ENGLISH_DLT_TEMPLATE_ID = process.env.BULKSMS_ENGLISH_DLT_TEMPLATE_ID || "1707175151753778713";

// Helper function to check if response is valid
const isValidSMSResponse = (responseData) => {
    if (!responseData || typeof responseData !== 'string') {
        return false;
    }

    // Check for valid message ID patterns (primary check)
    if (responseData.includes('MessageId-') || !isNaN(responseData.trim())) {
        return true;
    }

    // Even if it contains HTML, check if it has a MessageId in the HTML
    if (responseData.includes('<!DOCTYPE') || responseData.includes('<html') || responseData.includes('<body')) {
        // Extract MessageId from HTML response
        const messageIdMatch = responseData.match(/MessageId-(\d+)/);
        if (messageIdMatch) {
            return true;
        }
    }

    return false;
};

// Helper function to extract message ID
const extractMessageId = (responseData) => {
    // Try to extract MessageId using regex (works for both plain text and HTML)
    const messageIdMatch = responseData.match(/MessageId-(\d+)/);
    if (messageIdMatch) {
        return messageIdMatch[1];
    }

    // Fallback to old method
    if (responseData.includes('MessageId-')) {
        return responseData.split('MessageId-')[1].split('\n')[0].trim();
    }
    if (!isNaN(responseData.trim())) {
        return responseData.trim();
    }
    return null;
};

// Helper function to send SMS using POST method
const sendSMSPost = async (params, isUnicode = false) => {
    // Use correct API URL based on language
    const apiUrl = isUnicode ? BULKSMS_UNICODE_API_URL : BULKSMS_ENGLISH_API_URL;

    console.log(`Using API URL for ${isUnicode ? 'Unicode' : 'English'} SMS:`, apiUrl);

    try {
        // Try POST method first (recommended for BulkSMS)
        const response = await axios.post(apiUrl, null, {
            params: params,
            timeout: 30000,
            headers: {
                'Accept': 'text/plain',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response;
    } catch (error) {
        console.log('POST method failed, trying GET:', error.message);
        // Fallback to GET method
        const response = await axios.get(apiUrl, {
            params: params,
            timeout: 30000,
            headers: {
                'Accept': 'text/plain',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response;
    }
};

const sendSMS = async (phoneNumber, message, templateParams = {}) => {
    try {
        if (!BULKSMS_API_KEY || !BULKSMS_SENDER_ID || !BULKSMS_ENGLISH_API_URL || !BULKSMS_UNICODE_API_URL) {
            throw new Error('SMS service configuration missing');
        }

        // Generic Implementation that accepts DLT ID
        let params = {
            apikey: BULKSMS_API_KEY,
            sender: BULKSMS_SENDER_ID,
            number: phoneNumber,
            message: message,
        };

        // Attach DLT Template ID if provided (CRITICAL for Database-fetched templates)
        if (templateParams.templateId || templateParams.dltTemplateId) {
            params.templateid = templateParams.templateId || templateParams.dltTemplateId;
        }

        console.log('SMS API params:', params);

        // Send Request
        const response = await sendSMSPost(params, false);

        console.log('SMS API response:', response.data);

        // Check if response is valid
        if (isValidSMSResponse(response.data)) {
            const messageId = extractMessageId(response.data);
            if (messageId) {
                return {
                    success: true,
                    messageId: messageId
                };
            }
        }

        throw new Error('Failed to send SMS (Invalid Response)');
    } catch (error) {
        console.error('SMS sending error:', error);
        if (error.response) {
            console.error('SMS API error response:', error.response.data);
        }
        throw new Error('Failed to send SMS');
    }
};

// Check Balance Utility
const checkBalance = async () => {
    try {
        if (!BULKSMS_API_KEY) {
            throw new Error('SMS service configuration missing');
        }
        const response = await axios.get(`http://www.bulksmsapps.com/api/apicheckbalancev2.aspx?apikey=${BULKSMS_API_KEY}`);
        return response.data;
    } catch (error) {
        console.error('Error checking SMS balance:', error);
        throw new Error('Failed to check SMS balance');
    }
};

module.exports = {
    sendSMS,
    checkBalance,
    // Export others if needed but sendSMS is the main dynamic one
};
