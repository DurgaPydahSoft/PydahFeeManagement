const Transaction = require('../models/Transaction');
const User = require('../models/User');
const getEmployeeModel = require('../models/Employee');
const db = require('../config/sqlDb');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const sendReportEmail = require('../utils/sendReportEmail');
const campusService = require('./campusService');

/**
 * Fetches cashier profiles to build a lookup map resolving usernames, User ObjectIds, and full names to emp_no.
 */
const fetchCashierEmpNoMap = async () => {
    const cashierEmpNoMap = {};
    try {
        const Employee = getEmployeeModel();
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
            if (u._id) {
                cashierEmpNoMap[String(u._id).toLowerCase()] = empNo;
            }
            if (u.username) {
                cashierEmpNoMap[u.username.toLowerCase()] = empNo;
            }
            if (u.name) {
                cashierEmpNoMap[u.name.toLowerCase()] = empNo;
                const normalizedName = u.name.replace(/\s+/g, ' ').trim().toLowerCase();
                cashierEmpNoMap[normalizedName] = empNo;
            }
        });
    } catch (err) {
        console.error('[emailReportService] Failed to fetch cashier emp_no map:', err);
    }
    return cashierEmpNoMap;
};

/**
 * Compiles aggregated collection summary stats dynamically.
 * Supports custom date range filtering (startDate, endDate).
 */
