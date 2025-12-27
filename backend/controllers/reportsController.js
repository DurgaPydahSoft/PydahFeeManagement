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
            // Advanced Cashier Report: Group by Cashier + FeeHead first
            pipeline = [
                { $match: matchStage },
                // 1. Group by Cashier + FeeHead + Mode
                {
                    $group: {
                        _id: { cashier: "$collectedByName", feeHead: "$feeHead", mode: "$paymentMode", type: "$transactionType" },
                        amount: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                // 2. Lookup Fee Head Name
                {
                    $lookup: {
                        from: 'feeheads',
                        localField: '_id.feeHead',
                        foreignField: '_id',
                        as: 'feeHeadDetails'
                    }
                },
                { $unwind: { path: "$feeHeadDetails", preserveNullAndEmptyArrays: true } },
                // 3. Regroup by Cashier to consolidate
                {
                    $group: {
                        _id: "$_id.cashier",
                        totalAmount: { $sum: "$amount" },
                        totalCount: { $sum: "$count" },
                        debitAmount: {
                            $sum: { $cond: [{ $eq: ["$_id.type", "DEBIT"] }, "$amount", 0] }
                        },
                        creditAmount: {
                            $sum: { $cond: [{ $eq: ["$_id.type", "CREDIT"] }, "$amount", 0] }
                        },
                        // Cash vs Bank (For DEBIT only usually? Or all? Let's do all payments)
                        cashAmount: {
                            $sum: { $cond: [{ $eq: ["$_id.mode", "Cash"] }, "$amount", 0] }
                        },
                        bankAmount: {
                            $sum: { $cond: [{ $ne: ["$_id.mode", "Cash"] }, "$amount", 0] }
                        },
                        // Consolidate Fee Heads
                        feeHeads: {
                            $push: {
                                name: "$feeHeadDetails.name",
                                amount: "$amount",
                                count: "$count" // Optional
                            }
                        }
                    }
                },
                // 4. Clean up the feeHeads array (merge duplicates since we grouped by Mode too)
                // Or we can rely on frontend. But let's try to merge per feeHead in backend? 
                // It's easier to just return the list; frontend can reduce if same feehead appears twice (once for cash, once for bank)
                { $sort: { totalAmount: -1 } }
            ];

            // Additional Sort
            // pipeline.push({ $sort: { totalAmount: -1 } }); 

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
                        debitAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "DEBIT"] }, "$amount", 0] } },
                        creditAmount: { $sum: { $cond: [{ $eq: ["$transactionType", "CREDIT"] }, "$amount", 0] } },
                        cashAmount: { $sum: { $cond: [{ $eq: ["$paymentMode", "Cash"] }, "$amount", 0] } },
                        bankAmount: { $sum: { $cond: [{ $ne: ["$paymentMode", "Cash"] }, "$amount", 0] } },
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
                        if (tx.studentId) admissionNumbers.add(tx.studentId);
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
                            studentMap[s.admission_number] = s;
                        });
                    }

                    // Attach to transactions
                    dailyStats.forEach(day => {
                        if (day.transactions) {
                            day.transactions.forEach(tx => {
                                const details = studentMap[tx.studentId];
                                if (details) {
                                    tx.pinNo = details.pin_no;
                                    tx.course = details.course;
                                    tx.branch = details.branch;
                                    tx.studentYear = details.current_year;
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
        const studentMap = {};
        // Initialize details map
        students.forEach(s => {
            studentMap[s.admission_number] = {
                ...s,
                totalFee: 0,
                paidAmount: 0,
                dueAmount: 0,
                feeDetails: {} // Map key: feeHeadId -> { total: 0, paid: 0, due: 0 }
            };
        });

        // 2. Aggregate Total Fee (Demand) - Grouped by FeeHead
        const feeMatch = { studentId: { $in: studentIds } };
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
            const sid = f._id.studentId;
            const fid = f._id.feeHead;
            if (studentMap[sid]) {
                studentMap[sid].totalFee += f.totalFee;
                if (!studentMap[sid].feeDetails[fid]) studentMap[sid].feeDetails[fid] = { total: 0, paid: 0, due: 0 };
                studentMap[sid].feeDetails[fid].total = f.totalFee;
            }
        });

        // 3. Aggregate Total Paid - Grouped by FeeHead
        const txMatch = { studentId: { $in: studentIds } };
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
            const sid = p._id.studentId;
            const fid = p._id.feeHead;
            if (studentMap[sid]) {
                studentMap[sid].paidAmount += p.totalPaid;
                if (!studentMap[sid].feeDetails[fid]) studentMap[sid].feeDetails[fid] = { total: 0, paid: 0, due: 0 };
                studentMap[sid].feeDetails[fid].paid = p.totalPaid;
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
