const Transaction = require('../models/Transaction');
const StudentFee = require('../models/StudentFee');
const mongoose = require('mongoose');
const db = require('../config/sqlDb');
const collegeScope = require('../utils/collegeScope');
const { buildReportDateFilter } = require('../utils/reportDateFilter');

// @desc    Get Transaction Reports (Daily, Cashier, FeeHead, Mode)
// @route   GET /api/reports/transactions
// @access  Public (should be Protected)
const getTransactionReports = async (req, res) => {
    try {
        const { startDate, endDate, groupBy, college, feeGroupId, campusId } = req.query;

        const allowedColleges = await collegeScope.getEffectiveCollegeNames(req.user, campusId);
        const hasCollegeScope = Array.isArray(allowedColleges) && allowedColleges.length > 0;

        // Base matching condition — always exclude cancelled transactions from reports
        let matchStage = { status: { $ne: 'cancelled' } };
        matchStage = await collegeScope.applyStudentIdFilter(req.user, campusId, matchStage);
        if (matchStage.studentId?.$in?.[0] === '__none__') {
            return res.json([]);
        }

        // Filter by Fee Head Group if provided
        if (feeGroupId) {
            const FeeGroup = require('../models/FeeGroup');
            const group = await FeeGroup.findById(feeGroupId);
            if (group && group.feeHeads && group.feeHeads.length > 0) {
                matchStage.feeHead = { $in: group.feeHeads };
            } else {
                return res.json([]);
            }
        }

        // 🚨 CASHIER PRIVACY: If the user is a cashier, they can only see their own transactions.
        if (req.user && req.user.role === 'cashier') {
            matchStage.collectedBy = req.user.username;
        }

        // Date Filter (IST-aligned, same as dashboard stats)
        const dateFilter = buildReportDateFilter(startDate, endDate);
        if (dateFilter.createdAt) {
            matchStage.createdAt = dateFilter.createdAt;
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

        let groupId;
        let pipeline;

        if (groupBy === 'cashier') {
            // --- Advanced Cashier Report with College Breakdown (Includes Cancelled) ---
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();

            if (!transactions.length) {
                return res.json([]);
            }

            // Fetch cashier profiles to find emp_no
            const User = require('../models/User');
            const getEmployeeModel = require('../models/Employee');
            const Employee = getEmployeeModel();

            let cashierEmpNoMap = {};

            try {
                // Fetch all users to handle historical transactions, UUIDs, and spacing differences
                const usersList = await User.find({}).lean();
                const employeeIds = usersList.map(u => u.employeeId).filter(Boolean);
                const employeeMap = {}; // employeeId -> emp_no
                if (employeeIds.length > 0 && Employee) {
                    const employees = await Employee.find({ _id: { $in: employeeIds } }).select('emp_no').lean();
                    employees.forEach(emp => {
                        employeeMap[String(emp._id)] = emp.emp_no;
                    });
                }
                usersList.forEach(u => {
                    const empNo = u.employeeId ? (employeeMap[String(u.employeeId)] || u.username) : u.username;
                    if (u.username) {
                        cashierEmpNoMap[u.username.toLowerCase()] = empNo;
                    }
                    if (u.name) {
                        cashierEmpNoMap[u.name.toLowerCase()] = empNo;
                        // Normalize multiple spaces to a single space
                        const normalizedName = u.name.replace(/\s+/g, ' ').trim().toLowerCase();
                        cashierEmpNoMap[normalizedName] = empNo;
                    }
                });
            } catch (userErr) {
                console.error("Error fetching cashier details:", userErr);
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

            // 4. Fetch College Info from SQL (match by admission number or PIN)
            const collegeMap = {};
            if (studentIds.size > 0) {
                const idList = Array.from(studentIds).map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
                try {
                    const [students] = await db.query(
                        `SELECT admission_number, college, pin_no, course, branch, current_year FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`
                    );
                    students.forEach(s => {
                        const sData = {
                            college: s.college || 'Unknown',
                            pin_no: s.pin_no || '-',
                            course: s.course || 'N/A',
                            branch: s.branch || 'N/A',
                            current_year: s.current_year || 'N/A'
                        };
                        const adm = String(s.admission_number).trim();
                        collegeMap[adm] = sData;
                        collegeMap[adm.toLowerCase()] = sData;
                        if (s.pin_no) {
                            const pin = String(s.pin_no).trim();
                            collegeMap[pin] = sData;
                            collegeMap[pin.toLowerCase()] = sData;
                        }
                    });
                } catch (sqlErr) {
                    console.error("SQL Error fetching colleges:", sqlErr);
                }
            }

            // 5. Aggregate Data in Memory
            const cashierGroups = {};

            transactions.forEach(tx => {
                const cashier = tx.collectedByName || 'Unknown';
                const cashierUsername = tx.collectedBy || 'Unknown';
                const sId = String(tx.studentId).trim();
                const collegeData = collegeMap[sId] || collegeMap[sId.toLowerCase()];
                const college = collegeData ? collegeData.college : 'Unknown';

                if (hasCollegeScope && !collegeScope.isCollegeAllowed(college, allowedColleges)) {
                    return;
                }
                const fhId = tx.feeHead ? tx.feeHead.toString() : 'unknown';
                const fhName = feeHeadMap[fhId] || 'Unknown Fee Head';
                const amount = tx.amount || 0;
                const isDebit = tx.transactionType === 'DEBIT';
                const isCredit = tx.transactionType === 'CREDIT';
                const isCash = tx.paymentMode === 'Cash';
                const isCancelled = tx.status === 'cancelled';

                const normalizedCashierName = cashier.replace(/\s+/g, ' ').trim().toLowerCase();

                if (!cashierGroups[cashier]) {
                    cashierGroups[cashier] = {
                        _id: cashier,
                        empNo: cashierEmpNoMap[cashierUsername.toLowerCase()] || 
                               cashierEmpNoMap[normalizedCashierName] || 
                               cashierEmpNoMap[cashier.toLowerCase()] || 
                               cashier,
                        totalAmount: 0,
                        debitAmount: 0,
                        creditAmount: 0,
                        cashAmount: 0,
                        bankAmount: 0,
                        totalCount: 0,
                        feeHeadsMap: {},
                        transactions: []
                    };
                }

                const group = cashierGroups[cashier];

                if (!isCancelled) {
                    group.totalCount++;
                    if (isDebit) {
                        group.debitAmount += amount;
                        if (isCash) group.cashAmount += amount;
                        else group.bankAmount += amount;
                    }
                    if (isCredit) {
                        group.creditAmount += amount;
                    }
                }

                const empNo = cashierEmpNoMap[cashierUsername.toLowerCase()] || 
                              cashierEmpNoMap[normalizedCashierName] || 
                              cashierEmpNoMap[cashier.toLowerCase()] || 
                              cashier;

                group.transactions.push({
                    _id: tx._id,
                    receiptNo: tx.receiptNumber || '-',
                    studentName: tx.studentName,
                    amount: tx.amount,
                    paymentMode: tx.paymentMode,
                    transactionType: tx.transactionType,
                    pinNo: collegeData ? collegeData.pin_no : '-',
                    studentId: tx.studentId,
                    course: collegeData && collegeData.course ? collegeData.course : 'N/A',
                    branch: collegeData && collegeData.branch ? collegeData.branch : 'N/A',
                    studentYear: collegeData && collegeData.current_year ? collegeData.current_year : 'N/A',
                    feeHead: fhName,
                    college: college,
                    status: tx.status || 'active',
                    collectedBy: tx.collectedBy || 'Unknown',
                    collectedByName: tx.collectedByName || 'Unknown',
                    empNo: empNo,
                    cancelledBy: tx.cancelledBy,
                    cancelledByName: tx.cancelledByName,
                    cancelledAt: tx.cancelledAt,
                    cancellationReason: tx.cancellationReason,
                    createdAt: tx.createdAt,
                    updatedAt: tx.updatedAt
                });

                if (!isCancelled && isDebit) {
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
                    if (!fhEntry.colleges[college]) fhEntry.colleges[college] = { total: 0, courses: {} };
                    if (typeof fhEntry.colleges[college] === 'number') {
                        fhEntry.colleges[college] = { total: fhEntry.colleges[college], courses: { 'N/A': fhEntry.colleges[college] } };
                    }
                    const cName = collegeData && collegeData.course ? collegeData.course : 'N/A';
                    if (!fhEntry.colleges[college].courses[cName]) fhEntry.colleges[college].courses[cName] = 0;
                    fhEntry.colleges[college].courses[cName] += amount;
                    fhEntry.colleges[college].total += amount;
                }
            });

            // 6. Format Result Array
            const finalResults = Object.values(cashierGroups).map(group => {
                // Convert feeHeadsMap to array
                const feeHeads = Object.values(group.feeHeadsMap).map(fh => ({
                    name: fh.name,
                    amount: fh.amount,
                    count: fh.count,
                    colleges: fh.colleges
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
        } else if (groupBy === 'college') {
            // --- Advanced College Report with Cashier Breakdown (Includes Cancelled) ---
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();

            if (!transactions.length) {
                return res.json([]);
            }

            // Fetch cashier profiles to find emp_no
            const User = require('../models/User');
            const getEmployeeModel = require('../models/Employee');
            const Employee = getEmployeeModel();

            let cashierEmpNoMap = {};

            try {
                // Fetch all users to handle historical transactions, UUIDs, and spacing differences
                const usersList = await User.find({}).lean();
                const employeeIds = usersList.map(u => u.employeeId).filter(Boolean);
                const employeeMap = {}; // employeeId -> emp_no
                if (employeeIds.length > 0 && Employee) {
                    const employees = await Employee.find({ _id: { $in: employeeIds } }).select('emp_no').lean();
                    employees.forEach(emp => {
                        employeeMap[String(emp._id)] = emp.emp_no;
                    });
                }
                usersList.forEach(u => {
                    const empNo = u.employeeId ? (employeeMap[String(u.employeeId)] || u.username) : u.username;
                    if (u.username) {
                        cashierEmpNoMap[u.username.toLowerCase()] = empNo;
                    }
                    if (u.name) {
                        cashierEmpNoMap[u.name.toLowerCase()] = empNo;
                        // Normalize multiple spaces to a single space
                        const normalizedName = u.name.replace(/\s+/g, ' ').trim().toLowerCase();
                        cashierEmpNoMap[normalizedName] = empNo;
                    }
                });
            } catch (userErr) {
                console.error("Error fetching cashier details:", userErr);
            }

            // Extract Student IDs for SQL Lookup
            const studentIds = new Set();
            const feeHeadIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId) studentIds.add(String(tx.studentId).trim());
                if (tx.feeHead) feeHeadIds.add(tx.feeHead.toString());
            });

            // Fetch Fee Head Names from MongoDB
            const feeHeadMap = {};
            try {
                const feeHeads = await mongoose.connection.collection('feeheads').find({
                    _id: { $in: Array.from(feeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
                }).toArray();
                feeHeads.forEach(fh => feeHeadMap[fh._id.toString()] = fh.name);
            } catch (err) {
                console.error("Error fetching fee heads:", err);
            }

            // Fetch College Info from SQL (match by admission number or PIN)
            const collegeMap = {};
            if (studentIds.size > 0) {
                const idList = Array.from(studentIds).map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
                try {
                    const [students] = await db.query(
                        `SELECT admission_number, college, pin_no, course, branch, current_year FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`
                    );
                    students.forEach(s => {
                        const sData = {
                            college: s.college || 'Unknown',
                            pin_no: s.pin_no || '-',
                            course: s.course || 'N/A',
                            branch: s.branch || 'N/A',
                            current_year: s.current_year || 'N/A'
                        };
                        const adm = String(s.admission_number).trim();
                        collegeMap[adm] = sData;
                        collegeMap[adm.toLowerCase()] = sData;
                        if (s.pin_no) {
                            const pin = String(s.pin_no).trim();
                            collegeMap[pin] = sData;
                            collegeMap[pin.toLowerCase()] = sData;
                        }
                    });
                } catch (sqlErr) {
                    console.error("SQL Error fetching colleges:", sqlErr);
                }
            }

            // Aggregate Data in Memory by College
            const collegeGroups = {};

            transactions.forEach(tx => {
                const sId = String(tx.studentId).trim();
                const collegeData = collegeMap[sId] || collegeMap[sId.toLowerCase()];
                const collegeName = collegeData ? collegeData.college : 'Unknown';

                if (hasCollegeScope && !collegeScope.isCollegeAllowed(collegeName, allowedColleges)) {
                    return;
                }
                const cashier = tx.collectedByName || 'Unknown';
                const cashierUsername = tx.collectedBy || 'Unknown';
                const fhId = tx.feeHead ? tx.feeHead.toString() : 'unknown';
                const fhName = feeHeadMap[fhId] || 'Unknown Fee Head';
                const amount = tx.amount || 0;
                const isDebit = tx.transactionType === 'DEBIT';
                const isCredit = tx.transactionType === 'CREDIT';
                const isCash = tx.paymentMode === 'Cash';
                const isCancelled = tx.status === 'cancelled';

                const normalizedCashierName = cashier.replace(/\s+/g, ' ').trim().toLowerCase();
                const empNo = cashierEmpNoMap[cashierUsername.toLowerCase()] || 
                              cashierEmpNoMap[normalizedCashierName] || 
                              cashierEmpNoMap[cashier.toLowerCase()] || 
                              cashier;

                if (!collegeGroups[collegeName]) {
                    collegeGroups[collegeName] = {
                        _id: collegeName,
                        totalAmount: 0,
                        debitAmount: 0,
                        creditAmount: 0,
                        cashAmount: 0,
                        bankAmount: 0,
                        totalCount: 0,
                        count: 0,
                        cashiersMap: {},
                        transactions: []
                    };
                }

                const group = collegeGroups[collegeName];

                if (!isCancelled) {
                    group.totalCount++;
                    group.count++;
                    if (isDebit) {
                        group.debitAmount += amount;
                        if (isCash) group.cashAmount += amount;
                        else group.bankAmount += amount;
                    }
                    if (isCredit) {
                        group.creditAmount += amount;
                    }
                }
                group.transactions.push({
                    _id: tx._id,
                    receiptNo: tx.receiptNumber || '-',
                    studentName: tx.studentName,
                    amount: tx.amount,
                    paymentMode: tx.paymentMode,
                    transactionType: tx.transactionType,
                    pinNo: collegeData ? collegeData.pin_no : '-',
                    studentId: tx.studentId,
                    course: collegeData && collegeData.course ? collegeData.course : 'N/A',
                    branch: collegeData && collegeData.branch ? collegeData.branch : 'N/A',
                    studentYear: collegeData && collegeData.current_year ? collegeData.current_year : 'N/A',
                    feeHead: fhName,
                    college: collegeName,
                    status: tx.status || 'active',
                    collectedBy: tx.collectedBy || 'Unknown',
                    collectedByName: tx.collectedByName || 'Unknown',
                    empNo: empNo,
                    cancelledBy: tx.cancelledBy,
                    cancelledByName: tx.cancelledByName,
                    cancelledAt: tx.cancelledAt,
                    cancellationReason: tx.cancellationReason,
                    createdAt: tx.createdAt,
                    updatedAt: tx.updatedAt
                });

                // cashier breakdown inside this college
                if (!group.cashiersMap[cashierUsername]) {
                    group.cashiersMap[cashierUsername] = {
                        username: cashierUsername,
                        name: cashier,
                        empNo: empNo,
                        count: 0,
                        cashAmount: 0,
                        bankAmount: 0,
                        creditAmount: 0,
                        netTotal: 0,
                        feeHeadsMap: {}
                    };
                }

                if (!isCancelled) {
                    const cashierEntry = group.cashiersMap[cashierUsername];
                    cashierEntry.count++;
                    if (isDebit) {
                        cashierEntry.netTotal += amount;
                        if (isCash) cashierEntry.cashAmount += amount;
                        else cashierEntry.bankAmount += amount;

                        // Track cashier's fee heads for this college
                        if (!cashierEntry.feeHeadsMap[fhName]) {
                            cashierEntry.feeHeadsMap[fhName] = {
                                name: fhName,
                                cashAmount: 0,
                                bankAmount: 0,
                                netTotal: 0
                            };
                        }
                        const cfh = cashierEntry.feeHeadsMap[fhName];
                        cfh.netTotal += amount;
                        if (isCash) cfh.cashAmount += amount;
                        else cfh.bankAmount += amount;
                    } else if (isCredit) {
                        cashierEntry.creditAmount += amount;
                    }
                }
            });

            // Format results array
            const finalResults = Object.values(collegeGroups).map(group => {
                // cashier breakdowns
                group.cashiers = Object.values(group.cashiersMap).map(c => {
                    c.feeHeads = Object.values(c.feeHeadsMap || {}).sort((a, b) => b.netTotal - a.netTotal);
                    delete c.feeHeadsMap;
                    return c;
                }).sort((a, b) => b.netTotal - a.netTotal);
                delete group.cashiersMap;

                // College-level fee head summary
                const collegeFeeHeadsMap = {};
                group.transactions.forEach(tx => {
                    if (tx.status !== 'cancelled' && tx.transactionType === 'DEBIT') {
                        const fhName = tx.feeHead || 'Unknown';
                        const amt = tx.amount || 0;
                        const isCash = tx.paymentMode === 'Cash';

                        if (!collegeFeeHeadsMap[fhName]) {
                            collegeFeeHeadsMap[fhName] = {
                                name: fhName,
                                cashAmount: 0,
                                bankAmount: 0,
                                netTotal: 0
                            };
                        }
                        const cfh = collegeFeeHeadsMap[fhName];
                        cfh.netTotal += amt;
                        if (isCash) cfh.cashAmount += amt;
                        else cfh.bankAmount += amt;
                    }
                });
                group.feeHeads = Object.values(collegeFeeHeadsMap).sort((a, b) => b.netTotal - a.netTotal);

                group.totalAmount = group.debitAmount; // Match interface expectations
                return group;
            }).sort((a, b) => b.debitAmount - a.debitAmount);

            res.json(finalResults);
            return;

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
        const { college, course, branch, batch, search, campusId } = req.query;
        const allowedColleges = await collegeScope.getEffectiveCollegeNames(req.user, campusId);

        // 1. Build SQL Query for Students
        let sqlQuery = `SELECT admission_number, student_name, course, branch, current_year, student_mobile, pin_no, college FROM students WHERE 1=1`;
        const params = [];

        if (college) {
            if (allowedColleges && !allowedColleges.includes(college)) {
                return res.json([]);
            }
            sqlQuery += ` AND college = ?`;
            params.push(college);
        } else if (allowedColleges && allowedColleges.length > 0) {
            sqlQuery += ` AND college IN (${allowedColleges.map(() => '?').join(',')})`;
            params.push(...allowedColleges);
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

        // 3. Aggregate Total Paid - Grouped by FeeHead (exclude cancelled)
        const txMatch = { studentId: { $in: allIdentifiers }, status: { $ne: 'cancelled' } };
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
        const reportData = Object.values(studentMap).map(student => {
            student.dueAmount = Math.max(0, student.totalFee - student.paidAmount);

            // Convert feeDetails map to array expected by frontend
            student.feeDetailsArray = Object.keys(student.feeDetails).map(fid => {
                const detail = student.feeDetails[fid];
                const total = detail.total || 0;
                const paid = detail.paid || 0;
                return {
                    headName: feeHeadNameMap[fid] || 'Unknown',
                    total: total,
                    paid: paid,
                    due: Math.max(0, total - paid)
                };
            });

            return student;
        });

        res.json(reportData);

    } catch (error) {
        console.error('Due Report Error:', error);
        res.status(500).json({ message: 'Error generating due report' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const { startDate, endDate, campusId } = req.query;
        const allowedColleges = await collegeScope.getEffectiveCollegeNames(req.user, campusId);
        const studentScopeFilter = await collegeScope.applyStudentIdFilter(req.user, campusId, {});
        const hasNoAccess = studentScopeFilter.studentId?.$in?.[0] === '__none__';

        // Base date matching stage - timezone aware for IST (+05:30)
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate + "T00:00:00.000Z");
                start.setMinutes(start.getMinutes() - 330); // Offset IST by 5h 30m
                dateFilter.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate + "T23:59:59.999Z");
                end.setMinutes(end.getMinutes() - 330); // Offset IST by 5h 30m
                dateFilter.createdAt.$lte = end;
            }
        } else {
            // Default to today (IST) if no dates provided
            const now = new Date();
            const istTime = new Date(now.getTime() + (330 * 60 * 1000));
            const istDateStr = istTime.toISOString().split('T')[0];

            const start = new Date(istDateStr + "T00:00:00.000Z");
            start.setMinutes(start.getMinutes() - 330);

            const end = new Date(istDateStr + "T23:59:59.999Z");
            end.setMinutes(end.getMinutes() - 330);

            dateFilter.createdAt = { $gte: start, $lte: end };
        }

        // Trend date filter - defaults to last 7 days (IST) if date range is a single day (e.g. today only default)
        const trendDateFilter = { ...dateFilter };
        if (!startDate || startDate === endDate) {
            let refEndDateStr;
            if (endDate) {
                refEndDateStr = endDate;
            } else {
                const now = new Date();
                const istTime = new Date(now.getTime() + (330 * 60 * 1000));
                refEndDateStr = istTime.toISOString().split('T')[0];
            }

            const refEnd = new Date(refEndDateStr + "T00:00:00.000Z");
            refEnd.setDate(refEnd.getDate() - 6); // 6 days prior + today = 7 days trend
            const trendStart = refEnd;
            trendStart.setMinutes(trendStart.getMinutes() - 330); // Offset IST by 5h 30m

            trendDateFilter.createdAt = {
                $gte: trendStart,
                $lte: dateFilter.createdAt.$lte
            };
        }

        // 1. Collections (DEBIT transactions) within date range
        const collectionStats = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    ...dateFilter,
                    ...studentScopeFilter,
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    cash: {
                        $sum: { $cond: [{ $eq: ["$paymentMode", "Cash"] }, "$amount", 0] }
                    },
                    online: {
                        $sum: { $cond: [{ $ne: ["$paymentMode", "Cash"] }, "$amount", 0] }
                    }
                }
            }
        ]);

        const collections = collectionStats[0] || { total: 0, cash: 0, online: 0 };

        // 2. Student Count (Regular students from SQL)
        let studentCountQuery = "SELECT COUNT(*) as count FROM students WHERE LOWER(student_status) = 'regular'";
        const studentCountParams = [];
        if (allowedColleges && allowedColleges.length > 0) {
            studentCountQuery += ` AND college IN (${allowedColleges.map(() => '?').join(',')})`;
            studentCountParams.push(...allowedColleges);
        }
        const [studentCountResult] = hasNoAccess
            ? [[{ count: 0 }]]
            : await db.query(studentCountQuery, studentCountParams);
        const totalStudents = studentCountResult[0]?.count || 0;

        // 3. Recent Transactions within date range (exclude cancelled)
        const recentTransactions = hasNoAccess ? [] : await Transaction.find({
            ...dateFilter,
            ...studentScopeFilter,
            status: { $ne: 'cancelled' }
        })
        .populate('feeHead', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

        // 4. Collection Trend within date range (with IST timezone representation for calendar alignment)
        const trendData = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    status: { $ne: 'cancelled' },
                    ...trendDateFilter,
                    ...studentScopeFilter,
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 5. College and Course Wise Breakdown within date range
        const studentAggregates = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    status: { $ne: 'cancelled' },
                    ...dateFilter,
                    ...studentScopeFilter,
                }
            },
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

            const [collegesData] = await db.query('SELECT name, code FROM colleges');
            const collegeCodeMap = {}; // name -> code
            collegesData.forEach(c => {
                if (c.name && c.code) {
                    collegeCodeMap[c.name] = c.code;
                }
            });

            collegeWise = Object.entries(collegeMap).map(([name, amount]) => {
                const code = collegeCodeMap[name] || name;
                return {
                    name: code,
                    fullName: name,
                    amount
                };
            });
            courseWise = Object.entries(courseMap).map(([name, amount]) => ({ name, amount }));
        }

        // 6. Fee Head Wise Breakdown within date range
        const feeHeadWise = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    ...dateFilter,
                    ...studentScopeFilter,
                }
            },
            {
                $group: {
                    _id: "$feeHead",
                    amount: { $sum: "$amount" }
                }
            },
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
                    name: { $ifNull: ["$details.name", "Unknown Fee Head"] },
                    amount: 1
                }
            },
            { $sort: { amount: -1 } }
        ]);

        // 7. User Wise Breakdown within date range
        const rawUserWise = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'DEBIT',
                    ...dateFilter,
                    ...studentScopeFilter,
                }
            },
            {
                $group: {
                    _id: "$collectedBy",
                    name: { $first: "$collectedByName" },
                    amount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    username: "$_id",
                    name: { $ifNull: ["$name", "$_id"] },
                    amount: 1
                }
            },
            { $sort: { amount: -1 } }
        ]);

        const User = require('../models/User');
        const getEmployeeModel = require('../models/Employee');
        const Employee = getEmployeeModel();

        const userWise = [];
        for (const item of rawUserWise) {
            let empNo = item.username; // fallback to username
            
            // 1. Check local user database
            const dbUser = await User.findOne({ username: item.username });
            if (dbUser && dbUser.employeeId && Employee) {
                const emp = await Employee.findById(dbUser.employeeId).select('emp_no');
                if (emp && emp.emp_no) {
                    empNo = emp.emp_no;
                }
            } else if (Employee) {
                // 2. Fallback: Search directly in external Employee DB
                // Match by emp_no matching username
                let emp = await Employee.findOne({ emp_no: item.username }).select('emp_no');
                if (emp && emp.emp_no) {
                    empNo = emp.emp_no;
                } else if (item.name) {
                    // Match by employee_name matching collectedByName
                    emp = await Employee.findOne({ employee_name: item.name }).select('emp_no');
                    if (emp && emp.emp_no) {
                        empNo = emp.emp_no;
                    } else {
                        // Case-insensitive regex match for name
                        const normalizedName = item.name.replace(/\s+/g, ' ').trim();
                        emp = await Employee.findOne({ 
                            employee_name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } 
                        }).select('emp_no');
                        if (emp && emp.emp_no) {
                            empNo = emp.emp_no;
                        }
                    }
                }
            }

            userWise.push({
                username: item.username,
                name: empNo, // Display employee number as chart label
                fullName: item.name, // Display full name inside tooltip
                amount: item.amount
            });
        }

        res.json({
            collections,
            totalStudents,
            recentTransactions,
            trendData,
            collegeWise,
            courseWise,
            feeHeadWise,
            userWise
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