const compileDailyReportData = async (startDate = null, endDate = null) => {
    let startOfPeriod;
    let endOfPeriod;

    if (startDate && endDate) {
        startOfPeriod = new Date(startDate);
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date(endDate);
        endOfPeriod.setHours(23, 59, 59, 999);
    } else if (startDate) {
        startOfPeriod = new Date(startDate);
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date(startDate);
        endOfPeriod.setHours(23, 59, 59, 999);
    } else {
        startOfPeriod = new Date();
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date();
        endOfPeriod.setHours(23, 59, 59, 999);
    }

    // 1. Fetch transactions within the specified date range (excluding cancelled ones)
    const transactions = await Transaction.find({
        status: { $ne: 'cancelled' },
        createdAt: { $gte: startOfPeriod, $lte: endOfPeriod }
    }).lean();

    // 2. Fetch cashier profiles to resolve emp_no
    const cashierEmpNoMap = await fetchCashierEmpNoMap();

    // 3. Pull student profiles to map colleges and courses
    const studentIds = new Set();
    const feeHeadIds = new Set();
    transactions.forEach(tx => {
        if (tx.studentId) studentIds.add(String(tx.studentId).trim());
        if (tx.feeHead) feeHeadIds.add(tx.feeHead.toString());
    });

    const studentInfoMap = {};
    if (studentIds.size > 0) {
        const ids = Array.from(studentIds).map(id => `'${id}'`).join(',');
        try {
            const [students] = await db.query(`SELECT admission_number, college, course FROM students WHERE admission_number IN (${ids})`);
            students.forEach(s => {
                studentInfoMap[String(s.admission_number).trim().toLowerCase()] = {
                    college: s.college || 'Unknown',
                    course: s.course || 'Unknown Course'
                };
            });
        } catch (sqlErr) {
            console.error('[emailReportService] SQL Query failed:', sqlErr);
        }
    }

    const feeHeadMap = {};
    if (feeHeadIds.size > 0) {
        try {
            const feeHeads = await mongoose.connection.collection('feeheads').find({
                _id: { $in: Array.from(feeHeadIds).map(id => new mongoose.Types.ObjectId(id)) }
            }).toArray();
            feeHeads.forEach(fh => {
                feeHeadMap[fh._id.toString()] = fh.name;
            });
        } catch (mongoErr) {
            console.error('[emailReportService] Mongo Query failed:', mongoErr);
        }
    }

    // 4. Fetch Campuses for mapping
    const collegeToCampus = {};
    try {
        const campuses = await campusService.getAllCampuses();
        campuses.forEach(campus => {
            (campus.colleges || []).forEach(college => {
                if (college?.name) {
                    collegeToCampus[String(college.name).trim().toLowerCase()] = {
                        id: campus.id,
                        name: campus.name,
                        code: campus.code
                    };
                }
            });
        });
    } catch (campusErr) {
        console.error('[emailReportService] Campus lookup failed:', campusErr);
    }

    // 5. Aggregate collections dynamically by college (with users), course, and user-wise campus
    const collegeGroups = {};
    const campusUserMap = {};
    const campusCourseMap = {};

    transactions.forEach(tx => {
        const sId = String(tx.studentId || '').trim().toLowerCase();
        const studentInfo = studentInfoMap[sId];
        const collegeName = studentInfo ? studentInfo.college : 'Unknown';
        const courseName = studentInfo ? studentInfo.course : 'Unknown Course';
        const amount = tx.amount || 0;
        const isDebit = tx.transactionType === 'DEBIT';
        const isCash = tx.paymentMode === 'Cash';
        const username = tx.collectedBy || 'Unknown';
        const displayName = tx.collectedByName || tx.collectedBy || 'Unknown';
        
        const normalizedUsername = String(username).replace(/\s+/g, ' ').trim().toLowerCase();
        const normalizedDisplayName = String(displayName).replace(/\s+/g, ' ').trim().toLowerCase();

        const empNo = cashierEmpNoMap[normalizedUsername] ||
                      cashierEmpNoMap[normalizedDisplayName] ||
                      tx.empNo ||
                      username;

        // Lookup campus info for this college
        const collegeKey = String(collegeName || '').trim().toLowerCase();
        const campusInfo = collegeToCampus[collegeKey];
        const campusName = campusInfo ? campusInfo.name : 'Unassigned Campus';
        const campusCode = campusInfo ? campusInfo.code : '';

        // College-wise aggregation
        if (!collegeGroups[collegeName]) {
            collegeGroups[collegeName] = {
                collegeName: collegeName,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0,
                usersMap: {}
            };
        }

        const colGroup = collegeGroups[collegeName];
        colGroup.receiptsCount++;

        if (!colGroup.usersMap[empNo]) {
            colGroup.usersMap[empNo] = {
                username: displayName,
                empNo,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0
            };
        }
        const userEntry = colGroup.usersMap[empNo];
        userEntry.receiptsCount += 1;

        // Campus User-wise aggregation
        if (!campusUserMap[campusName]) {
            campusUserMap[campusName] = {
                campusName,
                campusCode,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0,
                usersMap: {}
            };
        }
        const cUserGroup = campusUserMap[campusName];
        cUserGroup.receiptsCount += 1;

        if (!cUserGroup.usersMap[empNo]) {
            cUserGroup.usersMap[empNo] = {
                username: displayName,
                empNo,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0
            };
        }
        const cuEntry = cUserGroup.usersMap[empNo];
        cuEntry.receiptsCount += 1;

        if (isDebit) {
            colGroup.netTotal += amount;
            userEntry.netTotal += amount;
            cUserGroup.netTotal += amount;
            cuEntry.netTotal += amount;

            if (isCash) {
                colGroup.cashAmt += amount;
                userEntry.cashAmt += amount;
                cUserGroup.cashAmt += amount;
                cuEntry.cashAmt += amount;
            } else {
                colGroup.bankAmt += amount;
                userEntry.bankAmt += amount;
                cUserGroup.bankAmt += amount;
                cuEntry.bankAmt += amount;
            }

            // Campus Course-wise aggregation
            if (!campusCourseMap[campusName]) {
                campusCourseMap[campusName] = {
                    campusName,
                    campusCode,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0,
                    coursesMap: {}
                };
            }
            const cCourseGroup = campusCourseMap[campusName];
            cCourseGroup.netTotal += amount;
            if (isCash) cCourseGroup.cashAmt += amount;
            else cCourseGroup.bankAmt += amount;

            if (!cCourseGroup.coursesMap[courseName]) {
                cCourseGroup.coursesMap[courseName] = {
                    courseName,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0
                };
            }
            const ccEntry = cCourseGroup.coursesMap[courseName];
            ccEntry.netTotal += amount;
            if (isCash) ccEntry.cashAmt += amount;
            else ccEntry.bankAmt += amount;
        }
    });

    const collegeSummaries = Object.values(collegeGroups).map(group => {
        const users = Object.values(group.usersMap || {}).sort((a, b) => b.netTotal - a.netTotal);
        delete group.usersMap;
        return { ...group, users };
    }).sort((a, b) => b.netTotal - a.netTotal);

    // 5. Campus-wise hierarchy (campus → colleges → users)
    const campusGroups = {};
    collegeSummaries.forEach(summary => {
        const key = String(summary.collegeName || '').trim().toLowerCase();
        const campus = collegeToCampus[key];
        const campusName = campus ? campus.name : 'Unassigned Campus';
        const campusCode = campus ? campus.code : '';

        if (!campusGroups[campusName]) {
            campusGroups[campusName] = {
                campusName: campusName,
                campusCode: campusCode,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0,
                colleges: []
            };
        }
        const cg = campusGroups[campusName];
        cg.receiptsCount += summary.receiptsCount || 0;
        cg.cashAmt += summary.cashAmt || 0;
        cg.bankAmt += summary.bankAmt || 0;
        cg.netTotal += summary.netTotal || 0;
        cg.colleges.push(summary);
    });

    const campusSummaries = Object.values(campusGroups)
        .map(campus => ({
            ...campus,
            collegesCount: (campus.colleges || []).length,
            colleges: (campus.colleges || []).sort((a, b) => b.netTotal - a.netTotal)
        }))
        .sort((a, b) => b.netTotal - a.netTotal);

    const campusUserSummaries = Object.values(campusUserMap).map(cg => {
        const users = Object.values(cg.usersMap || {}).sort((a, b) => b.netTotal - a.netTotal);
        delete cg.usersMap;
        return { ...cg, users };
    }).sort((a, b) => b.netTotal - a.netTotal);

    const campusCourseSummaries = Object.values(campusCourseMap).map(cg => {
        const courses = Object.values(cg.coursesMap || {}).sort((a, b) => b.netTotal - a.netTotal);
        delete cg.coursesMap;
        return { ...cg, courses };
    }).sort((a, b) => b.netTotal - a.netTotal);

    return {
        campusSummaries,
        collegeSummaries,
        campusUserSummaries,
        campusCourseSummaries
    };
};

