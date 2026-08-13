const db = require('../config/sqlDb');

// @desc    Get Academic Years from MySQL
// @route   GET /api/academic-calendar/academic-years
const getAcademicYears = async (req, res) => {
    try {
        const { college, course, batch } = req.query;
        let query = `
            SELECT 
                s.id, 
                s.college_id, 
                s.course_id, 
                s.academic_year_id, 
                s.batch,
                s.year_of_study, 
                s.semester_number, 
                s.start_date, 
                s.end_date,
                cl.name as college_name,
                cl.code as college_code,
                c.name as course_name,
                ay.year_label
            FROM semesters s
            LEFT JOIN courses c ON s.course_id = c.id
            LEFT JOIN colleges cl ON cl.id = COALESCE(s.college_id, c.college_id)
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
        `;
        const conditions = ['s.college_id IS NOT NULL'];
        const params = [];

        if (college) {
            conditions.push('(cl.name = ? OR cl.code = ?)');
            params.push(college, college);
        }
        if (batch) {
            conditions.push('(s.batch = ? OR ay.year_label = ?)');
            params.push(batch, batch);
        }
        if (course) {
            conditions.push('c.name = ?');
            params.push(course);
        }

        query += ` WHERE ${conditions.join(' AND ')}`;

        // Prefer filled dates first so duplicates are easier to spot
        query += ` ORDER BY s.batch DESC, c.name, s.year_of_study, s.semester_number,
                   (s.start_date IS NULL), ay.year_label DESC, s.id`;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching academic years:', error);
        res.status(500).json({ message: 'Error fetching academic years', error: error.message });
    }
};

// @desc    Get Academic Years Metadata (Years and Courses)
// @route   GET /api/academic-calendar/metadata
const getCalendarMetadata = async (req, res) => {
    try {
        const [years] = await db.query('SELECT id, year_label FROM academic_years ORDER BY year_label DESC');
        const [courses] = await db.query('SELECT id, name, college_id, total_years, semesters_per_year FROM courses ORDER BY name');
        res.json({ years, courses });
    } catch (error) {
        console.error('Error fetching calendar metadata:', error);
        res.status(500).json({ message: 'Error fetching calendar metadata' });
    }
};

