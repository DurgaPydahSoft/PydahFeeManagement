const xlsx = require('xlsx');
const fs = require('fs');
const db = require('../config/sqlDb');
const StudentFee = require('../models/StudentFee');
const FeeHead = require('../models/FeeHead');
const Transaction = require('../models/Transaction');

// @desc Process Excel Upload (Demands & Payments)
// @route POST /api/bulk-fee/upload
const processBulkUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { college, course: defaultCourse, branch: defaultBranch, batch } = req.body;

        // Fetch all Fee Heads for mapping
        const allFeeHeads = await FeeHead.find({});
        
        // Fee Head Mapping Helper for DUMP MODE
        // We will match Narration keywords to these Heads
        const getFeeHeadFromNarration = (narration) => {
            if (!narration) return null;
            const text = narration.toUpperCase();
            
            // 1. Exact Name Match (Normalized)
            const normalizedText = text.replace(/[^A-Z0-9]/g, '');
            const exactMatch = allFeeHeads.find(h => 
                normalizedText.includes(h.name.toUpperCase().replace(/[^A-Z0-9]/g, '')) 
            );
            if (exactMatch) return { _id: exactMatch._id, name: exactMatch.name };

            // 2. Keyword Heuristics
            if (text.includes('TUTION') || text.includes('TUITION')) {
                const match = allFeeHeads.find(h => h.name.toUpperCase().includes('TUITION'));
                if (match) return { _id: match._id, name: match.name };
            }
            if (text.includes('BUS') || text.includes('TRANSPORT') || text.includes('TRPT')) {
                const match = allFeeHeads.find(h => h.name.toUpperCase().includes('TRANSPORT') || h.name.toUpperCase().includes('BUS'));
                if (match) return { _id: match._id, name: match.name };
            }
            if (text.includes('PW') || text.includes('SPECIAL')) {
                 // Try to find "Special Fee" or "PW" specific head
                 const match = allFeeHeads.find(h => h.name.toUpperCase().includes('SPECIAL') || h.name.toUpperCase().includes('PW'));
                 if (match) return { _id: match._id, name: match.name };
                 // Fallback
                 const fallback = allFeeHeads.find(h => h.code === 'SF' || h.name.toUpperCase().includes('SPECIAL'));
                 if (fallback) return { _id: fallback._id, name: fallback.name };
            }
            if (text.includes('HOSTEL')) {
                const match = allFeeHeads.find(h => h.name.toUpperCase().includes('HOSTEL'));
                if (match) return { _id: match._id, name: match.name };
            }

            // 3. Fallback to "General" or log failure
            return null;
        };

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawData || rawData.length < 2) {
            return res.status(400).json({ message: 'File is empty or missing headers' });
        }

        const row0 = rawData[0]; // Headers

        // MODE DETECTION
        const headerStr = row0.map(String).join(' ').toUpperCase();
        // Check for specific headers from User's Dump Format
        const isDumpMode = headerStr.includes('SECID') || (headerStr.includes('NARRATION') && headerStr.includes('ADMNNO'));

        console.log(`Upload Mode Detected: ${isDumpMode ? 'TRANSACTION DUMP' : 'STUDENT MATRIX'}`);

        // --- MODE 1: STANDARD MATRIX PREVIEW --- 
        if (!isDumpMode) {
             // Validate filters for Matrix Mode
             if (!college || !defaultCourse || !defaultBranch || !batch) {
                 return res.status(400).json({ message: 'For Standard Matrix upload, please select College, Course, Branch, and Batch filters.' });
             }
             return processMatrixUpload(req, res, rawData, allFeeHeads, { college, defaultCourse, defaultBranch, batch });
        }

        // --- MODE 2: TRANSACTION DUMP PREVIEW ---
        // Robust Format: RecNo, SecId, TransDate, AdmnNo (Pin), StudentName, Amount, Narration, PayMode, PaymentDetails
        
        // Map Columns Dynamically
        const colMap = {};
        row0.forEach((h, i) => {
            const head = String(h).toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (head.includes('ADMN') || head.includes('PIN')) colMap.ID = i;
            if (head.includes('SECID') || head.includes('SECTION')) colMap.SEC = i;
            if (head.includes('DATE') && head.includes('TRANS')) colMap.DATE = i;
            if (head.includes('AMOUNT')) colMap.AMOUNT = i;
            if (head.includes('NARRATION')) colMap.NARRATION = i;
            if (head.includes('MODE') && head.includes('PAY')) colMap.MODE = i;
            if (head.includes('DETAIL') && head.includes('PAY')) colMap.DETAILS = i;
            if (head.includes('NAME') && head.includes('STUDENT')) colMap.NAME = i;
        });

        if (colMap.ID === undefined || colMap.AMOUNT === undefined) {
             return res.status(400).json({ message: 'Dump file missing critical columns: AdmnNo/Pin or Amount.' });
        }

        const previewDataMap = new Map(); // Key: Student ID (Pin/Adm)
        let processedCount = 0;

        // Helper to parse "2-1" -> Year 2, Sem 1 OR "11A" -> Year 1, Sem 1
        const parseSecId = (secId) => {
            if (!secId) return { year: 1, semester: 1 };
            const s = String(secId).trim();
            
            // Format 1: "2-1"
            if (s.includes('-')) {
                const parts = s.split('-');
                return { year: parseInt(parts[0]) || 1, semester: parseInt(parts[1]) || 1 };
            }

            // Format 2: "21A", "11", "32B" (YearSemSuffix)
            // Extract first two digits
            const match = s.match(/^(\d)(\d)/);
            if (match) {
                return { year: parseInt(match[1]), semester: parseInt(match[2]) };
            }

            // Fallback: If just "1", assume Year 1
            return { year: parseInt(s) || 1, semester: 1 };
        };

        const parseDate = (xlsDate) => {
             if (!xlsDate) return new Date();
             if (typeof xlsDate === 'number') return new Date((xlsDate - (25569)) * 86400 * 1000);
             
             const str = String(xlsDate).trim();
             
             // Format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
             // Regex matches: Group 1 (DD), Group 2 (MM), Group 3 (YYYY)
             const dmy = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
             if (dmy) {
                 const day = dmy[1].padStart(2, '0');
                 const month = dmy[2].padStart(2, '0');
                 return new Date(`${dmy[3]}-${month}-${day}`); // YYYY-MM-DD (Strict ISO)
             }

             // Format: YYYY-MM-DD or YYYY/MM/DD
             const ymd = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
             if (ymd) {
                 const month = ymd[2].padStart(2, '0');
                 const day = ymd[3].padStart(2, '0');
                 return new Date(`${ymd[1]}-${month}-${day}`);
             }

             // Fallback
             const attempt = new Date(str);
             return isNaN(attempt.getTime()) ? new Date() : attempt;
        };

        const parsePaymentDetails = (detailsStr) => {
            // Format: "Inst Dt: 30/05/2025 No: CNRB-42715"
            const res = { date: null, ref: '' };
            if (!detailsStr) return res;
            
            const txt = String(detailsStr);
            if (txt.includes('No:')) {
                const afterNo = txt.split('No:')[1];
                if (afterNo) res.ref = afterNo.trim();
            } else if (txt.includes('UPI')) {
                 // Try to grab UPI ID if needed, or leave ref empty
            } else {
                res.ref = txt; // fallback
            }
            
            // Regex for DD/MM/YYYY
            const dateMatch = txt.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
            if (dateMatch) {
                const parts = dateMatch[0].split('/');
                res.date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            return res;
        };

        // Pre-fetch all Student IDs from the file to check for existing fees in DB
        const allSheetIds = new Set();
        for (let i = 2; i < rawData.length; i++) { // rawData handles headers at 0, 1? Check loop start
             const r = rawData[i];
             if (r && r[colMap.ID]) allSheetIds.add(String(r[colMap.ID]).trim());
        }
        const distinctIds = Array.from(allSheetIds);

        // Fetch Existing StudentFees for these students
        // We need to resolve Pin -> Admission Number first? 
        // Actually, StudentFee stores 'studentId' which is Admission Number.
        // But the Excel might have Pins.
        // We need the SQL lookup FIRST to map Pin->AdminNo, THEN fetch MongoDB fees.
        
        // 1. Resolve Pins to Admission Numbers
        let pinToAdminMap = new Map(); // Pin -> AdminNo
        if (distinctIds.length > 0) {
            const [students] = await db.query(`
                SELECT admission_number, pin_no 
                FROM students 
                WHERE pin_no IN (?) OR admission_number IN (?)
            `, [distinctIds, distinctIds]);
            
            students.forEach(s => {
                if (s.pin_no) pinToAdminMap.set(s.pin_no, s.admission_number);
                pinToAdminMap.set(s.admission_number, s.admission_number); // Self-map
            });
        }

        // 2. Fetch StudentFees
        const relevantAdminNos = Array.from(pinToAdminMap.values());
        const existingFeeMap = new Map(); // Key: AdminNo-HeadId-Year -> Amount
        
        if (relevantAdminNos.length > 0) {
            const fees = await StudentFee.find({ 
                studentId: { $in: relevantAdminNos } 
            }).select('studentId feeHead studentYear amount');
            
            fees.forEach(f => {
                const key = `${f.studentId}-${f.feeHead}-${f.studentYear}`;
                existingFeeMap.set(key, f.amount);
            });
        }

        const demandTracker = new Set(); // Track added demands to avoid duplicates in preview

        for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const rawId = row[colMap.ID];
            if (!rawId) continue;

            const cleanId = String(rawId).trim(); // Pin or Adm from Excel
            const adminNo = pinToAdminMap.get(cleanId) || cleanId; // Resolved AdminNo

            const narration = row[colMap.NARRATION] ? String(row[colMap.NARRATION]) : '';
            const amount = parseFloat(row[colMap.AMOUNT]) || 0;
            
            if (amount <= 0) continue;

            const transDate = parseDate(row[colMap.DATE]);
            const secInfo = parseSecId(row[colMap.SEC]);
            const payMode = row[colMap.MODE] ? String(row[colMap.MODE]).trim().toUpperCase() : 'CASH';
            const details = parsePaymentDetails(row[colMap.DETAILS]);
            
            const feeHeadInfo = getFeeHeadFromNarration(narration);
            const feeHeadName = feeHeadInfo ? feeHeadInfo.name : 'Unknown Fee (Check Narration)';
            const feeHeadId = feeHeadInfo ? feeHeadInfo._id.toString() : 'UNKNOWN';

            // Group by Student ID (Use cleaned Excel ID for display grouping, identifying by AdminNo internally)
            if (!previewDataMap.has(cleanId)) {
                previewDataMap.set(cleanId, {
                    id: i,
                    displayId: cleanId, 
                    studentName: row[colMap.NAME] || 'Unknown',
                    pinNumber: cleanId, 
                    admissionNumber: adminNo,
                    totalDemand: 0, 
                    totalPaid: 0,
                    demands: [],
                    payments: [],
                    year: secInfo.year || 1, 
                    semester: secInfo.semester || 1,
                    // Will populate rest from DB later if needed
                    batch: 'Unknown',
                    college: 'Unknown',
                    course: 'Unknown',
                    branch: 'Unknown'
                });
            }

            const entry = previewDataMap.get(cleanId);
            
            // Logic: Check if Student Fee exists in DB
            const feeKey = `${adminNo}-${feeHeadId}-${secInfo.year}`;
            const actualDemandAmount = existingFeeMap.get(feeKey); // undefined if not found

            if (actualDemandAmount !== undefined) {
                // Fee Exists! Map it.
                // Only add to 'demands' list if not already added for this student/head/year in this preview session
                const trackKey = `${cleanId}-${feeHeadId}-${secInfo.year}`;
                if (!demandTracker.has(trackKey)) {
                    entry.demands.push({
                        headId: feeHeadId,
                        headName: feeHeadName,
                        year: secInfo.year,
                        amount: actualDemandAmount
                    });
                    entry.totalDemand += actualDemandAmount;
                    demandTracker.add(trackKey);
                }
            } else {
                // Fee Does NOT Exist -> Treat as Payment ONLY. No Demand created.
                // entry.totalDemand does NOT increase.
            }

            // Determine Payment Mode
            let finalMode = 'Cash';
            if (payMode.includes('CONC')) finalMode = 'Waiver';
            else if (payMode.includes('BANK') || payMode.includes('ONLINE') || payMode.includes('NEFT') || payMode.includes('RTGS')) finalMode = 'Net Banking';
            else if (payMode.includes('UPI') || payMode.includes('PHONEPE') || payMode.includes('GPAY')) finalMode = 'UPI';
            else if (payMode.includes('DD')) finalMode = 'DD';
            else if (payMode.includes('CHEQ')) finalMode = 'Cheque';
            else if (payMode.includes('CARD')) finalMode = 'Card';

            // Add Payment
            entry.payments.push({
                headId: feeHeadId,
                headName: feeHeadName,
                year: secInfo.year,
                amount: amount,
                mode: finalMode,
                date: transDate,
                ref: details.ref || '',
                receipt: '', 
                remarks: narration
            });
            entry.totalPaid += amount;
            processedCount++;
        }

        const previewData = Array.from(previewDataMap.values());
        
        // Enrich with DB Data (Resolve Pin -> Admission)
        const allIds = previewData.map(d => String(d.displayId).trim()).filter(Boolean);
        
        if (allIds.length > 0) {
             const [dbStudents] = await db.query(`
                SELECT admission_number, pin_no, student_name, batch, current_year
                FROM students
                WHERE pin_no IN (?) OR admission_number IN (?)
            `, [allIds, allIds]);
            
            const dbMap = {};
            dbStudents.forEach(s => {
                if (s.pin_no) dbMap[s.pin_no.trim().toLowerCase()] = s;
                if (s.admission_number) dbMap[s.admission_number.trim().toLowerCase()] = s;
            });

            previewData.forEach(entry => {
                const key = entry.displayId.toLowerCase();
                const match = dbMap[key];
                if (match) {
                    entry.studentName = match.student_name;
                    entry.admissionNumber = match.admission_number;
                    entry.pinNumber = match.pin_no;
                    entry.batch = match.batch; 
                }
            });
        }

        res.json({
            message: `Processed Dump: ${processedCount} transactions for ${previewData.length} students.`,
            count: previewData.length,
            data: previewData,
            warnings: previewData.filter(d => d.payments.some(p => p.headId === 'UNKNOWN')).length > 0 ? 'Some fee heads could not be identified.' : null
        });

    } catch (error) {
        console.error('Error processing:', error);
        res.status(500).json({ message: 'Error processing file', error: error.message });
    }
};

