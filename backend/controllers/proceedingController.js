const Proceeding = require('../models/Proceeding');
const ProceedingStudent = require('../models/ProceedingStudent');
const Transaction = require('../models/Transaction');
const collegeScope = require('../utils/collegeScope');
const db = require('../config/sqlDb');

const canApproveProceeding = (user) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return (user.permissions || []).includes('proceedings_approve');
};

const validateProceedingAccess = async (proceeding, user) => {
    if (!proceeding) return true;
    const allowedColleges = await collegeScope.getUserCollegeNames(user);
    if (allowedColleges && !allowedColleges.includes(proceeding.college)) return false;
    const allowedCourses = user.courses?.length > 0 ? user.courses : null;
    if (allowedCourses) {
        const matchString = `${proceeding.college}|${proceeding.course}`;
        if (!allowedCourses.includes(matchString)) return false;
    }
    return true;
};

// ─── Load students from SQL for proceeding creation ────────────────────
// GET /api/proceedings/load-students?college=X&course=Y&caste=Z&batch=B
const loadStudentsForProceeding = async (req, res) => {
    try {
        const { college, course, caste, batch } = req.query;
        if (!college || !course) {
            return res.status(400).json({ message: 'College and Course are required' });
        }

        const conditions = ["LOWER(student_status) = 'regular'"];
        const params = [];

        conditions.push('college = ?');
        params.push(college);
        conditions.push('course = ?');
        params.push(course);

        if (caste) {
            conditions.push('caste = ?');
            params.push(caste);
        }
        if (batch) {
            conditions.push('batch = ?');
            params.push(batch);
        }

        const query = `
            SELECT admission_number, pin_no, student_name, college, college_id, course, course_id, branch, branch_id, caste, batch, current_year, stud_type
            FROM students
            WHERE ${conditions.join(' AND ')}
            ORDER BY student_name
        `;
        const [rows] = await db.query(query, params);

        res.json(rows.map(r => ({
            studentId: r.admission_number,
            admissionNumber: r.admission_number,
            pinNo: r.pin_no || '',
            studentName: r.student_name || '',
            college: r.college || '',
            collegeId: r.college_id || null,
            course: r.course || '',
            courseId: r.course_id || null,
            branch: r.branch || '',
            branchId: r.branch_id || null,
            caste: r.caste || '',
            batch: r.batch || '',
            studentYear: r.current_year || '',
            studType: r.stud_type || ''
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Get all proceedings ────────────────────────────────────────────────
const getProceedings = async (req, res) => {
    try {
        const { college, course, batch, caste, status } = req.query;
        let query = {};
        if (college) query.college = college;
        if (course) query.course = course;
        if (batch) query.batch = batch;
        if (status) query.status = status;
        if (caste) {
            query.$or = [
                { caste: caste }, { caste: '' }, { caste: null }, { caste: { $exists: false } }
            ];
        }

        const allowedColleges = await collegeScope.getUserCollegeNames(req.user);
        if (allowedColleges) {
            if (query.college) {
                if (!allowedColleges.includes(query.college)) query.college = '__none__';
            } else {
                query.college = { $in: allowedColleges };
            }
        }
        const allowedCourses = req.user.courses?.length > 0 ? req.user.courses : null;
        if (allowedCourses) {
            const pairs = allowedCourses.map(ac => { const p = ac.split('|'); return p.length === 2 ? { college: p[0], course: p[1] } : null; }).filter(Boolean);
            if (pairs.length > 0) {
                if (query.college && query.course) {
                    if (!pairs.some(p => p.college === query.college && p.course === query.course)) { query.college = '__none__'; query.course = '__none__'; }
                } else if (query.college) {
                    if (typeof query.college === 'string') {
                        const mc = pairs.filter(p => p.college === query.college).map(p => p.course);
                        query.course = mc.length > 0 ? { $in: mc } : '__none__';
                    } else if (query.college.$in) {
                        const vp = pairs.filter(p => query.college.$in.includes(p.college));
                        if (vp.length > 0) query.$or = vp; else { query.college = '__none__'; query.course = '__none__'; }
                    }
                } else if (query.course) {
                    const mc = pairs.filter(p => p.course === query.course).map(p => p.college);
                    query.college = mc.length > 0 ? { $in: mc } : '__none__';
                } else {
                    query.$or = pairs;
                }
            }
        }

        const proceedings = await Proceeding.find(query).sort({ createdAt: -1 }).populate('feeHead', 'name');

        const proceedingsWithSummary = await Promise.all(proceedings.map(async (p) => {
            const txns = await Transaction.find({ proceedingId: p._id, status: { $ne: 'cancelled' } }).select('amount');
            const totalUsed = txns.reduce((acc, t) => acc + t.amount, 0);
            const studentCount = await ProceedingStudent.countDocuments({ proceedingId: p._id });
            return { ...p.toObject(), totalUsed, studentCount };
        }));

        res.json(proceedingsWithSummary);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Create proceeding (Step 1: no bank/amount, with student list) ──────
const createProceeding = async (req, res) => {
    try {
        const { proceedingNumber, proceedingDate, amount, bankCreditedAmount, bankAccount, bankCreditedDate, college, course, caste, batch, academicYear, students } = req.body;

        if (!proceedingNumber || !proceedingDate || !college || !course) {
            return res.status(400).json({ message: 'Please provide proceeding number, date, college and course' });
        }
        if (!students || students.length === 0) {
            return res.status(400).json({ message: 'Please select at least one student' });
        }

        const allowedColleges = await collegeScope.getUserCollegeNames(req.user);
        if (allowedColleges && !allowedColleges.includes(college)) {
            return res.status(403).json({ message: `Forbidden: No permission for college: ${college}` });
        }
        const allowedCourses = req.user.courses?.length > 0 ? req.user.courses : null;
        if (allowedCourses && !allowedCourses.includes(`${college}|${course}`)) {
            return res.status(403).json({ message: `Forbidden: No permission for course: ${course}` });
        }

        if (await Proceeding.findOne({ proceedingNumber, course })) {
            return res.status(400).json({ message: `Proceeding number '${proceedingNumber}' already exists for course '${course}'` });
        }

        // Resolve college/course IDs from the first student or from the payload
        const firstStudent = students[0] || {};
        let collegeId = req.body.collegeId || firstStudent.collegeId || null;
        let courseId = req.body.courseId || firstStudent.courseId || null;
        let branchId = req.body.branchId || firstStudent.branchId || null;

        // If IDs not provided, try to look them up from SQL
        if (!collegeId || !courseId) {
            try {
                const [idRows] = await db.query(
                    'SELECT college_id, course_id, branch_id FROM students WHERE college = ? AND course = ? LIMIT 1',
                    [college, course]
                );
                if (idRows.length > 0) {
                    if (!collegeId) collegeId = idRows[0].college_id || null;
                    if (!courseId) courseId = idRows[0].course_id || null;
                    if (!branchId) branchId = idRows[0].branch_id || null;
                }
            } catch (e) { /* non-fatal */ }
        }

        const proceeding = await Proceeding.create({
            proceedingNumber, proceedingDate,
            amount: Number(amount) || 0,
            bankCreditedAmount: Number(bankCreditedAmount) || 0,
            bankAccount: bankAccount || '',
            bankCreditedDate: bankCreditedDate || null,
            college, collegeId, course, courseId, branchId, caste, batch, academicYear,
            status: 'Pending',
            requestedBy: req.user?.username || '',
            requestedByName: req.user?.name || ''
        });

        const studentDocs = students.map(s => ({
            proceedingId: proceeding._id,
            studentId: s.studentId || s.admissionNumber,
            studentName: s.studentName || '',
            admissionNumber: s.admissionNumber || s.studentId,
            pinNo: s.pinNo || '',
            college: s.college || college,
            collegeId: s.collegeId || collegeId,
            course: s.course || course,
            courseId: s.courseId || courseId,
            branch: s.branch || '',
            branchId: s.branchId || branchId,
            caste: s.caste || '',
            batch: s.batch || '',
            studentYear: s.studentYear || ''
        }));
        await ProceedingStudent.insertMany(studentDocs, { ordered: false }).catch(() => {});

        res.status(201).json({ ...proceeding.toObject(), studentCount: studentDocs.length });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: `Proceeding number '${req.body.proceedingNumber}' already exists for course '${req.body.course}'` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Get single proceeding with students ────────────────────────────────
const getProceedingById = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id).populate('feeHead', 'name');
        if (!proceeding) return res.status(404).json({ message: 'Proceeding not found' });
        if (!await validateProceedingAccess(proceeding, req.user)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }
        const students = await ProceedingStudent.find({ proceedingId: proceeding._id }).sort({ studentName: 1 });
        res.json({ ...proceeding.toObject(), students });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Update proceeding (only Pending, basic fields + students) ──────────
const updateProceeding = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) return res.status(404).json({ message: 'Proceeding not found' });
        if (!await validateProceedingAccess(proceeding, req.user)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }

        const nextCollege = req.body.college || proceeding.college;
        const nextCourse = req.body.course || proceeding.course;
        const allowedColleges = await collegeScope.getUserCollegeNames(req.user);
        if (allowedColleges && !allowedColleges.includes(nextCollege)) {
            return res.status(403).json({ message: `Forbidden: No permission for college: ${nextCollege}` });
        }
        const allowedCourses = req.user.courses?.length > 0 ? req.user.courses : null;
        if (allowedCourses && !allowedCourses.includes(`${nextCollege}|${nextCourse}`)) {
            return res.status(403).json({ message: `Forbidden: No permission for course: ${nextCourse}` });
        }

        const nextProcNum = req.body.proceedingNumber ?? proceeding.proceedingNumber;
        const finalCourse = req.body.course ?? proceeding.course;
        const dup = await Proceeding.findOne({ proceedingNumber: nextProcNum, course: finalCourse, _id: { $ne: proceeding._id } });
        if (dup) return res.status(400).json({ message: `Proceeding number '${nextProcNum}' already exists for course '${finalCourse}'` });

        const { students, status: newStatus, ...updatePayload } = req.body;
        if (newStatus === 'Active' && proceeding.status !== 'Active') {
            // Can't activate via normal update
        } else if (newStatus) {
            updatePayload.status = newStatus;
        }

        const updated = await Proceeding.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

        if (students && Array.isArray(students)) {
            await ProceedingStudent.deleteMany({ proceedingId: proceeding._id });
            const docs = students.map(s => ({
                proceedingId: proceeding._id,
                studentId: s.studentId || s.admissionNumber,
                studentName: s.studentName || '',
                admissionNumber: s.admissionNumber || s.studentId,
                pinNo: s.pinNo || '',
                college: s.college || updated.college,
                collegeId: s.collegeId || updated.collegeId || null,
                course: s.course || updated.course,
                courseId: s.courseId || updated.courseId || null,
                branch: s.branch || '',
                branchId: s.branchId || updated.branchId || null,
                caste: s.caste || '',
                batch: s.batch || '',
                studentYear: s.studentYear || ''
            }));
            if (docs.length > 0) await ProceedingStudent.insertMany(docs, { ordered: false }).catch(() => {});
        }

        res.json(updated);
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ message: `Proceeding number '${req.body.proceedingNumber}' already exists for course '${req.body.course}'` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Approve proceeding (Step 2: bank/amount/feeHead + optional txn gen) ─
const approveProceeding = async (req, res) => {
    try {
        if (!canApproveProceeding(req.user)) {
            return res.status(403).json({ message: 'Forbidden: proceedings approve permission required' });
        }

        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) return res.status(404).json({ message: 'Proceeding not found' });
        if (!await validateProceedingAccess(proceeding, req.user)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }
        if (proceeding.status !== 'Pending') {
            return res.status(400).json({ message: `Proceeding is already ${proceeding.status}` });
        }

        const { bankAccount, bankCreditedDate, bankCreditedAmount, feeHead, generateTransactionsNow } = req.body;
        if (!bankAccount || !bankCreditedAmount || !bankCreditedDate || !feeHead) {
            return res.status(400).json({ message: 'Bank Account, Bank Credited Amount, Bank Credited Date, and Fee Head are required for approval' });
        }

        proceeding.bankAccount = bankAccount;
        proceeding.bankCreditedDate = bankCreditedDate || null;
        proceeding.bankCreditedAmount = Number(bankCreditedAmount);
        proceeding.feeHead = feeHead;
        proceeding.status = 'Active';
        proceeding.approvedBy = req.user?.username || '';
        proceeding.approvedByName = req.user?.name || '';
        proceeding.approvedAt = new Date();

        if (generateTransactionsNow) {
            const created = await generateProceedingTransactions(proceeding, req.user);
            proceeding.transactionsGenerated = true;
            await proceeding.save();
            return res.json({ message: `Proceeding approved. ${created} CREDIT transactions created.`, proceeding, transactionsCreated: created });
        }

        proceeding.transactionsGenerated = false;
        await proceeding.save();
        res.json({ message: 'Proceeding approved. Transactions will be generated in the nightly run.', proceeding });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Generate CREDIT transactions for a proceeding ──────────────────────
const generateProceedingTransactions = async (proceeding, user) => {
    const FeeGroup = require('../models/FeeGroup');
    const students = await ProceedingStudent.find({ proceedingId: proceeding._id });
    if (students.length === 0) return 0;

    const totalForSplit = proceeding.bankCreditedAmount || proceeding.amount || 0;
    const perStudentAmount = Math.round((totalForSplit / students.length) * 100) / 100;

    let groupCode = 'GEN';
    if (proceeding.feeHead) {
        const fg = await FeeGroup.findOne({ feeHeads: proceeding.feeHead });
        if (fg && fg.code) groupCode = fg.code.toUpperCase().trim();
    }

    const generateSimpleReceipt = () => {
        const ts = Date.now().toString().slice(-8);
        const rand = Math.floor(100 + Math.random() * 900);
        return `PROC${ts}${rand}`;
    };

    let created = 0;
    for (const stu of students) {
        const existing = await Transaction.findOne({
            proceedingId: proceeding._id,
            studentId: stu.studentId,
            status: { $ne: 'cancelled' }
        });
        if (existing) continue;

        const receiptNumber = generateSimpleReceipt();

        await Transaction.create({
            studentId: stu.studentId,
            studentName: stu.studentName,
            feeHead: proceeding.feeHead,
            amount: perStudentAmount,
            paymentMode: 'RTF',
            transactionType: 'DEBIT',
            remarks: `Auto-generated from Proceeding ${proceeding.proceedingNumber}`,
            studentYear: stu.studentYear || '',
            receiptNumber,
            collectedBy: user?.username || 'system',
            collectedByName: user?.name || 'System',
            proceedingId: proceeding._id,
            status: 'active',
            college: stu.college || proceeding.college,
            course: stu.course || proceeding.course,
            branch: stu.branch || '',
            pinNo: stu.pinNo || '',
            admissionNumber: stu.admissionNumber || stu.studentId,
            collegeId: '',
            courseId: '',
            branchId: ''
        });
        created++;
    }
    return created;
};

// ─── Nightly: generate transactions for approved proceedings ────────────
const processNightlyProceedingTransactions = async () => {
    const pending = await Proceeding.find({ status: 'Active', transactionsGenerated: false });
    if (pending.length === 0) {
        console.log('[Proceedings Nightly] No proceedings awaiting transaction generation.');
        return { processed: 0, totalCreated: 0 };
    }

    let totalCreated = 0;
    for (const proc of pending) {
        try {
            const count = await generateProceedingTransactions(proc, null);
            proc.transactionsGenerated = true;
            await proc.save();
            totalCreated += count;
            console.log(`[Proceedings Nightly] ${proc.proceedingNumber}: ${count} transactions created.`);
        } catch (err) {
            console.error(`[Proceedings Nightly] Failed for ${proc.proceedingNumber}:`, err.message);
        }
    }
    return { processed: pending.length, totalCreated };
};

// ─── Delete proceeding ──────────────────────────────────────────────────
const deleteProceeding = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) return res.status(404).json({ message: 'Proceeding not found' });
        if (!await validateProceedingAccess(proceeding, req.user)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }

        const txnCount = await Transaction.countDocuments({ proceedingId: proceeding._id, status: { $ne: 'cancelled' } });
        if (txnCount > 0) {
            return res.status(400).json({ message: `Cannot delete: ${txnCount} active transactions are linked to this proceeding.` });
        }

        await ProceedingStudent.deleteMany({ proceedingId: proceeding._id });
        await proceeding.deleteOne();
        res.json({ message: 'Proceeding removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// ─── Summary (students + amounts used) ──────────────────────────────────
const getProceedingSummary = async (req, res) => {
    try {
        const proceeding = await Proceeding.findById(req.params.id);
        if (!proceeding) return res.status(404).json({ message: 'Proceeding not found' });
        if (!await validateProceedingAccess(proceeding, req.user)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }

        const transactions = await Transaction.find({ proceedingId: req.params.id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
        const totalUsed = transactions.reduce((acc, t) => acc + t.amount, 0);

        const mappedStudents = await ProceedingStudent.find({ proceedingId: req.params.id }).sort({ studentName: 1 });

        const studentIds = [...new Set([
            ...transactions.map(t => t.studentId),
            ...mappedStudents.map(s => s.studentId)
        ])].filter(Boolean);

        let pinMap = {};
        if (studentIds.length > 0) {
            const [studs] = await db.query(
                `SELECT admission_number, pin_no FROM students WHERE admission_number IN (${studentIds.map(() => '?').join(',')})`,
                studentIds
            );
            studs.forEach(s => { if (s.admission_number) pinMap[s.admission_number] = s.pin_no || '-'; });
        }

        const transactionsWithPin = transactions.map(t => ({
            ...t.toObject(),
            pinNo: pinMap[t.studentId] || '-'
        }));

        res.json({
            transactions: transactionsWithPin,
            totalUsed,
            mappedStudents: mappedStudents.map(s => ({ ...s.toObject(), pinNo: pinMap[s.studentId] || s.pinNo || '-' }))
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ─── Sync missing college/course IDs on existing proceedings & students ──
const syncProceedingIds = async (req, res) => {
    try {
        let updatedProc = 0;
        let updatedStu = 0;

        // Sync Proceeding documents missing IDs
        const procsToSync = await Proceeding.find({ $or: [{ collegeId: null }, { courseId: null }, { collegeId: { $exists: false } }, { courseId: { $exists: false } }] });
        for (const proc of procsToSync) {
            try {
                const [rows] = await db.query(
                    'SELECT college_id, course_id, branch_id FROM students WHERE college = ? AND course = ? LIMIT 1',
                    [proc.college, proc.course]
                );
                if (rows.length > 0) {
                    const update = {};
                    if (!proc.collegeId && rows[0].college_id) update.collegeId = rows[0].college_id;
                    if (!proc.courseId && rows[0].course_id) update.courseId = rows[0].course_id;
                    if (!proc.branchId && rows[0].branch_id) update.branchId = rows[0].branch_id;
                    if (Object.keys(update).length > 0) {
                        await Proceeding.updateOne({ _id: proc._id }, { $set: update });
                        updatedProc++;
                    }
                }
            } catch (e) { /* skip */ }
        }

        // Sync ProceedingStudent documents missing IDs
        const studentsToSync = await ProceedingStudent.find({ $or: [{ collegeId: null }, { courseId: null }, { collegeId: { $exists: false } }, { courseId: { $exists: false } }] });
        if (studentsToSync.length > 0) {
            const admNos = [...new Set(studentsToSync.map(s => s.studentId || s.admissionNumber).filter(Boolean))];
            if (admNos.length > 0) {
                const [sqlRows] = await db.query(
                    `SELECT admission_number, college_id, course_id, branch_id FROM students WHERE admission_number IN (${admNos.map(() => '?').join(',')})`,
                    admNos
                );
                const idMap = {};
                sqlRows.forEach(r => { idMap[r.admission_number] = r; });

                for (const stu of studentsToSync) {
                    const key = stu.studentId || stu.admissionNumber;
                    const sql = idMap[key];
                    if (!sql) continue;
                    const update = {};
                    if (!stu.collegeId && sql.college_id) update.collegeId = sql.college_id;
                    if (!stu.courseId && sql.course_id) update.courseId = sql.course_id;
                    if (!stu.branchId && sql.branch_id) update.branchId = sql.branch_id;
                    if (Object.keys(update).length > 0) {
                        await ProceedingStudent.updateOne({ _id: stu._id }, { $set: update });
                        updatedStu++;
                    }
                }
            }
        }

        res.json({ message: `Synced IDs: ${updatedProc} proceedings, ${updatedStu} proceeding students updated.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getProceedings,
    createProceeding,
    getProceedingById,
    updateProceeding,
    approveProceeding,
    deleteProceeding,
    getProceedingSummary,
    loadStudentsForProceeding,
    processNightlyProceedingTransactions,
    generateProceedingTransactions,
    syncProceedingIds
};
