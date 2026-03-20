const db = require('../config/sqlDb');

// @desc    Get Academic Years from MySQL
// @route   GET /api/academic-calendar/academic-years
const getAcademicYears = async (req, res) => {
    try {
        const query = `
            SELECT s.id, s.academic_year_id, s.course_id, ay.year_label, c.name as course_name, s.year_of_study, s.semester_number, s.start_date, s.end_date
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

// @desc    Get Academic Years Metadata (Years and Courses)
// @route   GET /api/academic-calendar/metadata
const getCalendarMetadata = async (req, res) => {
    try {
        const [years] = await db.query('SELECT id, year_label FROM academic_years ORDER BY year_label DESC');
        const [courses] = await db.query('SELECT id, name, total_years, semesters_per_year FROM courses ORDER BY name');
        res.json({ years, courses });
    } catch (error) {
        console.error('Error fetching calendar metadata:', error);
        res.status(500).json({ message: 'Error fetching calendar metadata' });
    }
};

// @desc    Create a new Academic Calendar record (Semester)
// @route   POST /api/academic-calendar/academic-years
const createAcademicYear = async (req, res) => {
    const { academic_year_id, course_id, year_of_study, semester_number, start_date, end_date } = req.body;
    
    if (!academic_year_id || !course_id || !year_of_study || !semester_number || !start_date || !end_date) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const query = `
            INSERT INTO semesters (academic_year_id, course_id, year_of_study, semester_number, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [academic_year_id, course_id, year_of_study, semester_number, start_date, end_date]);
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
    const { academic_year_id, course_id, year_of_study, semester_number, start_date, end_date } = req.body;

    try {
        const query = `
            UPDATE semesters 
            SET academic_year_id = ?, course_id = ?, year_of_study = ?, semester_number = ?, start_date = ?, end_date = ?
            WHERE id = ?
        `;
        await db.query(query, [academic_year_id, course_id, year_of_study, semester_number, start_date, end_date, id]);
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
