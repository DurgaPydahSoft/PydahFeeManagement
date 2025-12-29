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

        // Fetch all Fee Heads
        const allFeeHeads = await FeeHead.find({});
        // Helper to normalize strings (Remove ALL non-alphanumeric, lowercase)
        // e.g. "Tuition Fee - Paid" -> "tuitionfeepaid"
        // e.g. "TuitionFee" -> "tuitionfee"
        const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const feeHeadMap = {};
        allFeeHeads.forEach(h => {
            const norm = normalize(h.name);
            feeHeadMap[norm] = { _id: h._id, name: h.name, rawName: h.name };
            console.log(`DB Fee Head: "${h.name}" -> Normalized: "${norm}"`);
        });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawData || rawData.length < 2) {
            return res.status(400).json({ message: 'File is empty or missing headers' });
        }

        const row0 = rawData[0]; // Main Headers
        const row1 = rawData[1]; // Sub Headers

        console.log('--- EXCEL HEADERS DEBUG ---');
        row0.forEach((h, i) => {
            console.log(`Col ${i}: Main="${h}", Sub="${row1[i]}"`);
        });

        // Build Column Map
        const columnMap = [];
        let currentMainHeader = '';
        let currentFeeHead = null; // Tracks if the current "Main Header" block refers to a known Fee Head

        for (let c = 0; c < row0.length; c++) {
            const h0 = row0[c] ? String(row0[c]) : '';
            const h1 = row1[c] ? String(row1[c]) : '';

            // Heuristic Step: Determine "Effective" Main Header
            // If h0 contains a generic label like "Mode", "Paid", "Date" etc., AND we are currently processing a Fee Head,
            // we treat this as a "Continued" column (Sub-header on Row 0) rather than a new Main Header.
            // Unless it explicitly says "Global".

            const h0Upper = h0.trim().toUpperCase();
            const continuationKeywords = ['TOTAL', 'DEMAND', 'PAID', 'MODE', 'TYPE', 'DATE', 'REF', 'REFERENCE', 'TRANSACTION', 'RECEIPT', 'REMARKS', 'NARRATION'];

            // "Payment Mode" is ambiguous. Usually Global if standalone. If next to Fee, maybe Fee. 
            // We'll trust "Global" keyword to force global.
            const isKeyword = continuationKeywords.some(k => h0Upper === k || h0Upper.startsWith(k + ' ') || h0Upper.endsWith(' ' + k));
            const isExplicitGlobal = h0Upper.includes('GLOBAL');

            let effectiveMain = currentMainHeader;
            let effectiveSub = h1;

            if (h0.trim()) {
                // If it's a keyword, we are in a fee block, and it's not explicitly global -> Continue Context
                if (currentFeeHead && isKeyword && !isExplicitGlobal) {
                    // Do NOT update currentMainHeader.
                    // We treat h0 as the Sub Header (since h1 is likely empty or redundant)
                    // If h1 is present, we check it too, but h0 provides the "Type"
                    if (!effectiveSub) effectiveSub = h0;
                } else {
                    // New Context
                    currentMainHeader = h0;
                    effectiveMain = h0;
                    currentFeeHead = null; // Reset
                }
            }

            const mainUpper = effectiveMain.toUpperCase();
            const subUpper = effectiveSub.toUpperCase();

            // Normalized comparison string
            let cleanMain = normalize(effectiveMain);

            // FIX: Handle common "Tution" typo
            if (cleanMain.includes('tution')) {
                const corrected = cleanMain.replace(/tution/g, 'tuition');
                // console.log(`Auto-corrected typo: "${cleanMain}" -> "${corrected}"`);
                cleanMain = corrected;
            }

            // 1. Metadata Columns (Highest Priority)
            // 1. Metadata Columns (Highest Priority)
            if (['ADMISSION', 'ADM', 'ROLL', 'REG', 'STUDENT ID', 'SCHOLAR', 'ENROLL'].some(k => mainUpper.includes(k))) {
                columnMap[c] = { type: 'admission' };
                currentFeeHead = null; continue;
            } else if (mainUpper.includes('PIN') || mainUpper.includes('HALL TICKET') || mainUpper.includes('HT NO')) {
                columnMap[c] = { type: 'pin' };
                currentFeeHead = null; continue;
            } else if (mainUpper.includes('STUDENT N') || mainUpper.includes('NAME')) {
                columnMap[c] = { type: 'name' };
                currentFeeHead = null; continue;
            } else if (mainUpper.includes('YEAR') || mainUpper === 'YR') {
                columnMap[c] = { type: 'year' };
                currentFeeHead = null; continue;
            } else if (mainUpper.includes('COURSE')) {
                columnMap[c] = { type: 'course' };
                currentFeeHead = null; continue;
            } else if (mainUpper.includes('BRANCH')) {
                columnMap[c] = { type: 'branch' };
                currentFeeHead = null; continue;
            }

            // 2. Fee Columns
            // Strategy: Check if the Main Header *INCLUDES* a known Fee Head
            let feeMatched = false;
            const feeKeys = Object.keys(feeHeadMap).sort((a, b) => b.length - a.length);

            for (const key of feeKeys) {
                const head = feeHeadMap[key];
                const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
                const matchStandard = cleanMain.includes(key);
                const matchSingular = key.endsWith('s') && cleanMain.includes(keySingular);

                if (matchStandard || matchSingular) {
                    // Found a fee head match
                    currentFeeHead = head; // MARK AS FEE CONTEXT

                    // Helper to check type
                    // Check BOTH effectiveSub AND effectiveMain suffix
                    const checkType = (tokens) => {
                        return subUpper && tokens.includes(subUpper) ||
                            tokens.some(t => mainUpper.endsWith(' ' + t) || mainUpper === t);
                    };

                    const isTotal = (subUpper === 'TOTAL' || subUpper === 'DEMAND' || mainUpper.endsWith(' TOTAL') || mainUpper.endsWith(' DEMAND'));
                    // Relaxed PAID check:
                    const isPaid = ((subUpper.includes('PAID') || mainUpper.includes('PAID') || subUpper.includes('COLLECTED') || mainUpper.includes('COLLECTED'))
                        && !subUpper.includes('UNPAID') && !mainUpper.includes('UNPAID'));
                    // Mode: allow "MODE", "TYPE", "PAYMENT MODE" inside fee context
                    const isMode = (subUpper.includes('MODE') || subUpper.includes('TYPE') || mainUpper.endsWith(' MODE'));
                    const isDate = (subUpper.includes('DATE') || mainUpper.endsWith(' DATE'));
                    const isRef = (subUpper.includes('REF') || subUpper.includes('TRANSACTION') || mainUpper.includes(' ID'));
                    const isReceipt = (subUpper.includes('RECEIPT') || mainUpper.includes('RECEIPT'));
                    const isRemarks = (subUpper.includes('REMARKS') || subUpper.includes('NARRATION'));

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

            // 3. Global Transaction Details (Fallback)
            // If we reached here, it didn't match a fee, or it matched a fee name but not a sub-type (Wait, if matched fee name but no sub-type, currentFeeHead is set but feeMatched is false.)
            // In that case, we should reset currentFeeHead? 
            // No, if user has "Tuition Fee" with no sub-header, it's just a label? Or "Total"?
            // If h0="Tuition Fee" and h1="" -> It usually implies Total if we are permissive, but currently we skip.
            // But if we skip, we shouldn't treat next column as continuation.
            // So if feeMatched is false, we should probably UNSET currentFeeHead unless we are confident.
            // But for safety, let's keep it set if the Main header matched the NAME logic.

            // Only Check Global if we are effectively using the h0 as Main.
            // If we decided h0 was a sub-header (continuation) but it failed to match a fee property, 
            // then it might be a weird column or we misjudged. 
            // But we can't fall back to Global easily if we already decided it was a Fee Sub-header.
            // However, h0Upper is checked here.

            // Using h0UpperRaw (from actual H0) for Global Check
            const h0RawCheck = h0.trim().toUpperCase();
            if (h0RawCheck === 'MODE' || h0RawCheck === 'PAYMENT MODE' || h0RawCheck === 'TYPE' || h0RawCheck === 'GLOBAL DEFAULT MODE') {
                columnMap[c] = { type: 'global_mode' };
            } else if (h0RawCheck.includes('DATE')) {
                columnMap[c] = { type: 'global_date' };
            } else if (h0RawCheck.includes('REF') || h0RawCheck.includes('TRANSACTION ID')) {
                columnMap[c] = { type: 'global_ref' };
            } else if (h0RawCheck.includes('RECEIPT')) {
                columnMap[c] = { type: 'global_receipt' };
            } else if (h0RawCheck === 'REMARKS' || h0RawCheck === 'NARRATION' || h0RawCheck.includes('GLOBAL DEFAULT REMARKS')) {
                columnMap[c] = { type: 'global_remarks' };
            }
        }

        const previewDataMap = new Map();

        // Helper to parse Excel Date
        const parseExcelDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            // Excel numeric date
            if (typeof val === 'number') {
                return new Date((val - (25569)) * 86400 * 1000);
            }
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
            let globalMode = null;
            let globalDate = null;
            let globalRef = null;
            let globalReceipt = null;
            let globalRemarks = null;

            // Extract Identity & Global Data
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
                    if (yStr.match(/1|one|i($|[^a-z])/i)) studentYear = 1;
                    else if (yStr.match(/2|two|ii($|[^a-z])/i)) studentYear = 2;
                    else if (yStr.match(/3|three|iii($|[^a-z])/i)) studentYear = 3;
                    else if (yStr.match(/4|four|iv($|[^a-z])/i)) studentYear = 4;
                    else studentYear = parseInt(val) || 1;
                }

                // Transaction Globals
                if (meta.type === 'global_mode') globalMode = val;
                if (meta.type === 'global_date') globalDate = val;
                if (meta.type === 'global_ref') globalRef = val;
                if (meta.type === 'global_receipt') globalReceipt = val;
                if (meta.type === 'global_remarks') globalRemarks = val;
            });

            // DEBUG LOGGING
            // console.log(`Row ${i}: Name="${name}", Pin="${pin}", Adm="${admission}", Course="${rowCourse}", Branch="${rowBranch}"`);

            // STRICT FILTERING: Match Excel Row against UI Config (Course/Branch)
            // Enhanced fuzzy match: Remove non-alphanumeric chars
            const normalizeStr = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

            if (rowCourse) {
                const rC = normalizeStr(rowCourse);
                const dC = normalizeStr(defaultCourse);
                if (rC !== dC) {
                    // console.log(`Row ${i} Skipped: Course Mismatch. Found: "${rowCourse}", Expected: "${defaultCourse}"`);
                    // continue;
                }
            }
            if (rowBranch) {
                const rB = normalizeStr(rowBranch);
                const dB = normalizeStr(defaultBranch);
                if (rB !== dB) {
                    // console.log(`Row ${i} Skipped: Branch Mismatch. Found: "${rowBranch}", Expected: "${defaultBranch}"`);
                    // continue;
                }
            }

            // Default Year to 1 if not specified in Excel (Common case)
            if (studentYear === null) studentYear = 1;

            let uid = null;
            const cleanPin = pin ? String(pin).trim() : '';
            const cleanAdm = admission ? String(admission).trim() : '';

            if (cleanPin.length > 0) {
                uid = cleanPin;
            } else if (cleanAdm.length > 0) {
                uid = cleanAdm;
            }

            if (!uid) {
                console.log(`Row ${i} Skipped: No UID resolved. Pin was "${pin}", Admission was "${admission}"`);
                continue;
            }

            if (!previewDataMap.has(uid)) {
                previewDataMap.set(uid, {
                    id: i,
                    studentName: name,
                    pinNumber: cleanPin,         // Show actual PIN if exists
                    admissionNumber: cleanAdm,   // Show actual Admission No if exists
                    displayId: uid,              // The ID we resolved (Pin or Adm)
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

            const feeData = {}; // headId -> { paid, total, mode, date, ref, receipt, remarks }

            columnMap.forEach((meta, idx) => {
                if (!meta || !meta.headId) return;
                // Initialize if not exists
                // paid: -1 indicates "Column Not Present" so we don't accidentally wipe data if user only uploaded "Demand"
                if (!feeData[meta.headId]) feeData[meta.headId] = { paid: -1, total: -1, mode: null, date: null, ref: null, receipt: null, remarks: null };

                const rawVal = row[idx];

                if (meta.type === 'fee_total') {
                    // Ignore Total from Excel; strictly fetch from DB configuration
                    // feeData[meta.headId].total = parseFloat(rawVal) || 0;
                } else if (meta.type === 'fee_paid') {
                    // If column exists, we accept the value. Empty/Invalid = 0.
                    feeData[meta.headId].paid = rawVal === undefined || rawVal === '' ? 0 : (parseFloat(rawVal) || 0);
                } else if (meta.type === 'fee_mode') {
                    feeData[meta.headId].mode = rawVal ? String(rawVal).trim() : null;
                } else if (meta.type === 'fee_date') {
                    feeData[meta.headId].date = rawVal;
                } else if (meta.type === 'fee_ref') {
                    feeData[meta.headId].ref = rawVal ? String(rawVal).trim() : null;
                } else if (meta.type === 'fee_receipt') {
                    feeData[meta.headId].receipt = rawVal ? String(rawVal).trim() : null;
                } else if (meta.type === 'fee_remarks') {
                    feeData[meta.headId].remarks = rawVal ? String(rawVal).trim() : null;
                }
            });

            // Now populate entry.demands and entry.payments
            Object.keys(feeData).forEach(headId => {
                const data = feeData[headId];
                const headName = allFeeHeads.find(h => String(h._id) === headId)?.name || 'Unknown';

                if (data.total >= 0) {
                    entry.demands.push({
                        headId,
                        headName,
                        year: studentYear,
                        amount: data.total
                    });
                    entry.totalDemand += data.total;
                }

                // Only process payment if a Paid column was actually found (value >= 0)
                if (data.paid >= 0) {
                    entry.payments.push({
                        headId,
                        headName,
                        year: studentYear,
                        amount: data.paid,
                        // Prioritize Specific -> Global -> Default. Clean defaults for 0-amount.
                        mode: (function () {
                            const rawMode = (data.paid > 0 ? (data.mode || globalMode || 'Cash') : (data.mode || '')).trim();
                            if (!rawMode) return 'Cash';
                            const m = rawMode.toLowerCase();
                            if (m.includes('upi') || m.includes('phonepe') || m.includes('gpay')) return 'UPI';
                            if (m.includes('cash')) return 'Cash';
                            if (m.includes('cheque')) return 'Cheque';
                            if (m.includes('dd')) return 'DD';
                            if (m.includes('card')) return 'Card';
                            if (m.includes('online') || m.includes('bank') || m.includes('net') || m.includes('transfer') || m.includes('neft') || m.includes('rtgs')) return 'Net Banking';
                            if (m.includes('adjustment')) return 'Adjustment';
                            if (m.includes('waiver')) return 'Waiver';
                            if (m.includes('refund')) return 'Refund';
                            if (m.includes('credit')) return 'Credit';
                            return 'Cash'; // Fallback to safe default
                        })(),
                        date: parseExcelDate(data.date) || parseExcelDate(globalDate) || new Date(),
                        ref: data.ref || globalRef || '',
                        receipt: data.receipt || globalReceipt || '',
                        remarks: data.paid > 0 ? (data.remarks || globalRemarks || `Bulk Upload - Yr ${studentYear}`) : (data.remarks || '')
                    });
                    entry.totalPaid += data.paid;
                }
            });
        }

        const previewData = Array.from(previewDataMap.values());

        // 1. Fetch valid student names from DB
        // Collect all potential IDs (Pin or Admission) to resolve against DB
        const allIds = previewData.map(d => String(d.displayId).trim()).filter(Boolean);

        if (allIds.length > 0) {
            try {
                // Fetch Names
                const [dbStudents] = await db.query(`
                    SELECT admission_number, pin_no, student_name
                    FROM students
                    WHERE pin_no IN (?) OR admission_number IN (?)
                `, [allIds, allIds]);

                const nameMap = {};
                const idToAdmissionMap = {}; // Map Excel ID (Pin/Adm) -> Canonical Admission No

                dbStudents.forEach(s => {
                    const adm = s.admission_number;
                    if (s.pin_no) {
                        const p = s.pin_no.trim().toLowerCase();
                        nameMap[p] = s.student_name;
                        idToAdmissionMap[p] = adm;
                    }
                    if (s.admission_number) {
                        const a = s.admission_number.trim().toLowerCase();
                        nameMap[a] = s.student_name;
                        idToAdmissionMap[a] = adm;
                    }
                });

                // 2. Fetch Existing Demands (StudentFee)
                // We only care about fee heads that are present in the Excel file (to keep the preview focused)
                // Or should we show all? The user said "fetched from fee heads".
                // Since this is a Bulk PAY action primarily, we usually match the columns.
                const relevantHeadIds = [...new Set(columnMap.map(c => c && c.headId).filter(Boolean))];

                let dbDemands = [];
                // Resolve all found IDs to Admission Numbers to query Mongo
                const resolvedAdmissionNos = allIds.map(id => idToAdmissionMap[id.toLowerCase()]).filter(Boolean);
                const uniqueResolvedAdms = [...new Set(resolvedAdmissionNos)];

                if (uniqueResolvedAdms.length > 0) {
                    // Fetch ALL demands for these students, regardless of what's in Excel
                    dbDemands = await StudentFee.find({
                        studentId: { $in: uniqueResolvedAdms }
                    });
                }

                // Map demands: studentId -> [demands]
                const studentDemandsMap = {}; // admissionNo -> [demandDoc, demandDoc]
                dbDemands.forEach(d => {
                    const sid = d.studentId.trim().toLowerCase();
                    if (!studentDemandsMap[sid]) studentDemandsMap[sid] = [];
                    studentDemandsMap[sid].push(d);
                });

                previewData.forEach(entry => {
                    // Use the resolved unique ID (Pin or Admission) we determined earlier
                    const sid = String(entry.displayId).trim().toLowerCase();
                    const realAdmissionNo = idToAdmissionMap[sid];

                    // A. Update Name
                    if (nameMap[sid]) {
                        entry.studentName = nameMap[sid];
                    }

                    if (!realAdmissionNo) return;

                    // B. Merge Demands
                    // We iterate ALL demands found in DB for this student
                    const myDemands = studentDemandsMap[String(realAdmissionNo).trim().toLowerCase()] || [];

                    myDemands.forEach(dbDemand => {
                        const headId = String(dbDemand.feeHead);
                        // Check if we already have a demand entry (from Excel parsing stage)
                        const existingEntryIdx = entry.demands.findIndex(d => String(d.headId) === headId);

                        if (existingEntryIdx !== -1) {
                            // If entry exists (e.g. created because Excel had a column for this head)
                            // Overwrite the amount with DB amount (since we are ignoring Excel Total)
                            // Note: We previously set it to 0 or ignored it. Now we enforce DB value.
                            if (entry.demands[existingEntryIdx].amount !== dbDemand.amount) {
                                // Adjust total demand diff
                                entry.totalDemand -= entry.demands[existingEntryIdx].amount;
                                entry.demands[existingEntryIdx].amount = dbDemand.amount;
                                entry.totalDemand += dbDemand.amount;
                            }
                        } else {
                            // No demand entry yet. Add it.
                            const headName = allFeeHeads.find(h => String(h._id) === headId)?.name || 'Unknown';
                            entry.demands.push({
                                headId: headId,
                                headName: headName,
                                year: dbDemand.studentYear,
                                amount: dbDemand.amount
                            });
                            entry.totalDemand += dbDemand.amount;
                        }
                    });
                });
            } catch (err) {
                console.error('Error enriching preview with DB data:', err);
            }
        }

        res.json({
            message: 'File processed',
            count: previewData.length,
            data: previewData
        });

    } catch (error) {
        console.error('Error processing:', error);
        res.status(500).json({ message: 'Error processing file' });
    }
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
