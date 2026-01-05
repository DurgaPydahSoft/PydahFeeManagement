const NotificationTemplate = require('../models/NotificationTemplate');
const db = require('../config/sqlDb');

// @desc    Get Academic Years from MySQL
// @route   GET /api/reminders/academic-years
// @access  Private
const getAcademicYears = async (req, res) => {
    try {
        const query = `
            SELECT 
                s.id,
                ay.year_label,
                c.name as course_name,
                s.year_of_study,
                s.semester_number,
                s.start_date,
                s.end_date
            FROM semesters s
            JOIN academic_years ay ON s.academic_year_id = ay.id
            JOIN courses c ON s.course_id = c.id
            ORDER BY ay.year_label DESC, c.name, s.year_of_study, s.semester_number
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching academic years:', error);
        res.status(500).json({ message: 'Error fetching academic years', error: error.message });
    }
};

// @desc    Get all templates
// @route   GET /api/reminders/templates
// @access  Private
const getTemplates = async (req, res) => {
    try {
        const templates = await NotificationTemplate.find({}).sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

// @desc    Create or Update a template
// @route   POST /api/reminders/templates
// @access  Private
const saveTemplate = async (req, res) => {
    const { _id, type, name, subject, body, templateId, senderId } = req.body;

    if (!type || !name || !body) {
        return res.status(400).json({ message: 'Please provide type, name and body' });
    }

    try {
        if (_id) {
            // Update existing
            const updatedTemplate = await NotificationTemplate.findByIdAndUpdate(
                _id,
                { type, name, subject, body, templateId, senderId },
                { new: true }
            );
            return res.json(updatedTemplate);
        } else {
            // Create new
            const newTemplate = await NotificationTemplate.create({
                type,
                name,
                subject,
                body,
                templateId,
                senderId
            });
            return res.json(newTemplate);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error saving template', error: error.message });
    }
};

// @desc    Delete a template
// @route   DELETE /api/reminders/templates/:id
// @access  Private
const deleteTemplate = async (req, res) => {
    try {
        await NotificationTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
};

const sendEmail = require('../utils/sendEmail');
const { sendSMS } = require('../utils/sendSMS');

const sendReminders = async (req, res) => {
    const { templateId, recipients } = req.body;

    if (!templateId || !recipients || recipients.length === 0) {
        return res.status(400).json({ message: 'Template ID and recipients are required' });
    }

    try {
        const template = await NotificationTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        console.log(`Sending ${template.type} using template "${template.name}" to ${recipients.length} recipients.`);

        const results = [];

        if (template.type === 'EMAIL') {
            // Process emails in parallel or sequentially? Parallel is faster but risky for rate limits.
            // Let's do `Promise.all` for now, assuming modest batch sizes.

            const emailPromises = recipients.map(async (recipient) => {
                const recipientEmail = recipient.email || recipient.student_email || recipient.parent_email; // Adjust based on actual data structure

                if (!recipientEmail) {
                    return {
                        admission_number: recipient.admission_number,
                        status: 'failed',
                        message: 'No email address found for recipient'
                    };
                }

                // Simple template replacement (optional)
                // e.g., Replace {{name}} with recipient.name
                let messageBody = template.body;
                if (recipient.student_name) messageBody = messageBody.replace(/{{student_name}}/g, recipient.student_name);
                if (recipient.admission_number) messageBody = messageBody.replace(/{{admission_number}}/g, recipient.admission_number);
                if (recipient.balance) messageBody = messageBody.replace(/{{balance}}/g, recipient.balance);

                try {
                    await sendEmail({
                        email: recipientEmail,
                        subject: template.subject,
                        message: messageBody, // Plain text version
                        html: messageBody.replace(/\n/g, '<br>') // Basic HTML version
                    });

                    return {
                        admission_number: recipient.admission_number,
                        status: 'success',
                        message: 'Email sent successfully'
                    };
                } catch (emailError) {
                    console.error(`Failed to send email to ${recipientEmail}:`, emailError);
                    return {
                        admission_number: recipient.admission_number,
                        status: 'failed',
                        message: emailError.message || 'Failed to send email'
                    };
                }
            });

            const emailResults = await Promise.all(emailPromises);
            results.push(...emailResults);

        } else if (template.type === 'SMS') {
            const smsPromises = recipients.map(async (recipient) => {
                const mobile = recipient.phone || recipient.student_mobile || recipient.mobile_number;

                if (!mobile || mobile.length < 10) {
                    return {
                        admission_number: recipient.admission_number,
                        status: 'failed',
                        message: 'No valid mobile number found'
                    };
                }

                // Variable Replacement
                let messageBody = template.body;
                if (recipient.student_name) messageBody = messageBody.replace(/{{student_name}}/g, recipient.student_name);
                if (recipient.admission_number) messageBody = messageBody.replace(/{{admission_number}}/g, recipient.admission_number);
                if (recipient.balance) messageBody = messageBody.replace(/{{balance}}/g, recipient.balance);
                if (recipient.due_date) messageBody = messageBody.replace(/{{due_date}}/g, recipient.due_date);
                if (recipient.amount) messageBody = messageBody.replace(/{{amount}}/g, recipient.amount);

                try {
                    // Call SMS Utility with dynamic DLT ID
                    await sendSMS(mobile, messageBody, {
                        templateId: template.templateId
                    });

                    return {
                        admission_number: recipient.admission_number,
                        status: 'success',
                        message: 'SMS sent successfully'
                    };
                } catch (smsError) {
                    console.error(`Failed to send SMS to ${mobile}:`, smsError);
                    return {
                        admission_number: recipient.admission_number,
                        status: 'failed',
                        message: smsError.message || 'Failed to send SMS'
                    };
                }
            });

            const smsResults = await Promise.all(smsPromises);
            results.push(...smsResults);
        } else {
            // Handle PUSH
            const mockResults = recipients.map(r => ({
                admission_number: r.admission_number,
                status: 'skipped',
                message: `${template.type} sending not yet implemented`
            }));
            results.push(...mockResults);
        }

        res.json({ message: 'Reminders processed', results });

    } catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ message: 'Error sending reminders', error: error.message });
    }
};

module.exports = {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    sendReminders,
    getAcademicYears
};
