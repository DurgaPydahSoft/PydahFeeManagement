const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const dotenv = require('dotenv');
const readline = require('readline');
const ExcelJS = require('exceljs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const db = require('../config/sqlDb');
const FeeHead = require('../models/FeeHead');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
};

// Helper to normalize strings for comparison
const normalizeStr = (val) => {
  if (!val) return '';
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

// Helper to map narration to fee head(s)
const mapNarrationToFeeHeads = (narrationStr, feeHeads) => {
  if (!narrationStr) return [];
  const str = narrationStr.toUpperCase().replace(/\s+/g, ' ').trim();
  const matched = [];
  
  // 1. Tuition Fee (TUI01)
  if (str.includes('TUT FEE') || str.includes('TUT_FEE') || str.includes('TUI') || str.includes('TUITION') || str.includes('TUT') || str.includes('TUTION')) {
    const fh = feeHeads.find(f => f.code === 'TUI01' || f.name.toUpperCase().includes('TUITION'));
    if (fh) matched.push(fh);
  }
  
  // 2. Transport Fee (TRN01)
  if (str.includes('BUS FEE') || str.includes('BUS_FEE') || str.includes('BUS') || str.includes('TRANSPORT') || str.includes('TRN')) {
    const fh = feeHeads.find(f => f.code === 'TRN01' || f.name.toUpperCase().includes('TRANSPORT'));
    if (fh) matched.push(fh);
  }
  
  // 3. Duplicate Hall Ticket (D H FEE, code: DUP001)
  if (str.includes('DUPLICATE HALL TICKET') || str.includes('HALL TICKET') || str.includes('HALL_TICKET') || str.includes('D H FEE') || str.includes('DH FEE') || str.includes('DUP001') || str.includes('DUP HT') || str.includes('DUP_HT') || str.includes('DUP.HT')) {
    const fh = feeHeads.find(f => f.code === 'DUP001' || f.name.toUpperCase().includes('D H FEE') || f.name.toUpperCase().includes('HALL TICKET'));
    if (fh) matched.push(fh);
  }
  
  // 4. Certificate Fee (TC & STUDY, TC, STUDY, code: CER001)
  if (str.includes('TC & STUDY') || str.includes('TC') || str.includes('STUDY') || str.includes('CERTIFICATE') || str.includes('BONIFIED') || str.includes('MIGRATION') || str.includes('CER001')) {
    const fh = feeHeads.find(f => f.code === 'CER001' || f.name.toUpperCase().includes('CERTIFICATE'));
    if (fh) matched.push(fh);
  }
  
  // 5. SCH Fee (SCH01)
  if (str.includes('SCH FEE') || str.includes('SCH_FEE') || str.includes('SCH01') || str.includes('SCH')) {
    const fh = feeHeads.find(f => f.code === 'SCH01' || f.name.toUpperCase().includes('SCH FEE') || f.name.toUpperCase() === 'SCH');
    if (fh) matched.push(fh);
  }
  
  // 6. Late Fee (LATE FEE, code: LAT01)
  if (str.includes('LATE FEE') || str.includes('LATE_FEE') || str.includes('LATE') || str.includes('LAT01')) {
    const fh = feeHeads.find(f => f.code === 'LAT01' || f.name.toUpperCase().includes('LATE FEE'));
    if (fh) matched.push(fh);
  }
  
  // 7. Hostel Fee (HST01)
  if (str.includes('HOSTEL FEE') || str.includes('HOSTEL_FEE') || str.includes('HOSTEL') || str.includes('HST01') || str.includes('MESS')) {
    const fh = feeHeads.find(f => f.code === 'HST01' || f.name.toUpperCase().includes('HOSTEL'));
    if (fh) matched.push(fh);
  }
  
  // 8. Exam Fee (EXM01)
  if (str.includes('EXAM FEE') || str.includes('EXAM_FEE') || str.includes('EXAM') || str.includes('EXM01')) {
    const fh = feeHeads.find(f => f.code === 'EXM01' || f.name.toUpperCase().includes('EXAM'));
    if (fh) matched.push(fh);
  }
  
  // 9. Application Fee (APPL01)
  if (str.includes('APPLICATION FEE') || str.includes('APPLICATION_FEE') || str.includes('APPL') || str.includes('APPL01')) {
    const fh = feeHeads.find(f => f.code === 'APPL01' || f.name.toUpperCase().includes('APPLICATION'));
    if (fh) matched.push(fh);
  }
  
  // 10. Lab Breakage Fee (LAB02)
  if (str.includes('LAB BREAKAGE') || str.includes('BREAKAGE') || str.includes('LAB02')) {
    const fh = feeHeads.find(f => f.code === 'LAB02' || f.name.toUpperCase().includes('BREAKAGE'));
    if (fh) matched.push(fh);
  }
  
  // 11. Laboratory Fee (LAB01)
  if (str.includes('LAB FEE') || str.includes('LAB_FEE') || str.includes('LAB') || str.includes('LABORATORY') || str.includes('LAB01')) {
    const fh = feeHeads.find(f => f.code === 'LAB01' || f.name.toUpperCase() === 'LABORATORY FEE' || f.name.toUpperCase() === 'LABORATORY');
    if (fh && !matched.some(m => String(m._id) === String(fh._id))) matched.push(fh);
  }
  
  // 12. Hostel Power Bill (P001)
  if (str.includes('POWER BILL') || str.includes('POWER_BILL') || str.includes('ELECTRICITY') || str.includes('P001')) {
    const fh = feeHeads.find(f => f.code === 'P001' || f.name.toUpperCase().includes('POWER'));
    if (fh) matched.push(fh);
  }
  
  // 13. CRT Fee (C001)
  if (str.includes('CRT FEE') || str.includes('CRT_FEE') || str.includes('CRT') || str.includes('C001')) {
    const fh = feeHeads.find(f => f.code === 'C001' || f.name.toUpperCase().includes('CRT'));
    if (fh) matched.push(fh);
  }
  
  // 14. Club Fee (CF)
  if (str.includes('CLUB FEE') || str.includes('CLUB_FEE') || str.includes('CLUB') || str.includes('CF')) {
    const fh = feeHeads.find(f => f.code === 'CF' || f.name.toUpperCase().includes('CLUB'));
    if (fh) matched.push(fh);
  }

  // 15. Student Services Fee (SSF)
  if (str.includes('STUDENT SERVICES') || str.includes('STUDENT_SERVICES') || str.includes('SSF') || str.includes('PC&CMM') || str.includes('PC & CMM') || str.includes('CMM') || str.includes('PCANDCMM')) {
    const fh = feeHeads.find(f => f.code === 'SSF' || f.name.toUpperCase().includes('STUDENT SERVICES'));
    if (fh) matched.push(fh);
  }

  // 16. Internship Fee (INT001)
  if (str.includes('INTERNSHIP') || str.includes('INT001')) {
    const fh = feeHeads.find(f => f.code === 'INT001' || f.name.toUpperCase().includes('INTERNSHIP'));
    if (fh) matched.push(fh);
  }

  // 17. Condonation Fee (CON001)
  if (str.includes('CONDONATION') || str.includes('CON001')) {
    const fh = feeHeads.find(f => f.code === 'CON001' || f.name.toUpperCase().includes('CONDONATION'));
    if (fh) matched.push(fh);
  }

  // 18. Processing Fee (PRO001)
  if (str.includes('PROCESSING') || str.includes('PRO001')) {
    const fh = feeHeads.find(f => f.code === 'PRO001' || f.name.toUpperCase().includes('PROCESSING'));
    if (fh) matched.push(fh);
  }

  // 19. Project Fee (PRJ001)
  if (str.includes('PROJECT') || str.includes('PRJ001')) {
    const fh = feeHeads.find(f => f.code === 'PRJ001' || f.name.toUpperCase().includes('PROJECT'));
    if (fh) matched.push(fh);
  }

  // 20. BUS/HOSTEL/OTHERS (OTH1)
  if (str.includes('BUS/HOSTEL/OTHERS') || str.includes('OTH1') || str.includes('UTF')) {
    const fh = feeHeads.find(f => f.code === 'OTH1' || f.name.toUpperCase().includes('HOSTEL/OTHERS') || f.name.toUpperCase() === 'BUS/HOSTEL/OTHERS');
    if (fh) matched.push(fh);
  }

  if (matched.length === 0) {
    const exactCodeMatch = feeHeads.find(f => f.code && f.code.toUpperCase() === str);
    if (exactCodeMatch) matched.push(exactCodeMatch);
    
    if (matched.length === 0) {
      const nameMatch = feeHeads.find(f => str.includes(f.name.toUpperCase()) || f.name.toUpperCase().includes(str));
      if (nameMatch) matched.push(nameMatch);
    }
  }

  // Deduplicate matched fee heads
  const uniqueMatched = [];
  const matchedIds = new Set();
  matched.forEach(fh => {
    if (!matchedIds.has(String(fh._id))) {
      matchedIds.add(String(fh._id));
      uniqueMatched.push(fh);
    }
  });

  return uniqueMatched;
};

// Helper to parse Excel dates (handles serial numbers, Date objects, and strings, forcing month to July (7))
const parseExcelDate = (val) => {
  if (val === undefined || val === null || val === '') return '';
  
  let dateObj = null;

  if (val instanceof Date) {
    dateObj = val;
  } else {
    const num = Number(val);
    if (!Number.isNaN(num) && num > 30000 && num < 60000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      dateObj = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    }
  }

  if (dateObj) {
    const d = dateObj.getUTCDate ? dateObj.getUTCDate() : dateObj.getDate();
    // Enforce July (month = 7)
    const m = 7;
    const y = dateObj.getUTCFullYear ? dateObj.getUTCFullYear() : dateObj.getFullYear();
    return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
  }

  // Handle string dates (e.g. DD/MM/YYYY, MM/DD/YYYY, or with dashes)
  let str = String(val).trim();
  if (str) {
    str = str.replace(/[-.]/g, '/'); // replace dashes or dots with slashes
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const part1 = Number(match[1]);
      const part2 = Number(match[2]);
      let y = Number(match[3]);
      if (y < 100) y = 2000 + y; // 2-digit year conversion
      
      let d = 1;
      let m = 7; // Enforce July
      
      // Since we know the month is July (7):
      // - If part1 is 7 and part2 !== 7, then part2 is the day.
      // - If part2 is 7 and part1 !== 7, then part1 is the day.
      // - If both are <= 12 and neither is 7, or if they are ambiguous, force month to 7.
      // - If one is > 12, that one must be the day, and the other is forced to 7.
      if (part1 === 7 && part2 !== 7) {
        d = part2;
      } else if (part2 === 7 && part1 !== 7) {
        d = part1;
      } else if (part1 > 12) {
        d = part1;
      } else if (part2 > 12) {
        d = part2;
      } else {
        // Ambiguous or neither is 7. Default first part to day and force month to 7.
        d = part1;
      }
      return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
    }

    // Match YYYY/MM/DD
    const matchYMD = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (matchYMD) {
      const y = Number(matchYMD[1]);
      const part3 = Number(matchYMD[3]);
      const d = part3;
      const m = 7; // Enforce July
      return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
    }
  }

  return str;
};

