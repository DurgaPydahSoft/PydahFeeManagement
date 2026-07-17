const Transaction = require('../models/Transaction');
const db = require('../config/sqlDb');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const sendReportEmail = require('../utils/sendReportEmail');

/**
 * Compiles aggregated collection summary stats dynamically.
 */
const compileDailyReportData = async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Fetch today's transactions (excluding cancelled ones)
    const transactions = await Transaction.find({
        status: { $ne: 'cancelled' },
        createdAt: { $gte: startOfToday, $lte: endOfToday }
    }).lean();

    // 2. Pull student profiles to map colleges and courses
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

    // 3. Aggregate collections dynamically by college and course
    const collegeGroups = {};
    const globalCourseGroups = {};

    transactions.forEach(tx => {
        const sId = String(tx.studentId || '').trim().toLowerCase();
        const studentInfo = studentInfoMap[sId];
        const collegeName = studentInfo ? studentInfo.college : 'Unknown';
        const courseName = studentInfo ? studentInfo.course : 'Unknown Course';
        const amount = tx.amount || 0;
        const isDebit = tx.transactionType === 'DEBIT';
        const isCash = tx.paymentMode === 'Cash';

        // College-wise aggregation
        if (!collegeGroups[collegeName]) {
            collegeGroups[collegeName] = {
                collegeName: collegeName,
                receiptsCount: 0,
                cashAmt: 0,
                bankAmt: 0,
                netTotal: 0
            };
        }

        const colGroup = collegeGroups[collegeName];
        colGroup.receiptsCount++;

        if (isDebit) {
            colGroup.netTotal += amount;
            if (isCash) {
                colGroup.cashAmt += amount;
            } else {
                colGroup.bankAmt += amount;
            }

            // Global Course-wise aggregation
            if (!globalCourseGroups[courseName]) {
                globalCourseGroups[courseName] = {
                    courseName: courseName,
                    cashAmt: 0,
                    bankAmt: 0,
                    netTotal: 0
                };
            }
            const cGroup = globalCourseGroups[courseName];
            cGroup.netTotal += amount;
            if (isCash) {
                cGroup.cashAmt += amount;
            } else {
                cGroup.bankAmt += amount;
            }
        }
    });

    return {
        collegeSummaries: Object.values(collegeGroups),
        globalCourses: Object.values(globalCourseGroups).sort((a, b) => b.netTotal - a.netTotal)
    };
};

/**
 * Draws a clean, structured table on a PDFKit document.
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
        const cells = row.cells;

        if (isTotal) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
            doc.strokeColor('#475569').lineWidth(0.8);
            doc.moveTo(40, currentY).lineTo(555, currentY).stroke();
        } else {
            doc.font('Helvetica').fontSize(8).fillColor('#334155');
        }

        let rx = 40;
        cells.forEach((cell, cellIdx) => {
            const width = columnWidths[cellIdx];
            const align = alignRight.includes(cellIdx) ? 'right' : 'left';
            doc.text(String(cell ?? ''), rx, currentY + 4, { width, align });
            rx += width;
        });

        // Draw light bottom border
        doc.strokeColor('#e2e8f0').lineWidth(0.5);
        doc.moveTo(40, currentY + 15).lineTo(555, currentY + 15).stroke();
        currentY += 15;
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
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#475569').text('ALL COLLEGES DAILY FEE COLLECTION REPORT', 40, doc.y, { align: 'center', width: 515 });
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

        // 3. College-wise abstract table
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('College-wise Consolidated Collections', 40, doc.y, { align: 'left', width: 515 });
        doc.moveDown(0.4);

        const collegeHeaders = ['S.No', 'College Name', 'Receipts', 'Cash Amount', 'Bank Amount', 'Net Collection'];
        const collegeColWidths = [30, 205, 50, 70, 75, 85];
        const collegeAlignRight = [2, 3, 4, 5];

        let totalReceipts = 0;
        let totalCash = 0;
        let totalBank = 0;
        let totalNet = 0;

        const collegeRows = data.collegeSummaries.map((summary, idx) => {
            totalReceipts += summary.receiptsCount;
            totalCash += summary.cashAmt;
            totalBank += summary.bankAmt;
            totalNet += summary.netTotal;

            return {
                cells: [
                    idx + 1,
                    String(summary.collegeName).toUpperCase(),
                    summary.receiptsCount,
                    `Rs. ${Number(summary.cashAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(summary.bankAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(summary.netTotal).toLocaleString('en-IN')}`
                ]
            };
        });

        // Add overall total row
        collegeRows.push({
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

        let currentY = drawPdfTableFlex(doc, doc.y, collegeHeaders, collegeRows, collegeColWidths, collegeAlignRight);
        doc.y = currentY + 20;

        // 4. Course-wise Consolidated Collections Table (Flat list of courses)
        if (doc.y > 600) {
            doc.addPage();
            doc.y = 40;
        }

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text('Course-wise Consolidated Collections', 40, doc.y, { align: 'left', width: 515 });
        doc.moveDown(0.4);

        const courseHeaders = ['S.No', 'Course Name', 'Cash Amount', 'Bank Amount', 'Net Collection'];
        const courseColWidths = [40, 225, 80, 80, 90];
        const courseAlignRight = [2, 3, 4];

        let totalCourseCash = 0;
        let totalCourseBank = 0;
        let totalCourseNet = 0;

        const courseRows = data.globalCourses.map((c, idx) => {
            totalCourseCash += c.cashAmt;
            totalCourseBank += c.bankAmt;
            totalCourseNet += c.netTotal;

            return {
                cells: [
                    idx + 1,
                    String(c.courseName).toUpperCase(),
                    `Rs. ${Number(c.cashAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(c.bankAmt).toLocaleString('en-IN')}`,
                    `Rs. ${Number(c.netTotal).toLocaleString('en-IN')}`
                ]
            };
        });

        // Add overall totals row
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

        // 5. Signatures
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
const sendDailyAllCollegesReportEmail = async (recipients) => {
    try {
        console.log('[emailReportService] Aggregating daily collections report data...');
        const data = await compileDailyReportData();

        const formattedDate = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '-');

        console.log('[emailReportService] Generating report PDF document...');
        const pdfBuffer = await generateDailyReportPdfBuffer(data, formattedDate);

        // Convert the generated PDF buffer to base64 attachment format for Brevo transactional email
        const base64Content = pdfBuffer.toString('base64');
        const filename = `All_Colleges_Daily_Report_${formattedDate}.pdf`;

        const emailOptions = {
            email: recipients,
            subject: `Daily Collection Report - All Colleges - ${formattedDate}`,
            message: `Please find attached the All Colleges Daily Collection Report for ${formattedDate}.\n\nThis is an automated system-generated report.`,
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
    }
};

module.exports = {
    compileDailyReportData,
    sendDailyAllCollegesReportEmail
};
