const db = require('../config/sqlDb');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');
const {
  formatConcessionEntry,
  mapStoredEntryForResponse,
  resolveStudentFeeAmount,
  getConcessionAmount,
  normalizeSemester,
  buildFeeHeadMaps,
  resolveFeeHeadId
} = require('../utils/overallConcessionFees');
const { syncStandardFees } = require('../services/studentFeeSyncService');

// @desc    Get all students with their overall concessions (revised fees)
// @route   GET /api/overall-concessions
const getOverallConcessions = async (req, res) => {
    try {
        const { college, course, branch, batch, search } = req.query;

        // 1. Query students matching filters
        let sqlQuery = `SELECT admission_number, pin_no, student_name, college, course, branch, batch, current_year, current_semester, stud_type FROM students WHERE LOWER(student_status) = 'regular'`;
        const params = [];

        if (college) {
            sqlQuery += ` AND college = ?`;
            params.push(college);
        }
        if (course) {
            sqlQuery += ` AND course = ?`;
            params.push(course);
        }
        if (branch) {
            sqlQuery += ` AND branch = ?`;
            params.push(branch);
        }
        if (batch) {
            sqlQuery += ` AND batch = ?`;
            params.push(batch);
        }
        if (search) {
            sqlQuery += ` AND (student_name LIKE ? OR admission_number LIKE ? OR pin_no LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sqlQuery += ` LIMIT 100`;

        const [students] = await db.query(sqlQuery, params);

        if (students.length === 0) {
            return res.json([]);
        }

        // 2. Fetch all concessions (revised fees) for these students
        const studentIds = students.map(s => s.admission_number);
        const [concessions] = await db.query(
            `SELECT * FROM overall_concessions WHERE admission_number IN (?)`,
            [studentIds]
        );

        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        // Map concessions by student admission_number
        const concessionMap = {};
        concessions.forEach(c => {
            let fees = [];
            if (c.revised_fees) {
                fees = typeof c.revised_fees === 'string' ? JSON.parse(c.revised_fees) : c.revised_fees;
            }
            if (Array.isArray(fees)) {
                concessionMap[c.admission_number] = fees.map((rf, idx) => ({
                    id: `${c.id}_${idx}`,
                    ...mapStoredEntryForResponse(rf, feeHeads, codeMap)
                }));
            } else {
                concessionMap[c.admission_number] = [];
            }
        });

        // 3. Return students with revised fees attached
        const results = students.map(s => ({
            admission_number: s.admission_number,
            pin_no: s.pin_no || '-',
            student_name: s.student_name,
            college: s.college,
            course: s.course,
            branch: s.branch,
            batch: s.batch,
            current_year: s.current_year,
            current_semester: s.current_semester,
            stud_type: s.stud_type || 'Regular',
            revisedFees: concessionMap[s.admission_number] || []
        }));

        res.json(results);
    } catch (error) {
        console.error('Error fetching overall concessions:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Assign or Update a revised fee (concession) for a student
// @route   POST /api/overall-concessions
const saveOverallConcession = async (req, res) => {
    const { 
        admissionNumber, 
        pinNo, 
        studentName, 
        college,
        course, 
        branch, 
        batch, 
        category,
        feeHeadId, 
        studentYear, 
        semester, 
        amount,
        revisedAmount,
        concessionType
    } = req.body;

    const concessionAmount = amount ?? revisedAmount;
    if (!admissionNumber || !feeHeadId || !studentYear || concessionAmount === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const sYear = Number(studentYear);
        const sem = normalizeSemester(semester);
        const numericAmount = Number(concessionAmount);

        // 1. Fetch existing student row
        const [existing] = await db.query(
            `SELECT * FROM overall_concessions WHERE admission_number = ?`,
            [admissionNumber]
        );

        let revisedFees = [];
        if (existing.length > 0) {
            const rawFees = existing[0].revised_fees;
            revisedFees = typeof rawFees === 'string' ? JSON.parse(rawFees) : rawFees || [];
        }

        const feeHead = await FeeHead.findById(feeHeadId).lean();
        const feeHeadCode = feeHead ? feeHead.code : '';

        // 2. Update or insert concession in the array
        const existingIndex = revisedFees.findIndex(f => 
            String(f.feeHeadId) === String(feeHeadId) && 
            Number(f.studentYear) === sYear && 
            normalizeSemester(f.semester) === sem
        );

        const storedEntry = formatConcessionEntry({
            feeHeadId,
            feeHeadCode,
            studentYear: sYear,
            semester: sem,
            amount: numericAmount,
            concessionType
        });

        if (existingIndex > -1) {
            revisedFees[existingIndex] = storedEntry;
        } else {
            revisedFees.push(storedEntry);
        }

        // 3. Upsert in MySQL overall_concessions table
        const revisedFeesJson = JSON.stringify(revisedFees);
        const insertQuery = `
            INSERT INTO overall_concessions 
                (admission_number, pin_no, student_name, batch, course, branch, revised_fees)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                revised_fees = ?, pin_no = ?, student_name = ?, batch = ?, course = ?, branch = ?
        `;
        const insertParams = [
            admissionNumber, pinNo || '-', studentName || '', batch || '', course || '', branch || '', revisedFeesJson,
            revisedFeesJson, pinNo || '-', studentName || '', batch || '', course || '', branch || ''
        ];

        const [dbResult] = await db.query(insertQuery, insertParams);

        // Fetch ID of row
        let concessionId = dbResult.insertId;
        if (!concessionId && existing.length > 0) {
            concessionId = existing[0].id;
        }

        // 4. Propagate to MongoDB StudentFee collection immediately (only if standard fees already exist for this student and batch)
        const standardFeesApplied = await StudentFee.exists({
            studentId: admissionNumber,
            academicYear: batch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });

        if (standardFeesApplied) {
            const standardFee = await FeeStructure.findOne({
                feeHead: feeHeadId,
                college,
                course,
                branch,
                batch,
                category: category || 'Regular',
                studentYear: sYear,
                semester: sem
            }).lean();

            const isTermsDivided = standardFee ? standardFee.isTermsDivided : false;
            const targetAmt = resolveStudentFeeAmount(standardFee ? standardFee.amount : 0, storedEntry);

            await StudentFee.findOneAndUpdate(
                {
                    studentId: admissionNumber,
                    feeHead: feeHeadId,
                    academicYear: batch,
                    studentYear: sYear,
                    semester: sem,
                    $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
                },
                {
                    $set: {
                        studentName: studentName,
                        college: college || 'ANY',
                        course: course,
                        branch: branch,
                        amount: targetAmt,
                        semester: sem,
                        batch: batch,
                        stud_type: category || 'Regular',
                        isScholarshipApplicable: false,
                        isTermsDivided: isTermsDivided || false
                    }
                },
                { upsert: true, new: true }
            );
        }

        res.status(201).json({
            message: 'Revised fee saved successfully',
            concession: {
                id: `${concessionId}_new`,
                admissionNumber,
                ...storedEntry
            }
        });
    } catch (error) {
        console.error('Error saving overall concession:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a revised fee (restore standard fees)
// @route   DELETE /api/overall-concessions/:id
const deleteOverallConcession = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch details first so we can remove corresponding MongoDB records
        const [rows] = await db.query(`SELECT * FROM overall_concessions WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Concession not found' });
        }
        const c = rows[0];

        // 2. Delete from MySQL
        await db.query(`DELETE FROM overall_concessions WHERE id = ?`, [id]);

        // 3. Parse JSON list of concessions and restore standard fee amounts in MongoDB
        let fees = [];
        if (c.revised_fees) {
            fees = typeof c.revised_fees === 'string' ? JSON.parse(c.revised_fees) : c.revised_fees;
        }

        const standardFeesApplied = await StudentFee.exists({
            studentId: c.admission_number,
            academicYear: c.batch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });

        let syncResult = null;
        if (standardFeesApplied && Array.isArray(fees) && fees.length > 0) {
            const [students] = await db.query(
                `SELECT admission_number, student_name, college, course, branch, batch, current_year, current_semester, stud_type
                 FROM students WHERE admission_number = ?`,
                [c.admission_number]
            );
            if (students.length > 0) {
                syncResult = await syncStandardFees(students[0], c.admission_number);
            }
        }

        console.log(`Restored standard fees after concession delete. Sync result:`, syncResult);

        res.json({ message: 'Concession removed and standard fees restored' });
    } catch (error) {
        console.error('Error deleting overall concession:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Bulk Assign, Update or Delete revised fees (concessions) for a student
// @route   POST /api/overall-concessions/bulk
const bulkSaveOverallConcessions = async (req, res) => {
    const { 
        admissionNumber, 
        pinNo, 
        studentName, 
        college, 
        course, 
        branch, 
        batch, 
        category,
        concessions // Array of { feeHeadId, feeHeadCode, studentYear, semester, amount }
    } = req.body;

    if (!admissionNumber || !Array.isArray(concessions)) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Persist concessions in SQL
        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        const normalizeIncomingEntry = (c) => {
            const sem = normalizeSemester(c.semester);
            const resolvedId = resolveFeeHeadId(c, codeMap);
            const resolvedFh = feeHeads.find(fh => fh._id.toString() === resolvedId);
            return formatConcessionEntry({
                feeHeadId: resolvedId,
                feeHeadCode: resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
                studentYear: Number(c.studentYear),
                semester: sem,
                amount: getConcessionAmount(c),
                concessionType: c.concessionType
            });
        };

        // 2. Normalize incoming concessions for storage
        if (concessions.length === 0) {
            await connection.query(`DELETE FROM overall_concessions WHERE admission_number = ?`, [admissionNumber]);
        } else {
            const updatedConcessions = concessions.map(normalizeIncomingEntry);

            const revisedFeesJson = JSON.stringify(updatedConcessions);
            const insertQuery = `
                INSERT INTO overall_concessions 
                    (admission_number, pin_no, student_name, batch, course, branch, revised_fees)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    revised_fees = ?, pin_no = ?, student_name = ?, batch = ?, course = ?, branch = ?
            `;
            const insertParams = [
                admissionNumber, pinNo || '-', studentName || '', batch || '', course || '', branch || '', revisedFeesJson,
                revisedFeesJson, pinNo || '-', studentName || '', batch || '', course || '', branch || ''
            ];
            await connection.query(insertQuery, insertParams);
        }

        await connection.commit();

        // 4. Re-sync MongoDB fee amounts from structure + remaining concessions
        const standardFeesApplied = await StudentFee.exists({
            studentId: admissionNumber,
            academicYear: batch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });

        if (standardFeesApplied) {
            const [students] = await db.query(
                `SELECT admission_number, student_name, college, course, branch, batch, current_year, current_semester, stud_type
                 FROM students WHERE admission_number = ?`,
                [admissionNumber]
            );
            if (students.length > 0) {
                await syncStandardFees(students[0], admissionNumber);
            }
        }

        // Fetch all concessions for this student again to return updated state
        const [updatedList] = await db.query(
            `SELECT * FROM overall_concessions WHERE admission_number = ?`,
            [admissionNumber]
        );

        const updatedRow = updatedList[0];
        const responseConcessions = updatedRow 
            ? (typeof updatedRow.revised_fees === 'string' ? JSON.parse(updatedRow.revised_fees) : updatedRow.revised_fees || []).map((c, idx) => ({
                id: `${updatedRow.id}_${idx}`,
                ...mapStoredEntryForResponse(c, feeHeads, codeMap)
            }))
            : [];

        res.json({
            message: 'Revised fees updated successfully',
            revisedFees: responseConcessions
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error performing bulk concession update:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getOverallConcessions,
    saveOverallConcession,
    deleteOverallConcession,
    bulkSaveOverallConcessions
};
