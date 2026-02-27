const Transaction = require('../models/Transaction');
const StudentFee = require('../models/StudentFee');
const mongoose = require('mongoose');
const db = require('../config/sqlDb');

// @desc    Get Transaction Reports (Daily, Cashier, FeeHead, Mode)
// @route   GET /api/reports/transactions
// @access  Public (should be Protected)
const getTransactionReports = async (req, res) => {
    try {
        const { startDate, endDate, groupBy, college } = req.query;

        // Base matching condition
        const matchStage = {};

        // 🚨 CASHIER PRIVACY: If the user is a cashier, they can only see their own transactions.
        if (req.user && req.user.role === 'cashier') {
            matchStage.collectedBy = req.user.username;
        }

        // Date Filter
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchStage.createdAt.$lte = end;
            }
        }

        // College Filter (Note: Transaction doesn't have college directly, it's on Student... 
        // We might need to join or assume filtering handles this upstream? 
        // But wait, the transaction DOESN'T have college. 
        // Ideally we should store college in Transaction. 
        // For now, let's skip college filter or fetch students first. 
        // Optimization: Let's assume for now we report on ALL transactions or rely on 'collectedBy' context if needed.
        // But the user might want college-wise. 
        // Transaction schema: studentId, ... 
        // We'd have to $lookup or add 'college' to Transaction. 
        // For existing data, we can't filter easily. Let's proceed without college filter for MVP or assume global.)

        // Actually, let's check Transaction schema again. Not there.
        // We'll proceed with basic filtering.

        if (groupBy === 'cashier') {
            // --- Advanced Cashier Report with College Breakdown ---
            // 1. Fetch raw transactions for the period
            const transactions = await Transaction.find(matchStage).lean();

            if (!transactions.length) {
                return res.json([]);
            }

            // 2. Extract Student IDs for SQL Lookup
            const studentIds = new Set();
            const feeHeadIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId) studentIds.add(String(tx.studentId).trim());
                if (tx.feeHead) feeHeadIds.add(tx.feeHead.toString());
            });

            // 3. Fetch Fee Head Names from MongoDB
            const feeHeadMap = {};
            try {
                const feeHeads = await mongoose.connection.collection('feeheads').find({
                    _id: { $in: Array.from(feeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
                }).toArray();
                feeHeads.forEach(fh => feeHeadMap[fh._id.toString()] = fh.name);
            } catch (err) {
                console.error("Error fetching fee heads:", err);
            }


            // 4. Fetch College Info from SQL
            const collegeMap = {}; // admission_number -> college_name
            if (studentIds.size > 0) {
                const ids = Array.from(studentIds).map(id => `'${id}'`).join(',');
                try {
                    const [students] = await db.query(`SELECT admission_number, college, pin_no, course, branch, current_year FROM students WHERE admission_number IN (${ids})`);
                    students.forEach(s => {
                        const sData = {
                            college: s.college || 'Unknown',
                            pin_no: s.pin_no || '-',
                            course: s.course || 'N/A',
                            branch: s.branch || 'N/A',
                            current_year: s.current_year || 'N/A'
                        };
                        collegeMap[String(s.admission_number).trim()] = sData;
                        collegeMap[String(s.admission_number).trim().toLowerCase()] = sData;
                    });
                } catch (sqlErr) {
                    console.error("SQL Error fetching colleges:", sqlErr);
                }
            }

            // 5. Aggregate Data in Memory
            const cashierGroups = {};
            // Structure: { cashierName: { totalAmount, totalCount, debitAmount, creditAmount, cashAmount, bankAmount, feeHeadsMap: { feeHeadId: { name, amount, count, colleges: { collegeName: amount } } } } }

            transactions.forEach(tx => {
                const cashier = tx.collectedByName || 'Unknown';
                const sId = String(tx.studentId).trim();
                const collegeData = collegeMap[sId] || collegeMap[sId.toLowerCase()];
                const college = collegeData ? collegeData.college : 'Unknown';
                const fhId = tx.feeHead ? tx.feeHead.toString() : 'unknown';
                const fhName = feeHeadMap[fhId] || 'Unknown Fee Head';
                const amount = tx.amount || 0;
                const isDebit = tx.transactionType === 'DEBIT';
                const isCredit = tx.transactionType === 'CREDIT';
                const isCash = tx.paymentMode === 'Cash';

                if (!cashierGroups[cashier]) {
                    cashierGroups[cashier] = {
                        _id: cashier,
                        totalAmount: 0,
                        debitAmount: 0,
                        creditAmount: 0,
                        cashAmount: 0,
                        bankAmount: 0,
                        totalCount: 0,
                        feeHeadsMap: {},
                        transactions: [] // <-- Add transactions array
                    };
                }

                const group = cashierGroups[cashier];

                group.totalCount++;
                if (isDebit) {
                    group.debitAmount += amount;
                    if (isCash) group.cashAmount += amount;
                    else group.bankAmount += amount;
                }
                if (isCredit) {
                    group.creditAmount += amount;
                }

                // Add this tx to the group's transactions list
                group.transactions.push({
                    receiptNo: tx.receiptNumber || '-',
                    studentName: tx.studentName,
                    amount: tx.amount,
                    paymentMode: tx.paymentMode,
                    transactionType: tx.transactionType,
                    pinNo: collegeMap[sId] ? collegeMap[sId].pin_no : '-', // Note: SQL fetch might not have pin_no yet, we'll fix below
                    course: tx.course || 'N/A',
                    branch: tx.branch || 'N/A',
                    studentYear: tx.studentYear || 'N/A'
                });

                // Fee Head Breakdown (Count DEBIT amounts usually for "Collection Report")
                // If the user wants Concession breakdown, we might need separate tracking.
                // Standard Cashier Report = What did they COLLECT. So verify if we should include Credits.
                // Usually "Fee Head Breakdown" sums the Collected amount.
                if (isDebit) {
                    if (!group.feeHeadsMap[fhId]) {
                        group.feeHeadsMap[fhId] = {
                            name: fhName,
                            amount: 0,
                            count: 0,
                            colleges: {}
                        };
                    }
                    const fhEntry = group.feeHeadsMap[fhId];
                    fhEntry.amount += amount;
                    fhEntry.count++;

                    // College Breakdown for this Fee Head
                    if (!fhEntry.colleges[college]) fhEntry.colleges[college] = 0;
                    fhEntry.colleges[college] += amount;
                }
            });

            // 6. Format Result Array
            const finalResults = Object.values(cashierGroups).map(group => {
                // Convert feeHeadsMap to array
                const feeHeads = Object.values(group.feeHeadsMap).map(fh => ({
                    name: fh.name,
                    amount: fh.amount,
                    count: fh.count,
                    colleges: fh.colleges // Keep the map: { "College A": 1000, "College B": 500 }
                })).sort((a, b) => b.amount - a.amount);

                // Remove map
                delete group.feeHeadsMap;
                group.feeHeads = feeHeads;

                // Ensure Total Amount is set to Debit Amount (Collections) for the report display
                group.totalAmount = group.debitAmount;

                return group;
            });

            res.json(finalResults);
            return;

        } else if (groupBy === 'feeHead') {
            // Enhanced Fee Head Report
            pipeline = [
                { $match: matchStage },
                {
                    $group: {
                        _id: "$feeHead",
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 },
                        debitAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "DEBIT"] }, "$amount", 0] } },
                        creditAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "CREDIT"] }, "$amount", 0] } },
                        cashAmount: { $sum: { $cond: [{ $eq: ["$paymentMode", "Cash"] }, "$amount", 0] } },
                        bankAmount: { $sum: { $cond: [{ $ne: ["$paymentMode", "Cash"] }, "$amount", 0] } }
                    }
                },
                // Lookup Name
                {
                    $lookup: {
                        from: 'feeheads',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'details'
                    }
                },
                { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        name: "$details.name", // Project name
                        totalAmount: 1,
                        count: 1,
                        debitAmount: 1,
                        creditAmount: 1,
                        cashAmount: 1,
                        bankAmount: 1
                    }
                },
                { $sort: { totalAmount: -1 } }
            ];
            // 'mode' groupBy removed as per request
        } else {
            // Default Day
            groupId = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
            pipeline = [
                { $match: matchStage },
                {
                    $group: {
                        _id: groupId,
                        totalAmount: { $sum: "$amount" }, // Grand Total (Collected + Concession)
                        count: { $sum: 1 },
                        debitAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "DEBIT"] }, "$amount", 0] } }, // Collected
                        creditAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "CREDIT"] }, "$amount", 0] } }, // Concession

                        // FIX: Cash and Bank should ONLY count DEBIT transactions (Real Money)
                        cashAmount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$transactionType", "DEBIT"] }, { $eq: ["$paymentMode", "Cash"] }] },
                                    "$amount",
                                    0
                                ]
                            }
                        },
                        bankAmount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$transactionType", "DEBIT"] }, { $ne: ["$paymentMode", "Cash"] }] },
                                    "$amount",
                                    0
                                ]
                            }
                        },
                        transactions: {
                            $push: {
                                receiptNo: "$receiptNumber",
                                studentName: "$studentName",
                                studentId: "$studentId",
                                amount: "$amount",
                                paymentMode: "$paymentMode",
                                transactionType: "$transactionType",
                                feeHead: "$feeHead",
                                semester: "$semester",      // Include semester
                                studentYear: "$studentYear" // Include year
                            }
                        }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
            ];

            const dailyStats = await Transaction.aggregate(pipeline);

            // --- SQL Enrichment Start ---
            // Extract all studentIds (Admission Numbers)
            const admissionNumbers = new Set();
            dailyStats.forEach(day => {
                if (day.transactions) {
                    day.transactions.forEach(tx => {
                        if (tx.studentId) admissionNumbers.add(String(tx.studentId).trim());
                    });
                }
            });

            if (admissionNumbers.size > 0) {
                const ids = Array.from(admissionNumbers).map(id => `'${id}'`).join(',');
                // Query SQL for Course, Branch, Pin No
                const sqlQuery = `SELECT admission_number, pin_no, course, branch, current_year FROM students WHERE admission_number IN (${ids})`;

                // Fix: Use await directly for Promise-based pool
                try {
                    const [studentDetails] = await db.query(sqlQuery);

                    // Create Map: AdmissionNo -> Details
                    const studentMap = {};
                    if (studentDetails) {
                        studentDetails.forEach(s => {
                            // Map both exact and trimmed upper/lower for safety
                            const adm = String(s.admission_number).trim();
                            studentMap[adm] = s;
                            studentMap[adm.toLowerCase()] = s;
                        });
                    }

                    // Attach to transactions
                    dailyStats.forEach(day => {
                        if (day.transactions) {
                            day.transactions.forEach(tx => {
                                const validId = String(tx.studentId).trim();
                                const details = studentMap[validId] || studentMap[validId.toLowerCase()];
                                if (details) {
                                    tx.pinNo = details.pin_no || '-'; // Ensure '-' if null
                                    tx.course = details.course;
                                    tx.branch = details.branch;
                                    tx.studentYear = details.current_year;
                                } else {
                                    tx.pinNo = '-';
                                }
                            });
                        }
                    });

                } catch (sqlErr) {
                    console.error("SQL Enrichment Error:", sqlErr);
                    // Proceed without enrichment if SQL fails, or handle appropriately
                }
            }
            // --- SQL Enrichment End ---

            res.json(dailyStats);
            return; // Return here as we handled response
        }

        const stats = await Transaction.aggregate(pipeline);
        res.json(stats);

    } catch (error) {
        console.error('Report Error:', error);
        res.status(500).json({ message: 'Error generating report' });
    }
};