// Extracted Matrix Logic (Existing)
const processMatrixUpload = async (req, res, rawData, allFeeHeads, { college, defaultCourse, defaultBranch, batch }) => {
        // Normalize helper
        const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const feeHeadMap = {};
        allFeeHeads.forEach(h => {
            const norm = normalize(h.name);
            feeHeadMap[norm] = { _id: h._id, name: h.name, rawName: h.name };
        });

        const row0 = rawData[0];
        const row1 = rawData[1]; 
        const columnMap = [];
        let currentMainHeader = '';
        let currentFeeHead = null;

        for (let c = 0; c < row0.length; c++) {
            const h0 = row0[c] ? String(row0[c]) : '';
            const h1 = row1[c] ? String(row1[c]) : '';
            const h0Upper = h0.trim().toUpperCase();
            const continuationKeywords = ['TOTAL', 'DEMAND', 'PAID', 'MODE', 'TYPE', 'DATE', 'REF', 'REFERENCE', 'TRANSACTION', 'RECEIPT', 'REMARKS', 'NARRATION'];
            const isExplicitGlobal = h0Upper.includes('GLOBAL');
            const isKeyword = continuationKeywords.some(k => h0Upper === k || h0Upper.startsWith(k + ' ') || h0Upper.endsWith(' ' + k));
            
            let effectiveMain = currentMainHeader;
            let effectiveSub = h1;

            if (h0.trim()) {
                if (currentFeeHead && isKeyword && !isExplicitGlobal) {
                    if (!effectiveSub) effectiveSub = h0;
                } else {
                    currentMainHeader = h0;
                    effectiveMain = h0;
                    currentFeeHead = null;
                }
            }

            const mainUpper = effectiveMain.toUpperCase();
            const subUpper = effectiveSub.toUpperCase();
            let cleanMain = normalize(effectiveMain);
            if (cleanMain.includes('tution')) cleanMain = cleanMain.replace(/tution/g, 'tuition');

            if (['ADMISSION', 'ADM', 'ROLL', 'REG', 'STUDENT ID'].some(k => mainUpper.includes(k))) { columnMap[c] = { type: 'admission' }; continue; }
            else if (mainUpper.includes('PIN') || mainUpper.includes('HALL TICKET')) { columnMap[c] = { type: 'pin' }; continue; }
            else if (mainUpper.includes('NAME')) { columnMap[c] = { type: 'name' }; continue; }
            else if (mainUpper.includes('YEAR')) { columnMap[c] = { type: 'year' }; continue; }
            else if (mainUpper.includes('COURSE')) { columnMap[c] = { type: 'course' }; continue; }
            else if (mainUpper.includes('BRANCH')) { columnMap[c] = { type: 'branch' }; continue; }

            // Fee Columns
            let feeMatched = false;
            const feeKeys = Object.keys(feeHeadMap).sort((a, b) => b.length - a.length);
            for (const key of feeKeys) {
                const head = feeHeadMap[key];
                const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
                if (cleanMain.includes(key) || (key.endsWith('s') && cleanMain.includes(keySingular))) {
                    currentFeeHead = head;
                    const isTotal = (subUpper === 'TOTAL' || subUpper === 'DEMAND' || mainUpper.endsWith(' TOTAL') || mainUpper.endsWith(' DEMAND'));
                    const isPaid = (subUpper.includes('PAID') || mainUpper.includes('PAID') || subUpper.includes('COLLECTED')) && !subUpper.includes('UNPAID');
                    const isMode = (subUpper.includes('MODE') || subUpper.includes('TYPE'));
                    const isDate = (subUpper.includes('DATE'));
                    const isRef = (subUpper.includes('REF') || subUpper.includes('TRANSACTION'));
                    const isReceipt = (subUpper.includes('RECEIPT'));
                    const isRemarks = (subUpper.includes('REMARKS'));

                    if (isTotal) { columnMap[c] = { type: 'fee_total', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isPaid) { columnMap[c] = { type: 'fee_paid', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isMode) { columnMap[c] = { type: 'fee_mode', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isDate) { columnMap[c] = { type: 'fee_date', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isRef) { columnMap[c] = { type: 'fee_ref', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isReceipt) { columnMap[c] = { type: 'fee_receipt', headId: head._id, headName: head.name }; feeMatched = true; }
                    else if (isRemarks) { columnMap[c] = { type: 'fee_remarks', headId: head._id, headName: head.name }; feeMatched = true; }
                    if (feeMatched) break;
                }
            }
            if (feeMatched) continue;

            const h0RawCheck = h0.trim().toUpperCase();
            if (h0RawCheck.includes('MODE') || h0RawCheck === 'TYPE') columnMap[c] = { type: 'global_mode' };
            else if (h0RawCheck.includes('DATE')) columnMap[c] = { type: 'global_date' };
            else if (h0RawCheck.includes('REF') || h0RawCheck.includes('TRANSACTION ID')) columnMap[c] = { type: 'global_ref' };
            else if (h0RawCheck.includes('RECEIPT')) columnMap[c] = { type: 'global_receipt' };
            else if (h0RawCheck.includes('REMARKS') || h0RawCheck === 'NARRATION') columnMap[c] = { type: 'global_remarks' };
        }

        const previewDataMap = new Map();
        const parseExcelDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            if (typeof val === 'number') return new Date((val - (25569)) * 86400 * 1000);
            return new Date(val);
        };

        for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            let admission = null;
            let pin = null;
            let name = 'Unknown';
            let rowCourse = null;
            let rowBranch = null;
            let studentYear = null;
            let globalMode = null, globalDate = null, globalRef = null, globalReceipt = null, globalRemarks = null;

            columnMap.forEach((meta, idx) => {
                if (!meta) return;
                const val = row[idx];
                if (meta.type === 'admission') admission = val;
                if (meta.type === 'pin') pin = val;
                if (meta.type === 'name') name = val;
                if (meta.type === 'course') rowCourse = val;
                if (meta.type === 'branch') rowBranch = val;
                if (meta.type === 'year') {
                    const yStr = String(val);
                    if (yStr.match(/1|one/i)) studentYear = 1;
                    else if (yStr.match(/2|two/i)) studentYear = 2;
                    else if (yStr.match(/3|three/i)) studentYear = 3;
                    else if (yStr.match(/4|four/i)) studentYear = 4;
                    else studentYear = parseInt(val) || 1;
                }
                if (meta.type === 'global_mode') globalMode = val;
                if (meta.type === 'global_date') globalDate = val;
                if (meta.type === 'global_ref') globalRef = val;
                if (meta.type === 'global_receipt') globalReceipt = val;
                if (meta.type === 'global_remarks') globalRemarks = val;
            });

            if (rowCourse) {
                 const normalizeStr = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
                 if (normalizeStr(rowCourse) !== normalizeStr(defaultCourse)) {} // skip check for now or continue
            }
            if (studentYear === null) studentYear = 1;

            let uid = null;
            const cleanPin = pin ? String(pin).trim() : '';
            const cleanAdm = admission ? String(admission).trim() : '';
            if (cleanPin.length > 0) uid = cleanPin;
            else if (cleanAdm.length > 0) uid = cleanAdm;

            if (!uid) continue;

            if (!previewDataMap.has(uid)) {
                previewDataMap.set(uid, {
                    id: i,
                    studentName: name,
                    pinNumber: cleanPin,
                    admissionNumber: cleanAdm,
                    displayId: uid,
                    totalDemand: 0,
                    totalPaid: 0,
                    demands: [],
                    payments: [],
                    college,
                    course: rowCourse || defaultCourse,
                    branch: rowBranch || defaultBranch,
                    batch,
                });
            }
            const entry = previewDataMap.get(uid);
            const feeData = {};

            columnMap.forEach((meta, idx) => {
                if (!meta || !meta.headId) return;
                if (!feeData[meta.headId]) feeData[meta.headId] = { paid: -1, total: -1, mode: null, date: null, ref: null, receipt: null, remarks: null };
                const rawVal = row[idx];
                if (meta.type === 'fee_total') {} // ignore
                else if (meta.type === 'fee_paid') feeData[meta.headId].paid = rawVal === undefined || rawVal === '' ? 0 : (parseFloat(rawVal) || 0);
                else if (meta.type === 'fee_mode') feeData[meta.headId].mode = rawVal ? String(rawVal).trim() : null;
                else if (meta.type === 'fee_date') feeData[meta.headId].date = rawVal;
                else if (meta.type === 'fee_ref') feeData[meta.headId].ref = rawVal ? String(rawVal).trim() : null;
                else if (meta.type === 'fee_receipt') feeData[meta.headId].receipt = rawVal ? String(rawVal).trim() : null;
                else if (meta.type === 'fee_remarks') feeData[meta.headId].remarks = rawVal ? String(rawVal).trim() : null;
            });

            Object.keys(feeData).forEach(headId => {
                const data = feeData[headId];
                const headName = allFeeHeads.find(h => String(h._id) === headId)?.name || 'Unknown';

                if (data.total >= 0) {
                    entry.demands.push({ headId, headName, year: studentYear, amount: data.total });
                    entry.totalDemand += data.total;
                }
                if (data.paid >= 0) {
                    entry.payments.push({
                        headId,
                        headName,
                        year: studentYear,
                        amount: data.paid,
                        mode: (function () {
                            const rawMode = (data.paid > 0 ? (data.mode || globalMode || 'Cash') : (data.mode || '')).trim();
                            if (!rawMode) return 'Cash';
                            const m = rawMode.toLowerCase();
                            if (m.includes('upi')) return 'UPI';
                            if (m.includes('net') || m.includes('bank')) return 'Net Banking';
                            if (m.includes('cheque')) return 'Cheque';
                            if (m.includes('dd')) return 'DD';
                            return 'Cash';
                        })(),
                        date: parseExcelDate(data.date) || parseExcelDate(globalDate) || new Date(),
                        ref: data.ref || globalRef || '',
                        receipt: data.receipt || globalReceipt || '',
                        remarks: data.paid > 0 ? (data.remarks || globalRemarks || `Bulk Upload - Yr ${studentYear}`) : ''
                    });
                    entry.totalPaid += data.paid;
                }
            });
        }

        const previewData = Array.from(previewDataMap.values());
        
        // Resolve Names (Copy-Paste)
        const allIds = previewData.map(d => String(d.displayId).trim()).filter(Boolean);
        if (allIds.length > 0) {
            try {
                const [dbStudents] = await db.query(`SELECT admission_number, pin_no, student_name FROM students WHERE pin_no IN (?) OR admission_number IN (?)`, [allIds, allIds]);
                const nameMap = {};
                const idToAdmissionMap = {};
                dbStudents.forEach(s => {
                    const adm = s.admission_number;
                    if (s.pin_no) { nameMap[s.pin_no.trim().toLowerCase()] = s.student_name; idToAdmissionMap[s.pin_no.trim().toLowerCase()] = adm; }
                    if (s.admission_number) { nameMap[s.admission_number.trim().toLowerCase()] = s.student_name; idToAdmissionMap[s.admission_number.trim().toLowerCase()] = adm; }
                });

                let dbDemands = [];
                const resolvedAdmissionNos = allIds.map(id => idToAdmissionMap[id.toLowerCase()]).filter(Boolean);
                const uniqueResolvedAdms = [...new Set(resolvedAdmissionNos)];
                if (uniqueResolvedAdms.length > 0) {
                    dbDemands = await StudentFee.find({ studentId: { $in: uniqueResolvedAdms } });
                }
                const studentDemandsMap = {};
                dbDemands.forEach(d => {
                    const sid = d.studentId.trim().toLowerCase();
                    if (!studentDemandsMap[sid]) studentDemandsMap[sid] = [];
                    studentDemandsMap[sid].push(d);
                });

                previewData.forEach(entry => {
                    const sid = String(entry.displayId).trim().toLowerCase();
                    const realAdmissionNo = idToAdmissionMap[sid];
                    if (nameMap[sid]) entry.studentName = nameMap[sid];
                    if (!realAdmissionNo) return;
                    const myDemands = studentDemandsMap[String(realAdmissionNo).trim().toLowerCase()] || [];
                    myDemands.forEach(dbDemand => {
                        const headId = String(dbDemand.feeHead);
                        const existingEntryIdx = entry.demands.findIndex(d => String(d.headId) === headId);
                        if (existingEntryIdx !== -1) {
                            if (entry.demands[existingEntryIdx].amount !== dbDemand.amount) {
                                entry.totalDemand -= entry.demands[existingEntryIdx].amount;
                                entry.demands[existingEntryIdx].amount = dbDemand.amount;
                                entry.totalDemand += dbDemand.amount;
                            }
                        } else {
                            const headName = allFeeHeads.find(h => String(h._id) === headId)?.name || 'Unknown';
                            entry.demands.push({ headId, headName, year: dbDemand.studentYear, amount: dbDemand.amount });
                            entry.totalDemand += dbDemand.amount;
                        }
                    });
                });
            } catch (err) { console.error(err); }
        }

        res.json({ message: 'File processed', count: previewData.length, data: previewData });
};

// @desc Save Bulk Data (Demands and Transactions)
// @route POST /api/bulk-fee/save
const saveBulkData = async (req, res) => {
    console.log('API: saveBulkData called');
    const { students } = req.body;
    const user = req.user ? req.user.username : 'system';

    if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ message: 'No student data provided' });
    }

    try {
        console.log(`Processing ${students.length} students...`);
        // Step 0: Resolve Student IDs (Map Pin/Admission -> Canonical Admission Number)
        // Use s.displayId which we resolved in the parsing stage (covers Pin or Admission)
        const potentialIds = [...new Set(students.map(s => s.displayId && String(s.displayId).trim()).filter(Boolean))];
        const studentMap = {};
        const allLinkedIdsMap = {}; // admissionNo -> Set of IDs (Pin, Adm)

        if (potentialIds.length > 0) {
            // Fetch matching students from SQL
            console.log(`Resolving ${potentialIds.length} IDs from SQL...`);
            const [rows] = await db.query(`
                SELECT admission_number, pin_no
                FROM students
                WHERE pin_no IN (?) OR admission_number IN (?)
            `, [potentialIds, potentialIds]);

            rows.forEach(r => {
                const adm = r.admission_number.trim().toLowerCase();
                const pin = r.pin_no ? r.pin_no.trim().toLowerCase() : null;

                // Map both Pin and Admission to Canonical Admission Number
                studentMap[adm] = r.admission_number;
                if (pin) studentMap[pin] = r.admission_number;

                // Track all linked IDs for thorough purging
                if (!allLinkedIdsMap[adm]) allLinkedIdsMap[adm] = new Set();
                allLinkedIdsMap[adm].add(adm);
                if (pin) {
                    allLinkedIdsMap[adm].add(pin);
                    // Also allow lookup by pin's lower case version
                    allLinkedIdsMap[pin] = allLinkedIdsMap[adm];
                }
            });
            console.log(`Resolved internal map size: ${Object.keys(studentMap).length}`);
        }

        const newDemands = [];
        const demandsToDelete = [];
        const transactionDocs = [];
        const targetsToDelete = [];
        const unresolvedStudents = [];

        // Step 1: Fetch Existing Transactions for "Sync Check"
        // Note: The existingTx check is not strictly necessary for the "Purge and Replace" consistency logic
        // as we are deleting anyway. It would be useful if we wanted to implement a "delta" update.
        // For now, we'll remove the aggregation and map, as they are not used in the current logic.

        const parseDate = (val) => {
            if (!val) return new Date();
            return new Date(val);
        };

        students.forEach(stud => {
            const rawId = stud.displayId ? String(stud.displayId).trim() : null;
            if (!rawId) return;

            const lookupKey = rawId.toLowerCase();
            const finalStudentId = studentMap[lookupKey] || rawId;

            if (finalStudentId === rawId && !studentMap[lookupKey]) {
                unresolvedStudents.push(`${stud.studentName} (${rawId})`);
            }

            // Comprehensive IDs to Clean (Both Resolved, Raw, and all linked IDs from SQL)
            const linkedIds = allLinkedIdsMap[finalStudentId.toLowerCase()] || new Set();
            linkedIds.add(finalStudentId.toLowerCase());
            linkedIds.add(rawId.toLowerCase());
            const idsToPurge = Array.from(linkedIds);

            // 1. Student Fees (Demands) - PURGE & REPLACE Logic
            // We delete ANY existing demand for this Student+Head+Year (regardless of Batch)
            // to ensure no duplicates accumulate (e.g. 3410 vs 1000).
            if (stud.demands) {
                stud.demands.forEach(d => {
                    const dYear = Number(d.year);

                    demandsToDelete.push({
                        studentId: { $in: idsToPurge },
                        feeHead: d.headId,
                        studentYear: { $in: [dYear, String(dYear)] }
                        // We intentionally OMIT academicYear here. 
                        // If there's an old "Year 1" record from a wrong batch, we want it GONE.
                    });

                    // Only insert new demand if amount > 0
                    if (d.amount > 0) {
                        newDemands.push({
                            studentId: finalStudentId,
                            studentName: stud.studentName,
                            feeHead: d.headId,
                            academicYear: stud.batch,
                            studentYear: dYear,
                            semester: null,
                            amount: d.amount,
                            college: stud.college,
                            course: stud.course,
                            branch: stud.branch,
                            batch: stud.batch,
                        });
                    }
                });
            }

            // 2. Transactions (Payments) - SYNC & REPLACE Logic
            if (stud.payments) {
                stud.payments.forEach(p => {
                    const sYear = String(p.year);
                    const nYear = Number(p.year);

                    // "Fully Reupdate": Delete old, Insert New
                    // We do this UNCONDITIONALLY for every payment row in the Excel.
                    // If the amount is same but Date/Ref changed, this ensures update.
                    // If everything is same, it just re-writes it (Idempotent).

                    // DEBUG: One-time check for first student to see what we are trying to delete vs what exists
                    if (transactionDocs.length === 0) {
                        // Only for the very first transaction we process in this batch
                        console.log(`DEBUG CHECK: Preparing purge for Student ${finalStudentId} (Raw: ${rawId}), Head ${p.headId}, Year ${sYear}`);
                        console.log(`Purge Criteria IDs:`, idsToPurge);
                    }

                    // 1. Mark for Deletion (Batched)
                    // We handle both String and Number types for Year to catch any legacy data mismatch
                    targetsToDelete.push({
                        studentId: { $in: idsToPurge },
                        feeHead: p.headId,
                        // Broaden the delete scope: if `studentYear` is numeric 1 or string "1", or even "I" (roman)?
                        // Just stick to strict type match for now but ensure we cover both.
                        studentYear: { $in: [sYear, nYear, String(nYear), Number(sYear)] }
                    });

                    // 2. Insert New Record with Target Amount
                    // FIX: Only insert transaction if amount > 0.
                    // If amount is 0, we still delete the old record (effectively resetting/clearing it) but don't create a dummy 0 transaction.
                    if (p.amount > 0) {
                        transactionDocs.push({
                            studentId: finalStudentId,
                            studentName: stud.studentName,
                            feeHead: p.headId,
                            amount: p.amount,
                            transactionType: 'CREDIT',
                            paymentMode: p.mode || 'Cash',
                            paymentDate: parseDate(p.date),
                            referenceNo: p.ref || '',
                            receiptNumber: p.receipt || '',
                            remarks: p.remarks || `Bulk Upload - Yr ${sYear}`,
                            studentYear: sYear,
                            collectedBy: user,
                            collectedByName: 'System Bulk Upload'
                        });
                    }
                });
            }
        });

        if (unresolvedStudents.length > 0) {
            console.warn(`Warning: ${unresolvedStudents.length} students used Raw IDs (could not map to SQL Admission No):`, unresolvedStudents.slice(0, 5));
        }

        if (demandsToDelete.length > 0) {
            console.log(`Deleting ${demandsToDelete.length} existing fee demands...`);
            try {
                await StudentFee.deleteMany({ $or: demandsToDelete });
            } catch (err) {
                console.error('Error deleting old demands:', err);
                throw new Error(`Failed to delete old demands: ${err.message}`);
            }
        }

        if (newDemands.length > 0) {
            console.log(`Inserting ${newDemands.length} new fee demands...`);
            // Dedup newDemands just in case of ID collision
            const uniqueDemands = [];
            const demandKeys = new Set();
            newDemands.forEach(d => {
                // Key: StudentID-FeeHead-Year-Batch
                const key = `${d.studentId}-${d.feeHead}-${d.studentYear}-${d.academicYear}`;
                if (!demandKeys.has(key)) {
                    demandKeys.add(key);
                    uniqueDemands.push(d);
                } else {
                    console.warn(`Duplicate Demand Detected and Skipped: ${key}`);
                }
            });

            try {
                // Ordered: false allows continuing even if one fails (though we prefer all success)
                // But specifically for Duplicates, false is safer to at least save partial.
                await StudentFee.insertMany(uniqueDemands, { ordered: false });
            } catch (err) {
                // Ignore duplicate key errors if they somehow persist
                if (err.code === 11000) {
                    console.warn('Duplicate Key Error during Demand Insert (Ignored subset):', err.message);
                } else {
                    console.error('Error inserting new demands:', err);
                    throw new Error(`Failed to insert demands: ${err.message}`);
                }
            }
        }

        if (targetsToDelete.length > 0) {
            console.log(`Deleting existing payments matching ${targetsToDelete.length} criteria points...`);
            try {
                await Transaction.deleteMany({ $or: targetsToDelete });
            } catch (err) {
                console.error('Error deleting old transactions:', err);
                throw new Error(`Failed to delete old transactions: ${err.message}`);
            }
        }

        if (transactionDocs.length > 0) {
            console.log(`Inserting ${transactionDocs.length} new transactions...`);
            try {
                await Transaction.insertMany(transactionDocs, { ordered: false });
            } catch (err) {
                if (err.code === 11000) {
                    console.warn('Duplicate Key Error during Transaction Insert (Ignored subset):', err.message);
                } else {
                    console.error('Error inserting new transactions:', err);
                    throw new Error(`Failed to insert transactions: ${err.message}`);
                }
            }
        }

        console.log('Bulk save completed successfully.');
        res.json({
            message: `Processed ${students.length} students. Saved Demands & Payments.`,
            unresolvedCount: unresolvedStudents.length,
            unresolvedSample: unresolvedStudents.slice(0, 5)
        });

    } catch (error) {
        console.error('CRITICAL ERROR saving bulk data:', error);
        // Return explicit error message to frontend
        res.status(500).json({ message: `Error saving data: ${error.message}`, error: error.toString() });
    }
};