/**
 * Draws a clean, structured table on a PDFKit document.
 * Supports indented / muted sub-rows via row.isSubRow.
 */
const drawPdfTableFlex = (doc, startY, headers, rows, columnWidths, alignRight = []) => {
    let currentY = startY;

    // Draw Table Header background
    doc.fillColor('#f1f5f9');
    doc.rect(40, currentY, 515, 18).fill();

    // Draw Table Header labels
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8);
    let hx = 40;
    headers.forEach((h, idx) => {
        const width = columnWidths[idx];
        const align = alignRight.includes(idx) ? 'right' : 'left';
        doc.text(h, hx, currentY + 5, { width, align });
        hx += width;
    });

    doc.strokeColor('#94a3b8').lineWidth(0.8);
    doc.moveTo(40, currentY + 18).lineTo(555, currentY + 18).stroke();

    currentY += 18;

    // Draw Rows
    rows.forEach((row) => {
        // Automatic page split handling
        if (currentY > 730) {
            doc.addPage();
            currentY = 40;

            // Re-render header on the new page
            doc.fillColor('#f1f5f9').rect(40, currentY, 515, 18).fill();
            doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8);
            let tempX = 40;
            headers.forEach((h, idx) => {
                const width = columnWidths[idx];
                const align = alignRight.includes(idx) ? 'right' : 'left';
                doc.text(h, tempX, currentY + 5, { width, align });
                tempX += width;
            });
            doc.strokeColor('#94a3b8').moveTo(40, currentY + 18).lineTo(555, currentY + 18).stroke();
            currentY += 18;
        }

        const isTotal = row.isTotal === true;
        const isSubRow = row.isSubRow === true;
        const isGroup = row.isGroup === true;
        const isCampus = row.isCampus === true;
        const cells = row.cells;

        // Set font & size first before calculating text heights
        if (isTotal || isCampus || isGroup) {
            doc.font('Helvetica-Bold').fontSize(8);
        } else if (isSubRow) {
            doc.font('Helvetica').fontSize(7.5);
        } else {
            doc.font('Helvetica').fontSize(8);
        }

        // Calculate dynamic row height based on content
        let maxRowHeight = 15;
        cells.forEach((cell, cellIdx) => {
            const width = columnWidths[cellIdx];
            if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
                let padLeft = 0;
                if (isGroup && cellIdx === 1) padLeft = 8;
                if (isSubRow && cellIdx === 1) padLeft = 18;

                let effectiveWidth = width;
                if (isCampus && cellIdx === 1 && (!cells[2] || String(cells[2]).trim() === '')) {
                    effectiveWidth = columnWidths[1] + (columnWidths[2] || 0);
                }

                const h = doc.heightOfString(String(cell), { width: effectiveWidth - padLeft - 2 });
                if (h + 6 > maxRowHeight) {
                    maxRowHeight = Math.ceil(h + 6);
                }
            }
        });

        // Draw background rectangle matching exact maxRowHeight
        if (isTotal) {
            doc.fillColor('#0f172a');
            doc.strokeColor('#475569').lineWidth(0.8);
            doc.moveTo(40, currentY).lineTo(555, currentY).stroke();
        } else if (isCampus) {
            doc.fillColor('#1e3a8a');
            doc.rect(40, currentY, 515, maxRowHeight).fill();
        } else if (isGroup) {
            doc.fillColor('#f1f5f9');
            doc.rect(40, currentY, 515, maxRowHeight).fill();
        }

        // Set text color for cell drawing
        if (isCampus) {
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
        } else if (isTotal || isGroup) {
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        } else if (isSubRow) {
            doc.fillColor('#475569').font('Helvetica').fontSize(7.5);
        } else {
            doc.fillColor('#334155').font('Helvetica').fontSize(8);
        }

        let rx = 40;
        cells.forEach((cell, cellIdx) => {
            const width = columnWidths[cellIdx];
            const align = alignRight.includes(cellIdx) ? 'right' : 'left';
            let padLeft = 0;
            if (isGroup && cellIdx === 1) padLeft = 8;
            if (isSubRow && cellIdx === 1) padLeft = 18;

            let cellWidth = width;
            if (isCampus && cellIdx === 1 && (!cells[2] || String(cells[2]).trim() === '')) {
                cellWidth = columnWidths[1] + (columnWidths[2] || 0);
            }

            if (cell !== undefined && cell !== null && String(cell) !== '') {
                doc.text(String(cell), rx + padLeft, currentY + 3, {
                    width: cellWidth - padLeft - 2,
                    align: align
                });
            }
            rx += width;
        });

        // Draw light bottom border matching maxRowHeight
        if (!isTotal) {
            doc.strokeColor('#e2e8f0').lineWidth(0.5);
            doc.moveTo(40, currentY + maxRowHeight).lineTo(555, currentY + maxRowHeight).stroke();
        }

        currentY += maxRowHeight;
    });

    return currentY;
};

