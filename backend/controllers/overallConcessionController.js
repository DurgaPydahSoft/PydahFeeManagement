const db = require('../config/sqlDb');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');

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
        const feeHeadMap = {};
        const codeMap = {};
        feeHeads.forEach(fh => {
            feeHeadMap[fh._id.toString()] = fh.code || '';
            if (fh.code) {
                codeMap[fh.code.trim().toUpperCase()] = fh;
            }
        });

        // Map concessions by student admission_number
        const concessionMap = {};
        concessions.forEach(c => {
            let fees = [];
            if (c.revised_fees) {
                fees = typeof c.revised_fees === 'string' ? JSON.parse(c.revised_fees) : c.revised_fees;
            }
            if (Array.isArray(fees)) {
                concessionMap[c.admission_number] = fees.map((rf, idx) => {
                    let resolvedFh = null;
                    const codeKey = rf.feeHeadCode ? rf.feeHeadCode.trim().toUpperCase() : '';
                    if (codeKey && codeMap[codeKey]) {
                        resolvedFh = codeMap[codeKey];
                    } else {
                        resolvedFh = feeHeads.find(fh => fh._id.toString() === rf.feeHeadId);
                    }

                    return {
                        id: `${c.id}_${idx}`,
                        feeHeadId: resolvedFh ? resolvedFh._id.toString() : rf.feeHeadId,
                        feeHeadCode: resolvedFh ? resolvedFh.code : (rf.feeHeadCode || ''),
                        studentYear: Number(rf.studentYear),
                        semester: rf.semester || null,
                        revisedAmount: Number(rf.revisedAmount),
                        concessionType: rf.concessionType || 'REVISED'
                    };
                });
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
        revisedAmount,
        concessionType
    } = req.body;

    if (!admissionNumber || !feeHeadId || !studentYear || revisedAmount === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const sYear = Number(studentYear);
        const sem = semester ? Number(semester) : null;
        const amount = Number(revisedAmount);

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
            f.feeHeadId === feeHeadId && 
            Number(f.studentYear) === sYear && 
            (f.semester === sem || (f.semester === null && sem === null))
        );

        if (existingIndex > -1) {
            revisedFees[existingIndex].revisedAmount = amount;
            revisedFees[existingIndex].feeHeadCode = feeHeadCode;
            revisedFees[existingIndex].concessionType = concessionType || 'REVISED';
        } else {
            revisedFees.push({
                feeHeadId,
                feeHeadCode,
                studentYear: sYear,
                semester: sem,
                revisedAmount: amount,
                concessionType: concessionType || 'REVISED'
            });
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

            let targetAmt = amount;
            if (concessionType === 'CONCESSION') {
                const stdAmount = standardFee ? standardFee.amount : 0;
                targetAmt = Math.max(0, stdAmount - amount);
            }

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
                feeHeadId,
                studentYear: sYear,
                semester: sem,
                revisedAmount: amount,
                concessionType: concessionType || 'REVISED'
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

        // 3. Parse JSON list of concessions and delete overrides from MongoDB
        let fees = [];
        if (c.revised_fees) {
            fees = typeof c.revised_fees === 'string' ? JSON.parse(c.revised_fees) : c.revised_fees;
        }

        let deletedCount = 0;
        if (Array.isArray(fees)) {
            for (const f of fees) {
                const deleteRes = await StudentFee.deleteOne({
                    studentId: c.admission_number,
                    feeHead: f.feeHeadId,
                    academicYear: c.batch,
                    studentYear: Number(f.studentYear),
                    semester: f.semester || null,
                    $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
                });
                deletedCount += deleteRes.deletedCount;
            }
        }

        console.log(`Deleted revised fees from MongoDB. Removed count: ${deletedCount}`);

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
        concessions // Array of { feeHeadId, studentYear, semester, revisedAmount }
    } = req.body;

    if (!admissionNumber || !Array.isArray(concessions)) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch existing concessions for this student in SQL
        const [existing] = await connection.query(
            `SELECT * FROM overall_concessions WHERE admission_number = ?`,
            [admissionNumber]
        );

        const existingRow = existing[0];
        const existingFees = existingRow 
            ? (typeof existingRow.revised_fees === 'string' ? JSON.parse(existingRow.revised_fees) : existingRow.revised_fees || []) 
            : [];

        const feeHeads = await FeeHead.find({}).lean();
        const feeHeadMap = {};
        const codeMap = {};
        feeHeads.forEach(fh => {
            feeHeadMap[fh._id.toString()] = fh.code || '';
            if (fh.code) {
                codeMap[fh.code.trim().toUpperCase()] = fh;
            }
        });

        // Normalize existing concessions for easy lookup
        const existingMap = {};
        existingFees.forEach(e => {
            let resolvedFh = null;
            const codeKey = e.feeHeadCode ? e.feeHeadCode.trim().toUpperCase() : '';
            if (codeKey && codeMap[codeKey]) {
                resolvedFh = codeMap[codeKey];
            } else {
                resolvedFh = feeHeads.find(fh => fh._id.toString() === e.feeHeadId);
            }
            const actualId = resolvedFh ? resolvedFh._id.toString() : e.feeHeadId;
            const actualCode = resolvedFh ? resolvedFh.code : (e.feeHeadCode || '');

            const key = `${actualId}_${e.studentYear}_${e.semester === null || e.semester === undefined ? 'null' : e.semester}`;
            existingMap[key] = {
                ...e,
                feeHeadId: actualId,
                feeHeadCode: actualCode
            };
        });

        const newMap = {};
        const toUpsert = [];
        const toDelete = [];

        // 2. Process incoming concessions
        concessions.forEach(c => {
            const sem = c.semester === null || c.semester === '' || c.semester === undefined ? null : Number(c.semester);
            
            let resolvedFh = null;
            const codeKey = c.feeHeadCode ? c.feeHeadCode.trim().toUpperCase() : '';
            if (codeKey && codeMap[codeKey]) {
                resolvedFh = codeMap[codeKey];
            } else {
                resolvedFh = feeHeads.find(fh => fh._id.toString() === c.feeHeadId);
            }
            const actualId = resolvedFh ? resolvedFh._id.toString() : c.feeHeadId;
            const actualCode = resolvedFh ? resolvedFh.code : (c.feeHeadCode || '');

            const key = `${actualId}_${Number(c.studentYear)}_${sem === null ? 'null' : sem}`;
            newMap[key] = {
                feeHeadId: actualId,
                feeHeadCode: actualCode,
                studentYear: Number(c.studentYear),
                semester: sem,
                revisedAmount: Number(c.revisedAmount),
                concessionType: c.concessionType || 'REVISED'
            };
            
            const existingEntry = existingMap[key];
            if (!existingEntry || Number(existingEntry.revisedAmount) !== Number(c.revisedAmount) || existingEntry.concessionType !== (c.concessionType || 'REVISED')) {
                toUpsert.push(newMap[key]);
            }
        });

        // Identify deletes (in existing but not in new)
        Object.keys(existingMap).forEach(key => {
            const e = existingMap[key];
            if (!newMap[key]) {
                toDelete.push({
                    feeHeadId: e.feeHeadId,
                    studentYear: Number(e.studentYear),
                    semester: e.semester
                });
            }
        });

        // 3. Update SQL
        if (concessions.length === 0) {
            await connection.query(`DELETE FROM overall_concessions WHERE admission_number = ?`, [admissionNumber]);
        } else {
            // Map concessions list to ensure it includes the feeHeadCode and is resolved to current ID
            const updatedConcessions = concessions.map(c => {
                const sem = c.semester === null || c.semester === '' || c.semester === undefined ? null : Number(c.semester);
                let resolvedFh = null;
                const codeKey = c.feeHeadCode ? c.feeHeadCode.trim().toUpperCase() : '';
                if (codeKey && codeMap[codeKey]) {
                    resolvedFh = codeMap[codeKey];
                } else {
                    resolvedFh = feeHeads.find(fh => fh._id.toString() === c.feeHeadId);
                }
                return {
                    feeHeadId: resolvedFh ? resolvedFh._id.toString() : c.feeHeadId,
                    feeHeadCode: resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
                    studentYear: Number(c.studentYear),
                    semester: sem,
                    revisedAmount: Number(c.revisedAmount),
                    concessionType: c.concessionType || 'REVISED'
                };
            });

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

        // 4. Perform MongoDB operations (outside SQL transaction, since MongoDB is not transactional in this setup and we want resilience)
        const standardFeesApplied = await StudentFee.exists({
            studentId: admissionNumber,
            academicYear: batch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });

        if (standardFeesApplied) {
            // MongoDB Deletes
            for (const d of toDelete) {
                await StudentFee.deleteOne({
                    studentId: admissionNumber,
                    feeHead: d.feeHeadId,
                    academicYear: batch,
                    studentYear: d.studentYear,
                    semester: d.semester || null,
                    $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
                });
            }

            const applicableStructures = await FeeStructure.find({
                college,
                course,
                branch,
                batch,
                category: category || 'Regular'
            }).lean();

            const structureMap = {};
            applicableStructures.forEach(fs => {
                const key = `${fs.feeHead.toString()}_${fs.studentYear}_${fs.semester === null || fs.semester === undefined ? 'null' : fs.semester}`;
                structureMap[key] = fs;
            });

            // MongoDB Upserts
            for (const u of toUpsert) {
                const fsKey = `${u.feeHeadId}_${u.studentYear}_${u.semester === null ? 'null' : u.semester}`;
                const matchedStructure = structureMap[fsKey];
                const isTermsDivided = matchedStructure ? matchedStructure.isTermsDivided : false;

                let finalAmount = u.revisedAmount;
                if (u.concessionType === 'CONCESSION') {
                    const stdAmount = matchedStructure ? matchedStructure.amount : 0;
                    finalAmount = Math.max(0, stdAmount - u.revisedAmount);
                }

                await StudentFee.findOneAndUpdate(
                    {
                        studentId: admissionNumber,
                        feeHead: u.feeHeadId,
                        academicYear: batch,
                        studentYear: u.studentYear,
                        semester: u.semester,
                        $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
                    },
                    {
                        $set: {
                            studentName: studentName,
                            college: college || 'ANY',
                            course: course,
                            branch: branch,
                            amount: finalAmount,
                            semester: u.semester,
                            batch: batch,
                            stud_type: category || 'Regular',
                            isScholarshipApplicable: false,
                            isTermsDivided: isTermsDivided || false
                        }
                    },
                    { upsert: true }
                );
            }
        }

        // Fetch all concessions for this student again to return updated state
        const [updatedList] = await db.query(
            `SELECT * FROM overall_concessions WHERE admission_number = ?`,
            [admissionNumber]
        );

        const updatedRow = updatedList[0];
        const responseConcessions = updatedRow 
            ? (typeof updatedRow.revised_fees === 'string' ? JSON.parse(updatedRow.revised_fees) : updatedRow.revised_fees || []).map((c, idx) => {
                let resolvedFh = null;
                const codeKey = c.feeHeadCode ? c.feeHeadCode.trim().toUpperCase() : '';
                if (codeKey && codeMap[codeKey]) {
                    resolvedFh = codeMap[codeKey];
                } else {
                    resolvedFh = feeHeads.find(fh => fh._id.toString() === c.feeHeadId);
                }
                return {
                    id: `${updatedRow.id}_${idx}`,
                    feeHeadId: resolvedFh ? resolvedFh._id.toString() : c.feeHeadId,
                    feeHeadCode: resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
                    studentYear: Number(c.studentYear),
                    semester: c.semester,
                    revisedAmount: Number(c.revisedAmount),
                    concessionType: c.concessionType || 'REVISED'
                };
            })
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