// Helper to check if value is numeric/valid
const getNumeric = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const num = Number(val);
  return Number.isNaN(num) ? 0 : num;
};

const openFileDialog = () => {
  console.log("Opening file dialog... Please select your EZ file.");
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms;
    $dialog = New-Object System.Windows.Forms.OpenFileDialog;
    $dialog.Filter = 'Excel Files (*.xlsx;*.xls)|*.xlsx;*.xls';
    $dialog.Title = 'Select EZ File for Transaction Reconciliation';
    $res = $dialog.ShowDialog();
    if ($res -eq 'OK') { Write-Output $dialog.FileName }
  `;
  try {
    const { execSync } = require('child_process');
    const stdout = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    return stdout.trim();
  } catch (err) {
    console.error("Failed to open file dialog via PowerShell:", err.message);
    return null;
  }
};

const generateExcelReport = async (filePath, summaryTotalStudents, summaryMismatchedCount, filteredExcelRows, groupedExcelTransactions, studentsReport, unresolvedStudents, savePath) => {
  const workbook = new ExcelJS.Workbook();
  
  // Define styles
  const titleStyle = {
    font: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }, // Dark Blue
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  
  const headerStyle = {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } }, // Medium Blue
    alignment: { horizontal: 'left', vertical: 'middle' }
  };

  const studentHeaderStyle = {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F497D' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }, // Soft Blue
    border: {
      top: { style: 'thin', color: { argb: 'FFB8CCE4' } },
      bottom: { style: 'thin', color: { argb: 'FFB8CCE4' } }
    }
  };

  const excelHeaderStyle = {
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF375623' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }, // Soft Green
    border: { bottom: { style: 'thin', color: { argb: 'FFC6E0B4' } } }
  };

  const mongoHeaderStyle = {
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF3F3F3F' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }, // Soft Gray
    border: { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } }
  };

  const boldLabelStyle = {
    font: { name: 'Calibri', size: 11, bold: true }
  };

  const greenText = { font: { name: 'Calibri', size: 10, color: { argb: 'FF375623' }, bold: true } };
  const redText = { font: { name: 'Calibri', size: 10, color: { argb: 'FFC00000' }, bold: true } };

  // 1. Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: true }] });
  
  // Title
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'RECONCILIATION SUMMARY REPORT';
  titleCell.style = titleStyle;
  summarySheet.getRow(1).height = 40;

  // Metadata
  summarySheet.addRow([]);
  summarySheet.addRow(['Generated At:', new Date().toLocaleString()]);
  summarySheet.addRow(['Input EZ File:', filePath]);
  summarySheet.addRow(['Total EZ Rows Processed:', filteredExcelRows.length]);
  summarySheet.addRow(['Total Students Processed:', summaryTotalStudents]);
  summarySheet.addRow(['Matched Students (Total Match):', summaryTotalStudents - summaryMismatchedCount]);
  summarySheet.addRow(['Mismatched Students:', summaryMismatchedCount]);
  
  // Format metadata labels as bold
  for (let r = 3; r <= 8; r++) {
    summarySheet.getCell(`A${r}`).style = boldLabelStyle;
  }

  summarySheet.addRow([]);
  summarySheet.addRow([]);

  // Unresolved Students Section Header
  const unresRow = summarySheet.addRow(['UNRESOLVED STUDENTS (NOT FOUND IN SQL DATABASE)']);
  summarySheet.mergeCells(`A${unresRow.number}:D${unresRow.number}`);
  summarySheet.getCell(`A${unresRow.number}`).style = headerStyle;
  unresRow.height = 25;

  const headerRow = summarySheet.addRow(['Student ID / Admission No', 'Student Name in EZ', '', '']);
  summarySheet.mergeCells(`B${headerRow.number}:D${headerRow.number}`);
  headerRow.font = { bold: true };
  headerRow.border = { bottom: { style: 'medium' } };

  if (unresolvedStudents.length === 0) {
    const emptyRow = summarySheet.addRow(['All students were successfully resolved in SQL.']);
    summarySheet.mergeCells(`A${emptyRow.number}:D${emptyRow.number}`);
  } else {
    unresolvedStudents.forEach(s => {
      const row = summarySheet.addRow([s.admissionNumber, s.studentName]);
      summarySheet.mergeCells(`B${row.number}:D${row.number}`);
    });
  }

  // Column width auto-fit for Summary sheet
  summarySheet.columns.forEach(col => {
    let maxLen = 0;
    col.eachCell({ includeEmpty: false }, cell => {
      const val = cell.value ? String(cell.value) : '';
      if (val.length > maxLen) maxLen = val.length;
    });
    col.width = Math.max(maxLen + 4, 12);
  });
  summarySheet.getColumn(1).width = 30; // Custom width for labels/ids
  summarySheet.getColumn(2).width = 40; // Custom width for names

  // Helper to build student details sheet
  const buildStudentSheet = (sheetName, studentsList) => {
    const ws = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
    
    studentsList.forEach(s => {
      // 1. Student Details row
      const detailsRow = ws.addRow([
        `STUDENT: ${s.studentName} (Admission: ${s.admissionNumber} | PIN: ${s.pinNo || 'N/A'})`,
        '', '', '', '', 
        `College: ${s.college} | Course: ${s.course} | Branch: ${s.branch}`,
        '', 
        `EZ Total: Rs. ${s.excelTotal}`,
        `New software transaction Total: Rs. ${s.mongoTotal}`
      ]);
      ws.mergeCells(`A${detailsRow.number}:E${detailsRow.number}`);
      ws.mergeCells(`F${detailsRow.number}:G${detailsRow.number}`);
      
      // Apply student header style across all cells of the row
      for (let c = 1; c <= 9; c++) {
        detailsRow.getCell(c).style = studentHeaderStyle;
      }
      detailsRow.height = 30;

      // 2. EZ Transactions Section Header
      const excelHeader = ws.addRow([
        'EZ TRANSACTIONS', 'Row Index', 'Date', 'Amount', 'Narration', 'Pay Mode', 'Reconciliation Status'
      ]);
      for (let c = 1; c <= 7; c++) {
        excelHeader.getCell(c).style = excelHeaderStyle;
      }
      excelHeader.height = 20;

      // 3. EZ Transactions Rows
      if (s.excelTransactions.length === 0) {
        const emptyRow = ws.addRow(['(No transactions found in EZ)']);
        ws.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
      } else {
        s.excelTransactions.forEach(t => {
          const statusText = t.status === 'matched' ? 'MATCHED' : 'MISSING IN NEW SOFTWARE';
          const row = ws.addRow([
            '', 
            t.excelRow ? `Row ${t.excelRow}` : 'N/A', 
            t.date || 'N/A', 
            t.amount, 
            t.narration, 
            t.payMode, 
            statusText
          ]);
          row.getCell(7).style = t.status === 'matched' ? greenText : redText;
        });
      }

      // 4. NEW SOFTWARE Transactions Section Header
      const mongoHeader = ws.addRow([
        'NEW SOFTWARE TRANSACTIONS', 'Receipt No', 'Date', 'Amount', 'Fee Head', 'Pay Mode', 'Reconciliation Status', 'Collected By'
      ]);
      for (let c = 1; c <= 8; c++) {
        mongoHeader.getCell(c).style = mongoHeaderStyle;
      }
      mongoHeader.height = 20;

      // 5. NEW SOFTWARE Transactions Rows
      const matchedMongo = s.excelTransactions.filter(t => t.status === 'matched').map(t => t.matchedWith);
      const unmatchedMongo = s.missingInExcelTransactions;
      
      // Make sure we carry status over
      const allMongo = [
        ...matchedMongo.map(m => ({ ...m, status: 'matched' })), 
        ...unmatchedMongo.map(m => ({ ...m, status: 'missing_in_excel' }))
      ];

      if (allMongo.length === 0) {
        const emptyRow = ws.addRow(['(No transactions found in New software transactions)']);
        ws.mergeCells(`A${emptyRow.number}:H${emptyRow.number}`);
      } else {
        allMongo.forEach(t => {
          const dateStr = t.paymentDate ? new Date(t.paymentDate).toLocaleDateString('en-IN') : 'N/A';
          const statusText = t.status === 'matched' ? 'MATCHED' : 'MISSING IN EZ';
          const collectorStr = t.collectedByName || t.collectedBy || 'Unknown';
          const row = ws.addRow([
            '', 
            t.receiptNumber || 'N/A', 
            dateStr, 
            t.amount, 
            t.feeHead || 'Unknown', 
            t.paymentMode || 'Cash', 
            statusText,
            collectorStr
          ]);
          row.getCell(7).style = t.status === 'matched' ? greenText : redText;
        });
      }

      // Divider space between students
      ws.addRow([]);
      ws.addRow([]);
    });

    // Auto-fit column widths
    ws.columns.forEach(col => {
      let maxLen = 0;
    });
    ws.getColumn(1).width = 25; // Header title column
    ws.getColumn(2).width = 14; // B: Row Index / Receipt No column
    ws.getColumn(3).width = 12; // C: Date column
    ws.getColumn(4).width = 10; // D: Amount column
    ws.getColumn(5).width = 22; // E: Narration / Fee Head column
    ws.getColumn(8).width = 25; // Collected By column
  };

  // Helper to build date-wise breakdown sheet
  const buildDateSheet = (sheetName, studentsList) => {
    const ws = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
    
    // 1. Gather all unique dates from all transactions
    const dateMap = {}; // { 'DD/MM/YYYY': [ { student, excelTxns, mongoTxns } ] }
    
    studentsList.forEach(s => {
      const studentDates = new Set();
      s.excelTransactions.forEach(t => {
        if (t.date) studentDates.add(t.date);
      });
      
      const matchedMongo = s.excelTransactions.filter(t => t.status === 'matched').map(t => t.matchedWith);
      const unmatchedMongo = s.missingInExcelTransactions;
      const allMongo = [
        ...matchedMongo.map(m => ({ ...m, status: 'matched' })),
        ...unmatchedMongo.map(m => ({ ...m, status: 'missing_in_excel' }))
      ];
      
      studentDates.forEach(date => {
        const excelTxnsOnDate = s.excelTransactions.filter(t => t.date === date);
        
        if (excelTxnsOnDate.length > 0) {
          if (!dateMap[date]) {
            dateMap[date] = [];
          }
          dateMap[date].push({
            student: s,
            excelTxns: excelTxnsOnDate,
            mongoTxns: allMongo
          });
        }
      });
    });
    
    // Sort dates chronologically
    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      const aParts = a.split('/');
      const bParts = b.split('/');
      const aDate = new Date(aParts[2], aParts[1] - 1, aParts[0]);
      const bDate = new Date(bParts[2], bParts[1] - 1, bParts[0]);
      return aDate - bDate;
    });
    
    // Render each date group
    sortedDates.forEach(date => {
      // Date Header Row
      const dateHeaderRow = ws.addRow([`DATE: ${date}`, '', '', '', '', '', '', '', '']);
      ws.mergeCells(`A${dateHeaderRow.number}:I${dateHeaderRow.number}`);
      dateHeaderRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      dateHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }; // Dark Blue
      dateHeaderRow.alignment = { horizontal: 'left', vertical: 'middle' };
      dateHeaderRow.height = 25;
      
      const records = dateMap[date].sort((a, b) => {
        return String(a.student.studentName).localeCompare(b.student.studentName);
      });
      
      records.forEach(r => {
        const s = r.student;
        const excelTotalOnDate = r.excelTxns.reduce((acc, t) => acc + t.amount, 0);
        const mongoTotal = r.mongoTxns.reduce((acc, t) => acc + t.amount, 0);
        
        // Student Row
        const detailsRow = ws.addRow([
          `STUDENT: ${s.studentName} (Admission: ${s.admissionNumber} | PIN: ${s.pinNo || 'N/A'})`,
          '', '', '', '', 
          `College: ${s.college} | Course: ${s.course} | Branch: ${s.branch}`,
          '', 
          `EZ Date Total: Rs. ${excelTotalOnDate}`,
          `New software Total: Rs. ${mongoTotal}`
        ]);
        ws.mergeCells(`A${detailsRow.number}:E${detailsRow.number}`);
        ws.mergeCells(`F${detailsRow.number}:G${detailsRow.number}`);
        
        for (let c = 1; c <= 9; c++) {
          detailsRow.getCell(c).style = studentHeaderStyle;
        }
        detailsRow.height = 30;
        
        // EZ Transactions Section Header
        const excelHeader = ws.addRow([
          'EZ TRANSACTIONS', 'Row Index', 'Date', 'Amount', 'Narration', 'Pay Mode', 'Reconciliation Status'
        ]);
        for (let c = 1; c <= 7; c++) {
          excelHeader.getCell(c).style = excelHeaderStyle;
        }
        excelHeader.height = 20;
        
        // EZ Transactions Rows
        if (r.excelTxns.length === 0) {
          const emptyRow = ws.addRow(['(No transactions found in EZ on this date)']);
          ws.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
        } else {
          r.excelTxns.forEach(t => {
            const statusText = t.status === 'matched' ? 'MATCHED' : 'MISSING IN NEW SOFTWARE';
            const row = ws.addRow([
              '', 
              t.excelRow ? `Row ${t.excelRow}` : 'N/A', 
              t.date || 'N/A', 
              t.amount, 
              t.narration, 
              t.payMode, 
              statusText
            ]);
            row.getCell(7).style = t.status === 'matched' ? greenText : redText;
          });
        }
        
        // NEW SOFTWARE Transactions Section Header
        const mongoHeader = ws.addRow([
          'NEW SOFTWARE TRANSACTIONS', 'Receipt No', 'Date', 'Amount', 'Fee Head', 'Pay Mode', 'Reconciliation Status', 'Collected By'
        ]);
        for (let c = 1; c <= 8; c++) {
          mongoHeader.getCell(c).style = mongoHeaderStyle;
        }
        mongoHeader.height = 20;
        
        // NEW SOFTWARE Transactions Rows
        if (r.mongoTxns.length === 0) {
          const emptyRow = ws.addRow(['(No transactions found in New software transactions)']);
          ws.mergeCells(`A${emptyRow.number}:H${emptyRow.number}`);
        } else {
          r.mongoTxns.forEach(t => {
            const dateStr = t.paymentDate ? new Date(t.paymentDate).toLocaleDateString('en-IN') : 'N/A';
            const statusText = t.status === 'matched' ? 'MATCHED' : 'MISSING IN EZ';
            const collectorStr = t.collectedByName || t.collectedBy || 'Unknown';
            const row = ws.addRow([
              '', 
              t.receiptNumber || 'N/A', 
              dateStr, 
              t.amount, 
              t.feeHead || 'Unknown', 
              t.paymentMode || 'Cash', 
              statusText,
              collectorStr
            ]);
            row.getCell(7).style = t.status === 'matched' ? greenText : redText;
          });
        }
        
        ws.addRow([]); // space between students on the same date
      });
      
      ws.addRow([]); // extra space between date groups
      ws.addRow([]);
    });
    
    // Auto-fit column widths
    ws.columns.forEach(col => {
      let maxLen = 0;
      col.eachCell({ includeEmpty: false }, cell => {
        if (cell.value && String(cell.value).startsWith('DATE:')) return;
        if (cell.value && String(cell.value).startsWith('STUDENT:')) return;
        if (cell.value && String(cell.value).startsWith('College:')) return;
        const val = cell.value ? String(cell.value) : '';
        if (val.length > maxLen) maxLen = val.length;
      });
      col.width = Math.max(maxLen + 4, 15);
    });
    ws.getColumn(1).width = 25; // Header title column
    ws.getColumn(2).width = 14; // B: Row Index / Receipt No column
    ws.getColumn(3).width = 12; // C: Date column
    ws.getColumn(4).width = 10; // D: Amount column
    ws.getColumn(5).width = 22; // E: Narration / Fee Head column
    ws.getColumn(8).width = 25; // Collected By column
  };

  // 2. Sheet 2: Matched Total Students
  console.log('Generating Matched Total Sheet...');
  const matchedStudentsList = studentsReport.filter(s => s.status === 'matched');
  buildStudentSheet('Matched Total', matchedStudentsList);
 
  // 3. Sheet 3: Mismatched Total Students
  console.log('Generating Mismatched Total Sheet...');
  const mismatchedStudentsList = studentsReport.filter(s => s.status === 'mismatched');
  buildStudentSheet('Mismatched Total', mismatchedStudentsList);

  // 4. Sheet 4: Date-wise Breakdown
  console.log('Generating Date-wise Breakdown Sheet...');
  buildDateSheet('Date-wise Breakdown', studentsReport);

  // Write workbook to file
  await workbook.xlsx.writeFile(savePath);
};

const printUsageAndExit = () => {
  console.log(`
Usage:
  node backend/scripts/reconcileTransactions.js [--file <path_to_ez_file>] [--save-report]

Options:
  --file <path>   Optional. Path to the EZ spreadsheet to parse. If not specified, a file picker will open.
  --save-report   Optional. Writes a detailed JSON reconciliation report under backend/logs/
`);
  process.exit(1);
};

const run = async () => {
  // Parse CLI args
  const fileArgIndex = process.argv.indexOf('--file');
  let filePath = '';
  if (fileArgIndex !== -1 && process.argv[fileArgIndex + 1]) {
    filePath = process.argv[fileArgIndex + 1];
  } else {
    // Attempt to open native open file dialog
    filePath = openFileDialog();
    if (!filePath) {
      console.error("No file was selected. Exiting.");
      process.exit(1);
    }
    console.log(`Selected File: ${filePath}`);
  }
  const saveReport = process.argv.includes('--save-report');

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist at path "${filePath}"`);
    process.exit(1);
  }

  console.log(`Connecting to databases...`);
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  try {
    // Fetch users for cashier mapping
    const users = await User.find({}).lean();
    const userIdMap = {};
    const userIdNameMap = {};
    const nameToUsernameMap = {};
    users.forEach(u => {
      const uidStr = String(u._id);
      if (u.username) userIdMap[uidStr] = u.username;
      if (u.name) {
        userIdNameMap[uidStr] = u.name;
        const norm = u.name.replace(/\s+/g, ' ').toLowerCase().trim();
        if (u.username) nameToUsernameMap[norm] = u.username;
      }
    });

    // 1. Fetch active fee heads
    const feeHeads = await FeeHead.find({ isActive: true }).lean();
    const lateFeeHead = feeHeads.find(f => 
      f.code === 'LAT01' || f.code === 'LF01' || f.name.toUpperCase().includes('LATE FEE')
    );

    console.log(`Successfully fetched ${feeHeads.length} active fee heads from MongoDB.`);

    // 2. Read and parse Excel file
    console.log(`Parsing EZ file: ${filePath}...`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) {
      console.error('Error: EZ sheet is empty or lacks headers.');
      process.exit(1);
    }

    const headers = rawRows[0].map(h => String(h || '').trim());
    console.log('Columns found:', headers);

    // Map column indices dynamically
    let colIndexAdmnNo = -1;
    let colIndexStudentName = -1;
    let colIndexAmount = -1;
    let colIndexNarration = -1;
    let colIndexLateFee = -1;
    let colIndexRecNo = -1;
    let colIndexTransDate = -1;
    let colIndexPayMode = -1;

    headers.forEach((header, index) => {
      const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm === 'admnno' || norm === 'admissionno' || norm === 'admissionnumber' || norm === 'studentno' || norm === 'rollno' || norm === 'htno') {
        colIndexAdmnNo = index;
      } else if (norm === 'studentname' || norm === 'name' || norm === 'sname') {
        colIndexStudentName = index;
      } else if (norm === 'amount' || norm === 'amt' || norm === 'baseamount') {
        colIndexAmount = index;
      } else if (norm === 'narration' || norm === 'particulars' || norm === 'remarks' || norm === 'feehead') {
        colIndexNarration = index;
      } else if (norm === 'latefee' || norm === 'latefeeamount' || norm === 'penalty') {
        colIndexLateFee = index;
      } else if (norm === 'recno' || norm === 'receiptno' || norm === 'receiptnumber') {
        colIndexRecNo = index;
      } else if (norm === 'transdate' || norm === 'date' || norm === 'paymentdate') {
        colIndexTransDate = index;
      } else if (norm === 'paymode' || norm === 'paymentmode' || norm === 'mode') {
        colIndexPayMode = index;
      }
    });

    if (colIndexAdmnNo === -1) {
      console.error('Error: Could not find student ID column (e.g. AdmnNo, AdmissionNo) in EZ.');
      process.exit(1);
    }

    const excelRows = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const admnNo = String(row[colIndexAdmnNo] || '').trim();
      if (!admnNo) continue;

      const studentName = colIndexStudentName !== -1 ? String(row[colIndexStudentName] || '').trim() : 'Unknown';
      const amount = colIndexAmount !== -1 ? getNumeric(row[colIndexAmount]) : 0;
      const narration = colIndexNarration !== -1 ? String(row[colIndexNarration] || '').trim() : '';
      const lateFee = colIndexLateFee !== -1 ? getNumeric(row[colIndexLateFee]) : 0;
      const recNo = colIndexRecNo !== -1 ? String(row[colIndexRecNo] || '').trim() : '';
      const transDate = colIndexTransDate !== -1 ? parseExcelDate(row[colIndexTransDate]) : '';
      const payMode = colIndexPayMode !== -1 ? String(row[colIndexPayMode] || '').trim() : '';

      excelRows.push({
        recNo,
        transDate,
        admnNo,
        studentName,
        amount,
        narration,
        lateFee,
        payMode,
        rowIndex: i + 1
      });
    }

    console.log(`Parsed ${excelRows.length} valid rows from EZ.`);

    // Interactive menu to select payment mode filter
    console.log(`\nSelect payment mode filter for reconciliation:`);
    console.log(`[1] Cash Transactions Only`);
    console.log(`[2] Non-Cash Transactions Only (Bank, UPI, Card, Net Banking, etc.)`);
    console.log(`[3] All Transactions (No Filter)`);
    const answer = await askQuestion('Enter choice (1, 2, or 3, default: 3): ');
    
    let filterMode = 'all';
    let filteredExcelRows = excelRows;
    if (answer.trim() === '1') {
      filterMode = 'cash';
      filteredExcelRows = excelRows.filter(row => row.payMode.toUpperCase() === 'CASH');
      console.log(`Filtered to Cash transactions only. Total remaining rows: ${filteredExcelRows.length}`);
    } else if (answer.trim() === '2') {
      filterMode = 'non-cash';
      filteredExcelRows = excelRows.filter(row => row.payMode.toUpperCase() !== 'CASH');
      console.log(`Filtered to Non-Cash transactions only. Total remaining rows: ${filteredExcelRows.length}`);
    } else {
      console.log(`Reconciling all transactions.`);
    }

    // 3. Resolve students using SQL database (Admission Numbers vs. PIN Numbers)
    const excelAdmnNos = [...new Set(filteredExcelRows.map(r => r.admnNo).filter(Boolean))];
    const studentMap = {};

    if (excelAdmnNos.length > 0) {
      console.log(`Resolving student details for ${excelAdmnNos.length} unique identifiers via SQL...`);
      const chunk = 500;
      for (let i = 0; i < excelAdmnNos.length; i += chunk) {
        const admnNosSubset = excelAdmnNos.slice(i, i + chunk);
        const placeholders = admnNosSubset.map(() => '?').join(',');
        
        const sqlQuery = `
          SELECT admission_number, pin_no, student_name, college, course, branch 
          FROM students 
          WHERE admission_number IN (${placeholders}) OR pin_no IN (${placeholders})
        `;
        
        const [studentRows] = await db.query(sqlQuery, [...admnNosSubset, ...admnNosSubset]);
        
        studentRows.forEach(s => {
          const sData = {
            admissionNumber: (s.admission_number || '').trim(),
            pinNo: (s.pin_no || '').trim(),
            studentName: (s.student_name || '').trim(),
            college: (s.college || '').trim(),
            course: (s.course || '').trim(),
            branch: (s.branch || '').trim()
          };
          
          if (sData.admissionNumber) {
            studentMap[sData.admissionNumber.toLowerCase()] = sData;
          }
          if (sData.pinNo) {
            studentMap[sData.pinNo.toLowerCase()] = sData;
          }
        });
      }
    }

    // Calculate SQL found/not found metrics
    let sqlFoundCount = 0;
    let sqlNotFoundCount = 0;
    excelAdmnNos.forEach(id => {
      if (studentMap[id.toLowerCase()]) {
        sqlFoundCount++;
      } else {
        sqlNotFoundCount++;
      }
    });

    console.log(`\n======================================================`);
    console.log(`   SQL RESOLUTION SUMMARY`);
    console.log(`======================================================`);
    console.log(`Unique Students found in EZ : ${excelAdmnNos.length}`);
    console.log(`Resolved in SQL Database       : ${sqlFoundCount}`);
    console.log(`Not Found in SQL Database      : ${sqlNotFoundCount}`);
    console.log(`======================================================\n`);

    // Group Excel rows
    const groupedExcelTransactions = {};
    filteredExcelRows.forEach(row => {
      const key = row.admnNo.toLowerCase();
      const studentDetail = studentMap[key] || {
        admissionNumber: row.admnNo,
        pinNo: '',
        studentName: row.studentName,
        college: 'Unknown',
        course: 'Unknown',
        branch: 'Unknown',
        isUnresolved: true
      };

      const groupKey = (studentDetail.admissionNumber || row.admnNo).toUpperCase().trim();
      if (!groupedExcelTransactions[groupKey]) {
        groupedExcelTransactions[groupKey] = {
          studentInfo: studentDetail,
          transactions: []
        };
      }

      // Base Transaction
      const mappedHeads = mapNarrationToFeeHeads(row.narration, feeHeads);
      groupedExcelTransactions[groupKey].transactions.push({
        recNo: row.recNo,
        date: row.transDate,
        amount: row.amount,
        narration: row.narration,
        payMode: row.payMode,
        feeHeads: mappedHeads,
        isLateFee: false,
        excelRow: row.rowIndex,
        status: 'unmatched',
        matchedWith: null
      });

      // Late Fee Transaction
      if (row.lateFee > 0) {
        groupedExcelTransactions[groupKey].transactions.push({
          recNo: row.recNo,
          date: row.transDate,
          amount: row.lateFee,
          narration: 'LATE FEE (from Excel column)',
          payMode: row.payMode,
          feeHeads: lateFeeHead ? [lateFeeHead] : [],
          isLateFee: true,
          excelRow: row.rowIndex,
          status: 'unmatched',
          matchedWith: null
        });
      }
    });

    const studentsReport = [];
    let summaryTotalStudents = Object.keys(groupedExcelTransactions).length;
    let summaryMatchedCount = 0;
    let summaryMissingInMongoCount = 0;
    let summaryMissingInExcelCount = 0;
    let summaryMismatchedCount = 0;

    console.log(`Reconciling transactions against MongoDB active transactions...`);

    // 1. Gather all student identifiers to query in bulk
    const allQueryIds = new Set();
    Object.keys(groupedExcelTransactions).forEach(groupKey => {
      const group = groupedExcelTransactions[groupKey];
      const student = group.studentInfo;
      [student.admissionNumber, student.pinNo, groupKey].filter(Boolean).forEach(id => {
        allQueryIds.add(id.trim());
      });
    });

    // Expand identifiers to include trimmed uppercase and lowercase variants for case-insensitive matching in MongoDB
    const expandedQueryIds = new Set();
    allQueryIds.forEach(id => {
      const trimmed = id.trim();
      expandedQueryIds.add(trimmed);
      expandedQueryIds.add(trimmed.toLowerCase());
      expandedQueryIds.add(trimmed.toUpperCase());
    });
    const finalQueryIds = Array.from(expandedQueryIds);

    console.log(`Querying MongoDB for active transactions of all resolved students in bulk...`);
    const allMongoTxns = await Transaction.find({
      $or: [
        { studentId: { $in: finalQueryIds } },
        { pinNo: { $in: finalQueryIds } },
        { admissionNumber: { $in: finalQueryIds } }
      ],
      status: { $ne: 'cancelled' }
    }).populate('feeHead').lean();

    // Apply payment mode filter on MongoDB transactions (case-insensitively)
    let filteredMongoTxns = allMongoTxns;
    if (filterMode === 'cash') {
      filteredMongoTxns = allMongoTxns.filter(tx => tx.paymentMode && tx.paymentMode.toUpperCase() === 'CASH');
    } else if (filterMode === 'non-cash') {
      filteredMongoTxns = allMongoTxns.filter(tx => !tx.paymentMode || tx.paymentMode.toUpperCase() !== 'CASH');
    }

    // Map any collectedBy Mongo IDs to usernames and map names
    filteredMongoTxns.forEach(tx => {
      const cbStr = String(tx.collectedBy || '');
      if (userIdMap[cbStr]) {
        tx.collectedBy = userIdMap[cbStr];
        if (userIdNameMap[cbStr]) {
          tx.collectedByName = userIdNameMap[cbStr];
        }
      } else if (tx.collectedByName) {
        const normName = String(tx.collectedByName).replace(/\s+/g, ' ').toLowerCase().trim();
        const resolvedUsername = nameToUsernameMap[normName];
        if (resolvedUsername) {
          tx.collectedBy = resolvedUsername;
        }
      }
    });

    console.log(`Found ${filteredMongoTxns.length} matching active transactions in MongoDB. Grouping in memory...`);

    // 2. Index active MongoDB transactions by all available student identifiers (case-insensitive keys)
    const mongoTxnsByStudent = {};
    const addTxnToMap = (key, tx) => {
      if (!key) return;
      const normalizedKey = key.trim().toUpperCase();
      if (!mongoTxnsByStudent[normalizedKey]) {
        mongoTxnsByStudent[normalizedKey] = [];
      }
      if (!mongoTxnsByStudent[normalizedKey].some(t => String(t._id) === String(tx._id))) {
        mongoTxnsByStudent[normalizedKey].push(tx);
      }
    };

    filteredMongoTxns.forEach(tx => {
      addTxnToMap(tx.studentId, tx);
      addTxnToMap(tx.pinNo, tx);
      addTxnToMap(tx.admissionNumber, tx);
    });

    // 3. Process each student's transactions in-memory
    for (const groupKey of Object.keys(groupedExcelTransactions)) {
      const group = groupedExcelTransactions[groupKey];
      const student = group.studentInfo;
      const excelTxns = group.transactions;

      // Resolve transactions for this student from the indexed map
      const queryIds = [student.admissionNumber, student.pinNo, groupKey]
        .filter(Boolean)
        .map(id => id.trim().toUpperCase());
      
      const mongoTxns = [];
      const seenTxnIds = new Set();
      
      queryIds.forEach(id => {
        const txns = mongoTxnsByStudent[id] || [];
        txns.forEach(tx => {
          if (!seenTxnIds.has(String(tx._id))) {
            seenTxnIds.add(String(tx._id));
            mongoTxns.push(tx);
          }
        });
      });

      const matchedMongoTxnIds = new Set();

      excelTxns.forEach(etx => {
        const matchingMongo = mongoTxns.find(mtx => {
          if (matchedMongoTxnIds.has(String(mtx._id))) return false;
          
          return mtx.amount === etx.amount;
        });

        if (matchingMongo) {
          etx.status = 'matched';
          etx.matchedWith = {
            _id: matchingMongo._id,
            receiptNumber: matchingMongo.receiptNumber,
            paymentDate: matchingMongo.paymentDate,
            amount: matchingMongo.amount,
            feeHead: matchingMongo.feeHead ? matchingMongo.feeHead.name : 'Unknown',
            paymentMode: matchingMongo.paymentMode,
            collectedBy: matchingMongo.collectedBy || 'Unknown',
            collectedByName: matchingMongo.collectedByName || 'Unknown'
          };
          matchedMongoTxnIds.add(String(matchingMongo._id));
          summaryMatchedCount++;
        } else {
          etx.status = 'missing_in_mongo';
          summaryMissingInMongoCount++;
        }
      });

      const extraMongoTxns = mongoTxns
        .filter(mtx => !matchedMongoTxnIds.has(String(mtx._id)))
        .map(mtx => {
          summaryMissingInExcelCount++;
          return {
            _id: mtx._id,
            receiptNumber: mtx.receiptNumber,
            paymentDate: mtx.paymentDate,
            amount: mtx.amount,
            feeHead: mtx.feeHead ? mtx.feeHead.name : 'Unknown',
            paymentMode: mtx.paymentMode,
            remarks: mtx.remarks,
            status: 'missing_in_excel',
            collectedBy: mtx.collectedBy || 'Unknown',
            collectedByName: mtx.collectedByName || 'Unknown'
          };
        });

      const excelTotal = excelTxns.reduce((acc, tx) => acc + tx.amount, 0);
      const mongoTotal = mongoTxns.reduce((acc, tx) => acc + tx.amount, 0);

      let overallStatus = 'matched';
      if (excelTxns.some(t => t.status === 'missing_in_mongo') || extraMongoTxns.length > 0) {
        overallStatus = 'mismatched';
        summaryMismatchedCount++;
      }

      studentsReport.push({
        admissionNumber: student.admissionNumber || groupKey,
        pinNo: student.pinNo || '',
        studentName: student.studentName || 'Unknown',
        college: student.college || 'Unknown',
        course: student.course || 'Unknown',
        branch: student.branch || 'Unknown',
        isUnresolved: student.isUnresolved || false,
        excelTotal,
        mongoTotal,
        status: overallStatus,
        excelTransactions: excelTxns,
        missingInExcelTransactions: extraMongoTxns
      });
    }

    // Gather unresolved students
    const unresolvedStudents = Object.values(groupedExcelTransactions)
      .map(g => g.studentInfo)
      .filter(s => s.isUnresolved);

    console.log('\n======================================================');
    console.log(`   STUDENTS NOT FOUND IN SQL DATABASE (${unresolvedStudents.length})`);
    console.log(`======================================================`);
    if (unresolvedStudents.length === 0) {
      console.log(`   All students successfully resolved in SQL.`);
    } else {
      unresolvedStudents.forEach((s, idx) => {
        console.log(`   [${idx + 1}] ID/Admission: ${s.admissionNumber} | Name: ${s.studentName}`);
      });
    }
    console.log(`======================================================\n`);

    // Print structured Student Transaction details for 5 random students as preview
    console.log(`\n======================================================`);
    console.log(`   STUDENT TRANSACTION DETAIL PREVIEW (5 RANDOM STUDENTS)`);
    console.log(`======================================================`);
    
    const getRandomPreviewStudents = (arr, count) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };
    const previewStudents = getRandomPreviewStudents(studentsReport, 5);
    previewStudents.forEach((s, idx) => {
      console.log(`\n[${idx + 1}] Student Name : ${s.studentName}`);
      console.log(`    Admission No : ${s.admissionNumber} | PIN No: ${s.pinNo || 'N/A'}`);
      console.log(`    College      : ${s.college} | Course: ${s.course} | Branch: ${s.branch}`);
      console.log(`    EZ Total     : Rs. ${s.excelTotal} | New software transaction Total: Rs. ${s.mongoTotal}`);
      
      console.log(`    --- EZ TRANSACTIONS ---`);
      if (s.excelTransactions.length === 0) {
        console.log(`      (No transactions found in EZ)`);
      } else {
        s.excelTransactions.forEach(t => {
          console.log(`      - Row ${t.excelRow} | Date: ${t.date || 'N/A'} | Amt: Rs. ${t.amount} | Narration: "${t.narration}"`);
        });
      }

      console.log(`    --- NEW SOFTWARE TRANSACTIONS ---`);
      const matchedMongo = s.excelTransactions.filter(t => t.status === 'matched').map(t => t.matchedWith);
      const unmatchedMongo = s.missingInExcelTransactions;
      const allMongo = [...matchedMongo, ...unmatchedMongo];

      if (allMongo.length === 0) {
        console.log(`      (No transactions found in New software transactions)`);
      } else {
        allMongo.forEach(t => {
          const dateStr = t.paymentDate ? new Date(t.paymentDate).toLocaleDateString('en-IN') : 'N/A';
          const collectorStr = t.collectedByName || t.collectedBy || 'Unknown';
          console.log(`      - Receipt: ${t.receiptNumber || 'N/A'} | Date: ${dateStr} | Amt: Rs. ${t.amount} | Fee Head: ${t.feeHead} | Mode: ${t.paymentMode} | Collected By: ${collectorStr}`);
        });
      }
      console.log(`------------------------------------------------------`);
    });

    console.log(`\nNote: Only first 5 students displayed in console preview. Use --save-report to output the complete set of results to a file.`);

    // 4. Ask the user if they want to download/save the reconciliation report as an Excel file
    const exportAns = await askQuestion('\nDo you want to save this reconciliation report as an Excel file? (yes/no, default: yes): ');
    if (exportAns.trim().toLowerCase() !== 'no' && exportAns.trim().toLowerCase() !== 'n') {
      const defaultFileName = `reconciliation_report_${Date.now()}.xlsx`;
      let defaultReportPath = path.join(process.cwd(), defaultFileName);
      
      const customPath = await askQuestion(`Enter target path/file name to save the Excel file (press Enter for default: ${defaultReportPath}): `);
      const savePath = customPath.trim() || defaultReportPath;

      console.log('Generating Excel workbook...');
      try {
        await generateExcelReport(filePath, summaryTotalStudents, summaryMismatchedCount, filteredExcelRows, groupedExcelTransactions, studentsReport, unresolvedStudents, savePath);
        console.log(`[SUCCESS] Reconciliation report successfully generated and saved to:\n  ${path.resolve(savePath)}`);
      } catch (writeErr) {
        console.error(`Failed to write Excel file:`, writeErr.message);
      }
    }

    // Save JSON report to file if requested
    if (saveReport) {
      const logsDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const reportFileName = `reconciliation_report_${Date.now()}.json`;
      const reportPath = path.join(logsDir, reportFileName);

      const reportPayload = {
        timestamp: new Date().toISOString(),
        inputFile: filePath,
        summary: {
          totalExcelRows: filteredExcelRows.length,
          totalStudents: summaryTotalStudents,
          matchedCount: summaryMatchedCount,
          missingInMongoCount: summaryMissingInMongoCount,
          missingInExcelCount: summaryMissingInExcelCount,
          mismatchedStudentsCount: summaryMismatchedCount,
          matchedStudentsCount: summaryTotalStudents - summaryMismatchedCount
        },
        students: studentsReport
      };

      fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
      console.log(`[SUCCESS] Detailed JSON report saved to: ${reportPath}`);
    }

  } catch (err) {
    console.error('Reconciliation execution failed:', err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

run();
