const Transaction = require('../models/Transaction');
const StudentFee = require('../models/StudentFee');
const mongoose = require('mongoose');
const db = require('../config/sqlDb');
const collegeScope = require('../utils/collegeScope');
const { buildReportDateFilter, applyReportDateToMatch, buildIstDayBounds, buildCollectionDateMatch } = require('../utils/reportDateFilter');

// Helper to filter transactions by user's scoped colleges using cached fields directly
const applyTransactionScopeFilter = async (user, campusId, query = {}) => {
    const collegeNames = await collegeScope.getEffectiveCollegeNames(user, campusId);
    if (collegeNames === null) return query;
    if (collegeNames.length === 0) {
        return { ...query, college: { $in: ['__none__'] } };
    }
    return {
        ...query,
        college: { $in: collegeNames }
    };
};

// @desc    Get Transaction Reports (Daily, Cashier, FeeHead, Mode)
// @route   GET /api/reports/transactions
// @access  Public (should be Protected)
const getTransactionReports = async (req, res) => {
    try {
        const { startDate, endDate, groupBy, college: collegeFilter, feeGroupId, campusId } = req.query;

        const allowedColleges = await collegeScope.getEffectiveCollegeNames(req.user, campusId);
        const hasCollegeScope = Array.isArray(allowedColleges) && allowedColleges.length > 0;

        // Base matching condition — always exclude cancelled transactions and overall concessions from reports
        let matchStage = { 
            status: { $ne: 'cancelled' },
            remarks: { $ne: 'Concession as per declaration' }
        };
        matchStage = await applyTransactionScopeFilter(req.user, campusId, matchStage);
        if (matchStage.studentId?.$in?.[0] === '__none__' || matchStage.college?.$in?.[0] === '__none__') {
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
        // Support matching by username OR their name in collectedByName (in case of UUID stored by other applications)
        if (req.user && req.user.role === 'cashier') {
            const orConditions = [
                { collectedBy: req.user.username }
            ];
            if (req.user.name) {
                orConditions.push({ collectedByName: req.user.name });
                const normName = req.user.name.replace(/\s+/g, ' ').trim();
                if (normName !== req.user.name) {
                    orConditions.push({ collectedByName: normName });
                }
            }
            matchStage.$or = orConditions;
        }

        // Date Filter (IST-aligned) — paymentDate (collection date), fallback createdAt
        applyReportDateToMatch(matchStage, startDate, endDate);

        const User = require('../models/User');
        const usersListForMapping = await User.find({}).lean();
        const userIdMap = {};
        const userIdNameMap = {};
        const nameToUsernameMap = {};
        usersListForMapping.forEach(u => {
            const uidStr = String(u._id);
            if (u.username) {
                userIdMap[uidStr] = u.username;
            }
            if (u.name) {
                userIdNameMap[uidStr] = u.name;
                const norm = u.name.replace(/\s+/g, ' ').toLowerCase().trim();
                if (u.username) {
                    nameToUsernameMap[norm] = u.username;
                }
            }
        });

        // College Filter will be applied in-memory after SQL enrichment, since college is not directly stored on Transaction
        // The college query param will be used to filter student data after fetching from SQL

        let groupId;
        let pipeline;

        if (groupBy === 'cashier') {
            // --- Advanced Cashier Report with College Breakdown (Includes Cancelled) ---
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();
            transactions.forEach(tx => {
                const cbStr = String(tx.collectedBy || '');
                if (userIdMap[cbStr]) {
                    tx.collectedBy = userIdMap[cbStr];
                    if (userIdNameMap[cbStr]) tx.collectedByName = userIdNameMap[cbStr];
                } else if (tx.collectedByName) {
                    const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
                    const resolvedUsername = nameToUsernameMap[normName];
                    if (resolvedUsername) {
                        tx.collectedBy = resolvedUsername;
                    }
                }
            });

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

            // 2. Extract Student IDs for SQL Lookup (only if cached metadata is missing)
            const studentIds = new Set();
            const feeHeadIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId && (!tx.college || !tx.course || !tx.branch || !tx.pinNo)) {
                    studentIds.add(String(tx.studentId).trim());
                }
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
                const college = tx.college || (collegeData ? collegeData.college : 'Unknown');

                if (hasCollegeScope && !collegeScope.isCollegeAllowed(college, allowedColleges)) {
                    return;
                }

                // Apply college query filter if specified (compare against the extracted college name)
                if (collegeFilter && collegeFilter !== college) {
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
                    pinNo: tx.pinNo || (collegeData ? collegeData.pin_no : '-'),
                    studentId: tx.studentId,
                    course: tx.course || (collegeData && collegeData.course ? collegeData.course : 'N/A'),
                    branch: tx.branch || (collegeData && collegeData.branch ? collegeData.branch : 'N/A'),
                    studentYear: tx.studentYear || (collegeData && collegeData.current_year ? collegeData.current_year : 'N/A'),
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
            // Enhanced Fee Head Report — fetch full transactions for detail view + print
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();
            transactions.forEach(tx => {
                const cbStr = String(tx.collectedBy || '');
                if (userIdMap[cbStr]) {
                    tx.collectedBy = userIdMap[cbStr];
                    if (userIdNameMap[cbStr]) tx.collectedByName = userIdNameMap[cbStr];
                } else if (tx.collectedByName) {
                    const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
                    const resolvedUsername = nameToUsernameMap[normName];
                    if (resolvedUsername) {
                        tx.collectedBy = resolvedUsername;
                    }
                }
            });

            // Resolve fee head names
            const fhFeeHeadIds = new Set();
            transactions.forEach(tx => { if (tx.feeHead) fhFeeHeadIds.add(tx.feeHead.toString()); });
            const fhNameMap = {};
            try {
                const fheads = await mongoose.connection.collection('feeheads').find({
                    _id: { $in: Array.from(fhFeeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
                }).toArray();
                fheads.forEach(fh => fhNameMap[fh._id.toString()] = fh.name);
            } catch (err) { console.error('Error fetching fee heads for feeHead report:', err); }

            // SQL student enrichment (only for uncached transactions)
            const fhStudentIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId && (!tx.college || !tx.course || !tx.branch || !tx.pinNo)) {
                    fhStudentIds.add(String(tx.studentId).trim());
                }
            });
            const fhStudentDataMap = {};
            if (fhStudentIds.size > 0) {
                const idList = Array.from(fhStudentIds).map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
                try {
                    const [students] = await db.query(
                        `SELECT admission_number, pin_no, college, course, branch, current_year FROM students WHERE admission_number IN (${idList}) OR pin_no IN (${idList})`
                    );
                    students.forEach(s => {
                        const sData = { pin_no: s.pin_no || '-', college: s.college || 'Unknown', course: s.course || 'N/A', branch: s.branch || 'N/A', current_year: s.current_year || 'N/A' };
                        const adm = String(s.admission_number).trim();
                        fhStudentDataMap[adm] = sData;
                        fhStudentDataMap[adm.toLowerCase()] = sData;
                        if (s.pin_no) {
                            const pin = String(s.pin_no).trim();
                            fhStudentDataMap[pin] = sData;
                            fhStudentDataMap[pin.toLowerCase()] = sData;
                        }
                    });
                } catch (sqlErr) { console.error('SQL Error in feeHead report:', sqlErr); }
            }

            // Group transactions by fee head
            const feeHeadGroups = {};
            transactions.forEach(tx => {
                const fhId = tx.feeHead ? tx.feeHead.toString() : 'unknown';
                const fhName = fhNameMap[fhId] || 'Unknown Fee Head';
                if (!feeHeadGroups[fhId]) {
                    feeHeadGroups[fhId] = { _id: fhId, name: fhName, totalAmount: 0, count: 0, debitAmount: 0, creditAmount: 0, cashAmount: 0, bankAmount: 0, transactions: [] };
                }
                const group = feeHeadGroups[fhId];
                const amt = tx.amount || 0;
                const isDebit = tx.transactionType === 'DEBIT';
                const isCredit = tx.transactionType === 'CREDIT';
                const isCash = tx.paymentMode === 'Cash';
                const isCancelled = tx.status === 'cancelled';
                const sId = String(tx.studentId || '').trim();
                const sData = fhStudentDataMap[sId] || fhStudentDataMap[sId.toLowerCase()] || {};
                const studentCollege = tx.college || sData.college || 'Unknown';

                // Apply college query filter if specified
                if (collegeFilter && collegeFilter !== studentCollege) {
                    return;
                }

                if (!isCancelled) {
                    group.totalAmount += amt;
                    group.count++;
                    if (isDebit) { group.debitAmount += amt; if (isCash) group.cashAmount += amt; else group.bankAmount += amt; }
                    if (isCredit) group.creditAmount += amt;
                }
                group.transactions.push({
                    _id: tx._id,
                    receiptNo: tx.receiptNumber || '-',
                    studentName: tx.studentName || '',
                    studentId: tx.studentId,
                    pinNo: tx.pinNo || sData.pin_no || '-',
                    college: studentCollege,
                    course: tx.course || sData.course || 'N/A',
                    branch: tx.branch || sData.branch || 'N/A',
                    studentYear: tx.studentYear || sData.current_year || 'N/A',
                    amount: tx.amount,
                    paymentMode: tx.paymentMode,
                    transactionType: tx.transactionType,
                    status: tx.status || 'active',
                    collectedBy: tx.collectedBy || '',
                    collectedByName: tx.collectedByName || '',
                    paymentDate: tx.paymentDate || tx.createdAt,
                    createdAt: tx.createdAt
                });
            });

            const fhFinalResults = Object.values(feeHeadGroups).sort((a, b) => b.debitAmount - a.debitAmount);
            res.json(fhFinalResults);
            return;


        } else if (groupBy === 'college') {
            // --- Advanced College Report with Cashier Breakdown (Includes Cancelled) ---
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();
            transactions.forEach(tx => {
                const cbStr = String(tx.collectedBy || '');
                if (userIdMap[cbStr]) {
                    tx.collectedBy = userIdMap[cbStr];
                    if (userIdNameMap[cbStr]) tx.collectedByName = userIdNameMap[cbStr];
                } else if (tx.collectedByName) {
                    const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
                    const resolvedUsername = nameToUsernameMap[normName];
                    if (resolvedUsername) {
                        tx.collectedBy = resolvedUsername;
                    }
                }
            });

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

            // Extract Student IDs for SQL Lookup (only uncached ones)
            const studentIds = new Set();
            const feeHeadIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId && (!tx.college || !tx.course || !tx.branch || !tx.pinNo)) {
                    studentIds.add(String(tx.studentId).trim());
                }
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
                const collegeName = tx.college || (collegeData ? collegeData.college : 'Unknown');

                // Apply college query filter if specified
                if (collegeFilter && collegeFilter !== collegeName) {
                    return;
                }

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
                    pinNo: tx.pinNo || (collegeData ? collegeData.pin_no : '-'),
                    studentId: tx.studentId,
                    course: tx.course || (collegeData && collegeData.course ? collegeData.course : 'N/A'),
                    branch: tx.branch || (collegeData && collegeData.branch ? collegeData.branch : 'N/A'),
                    studentYear: tx.studentYear || (collegeData && collegeData.current_year ? collegeData.current_year : 'N/A'),
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
                const cashierKey = String(empNo || cashierUsername).trim().toLowerCase();
                if (!group.cashiersMap[cashierKey]) {
                    group.cashiersMap[cashierKey] = {
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
                    const cashierEntry = group.cashiersMap[cashierKey];
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

        } else if (groupBy === 'account') {
            // --- Advanced Account-wise Report (Includes Cancelled) ---
            const matchStageWithCancelled = { ...matchStage };
            delete matchStageWithCancelled.status;
            const transactions = await Transaction.find(matchStageWithCancelled).lean();
            transactions.forEach(tx => {
                const cbStr = String(tx.collectedBy || '');
                if (userIdMap[cbStr]) {
                    tx.collectedBy = userIdMap[cbStr];
                    if (userIdNameMap[cbStr]) tx.collectedByName = userIdNameMap[cbStr];
                } else if (tx.collectedByName) {
                    const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
                    const resolvedUsername = nameToUsernameMap[normName];
                    if (resolvedUsername) {
                        tx.collectedBy = resolvedUsername;
                    }
                }
            });

            const PaymentConfig = require('../models/PaymentConfig');
            const configs = await PaymentConfig.find({}).lean();

            // Extract Student IDs for SQL Lookup (only uncached ones)
            const studentIds = new Set();
            const feeHeadIds = new Set();
            transactions.forEach(tx => {
                if (tx.studentId && (!tx.college || !tx.course || !tx.branch || !tx.pinNo)) {
                    studentIds.add(String(tx.studentId).trim());
                }
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

            const accountGroups = {};

            // Initialize groups for all configured payment accounts that are allowed for the user
            configs.forEach(config => {
                if (hasCollegeScope && !config.is_global && !collegeScope.isCollegeAllowed(config.college, allowedColleges)) {
                    return;
                }
                accountGroups[config._id.toString()] = {
                    _id: config._id.toString(),
                    account_name: config.account_name,
                    bank_name: config.bank_name,
                    account_number: config.account_number,
                    college: config.college,
                    course: config.course || 'All Courses',
                    is_global: !!config.is_global || !config.college,
                    is_active: config.is_active,
                    totalAmount: 0,
                    debitAmount: 0,
                    creditAmount: 0,
                    cashAmount: 0,
                    bankAmount: 0,
                    totalCount: 0,
                    count: 0,
                    transactions: []
                };
            });

            // Also prepare an "unassigned" group for direct cash/other transactions that do not specify an account
            const unassignedGroup = {
                _id: 'unassigned',
                account_name: 'Unassigned/Direct Cash',
                bank_name: 'Cash / General',
                account_number: 'N/A',
                college: 'N/A',
                course: 'N/A',
                is_global: true,
                is_active: true,
                totalAmount: 0,
                debitAmount: 0,
                creditAmount: 0,
                cashAmount: 0,
                bankAmount: 0,
                totalCount: 0,
                count: 0,
                transactions: []
            };

            // Fetch cashier profiles to find emp_no
            const User = require('../models/User');
            const getEmployeeModel = require('../models/Employee');
            const Employee = getEmployeeModel();

            let cashierEmpNoMap = {};
            try {
                const usersList = await User.find({}).lean();
                const employeeIds = usersList.map(u => u.employeeId).filter(Boolean);
                const employeeMap = {};
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
                        const normalizedName = u.name.replace(/\s+/g, ' ').trim().toLowerCase();
                        cashierEmpNoMap[normalizedName] = empNo;
                    }
                });
            } catch (userErr) {
                console.error("Error fetching cashier details:", userErr);
            }

            transactions.forEach(tx => {
                const sId = String(tx.studentId).trim();
                const collegeData = collegeMap[sId] || collegeMap[sId.toLowerCase()];
                const studentCollege = tx.college || (collegeData ? collegeData.college : 'Unknown');

                // Apply college query filter if specified
                if (collegeFilter && collegeFilter !== studentCollege) {
                    return;
                }

                const configId = tx.paymentConfigId ? tx.paymentConfigId.toString() : null;
                let group;

                if (configId && accountGroups[configId]) {
                    group = accountGroups[configId];
                } else if (!configId) {
                    // Skip unassigned Cash transactions in account-wise report
                    if (tx.paymentMode === 'Cash') {
                        return;
                    }
                    // Filter unassigned by student's college if under scope
                    if (hasCollegeScope && !collegeScope.isCollegeAllowed(studentCollege, allowedColleges)) {
                        return;
                    }
                    group = unassignedGroup;
                } else {
                    // Transaction has a configId, but it isn't in accountGroups (maybe college is not allowed)
                    return;
                }

                const amount = tx.amount || 0;
                const isDebit = tx.transactionType === 'DEBIT';
                const isCredit = tx.transactionType === 'CREDIT';
                const isCash = tx.paymentMode === 'Cash';
                const isCancelled = tx.status === 'cancelled';
                const fhId = tx.feeHead ? tx.feeHead.toString() : 'unknown';
                const fhName = feeHeadMap[fhId] || 'Unknown Fee Head';

                const cashier = tx.collectedByName || 'Unknown';
                const cashierUsername = tx.collectedBy || 'Unknown';
                const normalizedCashierName = cashier.replace(/\s+/g, ' ').trim().toLowerCase();
                const empNo = cashierEmpNoMap[cashierUsername.toLowerCase()] || 
                              cashierEmpNoMap[normalizedCashierName] || 
                              cashierEmpNoMap[cashier.toLowerCase()] || 
                              cashier;

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
                    pinNo: tx.pinNo || (collegeData ? collegeData.pin_no : '-'),
                    studentId: tx.studentId,
                    course: tx.course || (collegeData && collegeData.course ? collegeData.course : 'N/A'),
                    branch: tx.branch || (collegeData && collegeData.branch ? collegeData.branch : 'N/A'),
                    studentYear: tx.studentYear || (collegeData && collegeData.current_year ? collegeData.current_year : 'N/A'),
                    feeHead: fhName,
                    college: studentCollege,
                    status: tx.status || 'active',
                    collectedBy: tx.collectedBy || 'Unknown',
                    collectedByName: tx.collectedByName || 'Unknown',
                    empNo: empNo,
                    createdAt: tx.createdAt,
                    updatedAt: tx.updatedAt
                });
            });

            const finalResults = Object.values(accountGroups);
            finalResults.push(unassignedGroup);

            finalResults.forEach(g => {
                g.totalAmount = g.debitAmount;
            });

            // Display only accounts from which we have amount (> 0)
            const activeAccountResults = finalResults.filter(g => (g.debitAmount || 0) > 0 || (g.creditAmount || 0) > 0 || (g.totalAmount || 0) > 0);

            res.json(activeAccountResults);
            return;

        } else {
            // Default Day
            groupId = {
                year: { $year: { $ifNull: ["$paymentDate", "$createdAt"] } },
                month: { $month: { $ifNull: ["$paymentDate", "$createdAt"] } },
                day: { $dayOfMonth: { $ifNull: ["$paymentDate", "$createdAt"] } }
            };
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
                                studentYear: "$studentYear", // Include year
                                college: "$college",
                                course: "$course",
                                branch: "$branch",
                                pinNo: "$pinNo"
                            }
                        }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
            ];

            const dailyStats = await Transaction.aggregate(pipeline);

            // --- SQL Enrichment Start ---
            // Extract all studentIds (Admission Numbers) that lack cached metadata
            const admissionNumbers = new Set();
            dailyStats.forEach(day => {
                if (day.transactions) {
                    day.transactions.forEach(tx => {
                        if (tx.studentId && (!tx.college || !tx.course || !tx.branch || !tx.pinNo)) {
                            admissionNumbers.add(String(tx.studentId).trim());
                        }
                    });
                }
            });

            if (admissionNumbers.size > 0) {
                const ids = Array.from(admissionNumbers).map(id => `'${id}'`).join(',');
                // Query SQL for Course, Branch, Pin No, College
                const sqlQuery = `SELECT admission_number, pin_no, course, branch, current_year, college FROM students WHERE admission_number IN (${ids})`;

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

                    // Attach to transactions and filter by college if specified
                    dailyStats.forEach(day => {
                        if (day.transactions) {
                            day.transactions = day.transactions.filter(tx => {
                                const validId = String(tx.studentId).trim();
                                const details = studentMap[validId] || studentMap[validId.toLowerCase()];
                                
                                tx.pinNo = tx.pinNo || (details ? details.pin_no : null) || '-';
                                tx.course = tx.course || (details ? details.course : 'N/A');
                                tx.branch = tx.branch || (details ? details.branch : 'N/A');
                                tx.studentYear = tx.studentYear || (details ? details.current_year : 'N/A');
                                tx.college = tx.college || (details ? details.college : 'Unknown');

                                // Apply college query filter if specified
                                if (collegeFilter && collegeFilter !== tx.college) {
                                    return false;
                                }
                                return true;
                            });
                        }
                    });

                    // Remove empty days after filtering
                    const filteredStats = dailyStats.filter(day => day.transactions && day.transactions.length > 0);
                    
                    // Return filtered stats instead of dailyStats
                    res.json(filteredStats);

                } catch (sqlErr) {
                    console.error("SQL Enrichment Error:", sqlErr);
                    // Proceed without enrichment if SQL fails, or handle appropriately
                    res.json(dailyStats);
                }
            } else {
                res.json(dailyStats);
            }
            // --- SQL Enrichment End ---

            return; // Return here as we handled response
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
        const { college, course, branch, batch, search, campusId, year } = req.query;
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
        // Parse Academic Year start year from batch query param (e.g. "2024-2025" -> 2024)
        let ayStartYear = null;
        let yearNumber = null;
        if (batch) {
            if (batch.includes('-')) {
                const ayStartMatch = batch.match(/^(\d{4})/);
                if (ayStartMatch) {
                    ayStartYear = parseInt(ayStartMatch[1], 10);
                }
            } else {
                // Direct batch filter (no hyphen, e.g. "2024")
                sqlQuery += ` AND batch = ?`;
                params.push(batch);
            }
        }

        // Filter by Year/Semester (current_year)
        if (year) {
            const yearMatch = year.match(/^(\d+)/);
            if (yearMatch) {
                yearNumber = parseInt(yearMatch[1], 10);
                if (ayStartYear !== null) {
                    // Both Academic Year and Student Year are specified:
                    // Student batch = (ayStartYear - yearNumber + 1)
                    const targetBatch = String(ayStartYear - yearNumber + 1);
                    sqlQuery += ` AND batch = ? AND current_year = ?`;
                    params.push(targetBatch, yearNumber);
                } else {
                    sqlQuery += ` AND current_year = ?`;
                    params.push(yearNumber);
                }
            }
        } else if (ayStartYear !== null) {
            // Only Academic Year is specified (All student years):
            // (batch + current_year - 1) = ayStartYear
            sqlQuery += ` AND (CAST(batch AS SIGNED) + current_year - 1) = ?`;
            params.push(ayStartYear);
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

        // 2. Aggregate Total Fee (Demand) and Paid specific to the student year / academic year
        let feeMatch = { studentId: { $in: allIdentifiers } };
        let txMatch = { studentId: { $in: allIdentifiers }, status: { $ne: 'cancelled' } };

        if (yearNumber !== null) {
            // Filter by specific student year
            feeMatch.studentYear = yearNumber;
            txMatch.studentYear = String(yearNumber);
        } else if (ayStartYear !== null) {
            // Filter by target student year for each student based on Academic Year
            const feeOrConditions = [];
            const txOrConditions = [];
            students.forEach(student => {
                const studentBatch = parseInt(student.batch, 10);
                if (!isNaN(studentBatch)) {
                    const targetYear = ayStartYear - studentBatch + 1;
                    const identifiers = [student.admission_number, student.pin_no].filter(Boolean);
                    if (identifiers.length > 0) {
                        feeOrConditions.push({
                            studentId: { $in: identifiers },
                            studentYear: targetYear
                        });
                        txOrConditions.push({
                            studentId: { $in: identifiers },
                            studentYear: String(targetYear)
                        });
                    }
                }
            });

            if (feeOrConditions.length > 0) {
                feeMatch = { $or: feeOrConditions };
            }
            if (txOrConditions.length > 0) {
                txMatch = { $or: txOrConditions, status: { $ne: 'cancelled' } };
            }
        }

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
                    feeHeadNameMap[h._id.toString()] = {
                        name: h.name,
                        code: h.code || h.alias || h.name
                    };
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
                const headObj = feeHeadNameMap[fid];
                const headName = typeof headObj === 'object' ? headObj.name : (feeHeadNameMap[fid] || 'Unknown');
                const headCode = typeof headObj === 'object' ? headObj.code : (feeHeadNameMap[fid] || 'Unknown');
                return {
                    headId: fid,
                    headName: headName,
                    headCode: headCode || headName,
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
        const studentScopeFilter = await applyTransactionScopeFilter(req.user, campusId, {});
        const hasNoAccess = studentScopeFilter.studentId?.$in?.[0] === '__none__' || studentScopeFilter.college?.$in?.[0] === '__none__';

        // Base date matching — paymentDate (collection date), fallback createdAt
        let effectiveStart = startDate;
        let effectiveEnd = endDate;
        if (!startDate && !endDate) {
            const now = new Date();
            const istTime = new Date(now.getTime() + (330 * 60 * 1000));
            const istDateStr = istTime.toISOString().split('T')[0];
            effectiveStart = istDateStr;
            effectiveEnd = istDateStr;
        }

        const dateFilter = buildCollectionDateMatch(effectiveStart, effectiveEnd);

        // Trend date filter - defaults to last 7 days (IST) if date range is a single day
        let trendDateFilter = { ...dateFilter };
        if (!startDate || startDate === endDate) {
            let refEndDateStr = effectiveEnd;
            const refEnd = new Date(refEndDateStr + "T00:00:00.000Z");
            refEnd.setDate(refEnd.getDate() - 6);
            const trendStartStr = refEnd.toISOString().split('T')[0];
            trendDateFilter = buildCollectionDateMatch(trendStartStr, effectiveEnd);
        }

        // Build composite filters using $and to avoid key collision ($or overrides)
        const getCompositeFilter = (baseMatch = {}, customDateFilter = dateFilter) => {
            const matchObj = { ...baseMatch };
            const andConditions = [];
            if (Object.keys(customDateFilter).length > 0) {
                andConditions.push(customDateFilter);
            }
            if (Object.keys(studentScopeFilter).length > 0) {
                andConditions.push(studentScopeFilter);
            }
            if (andConditions.length > 0) {
                matchObj.$and = andConditions;
            }
            return matchObj;
        };

        // 1. Collections (DEBIT transactions) within date range
        const collectionStatsMatch = getCompositeFilter({ transactionType: 'DEBIT' });
        const collectionStats = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: collectionStatsMatch
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
        const recentTxMatch = getCompositeFilter({ status: { $ne: 'cancelled' } });
        const recentTransactions = hasNoAccess ? [] : await Transaction.find(recentTxMatch)
            .populate('feeHead', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // 4. Collection Trend within date range (with IST timezone representation for calendar alignment)
        const trendMatch = getCompositeFilter({ transactionType: 'DEBIT', status: { $ne: 'cancelled' } }, trendDateFilter);
        const trendData = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: trendMatch
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$paymentDate", "$createdAt"] }, timezone: "+05:30" } },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 5. College and Course Wise Breakdown within date range (aggregated directly from MongoDB cache)
        const breakdownMatch = getCompositeFilter({ transactionType: 'DEBIT', status: { $ne: 'cancelled' } });
        
        const collegeWiseAggs = hasNoAccess ? [] : await Transaction.aggregate([
            { $match: breakdownMatch },
            {
                $group: {
                    _id: "$college",
                    amount: { $sum: "$amount" }
                }
            }
        ]);

        const courseWiseAggs = hasNoAccess ? [] : await Transaction.aggregate([
            { $match: breakdownMatch },
            {
                $group: {
                    _id: "$course",
                    amount: { $sum: "$amount" }
                }
            }
        ]);

        // Resolve college code maps for chart labels
        let collegeWise = [];
        let courseWise = [];
        if (collegeWiseAggs.length > 0 || courseWiseAggs.length > 0) {
            try {
                const [collegesData] = await db.query('SELECT name, code FROM colleges');
                const collegeCodeMap = {};
                collegesData.forEach(c => {
                    if (c.name && c.code) {
                        collegeCodeMap[c.name] = c.code;
                    }
                });

                collegeWise = collegeWiseAggs.map(item => {
                    const fullName = item._id || 'Unknown';
                    return {
                        name: collegeCodeMap[fullName] || fullName,
                        fullName: fullName,
                        amount: item.amount
                    };
                });

                courseWise = courseWiseAggs.map(item => ({
                    name: item._id || 'Unknown',
                    amount: item.amount
                }));
            } catch (err) {
                console.error("Error resolving breakdown names:", err);
                collegeWise = collegeWiseAggs.map(item => ({ name: item._id || 'Unknown', amount: item.amount }));
                courseWise = courseWiseAggs.map(item => ({ name: item._id || 'Unknown', amount: item.amount }));
            }
        }

        // 6. Fee Head Wise Breakdown within date range
        const feeHeadMatch = getCompositeFilter({ transactionType: 'DEBIT' });
        const feeHeadWise = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: feeHeadMatch
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
        const userMatch = getCompositeFilter({ transactionType: 'DEBIT' });
        const rawUserWise = hasNoAccess ? [] : await Transaction.aggregate([
            {
                $match: userMatch
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
