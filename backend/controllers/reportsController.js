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
            // 1. Fetch ALL matching transactions first (to enrich with College)
            const allTransactions = await Transaction.find(matchStage).lean();

            if (!allTransactions.length) {
                return res.json([]);
            }

            // 2. Extract Student IDs for SQL Lookup
            const studentIds = new Set();
            allTransactions.forEach(tx => {
                if (tx.studentId) studentIds.add(String(tx.studentId).trim());
            });

            // 3. Fetch College Info from SQL
            const studentCollegeMap = {};
            if (studentIds.size > 0) {
                const ids = Array.from(studentIds).map(id => `'${id}'`).join(',');
                try {
                    // Optimized query: Only need admission_number and college
                    // Also checking pin_no just in case
                    const [students] = await db.query(`
                        SELECT admission_number, pin_no, college 
                        FROM students 
                        WHERE admission_number IN (${ids}) OR pin_no IN (${ids})
                    `);

                    students.forEach(s => {
                        if (s.admission_number) {
                            studentCollegeMap[s.admission_number.trim().toLowerCase()] = s.college;
                            studentCollegeMap[s.admission_number.trim()] = s.college;
                        }
                        if (s.pin_no) {
                            studentCollegeMap[s.pin_no.trim().toLowerCase()] = s.college;
                            studentCollegeMap[s.pin_no.trim()] = s.college;
                        }
                    });
                } catch (sqlErr) {
                    console.error("SQL College Fetch Error:", sqlErr);
                }
            }

            // 4. Resolve Fee Head Names (avoid N+1 lookups)
            const feeHeadIds = new Set();
            allTransactions.forEach(tx => {
                if (tx.feeHead) feeHeadIds.add(String(tx.feeHead));
            });

            const feeHeadNameMap = {};
            if (feeHeadIds.size > 0) {
                try {
                    const heads = await mongoose.connection.collection('feeheads').find({
                        _id: { $in: Array.from(feeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
                    }).toArray();
                    heads.forEach(h => feeHeadNameMap[String(h._id)] = h.name);
                } catch (e) {
                    console.error("FeeHead Fetch Error:", e);
                }
            }

            // 5. Aggregate Data Manually (Cashier -> Stats)
            const cashierMap = {};

            allTransactions.forEach(tx => {
                const cashierName = tx.collectedByName || 'Unknown';
                const college = studentCollegeMap[String(tx.studentId).trim().toLowerCase()] || 'Unknown College';
                const amount = tx.amount || 0;
                const mode = tx.paymentMode || 'Cash';
                const type = tx.transactionType || 'DEBIT';
                const feeHeadId = String(tx.feeHead);
                const feeHeadName = feeHeadNameMap[feeHeadId] || 'Unknown Fee';

                if (!cashierMap[cashierName]) {
                    cashierMap[cashierName] = {
                        _id: cashierName,
                        totalAmount: 0,
                        totalCount: 0,
                        debitAmount: 0,
                        creditAmount: 0,
                        cashAmount: 0,
                        bankAmount: 0,
                        feeHeadMap: {} // Unordered map for aggregation
                    };
                }

                const c = cashierMap[cashierName];
                c.totalAmount += amount;
                c.totalCount += 1;

                if (type === 'DEBIT') c.debitAmount += amount;
                if (type === 'CREDIT') c.creditAmount += amount;

                // Cash vs Bank Logic (Same as Daily Report)
                const modeLower = mode.toLowerCase();
                const isConcession = ['waiver', 'concession', 'adjustment'].includes(modeLower);
                const isCash = modeLower === 'cash';

                if (isCash) c.cashAmount += amount;
                else if (!isConcession) c.bankAmount += amount;

                // Fee Head Aggregation
                if (!c.feeHeadMap[feeHeadId]) {
                    c.feeHeadMap[feeHeadId] = {
                        name: feeHeadName,
                        amount: 0,
                        count: 0,
                        colleges: {} // College -> Amount
                    };
                }
                const fh = c.feeHeadMap[feeHeadId];
                fh.amount += amount;
                fh.count += 1;

                // College Breakdown
                if (!fh.colleges[college]) fh.colleges[college] = 0;
                fh.colleges[college] += amount;
            });

            // 6. Format Result
            const result = Object.values(cashierMap).map(c => {
                // Convert feeHeadMap to Array
                c.feeHeads = Object.values(c.feeHeadMap).sort((a, b) => b.amount - a.amount);
                delete c.feeHeadMap;
                return c;
            }).sort((a, b) => b.totalAmount - a.totalAmount);

            res.json(result);
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
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 },
                        // Cash: Strictly 'Cash' mode
                        cashAmount: {
                            $sum: {
                                $cond: [{ $eq: [{ $toLower: "$paymentMode" }, "cash"] }, "$amount", 0]
                            }
                        },
                        // Concession: Waiver, Concession, Adjustment
                        concessionAmount: {
                            $sum: {
                                $cond: [{ $in: [{ $toLower: "$paymentMode" }, ["waiver", "concession", "adjustment"]] }, "$amount", 0]
                            }
                        },
                        // Bank: Everything else (Online, Cheque, DD, etc.) excluding Cash/Concession
                        bankAmount: {
                            $sum: {
                                $cond: [{
                                    $and: [
                                        { $ne: [{ $toLower: "$paymentMode" }, "cash"] },
                                        { $not: { $in: [{ $toLower: "$paymentMode" }, ["waiver", "concession", "adjustment"]] } }
                                    ]
                                }, "$amount", 0]
                            }
                        },
                        transactions: {
                            $push: {
                                receiptNo: "$receiptNumber",
                                studentName: "$studentName",
                                studentId: "$studentId", // Usually Admission Number
                                amount: "$amount",
                                paymentMode: "$paymentMode",
                                transactionType: "$transactionType",
                                feeHead: "$feeHead",
                                semester: "$semester",
                                studentYear: "$studentYear"
                            }
                        }
                    }
                },
                // Add Net Total Field (Cash + Bank)
                {
                    $addFields: {
                        netTotal: { $add: ["$cashAmount", "$bankAmount"] }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
            ];

            const dailyStats = await Transaction.aggregate(pipeline);

            // --- SQL Enrichment Start (Fix PINs) ---
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
                // Prepare IDs for SQL IN clause
                const ids = Array.from(admissionNumbers).map(id => `'${id}'`).join(',');

                // Query SQL for Course, Branch, Pin No
                // Note: We use LOWER() for case-insensitive matching just in case
                const sqlQuery = `
                    SELECT admission_number, pin_no, course, branch, current_year 
                    FROM students 
                    WHERE admission_number IN (${ids}) 
                       OR pin_no IN (${ids})
                `;

                try {
                    const [studentDetails] = await db.query(sqlQuery);

                    // Create Map: AdmissionNo -> Details AND PinNo -> Details
                    const studentMap = {};
                    if (studentDetails) {
                        studentDetails.forEach(s => {
                            // Map by Admission Number
                            if (s.admission_number) {
                                studentMap[s.admission_number.trim().toLowerCase()] = s;
                                studentMap[s.admission_number.trim()] = s; // Case sensitive fallback
                            }
                            // Map by PIN (just in case studentId in transaction was PIN)
                            if (s.pin_no) {
                                studentMap[s.pin_no.trim().toLowerCase()] = s;
                                studentMap[s.pin_no.trim()] = s;
                            }
                        });
                    }

                    // Attach to transactions
                    dailyStats.forEach(day => {
                        if (day.transactions) {
                            day.transactions.forEach(tx => {
                                const lookupKey = String(tx.studentId).trim().toLowerCase();
                                const details = studentMap[lookupKey];

                                if (details) {
                                    tx.pinNo = details.pin_no || '-'; // Ensure PIN is set
                                    tx.course = details.course;
                                    tx.branch = details.branch;
                                    // Use transaction year if available, else current year
                                    if (!tx.studentYear) tx.studentYear = details.current_year;
                                } else {
                                    tx.pinNo = 'N/A';
                                }
                            });
                        }
                    });

                } catch (sqlErr) {
                    console.error("SQL Enrichment Error:", sqlErr);
                }
            }
            // --- SQL Enrichment End ---

            res.json(dailyStats);
            return;
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
        const reportData = Object.values(studentMap).map(s => {
            s.dueAmount = (s.totalFee || 0) - (s.paidAmount || 0);

            // Convert feeDetails map to array with names
            s.feeDetailsArray = Object.keys(s.feeDetails).map(fid => {
                const d = s.feeDetails[fid];
                d.due = (d.total || 0) - (d.paid || 0);
                d.headName = feeHeadNameMap[fid] || 'Unknown Fee';
                return d;
            });

            return s;
        });

        res.json(reportData);

    } catch (error) {
        console.error('Due Report Error:', error);
        res.status(500).json({ message: 'Error generating due report' });
    }
};

module.exports = {
    getTransactionReports,
    getDueReports
};
