const cron = require('node-cron');
const ReminderConfig = require('../models/ReminderConfig');
const db = require('../config/sqlDb');

// We need to import the helper safely to avoid circular dependency issues if any,
// but since controller depends on models, and we are just importing a helper, it should be fine.
// However, to be safe and avoid the previous error, let's ensure we import correctly.
const { processRemindersBatch } = require('../controllers/reminderController');
const { processLateFees } = require('../controllers/lateFeeController');

const initScheduler = () => {
    console.log('Initializing Timely Reminder & Late Fee Scheduler...');

    // Run every day at 10:00 AM (safe time)
    cron.schedule('0 10 * * *', async () => {
        console.log('Running Daily Automated Tasks...');
        await processReminderConfigs();
        await processLateFees();
    });
};

const processReminderConfigs = async () => {
    try {
        const configs = await ReminderConfig.find({ isActive: true });
        if (configs.length === 0) return;

        console.log(`Checking ${configs.length} active reminder rules...`);

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        for (const config of configs) {
            await checkAndExecuteConfig(config, today);
        }

    } catch (error) {
        console.error('Scheduler Error:', error);
    }
};

const checkAndExecuteConfig = async (config, today) => {
    try {
        // We iterate through all defined offsets to see if any match TODAY.
        if (!config.offsets || config.offsets.length === 0) return;

        // 1. Find the target event(s) for this Course/Year/Sem
        let query = `
            SELECT s.id, s.semester_number, ay.year_label, c.name as course_name, s.start_date, s.end_date
            FROM semesters s
            JOIN academic_years ay ON s.academic_year_id = ay.id
            JOIN courses c ON s.course_id = c.id
            WHERE c.name = ? 
            AND ay.year_label = ?
            AND s.year_of_study = ?
        `;
        
        const queryParams = [config.course, config.academicYear, config.yearOfStudy];

        if (config.semester && config.semester !== 'BOTH') {
            query += ` AND s.semester_number = ?`;
            queryParams.push(config.semester);
        }
        
        const [events] = await db.query(query, queryParams);

        if (events.length === 0) return;

        let matchedOffset = null;
        let matchedEvent = null;

        // 2. Check each event found against each offset
        for (const event of events) {
            const dateStr = config.eventType === 'START_DATE' ? event.start_date : event.end_date;
            if (!dateStr) continue;
            
            const eventDate = new Date(dateStr);
            eventDate.setHours(0,0,0,0);

            for (const offset of config.offsets) {
                // Calculate the date when the reminder SHOULD be sent
                const triggerDate = new Date(eventDate);
                
                if (config.triggerType === 'BEFORE') {
                    // Trigger Date = EventDate - Offset (e.g., Event is 10th, Offset 2 -> Trigger on 8th)
                    triggerDate.setDate(eventDate.getDate() - offset);
                } else { // AFTER
                    // Trigger Date = EventDate + Offset (e.g., Event is 10th, Offset 2 -> Trigger on 12th)
                    triggerDate.setDate(eventDate.getDate() + offset);
                }
                
                // Check if TODAY is that trigger date
                if (triggerDate.getTime() === today.getTime()) {
                    matchedOffset = offset;
                    matchedEvent = event;
                    break;
                }
            }
            if (matchedOffset !== null) break;
        }

        if (matchedOffset === null) {
            return; // No match today
        }

        // Match found!
        console.log(`Match found for Rule ${config._id}: Offset ${matchedOffset} days ${config.triggerType} of ${matchedEvent.course_name} Sem ${matchedEvent.semester_number}`);

        // Check if already executed for this specific offset today? 
        // The rule executes once per day max anyway. So if multiple offsets collide (impossible for same event), it sends once.
        if (config.lastExecutedDate) {
            const lastRun = new Date(config.lastExecutedDate);
            lastRun.setHours(0,0,0,0);
            if (lastRun.getTime() === today.getTime()) {
                console.log(`Rule ${config._id} already executed today. Skipping.`);
                return;
            }
        }

        // 3. Derive Batch and Fetch Students
        const startYearStr = config.academicYear.split('-')[0];
        const startYear = parseInt(startYearStr);
        const targetBatch = (startYear - (config.yearOfStudy - 1)).toString();

        console.log(`Deriving Batch: AY ${config.academicYear} Year ${config.yearOfStudy} -> Batch ${targetBatch}`);

        // Filter by derived Batch
        let studentQuery = `SELECT admission_number, student_name, student_mobile, student_email FROM students WHERE 1=1`;
        const params = [];

        if (config.college) { studentQuery += ` AND college = ?`; params.push(config.college); }
        if (config.course) { studentQuery += ` AND course = ?`; params.push(config.course); }
        if (config.branch) { studentQuery += ` AND branch = ?`; params.push(config.branch); }
        
        studentQuery += ` AND batch = ?`; 
        params.push(targetBatch);

        studentQuery += ` AND LOWER(student_status) = 'regular'`;

        const [students] = await db.query(studentQuery, params);

        if (students.length > 0) {
             const recipients = students.map(s => ({
                admission_number: s.admission_number,
                student_name: s.student_name,
                email: s.student_email,
                phone: s.student_mobile,
                // Add variables for template substitution
                offset_days: matchedOffset,
                event_type: config.eventType === 'START_DATE' ? 'Semester Start' : 'Semester End',
                event_date: config.eventType === 'START_DATE' ? matchedEvent.start_date : matchedEvent.end_date
            }));

            // Process SMS
            if (config.smsTemplateId) {
                console.log(`Sending SMS for Rule ${config._id}`);
                await processRemindersBatch(config.smsTemplateId, recipients);
            }

            // Process Email
            if (config.emailTemplateId) {
                console.log(`Sending Email for Rule ${config._id}`);
                await processRemindersBatch(config.emailTemplateId, recipients);
            }
            
            console.log(`Processed reminders for ${recipients.length} students.`);
        } else {
            console.log(`No students found for Rule ${config._id}`);
        }

        // 4. Update lastExecutedDate
        config.lastExecutedDate = new Date();
        await config.save();

    } catch (err) {
        console.error(`Error processing rule ${config._id}:`, err);
    }
};

module.exports = { initScheduler };
