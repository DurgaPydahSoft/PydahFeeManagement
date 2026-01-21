const NotificationTemplate = require('../models/NotificationTemplate');
const ReminderConfig = require('../models/ReminderConfig');
const db = require('../config/sqlDb');
const sendEmail = require('../utils/sendEmail');
const { sendSMS } = require('../utils/sendSMS');

// ==========================================
// CORE LOGIC (Helper)
// ==========================================

const processRemindersBatch = async (templateId, recipients) => {
    if (!templateId || !recipients || recipients.length === 0) {
        throw new Error('Template ID and recipients are required');
    }

    const template = await NotificationTemplate.findById(templateId);
    if (!template) {
        throw new Error('Template not found');
    }

    console.log(`Processing ${template.type} using template "${template.name}" to ${recipients.length} recipients.`);

    const results = [];

    if (template.type === 'EMAIL') {
        const emailPromises = recipients.map(async (recipient) => {
            const recipientEmail = recipient.email || recipient.student_email || recipient.parent_email;
            
            if (!recipientEmail) {
                return { admission_number: recipient.admission_number, status: 'failed', message: 'No email address found' };
            }

            let messageBody = template.body;
            // Basic replacement - can be expanded
            if (recipient.student_name) messageBody = messageBody.replace(/{{student_name}}/g, recipient.student_name);
            if (recipient.admission_number) messageBody = messageBody.replace(/{{admission_number}}/g, recipient.admission_number);

            try {
                await sendEmail({
                    email: recipientEmail,
                    subject: template.subject,
                    message: messageBody,
                    html: messageBody.replace(/\n/g, '<br>')
                });
                return { admission_number: recipient.admission_number, status: 'success', message: 'Email sent successfully' };
            } catch (emailError) {
                console.error(`Failed to send email to ${recipientEmail}:`, emailError);
                return { admission_number: recipient.admission_number, status: 'failed', message: emailError.message || 'Failed to send email' };
            }
        });
        results.push(...(await Promise.all(emailPromises)));

    } else if (template.type === 'SMS') {
        const smsPromises = recipients.map(async (recipient) => {
            const mobile = recipient.phone || recipient.student_mobile || recipient.mobile_number;

            if (!mobile || mobile.length < 10) {
                return { admission_number: recipient.admission_number, status: 'failed', message: 'No valid mobile number' };
            }

            let messageBody = template.body;
            if (recipient.student_name) messageBody = messageBody.replace(/{{student_name}}/g, recipient.student_name);
            if (recipient.admission_number) messageBody = messageBody.replace(/{{admission_number}}/g, recipient.admission_number);
            if (recipient.due_date) messageBody = messageBody.replace(/{{due_date}}/g, recipient.due_date);

            try {
                await sendSMS(mobile, messageBody, { templateId: template.templateId });
                return { admission_number: recipient.admission_number, status: 'success', message: 'SMS sent successfully' };
            } catch (smsError) {
                console.error(`Failed to send SMS to ${mobile}:`, smsError);
                return { admission_number: recipient.admission_number, status: 'failed', message: smsError.message || 'Failed to send SMS' };
            }
        });
        results.push(...(await Promise.all(smsPromises)));

    } else {
        results.push(...recipients.map(r => ({ admission_number: r.admission_number, status: 'skipped', message: 'Type not implemented' })));
    }

    return results;
};


// ==========================================
// CONTROLLER METHODS
// ==========================================