/**
 * Builds the Daily Abstract Report PDF and returns a buffer of the PDF file.
 */
const generateDailyReportPdfBuffer = async (data, formattedDate) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        // 1. Title Header
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a8a').text('PYDAH GROUP OF COLLEGES', 40, doc.y, { align: 'center', width: 515 });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#475569').text('CAMPUS-WISE DAILY FEE COLLECTION REPORT', 40, doc.y, { align: 'center', width: 515 });
        doc.moveDown(0.8);

        // 2. Info Row
        const generatedOnStr = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        const infoY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text(`Report Date: ${formattedDate}`, 40, infoY, { align: 'left', width: 250 });
        doc.font('Helvetica').fillColor('#64748b').text(`Generated On: ${generatedOnStr}`, 320, infoY, { align: 'right', width: 235 });
        doc.moveDown(0.5);

        // Draw separator
        doc.strokeColor('#cbd5e1').lineWidth(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);

        let currentY;

        // 3. Campus-wise abstract (summary totals only)
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('Campus-wise Consolidated Abstract', 40, doc.y, { align: 'left', width: 515 });
        doc.moveDown(0.4);

        const campusHeaders = ['S.No', 'Campus Name', 'Colleges', 'Receipts', 'Cash Amount', 'Bank Amount', 'Net Collection'];
        const campusColWidths = [30, 155, 50, 50, 70, 75, 85];
        const campusAlignRight = [2, 3, 4, 5, 6];

        let campusReceipts = 0;
        let campusCash = 0;
        let campusBank = 0;
        let campusNet = 0;
        let campusColleges = 0;

        const campusAbstractRows = (data.campusSummaries || []).map((summary, idx) => {
            campusReceipts += summary.receiptsCount;
            campusCash += summary.cashAmt;
            campusBank += summary.bankAmt;
            campusNet += summary.netTotal;
            campusColleges += summary.collegesCount || (summary.colleges || []).length || 0;

            const label = summary.campusCode
                ? `${String(summary.campusName).toUpperCase()} (${summary.campusCode})`
                : String(summary.campusName).toUpperCase();

            return {
                cells: [
                    idx + 1,
                    label,
                    summary.collegesCount || (summary.colleges || []).length || 0,
                    summary.receiptsCount,
                    `Rs. ${Number(summary.cashAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(summary.bankAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(summary.netTotal).toLocaleString('en-IN')}`
                ]
            };
        });

        campusAbstractRows.push({
            isTotal: true,
            cells: [
                '',
                'TOTAL',
                campusColleges,
                campusReceipts,
                `Rs. ${Number(campusCash).toLocaleString('en-IN')}`,
                `Rs. ${Number(campusBank).toLocaleString('en-IN')}`,
                `Rs. ${Number(campusNet).toLocaleString('en-IN')}`
            ]
        });

        currentY = drawPdfTableFlex(doc, doc.y, campusHeaders, campusAbstractRows, campusColWidths, campusAlignRight);
        doc.y = currentY + 20;

        // 4. Campus → College → User detail breakdown
        if (doc.y > 620) {
            doc.addPage();
            doc.y = 40;
        }

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('Campus-wise Detail (Campus / College / User)', 40, doc.y, { align: 'left', width: 515 });
        doc.moveDown(0.4);

        const detailHeaders = ['S.No', 'Campus / College / User', 'Receipts', 'Cash Amount', 'Bank Amount', 'Net Collection'];
        const detailColWidths = [30, 205, 50, 70, 75, 85];
        const detailAlignRight = [2, 3, 4, 5];

        let totalReceipts = 0;
        let totalCash = 0;
        let totalBank = 0;
        let totalNet = 0;
        const detailRows = [];

        (data.campusSummaries || []).forEach((campus, campusIdx) => {
            totalReceipts += campus.receiptsCount || 0;
            totalCash += campus.cashAmt || 0;
            totalBank += campus.bankAmt || 0;
            totalNet += campus.netTotal || 0;

            const campusLabel = campus.campusCode
                ? `${String(campus.campusName).toUpperCase()} (${campus.campusCode})`
                : String(campus.campusName).toUpperCase();

            detailRows.push({
                isCampus: true,
                cells: [
                    campusIdx + 1,
                    campusLabel,
                    campus.receiptsCount || 0,
                    `Rs. ${Number(campus.cashAmt || 0).toLocaleString('en-IN')}`,
                    `Rs. ${Number(campus.bankAmt || 0).toLocaleString('en-IN')}`,
                    `Rs. ${Number(campus.netTotal || 0).toLocaleString('en-IN')}`
                ]
            });

            (campus.colleges || []).forEach((college, collegeIdx) => {
                detailRows.push({
                    isGroup: true,
                    cells: [
                        `${campusIdx + 1}.${collegeIdx + 1}`,
                        String(college.collegeName).toUpperCase(),
                        college.receiptsCount || 0,
                        `Rs. ${Number(college.cashAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(college.bankAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(college.netTotal || 0).toLocaleString('en-IN')}`
                    ]
                });

                (college.users || []).forEach(user => {
                    const userLabel = user.empNo
                        ? `- ${String(user.username).toUpperCase()} (${user.empNo})`
                        : `- ${String(user.username).toUpperCase()}`;
                    detailRows.push({
                        isSubRow: true,
                        cells: [
                            '',
                            userLabel,
                            user.receiptsCount || 0,
                            `Rs. ${Number(user.cashAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(user.bankAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(user.netTotal || 0).toLocaleString('en-IN')}`
                        ]
                    });
                });
            });
        });

        detailRows.push({
            isTotal: true,
            cells: [
                '',
                'TOTAL',
                totalReceipts,
                `Rs. ${Number(totalCash).toLocaleString('en-IN')}`,
                `Rs. ${Number(totalBank).toLocaleString('en-IN')}`,
                `Rs. ${Number(totalNet).toLocaleString('en-IN')}`
            ]
        });

        currentY = drawPdfTableFlex(doc, doc.y, detailHeaders, detailRows, detailColWidths, detailAlignRight);
        doc.y = currentY + 20;

        // 5. User-wise Consolidated Collections (Campus-wise)
        if (data.campusUserSummaries && data.campusUserSummaries.length > 0) {
            if (doc.y > 600) {
                doc.addPage();
                doc.y = 40;
            }

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('User-wise Consolidated Collections (Campus-wise)', 40, doc.y, { align: 'left', width: 515 });
            doc.moveDown(0.4);

            const userHeaders = ['S.No', 'User ID', 'Cashier Name', 'Receipts', 'Cash Amount', 'Bank Amount', 'Net Collection'];
            const userColWidths = [40, 65, 175, 55, 60, 60, 60];
            const userAlignRight = [3, 4, 5, 6];

            let totalUserReceipts = 0;
            let totalUserCash = 0;
            let totalUserBank = 0;
            let totalUserNet = 0;
            const userRows = [];

            data.campusUserSummaries.forEach((campus, campusIdx) => {
                totalUserReceipts += campus.receiptsCount || 0;
                totalUserCash += campus.cashAmt || 0;
                totalUserBank += campus.bankAmt || 0;
                totalUserNet += campus.netTotal || 0;

                const campusLabel = campus.campusCode
                    ? `${String(campus.campusName).toUpperCase()} (${campus.campusCode})`
                    : String(campus.campusName).toUpperCase();

                userRows.push({
                    isCampus: true,
                    cells: [
                        campusIdx + 1,
                        campusLabel,
                        '',
                        campus.receiptsCount || 0,
                        `Rs. ${Number(campus.cashAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(campus.bankAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(campus.netTotal || 0).toLocaleString('en-IN')}`
                    ]
                });

                (campus.users || []).forEach((u, uIdx) => {
                    userRows.push({
                        isSubRow: true,
                        cells: [
                            `${campusIdx + 1}.${uIdx + 1}`,
                            u.empNo || 'N/A',
                            String(u.username).toUpperCase(),
                            u.receiptsCount || 0,
                            `Rs. ${Number(u.cashAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(u.bankAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(u.netTotal || 0).toLocaleString('en-IN')}`
                        ]
                    });
                });
            });

            userRows.push({
                isTotal: true,
                cells: [
                    '',
                    'TOTAL',
                    '',
                    totalUserReceipts,
                    `Rs. ${Number(totalUserCash).toLocaleString('en-IN')}`,
                    `Rs. ${Number(totalUserBank).toLocaleString('en-IN')}`,
                    `Rs. ${Number(totalUserNet).toLocaleString('en-IN')}`
                ]
            });

            currentY = drawPdfTableFlex(doc, doc.y, userHeaders, userRows, userColWidths, userAlignRight);
            doc.y = currentY + 20;
        }

        // 6. Course-wise Consolidated Collections Table (Campus-wise)
        if (data.campusCourseSummaries && data.campusCourseSummaries.length > 0) {
            if (doc.y > 600) {
                doc.addPage();
                doc.y = 40;
            }

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('Course-wise Consolidated Collections (Campus-wise)', 40, doc.y, { align: 'left', width: 515 });
            doc.moveDown(0.4);

            const courseHeaders = ['S.No', 'Course Name', 'Cash Amount', 'Bank Amount', 'Net Collection'];
            const courseColWidths = [40, 225, 80, 80, 90];
            const courseAlignRight = [2, 3, 4];

            let totalCourseCash = 0;
            let totalCourseBank = 0;
            let totalCourseNet = 0;
            const courseRows = [];

            data.campusCourseSummaries.forEach((campus, campusIdx) => {
                totalCourseCash += campus.cashAmt || 0;
                totalCourseBank += campus.bankAmt || 0;
                totalCourseNet += campus.netTotal || 0;

                const campusLabel = campus.campusCode
                    ? `${String(campus.campusName).toUpperCase()} (${campus.campusCode})`
                    : String(campus.campusName).toUpperCase();

                courseRows.push({
                    isCampus: true,
                    cells: [
                        campusIdx + 1,
                        campusLabel,
                        `Rs. ${Number(campus.cashAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(campus.bankAmt || 0).toLocaleString('en-IN')}`,
                        `Rs. ${Number(campus.netTotal || 0).toLocaleString('en-IN')}`
                    ]
                });

                (campus.courses || []).forEach((c, cIdx) => {
                    courseRows.push({
                        isSubRow: true,
                        cells: [
                            `${campusIdx + 1}.${cIdx + 1}`,
                            String(c.courseName).toUpperCase(),
                            `Rs. ${Number(c.cashAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(c.bankAmt || 0).toLocaleString('en-IN')}`,
                            `Rs. ${Number(c.netTotal || 0).toLocaleString('en-IN')}`
                        ]
                    });
                });
            });

            courseRows.push({
                isTotal: true,
                cells: [
                    '',
                    'TOTAL',
                    `Rs. ${Number(totalCourseCash).toLocaleString('en-IN')}`,
                    `Rs. ${Number(totalCourseBank).toLocaleString('en-IN')}`,
                    `Rs. ${Number(totalCourseNet).toLocaleString('en-IN')}`
                ]
            });

            currentY = drawPdfTableFlex(doc, doc.y, courseHeaders, courseRows, courseColWidths, courseAlignRight);
            doc.y = currentY + 35;
        }

        // 6. Signatures
        if (doc.y > 680) {
            doc.addPage();
            doc.y = 50;
        }

        const sigY = doc.y;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.strokeColor('#000000').lineWidth(0.8);

        doc.moveTo(80, sigY).lineTo(200, sigY).stroke();
        doc.text('Accountant', 80, sigY + 5, { width: 120, align: 'center' });

        doc.moveTo(350, sigY).lineTo(470, sigY).stroke();
        doc.text('Principal / Director', 350, sigY + 5, { width: 120, align: 'center' });

        doc.end();
    });
};

