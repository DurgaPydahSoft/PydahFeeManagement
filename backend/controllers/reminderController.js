const NotificationTemplate = require('../models/NotificationTemplate');
const ReminderConfig = require('../models/ReminderConfig');
const sendEmail = require('../utils/sendEmail');
const { sendSMS } = require('../utils/sendSMS');
const {
    VARIABLE_SOURCES,
    extractPlaceholders,
    syncVariableMap,
    applyVariableMap
} = require('../utils/reminderVariables');

// ==========================================
// CORE LOGIC (Helper)
// ==========================================

const MOBILE_FIELD_MAP = {
    student: 'student_mobile',
    parent: 'parent_mobile1',
    guardian: 'parent_mobile2'
};

/**
 * Expand recipients per smsRecipients setting.
 * Each entry overrides `phone` with the right mobile field.
 * Recipients with no valid number for a given type are skipped.
 */
const expandBySmsRecipients = (recipients, smsRecipients) => {
    if (!smsRecipients || smsRecipients.length === 0) return recipients;
    const expanded = [];
    for (const r of recipients) {
        for (const type of smsRecipients) {
            const field = MOBILE_FIELD_MAP[type];
            if (!field) continue;
            // check student sub-object first, then top-level
            const mobile = r.student?.[field] || r[field];
            if (!mobile || String(mobile).trim().length < 10) continue;
            expanded.push({ ...r, phone: String(mobile).trim() });
        }
    }
    return expanded;
};