// @desc    Get Academic Years from MySQL
// @route   GET /api/reminders/academic-years
const getAcademicYears = async (req, res) => {
    try {
        const query = `
            SELECT s.id, ay.year_label, c.name as course_name, s.year_of_study, s.semester_number, s.start_date, s.end_date
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
const saveTemplate = async (req, res) => {
    const { _id, type, name, subject, body, templateId, senderId } = req.body;
    if (!type || !name || !body) return res.status(400).json({ message: 'Please provide type, name and body' });

    try {
        if (_id) {
            const updatedTemplate = await NotificationTemplate.findByIdAndUpdate(
                _id, { type, name, subject, body, templateId, senderId }, { new: true }
            );
            return res.json(updatedTemplate);
        } else {
            const newTemplate = await NotificationTemplate.create({ type, name, subject, body, templateId, senderId });
            return res.json(newTemplate);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error saving template', error: error.message });
    }
};

// @desc    Delete a template
// @route   DELETE /api/reminders/templates/:id
const deleteTemplate = async (req, res) => {
    try {
        await NotificationTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
};

// @desc    Send Immediate Reminders
// @route   POST /api/reminders/send
const sendReminders = async (req, res) => {
    const { templateId, recipients } = req.body;
    try {
        const results = await processRemindersBatch(templateId, recipients);
        res.json({ message: 'Reminders processed', results });
    } catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ message: error.message || 'Error sending reminders' });
    }
};

// @desc    Create a Reminder Config Rule
// @route   POST /api/reminders/config
const createConfig = async (req, res) => {
    const { college, course, branch, academicYear, yearOfStudy, semester, smsTemplateId, emailTemplateId, eventType, triggerType, offsets } = req.body;

    if (!college || !course || !academicYear || !yearOfStudy || !eventType || !triggerType || !offsets || !Array.isArray(offsets) || offsets.length === 0) {
        return res.status(400).json({ message: 'Missing required configuration fields or invalid offsets' });
    }

    if (!smsTemplateId && !emailTemplateId) {
        return res.status(400).json({ message: 'At least one template (SMS or Email) must be selected.' });
    }

    try {
        const newConfig = await ReminderConfig.create({
            college, course, branch,
            academicYear, yearOfStudy,
            semester: semester || 'BOTH',
            smsTemplateId,
            emailTemplateId,
            eventType,
            triggerType,
            offsets
        });
        res.status(201).json(newConfig);
    } catch (error) {
        console.error('Error creating config:', error);
        res.status(500).json({ message: 'Error creating configuration', error: error.message });
    }
};

// @desc    Get Reminder Config Rules
// @route   GET /api/reminders/config
const getConfigs = async (req, res) => {
    try {
        const configs = await ReminderConfig.find({})
            .populate('smsTemplateId', 'name')
            .populate('emailTemplateId', 'name')
            .sort({ createdAt: -1 });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching configurations' });
    }
};

// @desc    Delete Reminder Config Rule
// @route   DELETE /api/reminders/config/:id
const deleteConfig = async (req, res) => {
    try {
        await ReminderConfig.findByIdAndDelete(req.params.id);
        res.json({ message: 'Configuration deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting configuration' });
    }
};

// @desc    Update Reminder Config Rule
// @route   PUT /api/reminders/config/:id
const updateConfig = async (req, res) => {
    const { id } = req.params;
    const { college, course, branch, academicYear, yearOfStudy, semester, smsTemplateId, emailTemplateId, eventType, triggerType, offsets } = req.body;

    if (!college || !course || !academicYear || !yearOfStudy || !eventType || !triggerType || !offsets || !Array.isArray(offsets) || offsets.length === 0) {
        return res.status(400).json({ message: 'Missing required configuration fields or invalid offsets' });
    }

    if (!smsTemplateId && !emailTemplateId) {
        return res.status(400).json({ message: 'At least one template (SMS or Email) must be selected.' });
    }

    try {
        const updatedConfig = await ReminderConfig.findByIdAndUpdate(id, {
            college, course, branch,
            academicYear, yearOfStudy,
            semester: semester || 'BOTH',
            smsTemplateId,
            emailTemplateId,
            eventType,
            triggerType,
            offsets
        }, { new: true });
        
        if (!updatedConfig) return res.status(404).json({ message: 'Config not found' });
        
        res.json(updatedConfig);
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ message: 'Error updating configuration', error: error.message });
    }
};

module.exports = {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    sendReminders,
    getAcademicYears,
    createConfig,
    getConfigs,
    deleteConfig,
    updateConfig,
    processRemindersBatch // Export helper for Scheduler
};