/**
 * Core entry point called by the scheduler to aggregate details,
 * build the PDF report, and dispatch it to multiple recipients.
 *
 * @param {string} recipients - Comma-separated list of emails
 */
const sendDailyAllCollegesReportEmail = async (recipients, startDate = null, endDate = null) => {
    try {
        console.log('[emailReportService] Aggregating daily collections report data for period:', startDate, 'to', endDate);
        const data = await compileDailyReportData(startDate, endDate);

        const formatDateStr = (dateVal) => {
            const d = new Date(dateVal);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        };

        let formattedDate;
        if (startDate && endDate && startDate !== endDate) {
            formattedDate = `${formatDateStr(startDate)} to ${formatDateStr(endDate)}`;
        } else if (startDate) {
            formattedDate = formatDateStr(startDate);
        } else {
            formattedDate = formatDateStr(new Date());
        }

        console.log('[emailReportService] Generating report PDF document for:', formattedDate);
        const pdfBuffer = await generateDailyReportPdfBuffer(data, formattedDate);

        // Convert the generated PDF buffer to base64 attachment format for Brevo transactional email
        const base64Content = pdfBuffer.toString('base64');
        const safeFileDate = formattedDate.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Campus_Wise_Collection_Report_${safeFileDate}.pdf`;

        const emailOptions = {
            email: recipients,
            subject: `Fee Collection Report - Campus Wise (${formattedDate})`,
            message: `Please find attached the Campus-wise Fee Collection Report for ${formattedDate}.\n\nThis is an automated system-generated report.`,
            attachments: [
                {
                    content: base64Content,
                    name: filename
                }
            ]
        };

        console.log('[emailReportService] Sending report email with attachment...');
        await sendReportEmail(emailOptions);
        console.log('[emailReportService] Daily report email completed successfully.');
    } catch (error) {
        console.error('[emailReportService] Error generating and sending daily report:', error);
        throw error;
    }
};

module.exports = {
    compileDailyReportData,
    sendDailyAllCollegesReportEmail
};
