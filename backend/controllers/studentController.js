const db = require('../config/sqlDb');
// @desc    Get all students
// @route   GET /api/students
const getStudents = async (req, res) => {
  try {
    const { college, course, branch, batch } = req.query;

    console.log('Attempting to fetch students from SQL...', { college, course, branch, batch });

    let query = `
      SELECT 
        id, admission_number, student_name, father_name, 
        college, course, branch, student_mobile, student_status,
        current_year, current_semester, pin_no, stud_type, batch, email
      FROM students
      WHERE LOWER(student_status) = 'regular'
    `;

    const params = [];
    if (college) {
      query += ` AND college = ?`;
      params.push(college);
    }
    if (course) {
      query += ` AND course = ?`;
      params.push(course);
    }
    if (branch) {
      query += ` AND branch = ?`;
      params.push(branch);
    }
    if (batch) {
      query += ` AND batch = ?`;
      params.push(batch);
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

    // Also fetch distinct batches and categories (stud_type)
    const [batches] = await db.query(`SELECT DISTINCT batch FROM students WHERE batch IS NOT NULL AND batch != '' ORDER BY batch DESC`);
    const batchList = batches.map(b => b.batch);

    const [types] = await db.query(`SELECT DISTINCT stud_type FROM students WHERE stud_type IS NOT NULL AND stud_type != '' ORDER BY stud_type`);
    const categoryList = types.map(t => t.stud_type);

    const hierarchy = {};
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

    // Course → total_years from courses table (SQL schema: courses.total_years) – dynamic per course
    const [courseRows] = await db.query(
      'SELECT name, total_years FROM courses WHERE is_active = 1 AND name IS NOT NULL AND name != ""'
    );
    const courseYears = {};
    courseRows.forEach((r) => {
      const years = r.total_years != null ? Number(r.total_years) : 4;
      if (r.name && !(r.name in courseYears)) courseYears[r.name] = Math.max(1, Math.min(years, 10));
    });

    // Fetch mapping of Categories per College, Course, Batch
    const [categoryRows] = await db.query(`
      SELECT DISTINCT 
        TRIM(college) as college, 
        TRIM(course) as course, 
        TRIM(batch) as batch, 
        stud_type as category 
      FROM students 
      WHERE stud_type IS NOT NULL AND stud_type != '' AND student_status = 'Regular'
    `);
    
    const categoryMapping = {};
    categoryRows.forEach(row => {
      // Normalize values for key matching (lowercase and trimmed)
      const college = String(row.college || '').trim().toLowerCase();
      const course = String(row.course || '').trim().toLowerCase();
      const batch = String(row.batch || '').trim().toLowerCase();
      const key = `${college}|${course}|${batch}`;
      
      if (!categoryMapping[key]) categoryMapping[key] = [];
      if (!categoryMapping[key].includes(row.category)) {
        categoryMapping[key].push(row.category);
      }
    });

    res.json({
      hierarchy,
      batches: batchList,
      categories: categoryList,
      categoryMapping,
      courseYears
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

// @desc    Search students by Name, Pin, or Admission No
// @route   GET /api/students/search
const searchStudents = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 3) return res.json([]); // Minimum 3 chars

        const searchTerm = `%${q}%`;
        const [rows] = await db.query(`
            SELECT admission_number, student_name, pin_no, college, course, branch, batch, current_year, current_semester, student_photo 
            FROM students 
            WHERE admission_number LIKE ? OR student_name LIKE ? OR pin_no LIKE ? 
            LIMIT 20
        `, [searchTerm, searchTerm, searchTerm]);

        res.json(rows);
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
  getStudents,
  getStudentMetadata,
  getStudentByAdmissionNumber,
  searchStudents
};