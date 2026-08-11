const NotificationTemplate = require('../models/NotificationTemplate');
const ReminderConfig = require('../models/ReminderConfig');
const SentReminderLog = require('../models/SentReminderLog');
const FeeStructure = require('../models/FeeStructure');
const ServiceLateFeeConfig = require('../models/ServiceLateFeeConfig');
const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');
const db = require('../config/sqlDb');
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

const logSentReminder = async (recipient, type, template, status, message, body, subject = '', recipientVal = '') => {
    try {
        const studentId = recipient.admission_number || recipient.studentId || recipient.student?.admission_number || 'Unknown';
        const studentName = recipient.student_name || recipient.studentName || recipient.student?.student_name || 'Unknown';
        const college = recipient.college || recipient.student?.college || 'Unknown';
        const course = recipient.course || recipient.student?.course || '';
        const branch = recipient.branch || recipient.student?.branch || '';
        const pinNo = recipient.pin_no || recipient.student?.pin_no || '';

        await SentReminderLog.create({
            studentId,
            studentName,
            college,
            course,
            branch,
            pinNo,
            recipient: recipientVal || 'Unknown',
            type,
            templateId: template._id,
            templateName: template.name,
            subject,
            body,
            status,
            message
        });
    } catch (err) {
        console.error('Error logging sent reminder:', err);
    }
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
                await logSentReminder(recipient, 'EMAIL', template, 'failed', 'No email address found', template.body, template.subject || '', 'No email found');
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
                await logSentReminder(recipient, 'EMAIL', template, 'success', 'Email sent successfully', messageBody, subject || template.subject, recipientEmail);
                return { admission_number: recipient.admission_number, status: 'success', message: 'Email sent successfully' };
            } catch (emailError) {
                console.error(`Failed to send email to ${recipientEmail}:`, emailError);
                await logSentReminder(recipient, 'EMAIL', template, 'failed', emailError.message || 'Failed to send email', messageBody, subject || template.subject, recipientEmail);
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
                await logSentReminder(recipient, 'SMS', template, 'failed', 'No valid mobile number', template.body, '', mobile || 'No mobile found');
                return { admission_number: recipient.admission_number, status: 'failed', message: 'No valid mobile number' };
            }

            const messageBody = applyVariableMap(template.body, variableMap, recipient);

            try {
                await sendSMS(mobile, messageBody, { templateId: template.templateId });
                await logSentReminder(recipient, 'SMS', template, 'success', 'SMS sent successfully', messageBody, '', mobile);
                return { admission_number: recipient.admission_number, status: 'success', message: 'SMS sent successfully' };
            } catch (smsError) {
                console.error(`Failed to send SMS to ${mobile}:`, smsError);
                await logSentReminder(recipient, 'SMS', template, 'failed', smsError.message || 'Failed to send SMS', messageBody, '', mobile);
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

const getReminderReportStats = async (req, res) => {
    try {
        const totalSuccess = await SentReminderLog.countDocuments({ status: 'success' });
        const totalFailed = await SentReminderLog.countDocuments({ status: 'failed' });
        const totalSent = totalSuccess + totalFailed;
        const successRate = totalSent > 0 ? Math.round((totalSuccess / totalSent) * 100) : 100;
        
        const activeRulesCount = await ReminderConfig.countDocuments({ isActive: true });
        
        res.json({
            totalSent,
            totalSuccess,
            totalFailed,
            successRate,
            activeRulesCount
        });
    } catch (error) {
        console.error('Error fetching reminder report stats:', error);
        res.status(500).json({ message: 'Error fetching report stats' });
    }
};

const getSentReminderLogs = async (req, res) => {
    try {
        const { search, status, type, college, startDate, endDate, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status) query.status = status;
        if (type) query.type = type;
        if (college) query.college = college;

        if (startDate || endDate) {
            query.sentAt = {};
            if (startDate) query.sentAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.sentAt.$lte = end;
            }
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { studentId: searchRegex },
                { studentName: searchRegex },
                { pinNo: searchRegex },
                { recipient: searchRegex },
                { templateName: searchRegex },
                { body: searchRegex }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [logs, total] = await Promise.all([
            SentReminderLog.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            SentReminderLog.countDocuments(query)
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching sent reminder logs:', error);
        res.status(500).json({ message: 'Error fetching sent logs' });
    }
};

const getUpcomingReminders = async (req, res) => {
    try {
        const activeConfigs = await ReminderConfig.find({ isActive: true })
            .populate('smsTemplateId', 'name body')
            .populate('emailTemplateId', 'name body')
            .lean();

        // 1. Get all semesters from SQL database to avoid n+1 query calls
        const [semesters] = await db.query(`
            SELECT s.semester_number, s.start_date, c.name as course, cl.name as college, s.batch, s.year_of_study
            FROM semesters s
            JOIN courses c ON s.course_id = c.id
            JOIN colleges cl ON s.college_id = cl.id
            WHERE s.start_date IS NOT NULL
        `);

        // 2. Fetch default late fee configs
        const defaultConfigs = await DefaultLateFeeConfig.find({ isActive: true }).lean();

        // 3. Define target window (tomorrow to today + 30 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const limitDate = new Date(today);
        limitDate.setDate(limitDate.getDate() + 30);
        limitDate.setHours(23, 59, 59, 999);

        const upcoming = [];

        // 4. Map active rules
        for (const config of activeConfigs) {
            const offsets = config.offsets || [];
            const triggerType = config.triggerType; // BEFORE, AFTER
            const quotasFilter = config.quotas?.length > 0 ? new Set(config.quotas) : null;
            const collegesFilter = config.colleges?.length > 0 ? new Set(config.colleges) : null;
            const coursesFilter = config.courses?.length > 0 ? new Set(config.courses) : null;

            if (config.dueSourceType === 'ACADEMIC') {
                // Find all applicable Mongoose fee structures matching academicYear
                const structures = await FeeStructure.find({
                    academicYear: config.academicYear
                }).populate('feeHead', 'name code').lean();

                for (const struct of structures) {
                    // Filter matching structures
                    if (quotasFilter && !quotasFilter.has(struct.category)) continue;
                    if (collegesFilter && !collegesFilter.has(struct.college)) continue;
                    if (coursesFilter && !coursesFilter.has(struct.course)) continue;

                    const terms = struct.terms || [];
                    const termsCount = terms.length || 1;
                    const defCfg = defaultConfigs.find((c) => Number(c.termsCount) === termsCount);

                    for (const st of terms) {
                        const dt = defCfg ? (defCfg.terms || []).find((t) => Number(t.termNumber) === Number(st.termNumber)) : null;
                        const timingTerm = {
                            ...st,
                            dueDateMode: st.dueDateMode || dt?.dueDateMode || 'offset',
                            referenceSemester: st.referenceSemester || dt?.referenceSemester || 1,
                            dueOffsetDays: (st.dueOffsetDays !== undefined && st.dueOffsetDays !== 0)
                                ? Number(st.dueOffsetDays)
                                : (Number(dt?.dueOffsetDays) || 0),
                            fixedDueDate: st.fixedDueDate || dt?.fixedDueDate || null
                        };

                        // Resolve due date
                        let dueDate = null;
                        if (timingTerm.dueDateMode === 'fixed') {
                            if (timingTerm.fixedDueDate) {
                                dueDate = new Date(timingTerm.fixedDueDate);
                                dueDate.setHours(0, 0, 0, 0);
                            }
                        } else {
                            const batchKey = String(struct.batch || '').split('-')[0].trim();
                            const targetSem = Number(timingTerm.referenceSemester) || 1;
                            const semMatch = (semesters || []).find(s => 
                                Number(s.semester_number) === targetSem &&
                                s.course === struct.course &&
                                s.college === struct.college &&
                                String(s.batch) === batchKey &&
                                Number(s.year_of_study) === Number(struct.studentYear)
                            );
                            if (semMatch && semMatch.start_date) {
                                dueDate = new Date(semMatch.start_date);
                                dueDate.setDate(dueDate.getDate() + (Number(timingTerm.dueOffsetDays) || 0));
                                dueDate.setHours(0, 0, 0, 0);
                            }
                        }

                        if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

                        for (const offset of offsets) {
                            const triggerDate = new Date(dueDate);
                            if (triggerType === 'BEFORE') {
                                triggerDate.setDate(triggerDate.getDate() - offset);
                            } else {
                                triggerDate.setDate(triggerDate.getDate() + offset);
                            }
                            triggerDate.setHours(0, 0, 0, 0);

                            if (triggerDate >= tomorrow && triggerDate <= limitDate) {
                                // Fetch count of regular students matching cohort
                                const [[{ count }]] = await db.query(
                                    `SELECT COUNT(*) as count FROM students 
                                     WHERE college = ? AND course = ? AND branch = ? AND batch = ? 
                                       AND current_year = ? AND stud_type = ? AND LOWER(student_status) = 'regular'`,
                                    [struct.college, struct.course, struct.branch, struct.batch, struct.studentYear, struct.category]
                                );

                                upcoming.push({
                                    triggerDate,
                                    dueSource: 'ACADEMIC',
                                    templateName: config.smsTemplateId?.name || config.emailTemplateId?.name || 'Academic Reminder',
                                    triggerType,
                                    offset,
                                    dueDate,
                                    cohort: `${struct.college} - ${struct.course} - Year ${struct.studentYear} (${struct.category})`,
                                    estimatedRecipients: count
                                });
                            }
                        }
                    }
                }
            } else {
                // hostel / transport
                const type = config.dueSourceType; // HOSTEL | TRANSPORT
                const serviceConfigs = await ServiceLateFeeConfig.find({
                    academicYear: config.academicYear,
                    type
                }).populate('applicableFeeHead', 'name code').lean();

                for (const svc of serviceConfigs) {
                    if (collegesFilter && !collegesFilter.has(svc.college)) continue;
                    if (coursesFilter && svc.course && !coursesFilter.has(svc.course)) continue;

                    const termsCount = Number(svc.defaultTermsCount) || (svc.defaultTerms || []).length || 1;
                    const rule = (svc.lateFeeRules || []).find((r) => Number(r.termsCount) === termsCount);
                    const fallbackDefault = defaultConfigs.find((c) => Number(c.termsCount) === termsCount);

                    const timingTerms = (svc.defaultTerms || [])
                        .filter((t) => t && Number(t.percentage) > 0)
                        .map((t, idx) => {
                            const termNum = Number(t.termNumber) || idx + 1;
                            const rt = rule?.terms?.find((item) => Number(item.termNumber) === termNum);
                            const dt = fallbackDefault?.terms?.find((item) => Number(item.termNumber) === termNum);
                            return {
                                termNumber: termNum,
                                dueDateMode: rt?.dueDateMode || dt?.dueDateMode || 'offset',
                                referenceSemester: rt?.referenceSemester || dt?.referenceSemester || 1,
                                dueOffsetDays: (rt?.dueOffsetDays !== undefined && rt?.dueOffsetDays !== null)
                                    ? Number(rt.dueOffsetDays)
                                    : (Number(dt?.dueOffsetDays) || 0),
                                fixedDueDate: rt?.fixedDueDate || dt?.fixedDueDate || null
                            };
                        });

                    const timingTermsToUse = timingTerms.length ? timingTerms : [{
                        termNumber: 1,
                        dueDateMode: 'offset',
                        referenceSemester: 1,
                        dueOffsetDays: 0,
                        fixedDueDate: null
                    }];

                    for (const st of timingTermsToUse) {
                        let dueDate = null;
                        const referenceSemester = Number(st.referenceSemester) || 1;

                        if (st.dueDateMode === 'fixed') {
                            if (st.fixedDueDate) {
                                dueDate = new Date(st.fixedDueDate);
                                dueDate.setHours(0, 0, 0, 0);
                            }
                        } else {
                            const semMatch = (semesters || []).find(s => 
                                Number(s.semester_number) === referenceSemester &&
                                s.college === svc.college &&
                                (!svc.course || s.course === svc.course)
                            );
                            if (semMatch && semMatch.start_date) {
                                dueDate = new Date(semMatch.start_date);
                                dueDate.setDate(dueDate.getDate() + (Number(st.dueOffsetDays) || 0));
                                dueDate.setHours(0, 0, 0, 0);
                            }
                        }

                        if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

                        for (const offset of offsets) {
                            const triggerDate = new Date(dueDate);
                            if (triggerType === 'BEFORE') {
                                triggerDate.setDate(triggerDate.getDate() - offset);
                            } else {
                                triggerDate.setDate(triggerDate.getDate() + offset);
                            }
                            triggerDate.setHours(0, 0, 0, 0);

                            if (triggerDate >= tomorrow && triggerDate <= limitDate) {
                                let countQuery = `SELECT COUNT(*) as count FROM students WHERE college = ? AND LOWER(student_status) = 'regular'`;
                                const countParams = [svc.college];
                                if (svc.course) {
                                    countQuery += ` AND course = ?`;
                                    countParams.push(svc.course);
                                }
                                if (quotasFilter) {
                                    const quotaArr = Array.from(quotasFilter);
                                    countQuery += ` AND stud_type IN (${quotaArr.map(() => '?').join(',')})`;
                                    countParams.push(...quotaArr);
                                }

                                const [[{ count }]] = await db.query(countQuery, countParams);

                                upcoming.push({
                                    triggerDate,
                                    dueSource: type,
                                    templateName: config.smsTemplateId?.name || config.emailTemplateId?.name || `${type} Reminder`,
                                    triggerType,
                                    offset,
                                    dueDate,
                                    cohort: `${svc.college}${svc.course ? ` - ${svc.course}` : ''} (${type})`,
                                    estimatedRecipients: count
                                });
                            }
                        }
                    }
                }
            }
        }

        upcoming.sort((a, b) => a.triggerDate - b.triggerDate);

        res.json(upcoming);
    } catch (error) {
        console.error('Error fetching upcoming reminders:', error);
        res.status(500).json({ message: 'Error calculating upcoming reminders', error: error.message });
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
    processRemindersBatch,
    getReminderReportStats,
    getSentReminderLogs,
    getUpcomingReminders
};