const processRemindersBatch = async (templateId, recipients, { smsRecipients } = {}) => {
    if (!templateId || !recipients || recipients.length === 0) {
        throw new Error('Template ID and recipients are required');
    }

    const template = await NotificationTemplate.findById(templateId);
    if (!template) {
        throw new Error('Template not found');
    }

    console.log(`Processing ${template.type} using template "${template.name}" to ${recipients.length} recipients.`);

    const results = [];
    const variableMap = template.variableMap || [];

    if (template.type === 'EMAIL') {
        const emailPromises = recipients.map(async (recipient) => {
            const recipientEmail = recipient.email || recipient.student_email || recipient.student?.email || recipient.parent_email;

            if (!recipientEmail) {
                return { admission_number: recipient.admission_number, status: 'failed', message: 'No email address found' };
            }

            let messageBody = applyVariableMap(template.body, variableMap, recipient);
            let subject = applyVariableMap(template.subject || '', variableMap, recipient);

            try {
                await sendEmail({
                    email: recipientEmail,
                    subject: subject || template.subject,
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
        // Expand to student/parent/guardian mobiles if smsRecipients specified
        const targets = smsRecipients?.length
            ? expandBySmsRecipients(recipients, smsRecipients)
            : recipients;

        const smsPromises = targets.map(async (recipient) => {
            const mobile = recipient.phone || recipient.student_mobile || recipient.student?.student_mobile || recipient.mobile_number;

            if (!mobile || String(mobile).length < 10) {
                return { admission_number: recipient.admission_number, status: 'failed', message: 'No valid mobile number' };
            }

            const messageBody = applyVariableMap(template.body, variableMap, recipient);

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

const getVariableSources = async (_req, res) => {
    res.json(VARIABLE_SOURCES);
};

const getTemplates = async (req, res) => {
    try {
        const templates = await NotificationTemplate.find({}).sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

const saveTemplate = async (req, res) => {
    const { _id, type, name, subject, body, templateId, senderId, variableMap } = req.body;
    if (!type || !name || !body) return res.status(400).json({ message: 'Please provide type, name and body' });

    // Sync map from {#var#} / {{named}} in body; keep user-selected sources
    const keys = extractPlaceholders(body);
    let map = syncVariableMap(body, Array.isArray(variableMap) ? variableMap : []);
    map = map.filter((m) => keys.includes(m.key));
    const missing = map.filter((m) => !m.source);
    if (missing.length) {
        return res.status(400).json({
            message: `Map a source for every variable: ${missing.map((m) => m.key).join(', ')}`
        });
    }
    try {
        if (_id) {
            const updatedTemplate = await NotificationTemplate.findByIdAndUpdate(
                _id,
                { type, name, subject, body, templateId, senderId, variableMap: map },
                { new: true }
            );
            return res.json(updatedTemplate);
        } else {
            const newTemplate = await NotificationTemplate.create({
                type, name, subject, body, templateId, senderId, variableMap: map
            });
            return res.json(newTemplate);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error saving template', error: error.message });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        await NotificationTemplate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
};

const sendReminders = async (req, res) => {
    const { templateId, recipients, smsRecipients } = req.body;
    try {
        const results = await processRemindersBatch(templateId, recipients, {
            smsRecipients: Array.isArray(smsRecipients) ? smsRecipients : undefined
        });
        res.json({ message: 'Reminders processed', results });
    } catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ message: error.message || 'Error sending reminders' });
    }
};

const VALID_SMS_RECIPIENTS = ['student', 'parent', 'guardian'];

const createConfig = async (req, res) => {
    const { academicYear, dueSourceType, smsTemplateId, emailTemplateId, triggerType, offsets, smsRecipients, quotas, colleges, courses } = req.body;

    if (!academicYear || !dueSourceType || !triggerType || !offsets || !Array.isArray(offsets) || offsets.length === 0) {
        return res.status(400).json({ message: 'Missing required fields: academicYear, dueSourceType, triggerType, offsets' });
    }

    if (!['ACADEMIC', 'HOSTEL', 'TRANSPORT'].includes(dueSourceType)) {
        return res.status(400).json({ message: 'dueSourceType must be ACADEMIC, HOSTEL, or TRANSPORT' });
    }

    if (!smsTemplateId && !emailTemplateId) {
        return res.status(400).json({ message: 'At least one template (SMS or Email) must be selected.' });
    }

    // Validate smsRecipients if SMS is enabled
    const normalizedSmsRecipients = Array.isArray(smsRecipients)
        ? smsRecipients.filter(r => VALID_SMS_RECIPIENTS.includes(r))
        : ['student'];

    if (smsTemplateId && normalizedSmsRecipients.length === 0) {
        return res.status(400).json({ message: 'At least one SMS recipient (Student, Parent, or Guardian) must be selected.' });
    }

    try {
        const newConfig = await ReminderConfig.create({
            academicYear: String(academicYear).trim(),
            dueSourceType,
            triggerType,
            offsets: offsets.map(Number).filter((n) => !Number.isNaN(n) && n >= 0),
            smsTemplateId: smsTemplateId || undefined,
            emailTemplateId: emailTemplateId || undefined,
            smsRecipients: normalizedSmsRecipients,
            quotas: Array.isArray(quotas) ? quotas.filter(Boolean) : [],
            colleges: Array.isArray(colleges) ? colleges.filter(Boolean) : [],
            courses: Array.isArray(courses) ? courses.filter(Boolean) : []
        });
        res.status(201).json(newConfig);
    } catch (error) {
        console.error('Error creating config:', error);
        res.status(500).json({ message: 'Error creating configuration', error: error.message });
    }
};

const getConfigs = async (req, res) => {
    try {
        const configs = await ReminderConfig.find({})
            .populate('smsTemplateId', 'name type')
            .populate('emailTemplateId', 'name type')
            .sort({ createdAt: -1 });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching configurations' });
    }
};

const deleteConfig = async (req, res) => {
    try {
        await ReminderConfig.findByIdAndDelete(req.params.id);
        res.json({ message: 'Configuration deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting configuration' });
    }
};

const updateConfig = async (req, res) => {
    const { id } = req.params;
    const { academicYear, dueSourceType, smsTemplateId, emailTemplateId, triggerType, offsets, smsRecipients, quotas, colleges, courses } = req.body;

    if (!academicYear || !dueSourceType || !triggerType || !offsets || !Array.isArray(offsets) || offsets.length === 0) {
        return res.status(400).json({ message: 'Missing required configuration fields or invalid offsets' });
    }

    if (!smsTemplateId && !emailTemplateId) {
        return res.status(400).json({ message: 'At least one template (SMS or Email) must be selected.' });
    }

    const normalizedSmsRecipients = Array.isArray(smsRecipients)
        ? smsRecipients.filter(r => VALID_SMS_RECIPIENTS.includes(r))
        : ['student'];

    if (smsTemplateId && normalizedSmsRecipients.length === 0) {
        return res.status(400).json({ message: 'At least one SMS recipient (Student, Parent, or Guardian) must be selected.' });
    }

    try {
        const updatedConfig = await ReminderConfig.findByIdAndUpdate(id, {
            academicYear: String(academicYear).trim(),
            dueSourceType,
            triggerType,
            offsets: offsets.map(Number).filter((n) => !Number.isNaN(n) && n >= 0),
            smsTemplateId: smsTemplateId || null,
            emailTemplateId: emailTemplateId || null,
            smsRecipients: normalizedSmsRecipients,
            quotas: Array.isArray(quotas) ? quotas.filter(Boolean) : [],
            colleges: Array.isArray(colleges) ? colleges.filter(Boolean) : [],
            courses: Array.isArray(courses) ? courses.filter(Boolean) : []
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
    createConfig,
    getConfigs,
    deleteConfig,
    updateConfig,
    getVariableSources,
    processRemindersBatch
};
