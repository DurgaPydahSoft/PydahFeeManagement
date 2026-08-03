const db = require('../config/sqlDb');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');
const OverallConcessionRequest = require('../models/OverallConcessionRequest');
const {
  formatConcessionEntry,
  mapStoredEntryForResponse,
  resolveStudentFeeAmount,
  getConcessionAmount,
  normalizeSemester,
  normalizeConcessionType,
  buildFeeHeadMaps,
  resolveFeeHeadId
} = require('../utils/overallConcessionFees');
const { syncStandardFees } = require('../services/studentFeeSyncService');
const {
  validateRevisedEntriesAgainstStructures,
  applyRevisedConcessionTransactions,
  cancelDeclarationConcessionTransactions
} = require('../services/overallConcessionRevisedService');

// @desc    Get all students with their overall concessions (revised fees)
// @route   GET /api/overall-concessions
const getOverallConcessions = async (req, res) => {
    try {
        const { college, course, branch, batch, search } = req.query;

        // 1. Query students matching filters
        let sqlQuery = `SELECT admission_number, pin_no, student_name, college, course, branch, batch, current_year, current_semester, stud_type, student_status FROM students WHERE LOWER(student_status) = 'regular'`;
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

        const [students] = await db.query(sqlQuery, params);

        if (students.length === 0) {
            return res.json([]);
        }

        // 2. Fetch all concessions (revised fees) from MongoDB for these students
        const studentIds = students.map(s => s.admission_number);
        const approvedRequests = await OverallConcessionRequest.find({
            admissionNumber: { $in: studentIds },
            status: 'APPROVED'
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();

        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        // Map concessions by student admission_number
        const concessionMap = {};
        studentIds.forEach(id => {
            concessionMap[id] = [];
        });

        const processedStudents = new Set();
        approvedRequests.forEach(req => {
            if (!processedStudents.has(req.admissionNumber)) {
                processedStudents.add(req.admissionNumber);
                const fees = req.concessions || [];
                concessionMap[req.admissionNumber] = fees.map((rf, idx) => ({
                    id: `${req._id.toString()}_${idx}`,
                    ...mapStoredEntryForResponse(rf, feeHeads, codeMap)
                }));
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
            student_status: s.student_status,
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
        concessionType,
        remarks
    } = req.body;

    const concessionAmount = amount ?? revisedAmount;
    if (!admissionNumber || !feeHeadId || !studentYear || concessionAmount === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const sYear = Number(studentYear);
        const sem = normalizeSemester(semester);
        const numericAmount = Number(concessionAmount);

        const feeHead = await FeeHead.findById(feeHeadId).lean();
        const feeHeadCode = feeHead ? feeHead.code : '';

        const storedEntry = formatConcessionEntry({
            feeHeadId,
            feeHeadCode,
            studentYear: sYear,
            semester: sem,
            amount: numericAmount,
            concessionType,
            remarks
        });

        if (normalizeConcessionType(storedEntry.concessionType) === 'REVISED') {
            const validation = await validateRevisedEntriesAgainstStructures({
                entries: [storedEntry],
                college,
                course,
                branch,
                batch,
                category: category || 'Regular'
            });
            if (!validation.ok) {
                return res.status(400).json({ message: validation.message, warnings: validation.warnings });
            }
        }

        // 1. Fetch existing approved request from MongoDB
        let approvedRequest = await OverallConcessionRequest.findOne({
            admissionNumber,
            status: 'APPROVED'
        }).sort({ updatedAt: -1, createdAt: -1 });

        let revisedFees = [];
        if (approvedRequest) {
            revisedFees = approvedRequest.concessions || [];
        }

        // 2. Update or insert concession in the array
        const existingIndex = revisedFees.findIndex(f => 
            String(f.feeHeadId) === String(feeHeadId) && 
            Number(f.studentYear) === sYear && 
            normalizeSemester(f.semester) === sem
        );

        if (existingIndex > -1) {
            revisedFees[existingIndex] = storedEntry;
        } else {
            revisedFees.push(storedEntry);
        }

        // 3. Upsert in MongoDB OverallConcessionRequest table
        if (approvedRequest) {
            approvedRequest.concessions = revisedFees;
            approvedRequest.studentName = studentName || approvedRequest.studentName;
            approvedRequest.pinNo       = pinNo || approvedRequest.pinNo;
            approvedRequest.college     = college || approvedRequest.college;
            approvedRequest.course      = course || approvedRequest.course;
            approvedRequest.branch      = branch || approvedRequest.branch;
            approvedRequest.batch       = batch || approvedRequest.batch;
            approvedRequest.category    = category || approvedRequest.category;
            approvedRequest.approvedBy  = req.user?.username || approvedRequest.approvedBy || 'system';
            approvedRequest.approvedByName = req.user?.name || approvedRequest.approvedByName || 'System';
            await approvedRequest.save();
        } else {
            approvedRequest = await OverallConcessionRequest.create({
                admissionNumber,
                pinNo:           pinNo || '-',
                studentName:     studentName || '',
                college:         college || '',
                course:          course || '',
                branch:          branch || '',
                batch:           batch || '',
                category:        category || 'Regular',
                concessions:     revisedFees,
                status:          'APPROVED',
                requestedBy:     req.user?.username || 'system',
                requestedByName: req.user?.name || 'System',
                approvedBy:      req.user?.username || 'system',
                approvedByName:  req.user?.name || 'System'
            });
        }

        const concessionId = approvedRequest._id.toString();

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
                    semester: sem
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
                        isTermsDivided: isTermsDivided || false,
                        remarks: storedEntry.remarks || undefined
                    }
                },
                { upsert: true, new: true }
            );

            await applyRevisedConcessionTransactions({
                admissionNumber,
                studentName,
                college,
                course,
                branch,
                batch,
                category: category || 'Regular',
                entries: [storedEntry],
                collectedBy: req.user?.username || 'system',
                collectedByName: req.user?.name || 'System'
            });
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
        const request = await OverallConcessionRequest.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Concession not found' });
        }

        // 2. Delete from MongoDB
        await OverallConcessionRequest.findByIdAndDelete(id);

        // 3. Parse list of concessions and restore standard fee amounts in MongoDB
        const fees = request.concessions || [];

        await cancelDeclarationConcessionTransactions({
            admissionNumber: request.admissionNumber,
            entries: fees,
            collectedBy: req.user?.username || 'system',
            collectedByName: req.user?.name || 'System'
        });

        const standardFeesApplied = await StudentFee.exists({
            studentId: request.admissionNumber,
            academicYear: request.batch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });

        let syncResult = null;
        if (standardFeesApplied && Array.isArray(fees) && fees.length > 0) {
            const [students] = await db.query(
                `SELECT admission_number, student_name, college, course, branch, batch, current_year, current_semester, stud_type
                 FROM students WHERE admission_number = ?`,
                [request.admissionNumber]
            );
            if (students.length > 0) {
                syncResult = await syncStandardFees(students[0], request.admissionNumber);
            }
        }

        console.log(`Restored standard fees after concession delete. Sync result:`, syncResult);

        res.json({ message: 'Concession removed and standard fees restored' });
    } catch (error) {
        console.error('Error deleting overall concession:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ── Shared helper: save concessions for ONE student inside a given connection/transaction ──
const _saveStudentConcessions = async ({
    admissionNumber, pinNo, studentName, college, course, branch, batch,
    category, concessions, feeHeads, codeMap, user
}) => {
    // Normalize one entry; async because zero-value REVISED entries need a structure lookup.
    const normalizeIncomingEntry = async (c) => {
        const sem = normalizeSemester(c.semester);
        const resolvedId = resolveFeeHeadId(c, codeMap);
        const resolvedFh = feeHeads.find(fh => fh._id.toString() === resolvedId);
        const cType = normalizeConcessionType(c.concessionType);
        let amount = getConcessionAmount(c);

        // Zero value + REVISED → treat the full structure demand as the concession amount
        // (student pays ₹0, i.e., complete waiver for that fee head / year).
        if (amount === 0 && cType === 'REVISED') {
            const structure = await FeeStructure.findOne({
                feeHead: resolvedId,
                college: college || '',
                course:  course  || '',
                branch:  branch  || '',
                batch:   batch   || '',
                category: category || 'Regular',
                studentYear: Number(c.studentYear),
                ...(sem !== null ? { semester: sem } : {
                    $or: [{ semester: null }, { semester: { $exists: false } }]
                })
            }).lean();
            if (structure && Number(structure.amount) > 0) {
                amount = Number(structure.amount);
            }
        }

        return formatConcessionEntry({
            feeHeadId: resolvedId,
            feeHeadCode: resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
            studentYear: Number(c.studentYear),
            semester: sem,
            amount,
            concessionType: c.concessionType,
            remarks: c.remarks
        });
    };

    const updatedConcessions = await Promise.all(concessions.map(normalizeIncomingEntry));

    const validation = await validateRevisedEntriesAgainstStructures({
        entries: updatedConcessions, college, course, branch, batch,
        category: category || 'Regular', codeMap
    });
    if (!validation.ok) {
        return { ok: false, message: validation.message, warnings: validation.warnings };
    }

    let approvedRequest = await OverallConcessionRequest.findOne({
        admissionNumber,
        status: 'APPROVED'
    }).sort({ updatedAt: -1, createdAt: -1 });

    let previousFees = approvedRequest ? approvedRequest.concessions || [] : [];

    if (concessions.length === 0) {
        if (approvedRequest) {
            await OverallConcessionRequest.findByIdAndDelete(approvedRequest._id);
        }
    } else {
        if (approvedRequest) {
            approvedRequest.concessions = updatedConcessions;
            approvedRequest.studentName = studentName || approvedRequest.studentName;
            approvedRequest.pinNo       = pinNo || approvedRequest.pinNo;
            approvedRequest.college     = college || approvedRequest.college;
            approvedRequest.course      = course || approvedRequest.course;
            approvedRequest.branch      = branch || approvedRequest.branch;
            approvedRequest.batch       = batch || approvedRequest.batch;
            approvedRequest.category    = category || approvedRequest.category;
            approvedRequest.approvedBy  = user?.username || approvedRequest.approvedBy || 'system';
            approvedRequest.approvedByName = user?.name || approvedRequest.approvedByName || 'System';
            await approvedRequest.save();
        } else {
            await OverallConcessionRequest.create({
                admissionNumber,
                pinNo:           pinNo || '-',
                studentName:     studentName || '',
                college:         college || '',
                course:          course || '',
                branch:          branch || '',
                batch:           batch || '',
                category:        category || 'Regular',
                concessions:     updatedConcessions,
                status:          'APPROVED',
                requestedBy:     user?.username || 'system',
                requestedByName: user?.name || 'System',
                approvedBy:      user?.username || 'system',
                approvedByName:  user?.name || 'System'
            });
        }
    }

    const nextKeys = new Set(
        updatedConcessions
            .filter(e => normalizeConcessionType(e.concessionType) === 'REVISED')
            .map(e => `${e.feeHeadId}_${Number(e.studentYear)}_${normalizeSemester(e.semester) ?? 'null'}`)
    );
    const removedRevised = previousFees.filter(e => {
        if (normalizeConcessionType(e.concessionType) !== 'REVISED') return false;
        const key = `${e.feeHeadId}_${Number(e.studentYear)}_${normalizeSemester(e.semester) ?? 'null'}`;
        return !nextKeys.has(key);
    });
    if (removedRevised.length > 0 || concessions.length === 0) {
        await cancelDeclarationConcessionTransactions({
            admissionNumber,
            entries: concessions.length === 0 ? previousFees : removedRevised,
            collectedBy: user?.username || 'system',
            collectedByName: user?.name || 'System',
            codeMap
        });
    }

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

        if (updatedConcessions.length > 0) {
            await applyRevisedConcessionTransactions({
                admissionNumber, studentName, college, course, branch, batch,
                category: category || 'Regular', entries: updatedConcessions,
                collectedBy: user?.username || 'system',
                collectedByName: user?.name || 'System',
                codeMap
            });
        }
    }

    return { ok: true, updatedConcessions };
};

// @desc    Bulk Assign, Update or Delete revised fees (concessions) for a student
// @route   POST /api/overall-concessions/bulk
const bulkSaveOverallConcessions = async (req, res) => {
    const { 
        admissionNumber, pinNo, studentName, college, course, branch, batch,
        category, concessions
    } = req.body;

    if (!admissionNumber || !Array.isArray(concessions)) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        const result = await _saveStudentConcessions({
            admissionNumber, pinNo, studentName, college, course,
            branch, batch, category, concessions, feeHeads, codeMap, user: req.user
        });

        if (!result.ok) {
            return res.status(400).json({ message: result.message, warnings: result.warnings });
        }

        const approvedRequest = await OverallConcessionRequest.findOne({
            admissionNumber,
            status: 'APPROVED'
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();

        const responseConcessions = approvedRequest
            ? (approvedRequest.concessions || []).map((c, idx) => ({
                id: `${approvedRequest._id.toString()}_${idx}`,
                ...mapStoredEntryForResponse(c, feeHeads, codeMap)
            }))
            : [];

        res.json({ message: 'Revised fees updated successfully', revisedFees: responseConcessions });

    } catch (error) {
        console.error('Error performing bulk concession update:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Bulk save concessions for MULTIPLE students at once
// @route   POST /api/overall-concessions/bulk-multi
const bulkSaveMultipleStudents = async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ message: 'No students provided' });
    }

    try {
        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        const errors = [];
        let saved = 0;

        for (const s of students) {
            if (!s.admissionNumber || !Array.isArray(s.concessions)) {
                errors.push({ admissionNumber: s.admissionNumber || '?', message: 'Missing required fields' });
                continue;
            }
            try {
                const result = await _saveStudentConcessions({
                    admissionNumber: s.admissionNumber,
                    pinNo: s.pinNo,
                    studentName: s.studentName,
                    college: s.college,
                    course: s.course,
                    branch: s.branch,
                    batch: s.batch,
                    category: s.category,
                    concessions: s.concessions,
                    feeHeads, codeMap, user: req.user
                });
                if (!result.ok) {
                    errors.push({ admissionNumber: s.admissionNumber, message: result.message });
                } else {
                    saved++;
                }
            } catch (err) {
                errors.push({ admissionNumber: s.admissionNumber, message: err.message });
            }
        }

        res.json({ message: `Saved ${saved} of ${students.length} students`, saved, total: students.length, errors });

    } catch (error) {
        console.error('Error performing bulk-multi concession update:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ---------------------------------------------------------------------------
// REQUEST WORKFLOW
// ---------------------------------------------------------------------------

// @desc    Submit a concession request for approval
// @route   POST /api/overall-concessions/request
const submitConcessionRequest = async (req, res) => {
    const {
        admissionNumber, pinNo, studentName,
        college, course, branch, batch, category,
        concessions // [{ feeHeadId, feeHeadCode, studentYear, semester, amount, concessionType }]
    } = req.body;

    if (!admissionNumber || !Array.isArray(concessions) || concessions.length === 0) {
        return res.status(400).json({ message: 'admissionNumber and at least one concession entry are required.' });
    }

    try {
        // Resolve student quota from SQL (stud_type). Request.category stores this quota.
        const [studentRows] = await db.query(
            `SELECT admission_number, student_name, pin_no, college, course, branch, batch, stud_type
             FROM students WHERE admission_number = ?`,
            [admissionNumber]
        );
        const student = studentRows[0];
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const studentQuota = (student.stud_type && String(student.stud_type).trim()) || category || 'Regular';
        const snapCollege = student.college || college || '';
        const snapCourse = student.course || course || '';
        const snapBranch = student.branch || branch || '';
        const snapBatch = student.batch || batch || '';
        const snapName = student.student_name || studentName || '';
        const snapPin = student.pin_no || pinNo || '-';

        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        // Normalize incoming entries; zero-value REVISED → resolve full structure amount
        const normalizedEntries = await Promise.all(concessions.map(async c => {
            const sem = normalizeSemester(c.semester);
            const resolvedId = resolveFeeHeadId(c, codeMap);
            const resolvedFh = feeHeads.find(fh => fh._id.toString() === resolvedId);
            const cType = String(c.concessionType || 'CONCESSION').trim().toUpperCase() === 'REVISED' ? 'REVISED' : 'CONCESSION';
            let amount = getConcessionAmount(c);

            // Zero + REVISED → use full fee structure demand as the concession amount
            if (amount === 0 && cType === 'REVISED') {
                const structure = await FeeStructure.findOne({
                    feeHead: resolvedId,
                    college: snapCollege,
                    course:  snapCourse,
                    branch:  snapBranch,
                    batch:   snapBatch,
                    category: studentQuota,
                    studentYear: Number(c.studentYear),
                    ...(sem !== null ? { semester: sem } : {
                        $or: [{ semester: null }, { semester: { $exists: false } }]
                    })
                }).lean();
                if (structure && Number(structure.amount) > 0) {
                    amount = Number(structure.amount);
                }
            }

            return {
                feeHeadId:      resolvedId,
                feeHeadCode:    resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
                studentYear:    Number(c.studentYear),
                semester:       sem,
                amount,
                concessionType: cType,
                remarks:        c.remarks || ''
            };
        }));

        // Find existing PENDING request for this student
        let existingRequest = await OverallConcessionRequest.findOne({
            admissionNumber,
            status: 'PENDING'
        });

        if (existingRequest) {
            // Merge: same feeHeadId + studentYear combo replaces, new combos are added
            const mergedMap = {};
            existingRequest.concessions.forEach(e => {
                mergedMap[`${e.feeHeadId}_${e.studentYear}_${e.semester ?? 'null'}`] = e;
            });
            normalizedEntries.forEach(e => {
                mergedMap[`${e.feeHeadId}_${e.studentYear}_${e.semester ?? 'null'}`] = e;
            });
            existingRequest.concessions = Object.values(mergedMap);
            existingRequest.requestedBy = req.user?.username || 'Unknown';
            existingRequest.requestedByName = req.user?.name || '';
            // Refresh student snapshot — category = student quota
            existingRequest.studentName = snapName || existingRequest.studentName;
            existingRequest.pinNo       = snapPin || existingRequest.pinNo;
            existingRequest.college     = snapCollege || existingRequest.college;
            existingRequest.course      = snapCourse || existingRequest.course;
            existingRequest.branch      = snapBranch || existingRequest.branch;
            existingRequest.batch       = snapBatch || existingRequest.batch;
            existingRequest.category    = studentQuota;
            await existingRequest.save();
            return res.status(200).json({ message: 'Pending request updated with new entries.', request: existingRequest });
        }

        // No existing pending request — create fresh
        const newRequest = await OverallConcessionRequest.create({
            admissionNumber,
            pinNo:           snapPin,
            studentName:     snapName,
            college:         snapCollege,
            course:          snapCourse,
            branch:          snapBranch,
            batch:           snapBatch,
            category:        studentQuota,
            concessions:     normalizedEntries,
            status:          'PENDING',
            requestedBy:     req.user?.username || 'Unknown',
            requestedByName: req.user?.name || ''
        });

        res.status(201).json({ message: 'Concession request submitted for approval.', request: newRequest });
    } catch (error) {
        console.error('Error submitting concession request:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    List all concession requests (admin/superadmin only)
// @route   GET /api/overall-concessions/requests
const getConcessionRequests = async (req, res) => {
    try {
        const { status, college, course, branch, batch, admissionNumber, search } = req.query;
        const filter = {};
        if (status)          filter.status = status.toUpperCase();
        if (college)         filter.college = college;
        if (course)          filter.course = course;
        if (branch)          filter.branch = branch;
        if (batch)           filter.batch = batch;
        if (admissionNumber) filter.admissionNumber = admissionNumber;

        const q = String(search || '').trim();
        if (q) {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(escaped, 'i');
            filter.$or = [
                { studentName: rx },
                { admissionNumber: rx },
                { pinNo: rx }
            ];
        }

        const requests = await OverallConcessionRequest.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        // Enrich with fee head names + live student quota (stud_type)
        const feeHeads = await FeeHead.find({}).lean();
        const fhMap = {};
        feeHeads.forEach(fh => { fhMap[fh._id.toString()] = fh.name; });

        const admissionNos = [...new Set(requests.map(r => r.admissionNumber).filter(Boolean))];
        const quotaMap = {};
        if (admissionNos.length > 0) {
            const [studentRows] = await db.query(
                `SELECT admission_number, stud_type FROM students WHERE admission_number IN (?)`,
                [admissionNos]
            );
            studentRows.forEach(s => {
                quotaMap[s.admission_number] = s.stud_type || '';
            });
        }

        const enriched = requests.map(r => ({
            ...r,
            studentQuota: quotaMap[r.admissionNumber] || '',
            concessions: r.concessions.map(c => ({
                ...c,
                feeHeadName: fhMap[c.feeHeadId] || c.feeHeadCode || 'Unknown'
            }))
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching concession requests:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Approve a concession request — writes to overall_concessions + syncs StudentFee
// @route   PUT /api/overall-concessions/requests/:id/approve
const approveConcessionRequest = async (req, res) => {
    try {
        const { concessionGivenBy } = req.body;
        const request = await OverallConcessionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'PENDING') return res.status(400).json({ message: `Request is already ${request.status}` });

        const { admissionNumber, pinNo, studentName, college, course, branch, batch, category, concessions } = request;

        // Prefer live student quota (students.stud_type → CONV/MANG/SPOT).
        // Request.category is the quota snapshot; never confuse with student_status.
        const [studentRows] = await db.query(
            `SELECT admission_number, student_name, college, course, branch, batch, current_year, current_semester, stud_type
             FROM students WHERE admission_number = ?`,
            [admissionNumber]
        );
        const student = studentRows[0] || null;
        const effectiveQuota = student?.stud_type || category || 'Regular';
        const effectiveCollege = student?.college || college;
        const effectiveCourse = student?.course || course;
        const effectiveBranch = student?.branch || branch;
        const effectiveBatch = student?.batch || batch;

        // Re-use the exact same bulk-save logic -------------------------
        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        const validation = await validateRevisedEntriesAgainstStructures({
            entries: concessions,
            college: effectiveCollege,
            course: effectiveCourse,
            branch: effectiveBranch,
            batch: effectiveBatch,
            category: effectiveQuota,
            codeMap
        });
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message, warnings: validation.warnings });
        }

        // 1. Fetch existing approved request from MongoDB and merge
        let approvedRequest = await OverallConcessionRequest.findOne({
            admissionNumber,
            status: 'APPROVED'
        }).sort({ updatedAt: -1, createdAt: -1 });

        let existingFees = approvedRequest ? approvedRequest.concessions || [] : [];

        // Merge: request entries override matching keys, preserve others
        const mergedMap = {};
        existingFees.forEach(e => {
            const key = `${e.feeHeadId}_${Number(e.studentYear)}_${normalizeSemester(e.semester) ?? 'null'}`;
            mergedMap[key] = e;
        });
        concessions.forEach(c => {
            const key = `${c.feeHeadId}_${Number(c.studentYear)}_${normalizeSemester(c.semester) ?? 'null'}`;
            mergedMap[key] = formatConcessionEntry({
                feeHeadId:      c.feeHeadId,
                feeHeadCode:    c.feeHeadCode || '',
                studentYear:    Number(c.studentYear),
                semester:       normalizeSemester(c.semester),
                amount:         c.amount,
                concessionType: c.concessionType,
                remarks:        c.remarks
            });
        });
        const mergedFees = Object.values(mergedMap);

        // 2. Re-sync MongoDB StudentFee amounts
        const standardFeesApplied = await StudentFee.exists({
            studentId: admissionNumber,
            academicYear: effectiveBatch,
            $or: [{ remarks: { $exists: false } }, { remarks: null }, { remarks: '' }]
        });
        if (standardFeesApplied && student) {
            await syncStandardFees(student, admissionNumber);
        }

        // 3. For REVISED entries: keep structured demand and post difference as CREDIT waiver
        await applyRevisedConcessionTransactions({
            admissionNumber,
            studentName: student?.student_name || studentName,
            college: effectiveCollege,
            course: effectiveCourse,
            branch: effectiveBranch,
            batch: effectiveBatch,
            category: effectiveQuota,
            entries: concessions,
            collectedBy: req.user?.username || 'system',
            collectedByName: req.user?.name || 'System',
            codeMap
        });
        // ---------------------------------------------------------------

        // 4. Mark request as APPROVED
        request.concessions      = mergedFees; // Save the complete merged fees on the approved request
        request.status           = 'APPROVED';
        request.category         = effectiveQuota; // keep quota in sync with student
        request.college          = effectiveCollege || request.college;
        request.course           = effectiveCourse || request.course;
        request.branch           = effectiveBranch || request.branch;
        request.batch            = effectiveBatch || request.batch;
        request.approvedBy       = req.user?.username || 'Unknown';
        request.approvedByName   = req.user?.name || '';
        request.concessionGivenBy = concessionGivenBy || '';
        await request.save();

        // Return enriched concessions for frontend to refresh
        const responseConcessions = mergedFees.map((c, idx) => ({
            id: `${request._id.toString()}_${idx}`,
            ...mapStoredEntryForResponse(c, feeHeads, codeMap)
        }));

        res.json({
            message: 'Concession request approved and fees updated.',
            request,
            revisedFees: responseConcessions
        });
    } catch (error) {
        console.error('Error approving concession request:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update the entries of a PENDING concession request (edit before approval)
// @route   PUT /api/overall-concessions/requests/:id
const updateConcessionRequestEntries = async (req, res) => {
    try {
        const { concessions } = req.body;
        if (!Array.isArray(concessions) || concessions.length === 0) {
            return res.status(400).json({ message: 'At least one concession entry is required.' });
        }

        const request = await OverallConcessionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'PENDING') {
            return res.status(400).json({ message: `Request is already ${request.status}` });
        }

        const feeHeads = await FeeHead.find({}).lean();
        const { codeMap } = buildFeeHeadMaps(feeHeads);

        const normalizedEntries = concessions.map(c => {
            const resolvedId = resolveFeeHeadId(c, codeMap);
            const resolvedFh = feeHeads.find(fh => fh._id.toString() === resolvedId);
            return {
                feeHeadId:      resolvedId,
                feeHeadCode:    resolvedFh ? resolvedFh.code : (c.feeHeadCode || ''),
                studentYear:    Number(c.studentYear),
                semester:       normalizeSemester(c.semester),
                amount:         getConcessionAmount(c),
                concessionType: normalizeConcessionType(c.concessionType)
            };
        }).filter(e => e.feeHeadId && e.studentYear);

        if (normalizedEntries.length === 0) {
            return res.status(400).json({ message: 'No valid concession entries provided.' });
        }

        // Validate REVISED entries against the student's actual structure/quota
        const [studentRows] = await db.query(
            `SELECT college, course, branch, batch, stud_type FROM students WHERE admission_number = ?`,
            [request.admissionNumber]
        );
        const student = studentRows[0];
        const validation = await validateRevisedEntriesAgainstStructures({
            entries: normalizedEntries,
            college: student?.college || request.college,
            course: student?.course || request.course,
            branch: student?.branch || request.branch,
            batch: student?.batch || request.batch,
            category: student?.stud_type || request.category || 'Regular',
            codeMap
        });
        if (!validation.ok) {
            return res.status(400).json({ message: validation.message, warnings: validation.warnings });
        }

        request.concessions = normalizedEntries;
        await request.save();

        const enriched = {
            ...request.toObject(),
            studentQuota: student?.stud_type || '',
            concessions: request.concessions.map(c => {
                const fh = feeHeads.find(f => f._id.toString() === String(c.feeHeadId));
                return {
                    ...(c.toObject ? c.toObject() : c),
                    feeHeadName: fh ? fh.name : (c.feeHeadCode || 'Unknown')
                };
            })
        };

        res.json({ message: 'Request updated successfully.', request: enriched });
    } catch (error) {
        console.error('Error updating concession request:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Reject a concession request
// @route   PUT /api/overall-concessions/requests/:id/reject
const rejectConcessionRequest = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const request = await OverallConcessionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'PENDING') return res.status(400).json({ message: `Request is already ${request.status}` });

        request.status          = 'REJECTED';
        request.rejectionReason = rejectionReason || '';
        request.approvedBy      = req.user?.username || 'Unknown';
        request.approvedByName  = req.user?.name || '';
        await request.save();

        res.json({ message: 'Concession request rejected.', request });
    } catch (error) {
        console.error('Error rejecting concession request:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getOverallConcessions,
    saveOverallConcession,
    deleteOverallConcession,
    bulkSaveOverallConcessions,
    bulkSaveMultipleStudents,
    submitConcessionRequest,
    getConcessionRequests,
    approveConcessionRequest,
    updateConcessionRequestEntries,
    rejectConcessionRequest
};