// @desc    Create a new Academic Calendar record (Semester)
// @route   POST /api/academic-calendar/academic-years
const createAcademicYear = async (req, res) => {
    const { academic_year_id, course_id, year_of_study, semester_number, start_date, end_date, batch, college_id } = req.body;
    
    if (!academic_year_id || !course_id || !year_of_study || !semester_number) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const query = `
            INSERT INTO semesters (academic_year_id, course_id, year_of_study, semester_number, start_date, end_date, batch, college_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [academic_year_id, course_id, year_of_study, semester_number, start_date || null, end_date || null, batch || null, college_id || null]);
        res.status(201).json({ id: result.insertId, message: 'Calendar entry created successfully' });
    } catch (error) {
        console.error('Error creating academic year:', error);
        res.status(500).json({ message: 'Error creating academic year' });
    }
};

// @desc    Update an Academic Calendar record (Semester)
// @route   PUT /api/academic-calendar/academic-years/:id
const updateAcademicYear = async (req, res) => {
    const { id } = req.params;
    const { academic_year_id, course_id, year_of_study, semester_number, start_date, end_date, batch, college_id } = req.body;

    try {
        const query = `
            UPDATE semesters 
            SET academic_year_id = ?, course_id = ?, year_of_study = ?, semester_number = ?, start_date = ?, end_date = ?, batch = ?, college_id = ?
            WHERE id = ?
        `;
        await db.query(query, [academic_year_id, course_id, year_of_study, semester_number, start_date || null, end_date || null, batch || null, college_id || null, id]);
        res.json({ message: 'Calendar entry updated successfully' });
    } catch (error) {
        console.error('Error updating academic year:', error);
        res.status(500).json({ message: 'Error updating academic year' });
    }
};

// @desc    Delete an Academic Calendar record (Semester)
// @route   DELETE /api/academic-calendar/academic-years/:id
const deleteAcademicYear = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM semesters WHERE id = ?', [id]);
        res.json({ message: 'Calendar entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting academic year:', error);
        res.status(500).json({ message: 'Error deleting academic year' });
    }
};

const getTermDates = async (req, res) => {
    try {
        const { college, academicYear, course, quota } = req.query;

        // 1. Fetch semesters matching criteria from MySQL
        let semQuery = `
            SELECT 
                s.id, 
                s.college_id, 
                s.course_id, 
                s.academic_year_id, 
                s.batch,
                s.year_of_study, 
                s.semester_number, 
                s.start_date, 
                s.end_date,
                cl.name as college_name,
                cl.code as college_code,
                c.name as course_name,
                ay.year_label
            FROM semesters s
            LEFT JOIN courses c ON s.course_id = c.id
            LEFT JOIN colleges cl ON cl.id = COALESCE(s.college_id, c.college_id)
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.college_id IS NOT NULL AND s.start_date IS NOT NULL
        `;
        const semParams = [];
        if (college) {
            semQuery += ' AND (cl.name = ? OR cl.code = ?)';
            semParams.push(college, college);
        }
        if (course) {
            semQuery += ' AND c.name = ?';
            semParams.push(course);
        }
        if (academicYear) {
            semQuery += ' AND (s.batch = ? OR ay.year_label = ?)';
            semParams.push(academicYear, academicYear);
        }
        
        semQuery += ' ORDER BY s.batch DESC, c.name, s.year_of_study';

        const [semesterRows] = await db.query(semQuery, semParams);

        // 2. Fetch configurations from Mongoose
        const FeeStructure = require('../models/FeeStructure');
        const ServiceLateFeeConfig = require('../models/ServiceLateFeeConfig');
        const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');

        const structuresQuery = { isActive: { $ne: false } };
        if (quota) {
            structuresQuery.category = quota;
        } else {
            structuresQuery.category = 'CONV';
        }

        const [structures, serviceConfigs, defaultConfigs] = await Promise.all([
            FeeStructure.find(structuresQuery).lean(),
            ServiceLateFeeConfig.find({ isActive: { $ne: false } }).lean(),
            DefaultLateFeeConfig.find({ isActive: true }).lean()
        ]);

        // 3. Helper to resolve due date
        const resolveDateHelper = (term, targetSem, colName, crsName, batchKey, yrStudy, acadYearLabel) => {
            if (term.dueDateMode === 'fixed') {
                return term.fixedDueDate ? new Date(term.fixedDueDate) : null;
            }
            const semMatch = (semesterRows || []).find(s => 
                Number(s.semester_number) === targetSem &&
                s.course_name === crsName &&
                s.college_name === colName &&
                String(s.batch) === batchKey &&
                Number(s.year_of_study) === Number(yrStudy) &&
                String(s.year_label || s.academic_year).slice(0, 4) === String(acadYearLabel).slice(0, 4)
            );
            if (!semMatch || !semMatch.start_date) return null;
            const dueDate = new Date(semMatch.start_date);
            dueDate.setDate(dueDate.getDate() + (Number(term.dueOffsetDays) || 0));
            return dueDate;
        };

        const formatTermVal = (term, targetSem, colName, crsName, batchKey, yrStudy, acadYearLabel) => {
            const dateVal = resolveDateHelper(term, targetSem, colName, crsName, batchKey, yrStudy, acadYearLabel);
            if (dateVal) {
                const y = dateVal.getFullYear();
                const m = String(dateVal.getMonth() + 1).padStart(2, '0');
                const d = String(dateVal.getDate()).padStart(2, '0');
                const rawDate = `${y}-${m}-${d}`;
                const dateText = dateVal.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                return { dateText, rawDate };
            }
            if (term.dueDateMode === 'offset') {
                return { dateText: `Sem ${targetSem} start date not in Academic Calendar`, rawDate: null };
            }
            return { dateText: '—', rawDate: null };
        };

        // 4. Generate unique cohorts from semester calendar rows
        const cohortKeys = new Set();
        const cohorts = [];

        semesterRows.forEach(s => {
            const key = `${s.college_name}|${s.course_name}|${s.batch}|${s.year_of_study}`;
            if (!cohortKeys.has(key)) {
                cohortKeys.add(key);
                cohorts.push({
                    college_name: s.college_name,
                    college_code: s.college_code,
                    course_name: s.course_name,
                    batch: s.batch,
                    year_of_study: s.year_of_study,
                    year_label: s.year_label
                });
            }
        });

        const results = [];

        cohorts.forEach(cohort => {
            const { college_name, college_code, course_name, batch, year_of_study, year_label } = cohort;

            // Resolve Academic terms
            const acadStruct = structures.find(fs => 
                fs.college === college_name &&
                fs.course === course_name &&
                String(fs.batch).split('-')[0].trim() === String(batch).split('-')[0].trim() &&
                Number(fs.studentYear) === Number(year_of_study) &&
                fs.terms && fs.terms.length > 0
            );

            const acadTerms = acadStruct ? acadStruct.terms : [];
            const acadResolved = acadTerms.map(t => {
                const targetSem = Number(t.referenceSemester) || Number(acadStruct?.semester) || 1;
                const formatted = formatTermVal(t, targetSem, college_name, course_name, batch, year_of_study, year_label);
                return {
                    termNumber: t.termNumber,
                    dateText: formatted.dateText,
                    rawDate: formatted.rawDate
                };
            });

            // Resolve Service terms (Transport & Hostel)
            const getServiceResolved = (type) => {
                const svc = serviceConfigs.find(c => c.type === type && String(c.academicYear).slice(0, 4) === String(year_label).slice(0, 4));
                if (!svc) return [];
                const termsCount = Number(svc.defaultTermsCount) || (svc.defaultTerms || []).length || 1;
                const rule = (svc.lateFeeRules || []).find((r) => Number(r.termsCount) === termsCount);
                const fallbackDefault = defaultConfigs.find((c) => Number(c.termsCount) === termsCount);

                return (svc.defaultTerms || []).map((t, idx) => {
                    const termNum = Number(t.termNumber) || idx + 1;
                    const rt = rule?.terms?.find(item => Number(item.termNumber) === termNum);
                    const dt = fallbackDefault?.terms?.find(item => Number(item.termNumber) === termNum);
                    const termConfig = {
                        dueDateMode: rt?.dueDateMode || dt?.dueDateMode || 'offset',
                        referenceSemester: rt?.referenceSemester || dt?.referenceSemester || 1,
                        dueOffsetDays: (rt?.dueOffsetDays !== undefined && rt?.dueOffsetDays !== null)
                            ? Number(rt.dueOffsetDays)
                            : (Number(dt?.dueOffsetDays) || 0),
                        fixedDueDate: rt?.fixedDueDate || dt?.fixedDueDate || null
                    };
                    const targetSem = Number(termConfig.referenceSemester) || 1;
                    const formatted = formatTermVal(termConfig, targetSem, college_name, course_name, batch, year_of_study, year_label);
                    return {
                        termNumber: termNum,
                        dateText: formatted.dateText,
                        rawDate: formatted.rawDate
                    };
                });
            };

            const transportResolved = getServiceResolved('TRANSPORT');
            const hostelResolved = getServiceResolved('HOSTEL');

            results.push({
                college_name,
                college_code,
                course_name,
                batch,
                year_of_study,
                year_label,
                categories: [
                    { categoryName: 'Academic Fees', terms: acadResolved },
                    { categoryName: 'Transport Fee', terms: transportResolved },
                    { categoryName: 'Hostel Fee', terms: hostelResolved }
                ]
            });
        });

        res.json(results);
    } catch (err) {
        console.error('Error fetching term dates:', err);
        res.status(500).json({ message: 'Error fetching term dates', error: err.message });
    }
};

const updateTermDates = async (req, res) => {
    try {
        const { college, course, batch, year_of_study, year_label, categoryName, terms } = req.body;
        if (!college || !course || !batch || !year_of_study || !categoryName || !Array.isArray(terms)) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const FeeStructure = require('../models/FeeStructure');
        const ServiceLateFeeConfig = require('../models/ServiceLateFeeConfig');
        const DefaultLateFeeConfig = require('../models/DefaultLateFeeConfig');

        if (categoryName === 'Academic Fees') {
            const matchBatch = String(batch).split('-')[0].trim();
            const structures = await FeeStructure.find({
                college,
                course,
                studentYear: Number(year_of_study)
            });

            const targetStructures = structures.filter(fs => 
                String(fs.batch).split('-')[0].trim() === matchBatch
            );

            if (targetStructures.length === 0) {
                return res.status(404).json({ message: 'Fee Structure not found for this cohort' });
            }

            for (const struct of targetStructures) {
                let modified = false;
                terms.forEach(t => {
                    const termNum = Number(t.termNumber);
                    const rawDate = t.rawDate;
                    if (!rawDate) return;
                    
                    const existingTerm = struct.terms.find(item => Number(item.termNumber) === termNum);
                    if (existingTerm) {
                        existingTerm.dueDateMode = 'fixed';
                        existingTerm.fixedDueDate = new Date(rawDate);
                        modified = true;
                    }
                });
                if (modified) {
                    await struct.save();
                }
            }

        } else {
            const type = categoryName === 'Transport Fee' ? 'TRANSPORT' : 'HOSTEL';
            const yearStr = String(year_label).slice(0, 4);
            const svc = await ServiceLateFeeConfig.findOne({
                type,
                isActive: { $ne: false },
                academicYear: { $regex: new RegExp(`^${yearStr}`) }
            });

            if (!svc) {
                return res.status(404).json({ message: `Service Late Fee Config not found for type ${type} and year ${yearStr}` });
            }

            const termsCount = Number(svc.defaultTermsCount) || (svc.defaultTerms || []).length || 1;
            let rule = (svc.lateFeeRules || []).find((r) => Number(r.termsCount) === termsCount);
            if (!rule) {
                const fallbackDefault = await DefaultLateFeeConfig.findOne({ isActive: true, termsCount });
                const newTermsList = [];
                for (let i = 1; i <= termsCount; i++) {
                    const dt = fallbackDefault?.terms?.find(item => Number(item.termNumber) === i);
                    newTermsList.push({
                        termNumber: i,
                        dueDateMode: dt?.dueDateMode || 'offset',
                        referenceSemester: dt?.referenceSemester || 1,
                        dueOffsetDays: dt?.dueOffsetDays !== undefined ? Number(dt.dueOffsetDays) : 0,
                        fixedDueDate: dt?.fixedDueDate || null
                    });
                }
                
                svc.lateFeeRules.push({
                    termsCount,
                    terms: newTermsList
                });
                rule = svc.lateFeeRules[svc.lateFeeRules.length - 1];
            }

            terms.forEach(t => {
                const termNum = Number(t.termNumber);
                const rawDate = t.rawDate;
                if (!rawDate) return;

                const ruleTerm = rule.terms.find(item => Number(item.termNumber) === termNum);
                if (ruleTerm) {
                    ruleTerm.dueDateMode = 'fixed';
                    ruleTerm.fixedDueDate = new Date(rawDate);
                }
            });

            svc.markModified('lateFeeRules');
            await svc.save();
        }

        res.json({ message: 'Term dates updated successfully' });
    } catch (err) {
        console.error('Error updating term dates:', err);
        res.status(500).json({ message: 'Error updating term dates', error: err.message });
    }
};

module.exports = {
    getAcademicYears,
    getCalendarMetadata,
    createAcademicYear,
    updateAcademicYear,
    deleteAcademicYear,
    getTermDates,
    updateTermDates
};