// @desc    Generate and Download Bulk Upload Template
// @route   GET /api/bulk-fee/template
const downloadTemplate = async (req, res) => {
    try {
        const feeHeads = await FeeHead.find({});

        // Define Headers
        const mainHeaders = ['Admission No', 'Pin No', 'Student Name', 'Course', 'Branch', 'Year'];
        const subHeaders = ['', '', '', '', '', ''];

        // Add specific merge ranges if we were using a more complex builder, but simple AOA (Array of Arrays) works for data
        // We will construct the rows

        // Fee Heads Columns
        feeHeads.forEach(head => {
            // For each head, we now have 6 columns (Total removed): Paid, Mode, Date, Ref, Receipt, Remarks
            mainHeaders.push(head.name, '', '', '', '', '');
            subHeaders.push('Paid', 'Mode', 'Date', 'Ref', 'Receipt', 'Remarks');
        });

        // Add Global columns (Optional now, but good to keep as defaults)
        mainHeaders.push('Global Default Mode', 'Global Default Date', 'Global Default Ref No', 'Global Default Receipt No', 'Global Default Remarks');
        subHeaders.push('', '', '', '', '');

        // Create Workbook
        const wb = xlsx.utils.book_new();

        // Create Worksheet from AOA
        // We want to merge the main headers.
        // Logic: specific merge objects { s: {r, c}, e: {r, c} }
        const wsData = [mainHeaders, subHeaders];
        const ws = xlsx.utils.aoa_to_sheet(wsData);

        // Calculate Merges
        const merges = [];
        // Fixed columns merges (Rows 0-1 are headers, so Row 0 cols 0,1,2,3 should merge down? Or normally Row 0 is just Header 1)
        // Let's merge Row 0 with Row 1 for the fixed columns (Admission..Year) -> r:0 to r:1
        // merge: s (start), e (end). c (col), r (row).

        // Merge "Admission No" (0,0) -> (1,0)
        merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
        // Merge "Pin No" (0,1) -> (1,1)
        merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } });
        // Merge "Student Name" (0,2) -> (1,2)
        merges.push({ s: { r: 0, c: 2 }, e: { r: 1, c: 2 } });
        // Merge "Course" (0,3) -> (1,3)
        merges.push({ s: { r: 0, c: 3 }, e: { r: 1, c: 3 } });
        // Merge "Branch" (0,4) -> (1,4)
        merges.push({ s: { r: 0, c: 4 }, e: { r: 1, c: 4 } });
        // Merge "Year" (0,5) -> (1,5)
        merges.push({ s: { r: 0, c: 5 }, e: { r: 1, c: 5 } });

        // Fee Head Merges (Horizontal)
        // Start col index = 6. Each head takes 6 cols now.
        let colIdx = 6;
        feeHeads.forEach(() => {
            // Merge Row 0 from colIdx to colIdx+5
            merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + 5 } });
            colIdx += 6;
        });

        // Global Default columns also merge down
        merges.push({ s: { r: 0, c: colIdx }, e: { r: 1, c: colIdx } }); // Global Default Mode
        merges.push({ s: { r: 0, c: colIdx + 1 }, e: { r: 1, c: colIdx + 1 } }); // Global Default Date
        merges.push({ s: { r: 0, c: colIdx + 2 }, e: { r: 1, c: colIdx + 2 } }); // Global Default Ref No
        merges.push({ s: { r: 0, c: colIdx + 3 }, e: { r: 1, c: colIdx + 3 } }); // Global Default Receipt No
        merges.push({ s: { r: 0, c: colIdx + 4 }, e: { r: 1, c: colIdx + 4 } }); // Global Default Remarks


        // Apply merges
        ws['!merges'] = merges;

        // Set column widths for better UX
        const wscols = [
            { wch: 15 }, // Admission
            { wch: 12 }, // Pin
            { wch: 25 }, // Name
            { wch: 10 }, // Course
            { wch: 10 }, // Branch
            { wch: 8 },  // Year
        ];
        // Add widths for fee columns
        feeHeads.forEach(() => {
            // Paid, Mode, Date, Ref, Rec, Rem
            wscols.push({ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 });
        });
        // Add widths for global default columns
        wscols.push({ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 });
        ws['!cols'] = wscols;

        xlsx.utils.book_append_sheet(wb, ws, 'Template');

        // Write to buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="BulkFeeUploadTemplate.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ message: 'Error generating template' });
    }
};

module.exports = {
    processBulkUpload,
    saveBulkData,
    downloadTemplate
};
