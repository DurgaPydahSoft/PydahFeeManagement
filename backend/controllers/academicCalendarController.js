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

module.exports = {
    getAcademicYears,
    getCalendarMetadata,
    createAcademicYear,
    updateAcademicYear,
    deleteAcademicYear
};