const getDueReports = async (req, res) => {
    try {
        const { college, course, branch, batch, search } = req.query;

        // 1. Build SQL Query for Students
        // Added pin_no, replaced phone_number with student_mobile
        let sqlQuery = `SELECT admission_number, student_name, course, branch, current_year, student_mobile, pin_no FROM students WHERE 1=1`;
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
        // Filter by Batch instead of Year
        if (batch) {
            sqlQuery += ` AND batch = ?`;
            params.push(batch);
        }

        // Search Filter (Global or Refined)
        if (search) {
            sqlQuery += ` AND (student_name LIKE ? OR admission_number LIKE ? OR pin_no LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        const [students] = await db.query(sqlQuery, params);

        if (!students || students.length === 0) {
            return res.json([]);
        }

        const studentIds = students.map(s => s.admission_number);
        const pinNumbers = students.map(s => s.pin_no).filter(Boolean); // Get valid pins
        const allIdentifiers = [...new Set([...studentIds, ...pinNumbers])]; // Unique list of all IDs

        const studentMap = {};
        const idToStudentMap = {}; // Helper to resolve any ID (Pin or Adm) to the Student Object

        // Initialize details map
        students.forEach(s => {
            const studentObj = {
                ...s,
                totalFee: 0,
                paidAmount: 0,
                dueAmount: 0,
                feeDetails: {} // Map key: feeHeadId -> { total: 0, paid: 0, due: 0 }
            };

            // Key by Primary ID (Admission Number) for final list
            studentMap[s.admission_number] = studentObj;

            // Map identifiers to this object
            if (s.admission_number) idToStudentMap[s.admission_number] = studentObj;
            // Also map normalized versions if needed (e.g. trimmed)
            if (s.admission_number) idToStudentMap[s.admission_number.trim()] = studentObj;

            if (s.pin_no) {
                idToStudentMap[s.pin_no] = studentObj;
                idToStudentMap[s.pin_no.trim()] = studentObj;
            }
        });

        // 2. Aggregate Total Fee (Demand) - Grouped by FeeHead
        const feeMatch = { studentId: { $in: allIdentifiers } };
        const feeDemands = await StudentFee.aggregate([
            { $match: feeMatch },
            {
                $group: {
                    _id: { studentId: "$studentId", feeHead: "$feeHead" },
                    totalFee: { $sum: "$amount" }
                }
            }
        ]);

        feeDemands.forEach(f => {
            const rawSid = f._id.studentId; // Could be Pin or Admission
            const fid = f._id.feeHead;

            // Resolve student using the map
            const student = idToStudentMap[rawSid] || idToStudentMap[String(rawSid).trim()];

            if (student) {
                student.totalFee += f.totalFee;
                if (!student.feeDetails[fid]) student.feeDetails[fid] = { total: 0, paid: 0, due: 0 };
                student.feeDetails[fid].total += f.totalFee;
            }
        });

        // 3. Aggregate Total Paid - Grouped by FeeHead
        const txMatch = { studentId: { $in: allIdentifiers } };
        const payments = await Transaction.aggregate([
            { $match: txMatch },
            {
                $group: {
                    _id: { studentId: "$studentId", feeHead: "$feeHead" },
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        payments.forEach(p => {
            const rawSid = p._id.studentId;
            const fid = p._id.feeHead;

            const student = idToStudentMap[rawSid] || idToStudentMap[String(rawSid).trim()];

            if (student) {
                student.paidAmount += p.totalPaid;
                if (!student.feeDetails[fid]) student.feeDetails[fid] = { total: 0, paid: 0, due: 0 };
                student.feeDetails[fid].paid += p.totalPaid;
            }
        });

        // 4. Resolve FeeHead Names
        // Get all unique feeHead IDs from all students
        const allFeeHeadIds = new Set();
        Object.values(studentMap).forEach(s => {
            Object.keys(s.feeDetails).forEach(fid => allFeeHeadIds.add(fid));
        });

        let feeHeadNameMap = {};
        if (allFeeHeadIds.size > 0) {
            // We need to fetch FeeHead names. Assuming 'FeeHead' model exists or we query collection 'feeheads'.
            // In getTransactionReports, it does $lookup from 'feeheads'. Let's use mongoose model if available or distinct lookup.
            // We don't have FeeHead imported at top, let's try direct connection collection query or assume standard model name.
            // Best to just use direct db collection query if model not imported, OR import it. 
            // Let's use raw collection query via mongoose.connection to be safe on imports, or 'mongoose.model("FeeHead")' if registered.
            try {
                const heads = await mongoose.connection.collection('feeheads').find({
                    _id: { $in: Array.from(allFeeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
                }).toArray();

                heads.forEach(h => {
                    feeHeadNameMap[h._id.toString()] = h.name;
                });
            } catch (e) {
                console.log('Error fetching fee heads', e);
            }
        }

        // 5. Finalize Data Structure
        res.json(reportData);

    } catch (error) {
        console.error('Due Report Error:', error);
        res.status(500).json({ message: 'Error generating due report' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const { college } = req.query; // Optional: filter by college

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. Collections (DEBIT transactions)
        const collectionStats = await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT'
                }
            },
            {
                $group: {
                    _id: null,
                    today: {
                        $sum: { $cond: [{ $gte: ["$createdAt", today] }, "$amount", 0] }
                    },
                    monthly: {
                        $sum: { $cond: [{ $gte: ["$createdAt", firstDayOfMonth] }, "$amount", 0] }
                    },
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const collections = collectionStats[0] || { today: 0, monthly: 0, total: 0 };

        // 2. Student Count (Regular students from SQL)
        const [studentCountResult] = await db.query("SELECT COUNT(*) as count FROM students WHERE LOWER(student_status) = 'regular'");
        const totalStudents = studentCountResult[0]?.count || 0;

        // 3. Recent Transactions
        const recentTransactions = await Transaction.find()
            .populate('feeHead', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // 4. Collection Trend (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const trendData = await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 5. College and Course Wise Breakdown
        const studentAggregates = await Transaction.aggregate([
            { $match: { transactionType: 'DEBIT' } },
            { $group: { _id: "$studentId", total: { $sum: "$amount" } } }
        ]);

        const uniqueStudentIds = studentAggregates.map(s => s._id);
        let collegeWise = [];
        let courseWise = [];

        if (uniqueStudentIds.length > 0) {
            // Fetch student metadata from SQL
            const [studentMeta] = await db.query(
                `SELECT admission_number, college, course FROM students WHERE admission_number IN (?)`,
                [uniqueStudentIds]
            );

            const metaMap = {};
            studentMeta.forEach(sm => metaMap[sm.admission_number] = sm);

            const collegeMap = {};
            const courseMap = {};

            studentAggregates.forEach(sa => {
                const meta = metaMap[sa._id];
                if (meta) {
                    collegeMap[meta.college] = (collegeMap[meta.college] || 0) + sa.total;
                    courseMap[meta.course] = (courseMap[meta.course] || 0) + sa.total;
                } else {
                    collegeMap['Unknown'] = (collegeMap['Unknown'] || 0) + sa.total;
                    courseMap['Unknown'] = (courseMap['Unknown'] || 0) + sa.total;
                }
            });

            collegeWise = Object.entries(collegeMap).map(([name, amount]) => ({ name, amount }));
            courseWise = Object.entries(courseMap).map(([name, amount]) => ({ name, amount }));
        }

        res.json({
            collections,
            totalStudents,
            recentTransactions,
            trendData,
            collegeWise,
            courseWise
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};

module.exports = {
    getTransactionReports,
    getDueReports,
    getDashboardStats
};
