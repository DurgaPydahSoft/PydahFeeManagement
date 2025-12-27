const db = require('../config/sqlDb');

// @desc    Get all students
// @route   GET /api/students
// @access  Public (for now)
// @desc    Get All Students (from SQL)
// @route   GET /api/students
const getStudents = async (req, res) => {
  try {
    const { college } = req.query;

    console.log('Attempting to fetch students from SQL...');

    let query = `
      SELECT *
      FROM students
      WHERE LOWER(student_status) = 'regular'
    `;

    const params = [];
    if (college) {
      query += ` AND college = ?`;
      params.push(college);
    }
    if (req.query.course) {
      query += ` AND course = ?`;
      params.push(req.query.course);
    }
    if (req.query.branch) {
      query += ` AND branch = ?`;
      params.push(req.query.branch);
    }
    if (req.query.batch) {
      query += ` AND batch = ?`;
      params.push(req.query.batch);
    }

    // Optimize query: Select only necessary columns
    // Including 'current_year' to map to Fee Structure's studentYear
    const [rows] = await db.query(query, params);
    console.log(`Successfully fetched ${rows.length} students.`);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students form SQL Database', error: error.message });
  }
};

// @desc    Get Institutional Metadata (Colleges -> Courses -> Branches + Duration)
// @route   GET /api/students/metadata
const getStudentMetadata = async (req, res) => {
  try {
    // Join tables to get valid hierarchy including total_years from courses table
    const [rows] = await db.query(`
      SELECT 
        cl.name as college, 
        c.name as course, 
        c.total_years,
        cb.name as branch 
      FROM colleges cl 
      JOIN courses c ON cl.id = c.college_id 
      JOIN course_branches cb ON c.id = cb.course_id
      WHERE cl.is_active = 1 AND c.is_active = 1 AND cb.is_active = 1
      ORDER BY cl.name, c.name, cb.name
    `);

    // Transform into hierarchical structure
    // { "College A": { "Course X": { branches: ["Branch 1"], total_years: 4 } } }
    const hierarchy = {};

    // Also fetch distinct batches
    const [batches] = await db.query(`SELECT DISTINCT batch FROM students WHERE batch IS NOT NULL AND batch != '' ORDER BY batch DESC`);
    const batchList = batches.map(b => b.batch);

    rows.forEach(row => {
      if (!hierarchy[row.college]) {
        hierarchy[row.college] = {};
      }
      if (!hierarchy[row.college][row.course]) {
        hierarchy[row.college][row.course] = {
          branches: [],
          total_years: row.total_years || 4 // Fallback if null
        };
      }
      if (!hierarchy[row.college][row.course].branches.includes(row.branch)) {
        hierarchy[row.college][row.course].branches.push(row.branch);
      }
    });

    res.json({
      hierarchy,
      batches: batchList
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ message: 'Failed to fetch metadata' });
  }
};

// @desc    Get Single Student by Admission Number (with Photo)
// @route   GET /api/students/:id
const getStudentByAdmissionNumber = async (req, res) => {
  try {
    const { id } = req.params; // admission_number

    const [rows] = await db.query(`SELECT * FROM students WHERE admission_number = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getStudents,
  getStudentMetadata,
  getStudentByAdmissionNumber
};
