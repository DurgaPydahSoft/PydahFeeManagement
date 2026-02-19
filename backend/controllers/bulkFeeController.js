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

        const { uploadType, isPendingMode } = req.body; // 'DUE' or 'PAYMENT', isPendingMode boolean
        console.log(`Processing Bulk Upload. Mode: ${uploadType}, PendingMode: ${isPendingMode}`);

        // Fetch all Fee Heads
        const allFeeHeads = await FeeHead.find({});
        
        let miscHead = null;
        if (uploadType === 'DUE') {
            miscHead = allFeeHeads.find(h => h.name.toLowerCase().includes('miscellaneous') && h.name.toLowerCase().includes('due'));
            if (!miscHead) {
                 miscHead = allFeeHeads.find(h => h.name.toLowerCase().includes('miscellaneous') || h.name.toLowerCase().includes('other fees'));
                 
                if (!miscHead) {
                    try {
                        miscHead = await FeeHead.create({
                             name: 'Miscellaneous Due',
                             alias: 'MISC',
                             type: 'General',
                             description: 'Auto-created for Bulk Dues'
                        });
                        console.log('Created new Miscellaneous Due fee head');
                    } catch (err) {
                        miscHead = await FeeHead.findOne({ name: 'Miscellaneous Due' });
                    }
                }
            }
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawData || rawData.length < 2) {
            return res.status(400).json({ message: 'File is empty or missing headers' });
        }

        const row0 = rawData[0]; 

        // Map Columns (Flexible)
        const colMap = {};
        row0.forEach((h, i) => {
            const head = String(h).toUpperCase().replace(/[^A-Z0-9]/g, '');
            // Separate mapping for Admission and Pin
            if (head.includes('ADMN') || head.includes('ADMISSION') || (head.includes('STUDENT') && head.includes('ID'))) colMap.ADMISSION = i;
            if (head.includes('PIN') || head.includes('HTNO') || head.includes('HALLTICKET')) colMap.PIN = i;
            
            // Fallback for generic ID if specific ones not found (legacy support)
            if ((head === 'ID' || head === 'STUDENTID') && colMap.ADMISSION === undefined) colMap.ADMISSION = i;

            if (head.includes('AMOUNT')) colMap.AMOUNT = i;
            if (head.includes('YEAR')) colMap.YEAR = i; 
            if (head.includes('SEM') || head.includes('SEC')) colMap.SEM = i; // Added SEM/SEC support
            
            // Payment specific
            if (head.includes('DATE') && head.includes('TRANS')) colMap.DATE = i;
            if (head.includes('MODE') && head.includes('PAY')) colMap.MODE = i;
            if (head.includes('NARRATION') || head.includes('REMARKS')) colMap.NARRATION = i;
            if (head.includes('REF') || (head.includes('TRANS') && head.includes('ID'))) colMap.REF = i;
            
            // Name for preview
            if (head.includes('NAME') && head.includes('STUDENT')) colMap.NAME = i;
        });

        // DUES MATRIX LOGIC (If DUE mode, look for Fee Heads in Columns)
        const feeHeadColMap = {}; // name -> index
        if (uploadType === 'DUE') {
            row0.forEach((h, i) => {
                const headerText = String(h).toUpperCase().replace(/[^A-Z0-9]/g, '');
                // Try to match against allFeeHeads
                allFeeHeads.forEach(fh => {
                    const fhName = fh.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (headerText === fhName || headerText.includes(fhName)) {
                        feeHeadColMap[fh.name] = i;
                    }
                });
            });
            console.log('Identified Fee Head Columns:', Object.keys(feeHeadColMap));
        }

        if (colMap.ADMISSION === undefined && colMap.PIN === undefined && Object.keys(feeHeadColMap).length === 0 && colMap.AMOUNT === undefined) {
             return res.status(400).json({ message: 'File missing critical columns: Admission No or Pin No.' });
        }

        const previewDataMap = new Map(); 
        let processedCount = 0;

        const parseYear = (val) => {
             if (!val) return 1; 
             const s = String(val).trim();
             if (s.match(/1|one|I/i)) return 1;
             if (s.match(/2|two|II/i)) return 2;
             if (s.match(/3|three|III/i)) return 3;
             if (s.match(/4|four|IV/i)) return 4;
             return parseInt(s) || 1;
        };

        const parseDate = (xlsDate) => {
             if (!xlsDate) return new Date();
             if (typeof xlsDate === 'number') return new Date((xlsDate - (25569)) * 86400 * 1000);
             const str = String(xlsDate).trim();
             const attempt = new Date(str);
             return isNaN(attempt.getTime()) ? new Date() : attempt;
        };

        // Improved SECID Parser
        const parseSecId = (val) => {
            if (!val) return { year: null, semester: null };
            const s = String(val).trim().toUpperCase();

            // Format 1: "2-1" or "2/1" (Year-Sem)
            if (s.includes('-') || s.includes('/')) {
                const parts = s.split(/[-/]/);
                return { year: parseInt(parts[0]) || null, semester: parseInt(parts[1]) || null };
            }
            
            // Format 2: "11A", "22C", "31B" (YearSemSuffix) -> 2 digits followed by optional letters
            // ^(\d)(\d)
            const match = s.match(/^(\d)(\d)/);
            if (match) {
                return { year: parseInt(match[1]), semester: parseInt(match[2]) };
            }

            // Format 3: "I", "II" (Roman numerals for Year or Sem? Ambiguous. Assume Sem 1, Year = Roman)
            if (s.match(/^(I|II|III|IV)$/)) {
                let y = 1;
                if (s === 'II') y = 2;
                if (s === 'III') y = 3;
                if (s === 'IV') y = 4;
                return { year: y, semester: 1 }; // Default sem 1
            }

            // Format 4: Just a number "1", "2" -> Generally Sem? or Year? 
            // If explicit YEAR column exists, this is Sem. If not, it's ambiguous. 
            // Let's assume it's just Sem if Year is handled elsewhere, or Year if only column?
            // Safer to return just semester if single digit.
            const n = parseInt(s);
            if (!isNaN(n)) return { year: null, semester: n };

            return { year: null, semester: 1 };
        };

        // --- PROCESSING LOOP ---
        for (let r = 1; r < rawData.length; r++) {
            const row = rawData[r]; // Array of values
            
            // Get ID (Try Admission, then Pin, then fallback)
            let rawId = null;
            if (colMap.ADMISSION !== undefined && row[colMap.ADMISSION]) rawId = row[colMap.ADMISSION];
            if (!rawId && colMap.PIN !== undefined && row[colMap.PIN]) rawId = row[colMap.PIN];
            // Backward compatibility if generic ID was mapped (not needed if we split logic well, but safer)
            if (!rawId && colMap.ID !== undefined && row[colMap.ID]) rawId = row[colMap.ID];

            if (!rawId) continue;
            const cleanId = String(rawId).trim();
            // In Matrix mode, 'amount' column might not exist, we check specific Fee Cols later
            const defaultAmount = colMap.AMOUNT !== undefined ? (parseFloat(row[colMap.AMOUNT]) || 0) : 0;


            const name = colMap.NAME !== undefined ? row[colMap.NAME] : 'Unknown';
            
            // Resolve Year & Semester
            // 1. Try explicit columns
            let year = colMap.YEAR !== undefined ? parseYear(row[colMap.YEAR]) : 1;
            let semester = 1;

            // 2. Try SECID logic (Override or Augment)
            if (colMap.SEM !== undefined) {
                const secParsed = parseSecId(row[colMap.SEM]);
                if (secParsed.semester) semester = secParsed.semester;
                // If explicit Year was NOT found, or SECID provides a valid year, use SECID's year?
                // User said "From Year we extracting... 11A". It's a strong signal.
                // Let's trust SECID's year if present, especially if colMap.YEAR is missing.
                // Even if colMap.YEAR is present, SECID "11A" strongly implies Year 1.
                if (secParsed.year) year = secParsed.year;
            }

            if (!previewDataMap.has(cleanId)) {
                previewDataMap.set(cleanId, {
                    id: r,
                    displayId: cleanId, 
                    studentName: name, 
                    totalDemand: 0, 
                    totalPaid: 0,
                    demands: [],
                    payments: [],
                    year: year, 
                    semester: semester, 
                    admissionNumber: null,
                    pinNumber: null,
                    college: 'Unknown',
                    course: 'Unknown',
                    branch: 'Unknown',
                    batch: '2024-2025' // Default fallback
                });
            }
            const entry = previewDataMap.get(cleanId);

            if (uploadType === 'DUE') {
                // DUES MODE
                // 1. Check Matrix Columns First
                let matrixFound = false;
                Object.keys(feeHeadColMap).forEach(headName => {
                    const idx = feeHeadColMap[headName];
                    const val = parseFloat(row[idx]);
                    if (val > 0) {
                        matrixFound = true;
                        const headObj = allFeeHeads.find(h => h.name === headName);
                        entry.demands.push({
                            headId: headObj ? headObj._id.toString() : 'UNKNOWN',
                            headName: headName,
                            year: year,
                            semester: semester,
                            amount: val
                        });
                        entry.totalDemand += val;
                    }
                });

                // 2. Fallback to Single Amount Column if no Matrix columns found OR if Amount col exists
                if (!matrixFound && defaultAmount > 0) {
                     entry.demands.push({
                        headId: miscHead ? miscHead._id.toString() : 'UNKNOWN',
                        headName: miscHead ? miscHead.name : 'Miscellaneous Due',
                        year: year,
                        semester: semester,
                        amount: defaultAmount
                    });
                    entry.totalDemand += defaultAmount;
                }

            } else {
                const amount = defaultAmount;
                if (amount <= 0) continue; // Skip if no amount in payment mode
                entry.payments.push({
                    headId: feeHeadInfo ? feeHeadInfo._id.toString() : 'UNKNOWN',
                    headName: feeHeadInfo ? feeHeadInfo.name : 'Unknown Fee',
                    year: year,
                    semester: semester,
                    amount: amount,
                    mode: payMode,
                    date: transDate,
                    ref: ref,
                    remarks: narration
                });
                entry.totalPaid += amount;
            }
            
            processedCount++;
        }

        const previewData = Array.from(previewDataMap.values());
        
        // --- DATA ENRICHMENT (SQL) ---
        // Resolve Pin/Admission -> Real Admission Number & Batch
        const allIds = previewData.map(d => d.displayId);
        
        // Chunking the SQL query to avoid limits if too many students
        if (allIds.length > 0) {
            // We'll just take unique IDs
            const uniqueIds = [...new Set(allIds)];
            
             const [students] = await db.query(`
                SELECT admission_number, pin_no, student_name, batch, college, course, branch, current_year
                FROM students 
                WHERE pin_no IN (?) OR admission_number IN (?)
            `, [uniqueIds, uniqueIds]);

            const dbMap = {}; // Key: lowercase ID (pin or adm) -> Student Obj
            students.forEach(s => {
                const adm = s.admission_number.trim().toLowerCase();
                const pin = s.pin_no ? s.pin_no.trim().toLowerCase() : null;
                dbMap[adm] = s;
                if (pin) dbMap[pin] = s;
            });

            previewData.forEach(entry => {
                const key = entry.displayId.toLowerCase();
                const match = dbMap[key];
                if (match) {
                    entry.studentName = match.student_name; // Prioritize SQL name
                    entry.admissionNumber = match.admission_number;
                    entry.pinNumber = match.pin_no;
                    entry.batch = match.batch;
                    entry.college = match.college;
                    entry.course = match.course;
                    entry.branch = match.branch;
                }
            });
                }


            // --- PENDING DUES MODE EXTRACTION ---
            if (uploadType === 'DUE' && isPendingMode === 'true') {
                 console.log('Calculating Payments from Pending Dues...');
                 // We need to fetch EXISTING DEMANDS for these students to calculate the difference
                 // Query StudentFee for these students
                 const allAdmNos = previewData.map(d => d.admissionNumber).filter(Boolean);
                 
                 if (allAdmNos.length > 0) {

                     // FETCH FROM MONGOOSE (StudentFee is MongoDB)
                     const existingDemands = await StudentFee.find({
                         studentId: { $in: allAdmNos }
                     }).select('studentId feeHead amount studentYear');


                     const demandMap = {}; // key: studentId-feeHeadId-Year -> amount
                     existingDemands.forEach(d => {
                         demandMap[`${d.studentId}-${d.feeHead}-${d.studentYear}`] = Number(d.amount);
                     });

                     // Now iterate preview data and CONVERT Demands to Payments based on difference
                     previewData.forEach(entry => {
                         if (!entry.admissionNumber) return; // Can't calc without valid student

                         const newDemands = []; // We might NOT keep demands if we are just creating payments? 
                         // actually user said "upload the list as 2000... then 3000 will be saved in transaction".
                         // Does this mean we UPDATE the Demand to 2000? NO.
                         // Fee Structure says 5000. He paid 3000. Pending is 2000.
                         // If we upload 2000, we want to result in: Demand 5000, Paid 3000.
                         // So we should NOT touch the Demand (unless it's missing?).
                         // But the "Dues Upload" logic usually *creates* demands.
                         // In "Pending Mode", we use the upload value ONLY to calculate payment.
                         // We should NOT create a formatted Demand entry in `entry.demands` that would overwrite the 5000.
                         
                         // Move items from entry.demands to entry.payments essentially
                         const calculatedPayments = [];
                         
                         entry.demands.forEach(d => {
                             // d.amount is the PENDING amount (e.g. 2000)
                             // Key MUST include Year now to match specific fee structure
                             const key = `${entry.admissionNumber}-${d.headId}-${d.year}`;
                             const totalFee = demandMap[key] || 0;
                             
                             // console.log(`DEBUG PENDING: Student ${entry.admissionNumber}, Head ${d.headName}, Year ${d.year}`);
                             // console.log(`- Uploaded Pending (Excel): ${d.amount}`);
                             // console.log(`- Total Fee (DB): ${totalFee}`);
                             
                             if (totalFee > 0 && totalFee >= d.amount) {
                                 const paidAmount = totalFee - d.amount;
                                 // console.log(`- Calculated Paid: ${paidAmount}`);
                                 
                                 if (paidAmount > 0) {
                                     calculatedPayments.push({
                                         headId: d.headId,
                                         headName: d.headName,
                                         year: d.year,
                                         semester: d.semester,
                                         amount: paidAmount,
                                         mode: 'Cash', // Default
                                         date: new Date(),
                                         remarks: 'Auto-generated from Pending Due Upload',
                                         meta: {
                                             totalDemand: totalFee,
                                             pendingAmount: d.amount
                                         }
                                     });
                                     entry.totalPaid += paidAmount;
                                 }
                             } else {
                                 // Warning: Pending amount > Total Fee? or No Total Fee found.
                                 // In this case, we can't calculate 'Paid'. 
                                 // Maybe treat it as a direct Demand update? Or just warn?
                                 // User expectation: "I want to upload list as 2000... 3000 saved as paid".
                                 // If Total is 0, we can't do this.
                                 console.warn(`Skipping Pending Due Calc for ${entry.studentName} - Head ${d.headName}. Total Fee (${totalFee}) < Pending (${d.amount}) or not found.`);
                             }
                         });

                         // REPLACE Demands with Payments for the final Save operation
                         // We clear demands because we don't want to overwrite the 5000 with 2000.
                         entry.demands = []; 

                         entry.payments.push(...calculatedPayments);
                     });
                 }
            }


        res.json({
            message: `Processed ${uploadType}: ${processedCount} records.`,
            count: previewData.length,
            data: previewData,
            warnings: previewData.filter(d => d.payments.some(p => p.headId === 'UNKNOWN')).length > 0 ? 'Some fee heads could not be identified.' : null
        });

    } catch (error) {
        console.error('Error processing bulk upload:', error);
        res.status(500).json({ message: 'Processing Failed', error: error.message });
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
                            semester: d.semester || 1, // Include Semester!
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
                        if (p.amount > 0) {
                        transactionDocs.push({
                            studentId: finalStudentId,
                            studentName: stud.studentName,
                            feeHead: p.headId,
                            amount: p.amount,
                            transactionType: 'DEBIT',
                            paymentMode: p.mode || 'Cash',
                            paymentDate: parseDate(p.date),
                            referenceNo: p.ref || '',
                            receiptNumber: p.receipt || '',
                            remarks: p.remarks || `Bulk Upload - Yr ${sYear}`,
                            studentYear: sYear,
                            semester: p.semester || 1, // Include Semester!
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
                // Key: StudentID-FeeHead-Year-Batch-Semester
                const key = `${d.studentId}-${d.feeHead}-${d.studentYear}-${d.academicYear}-${d.semester}`;
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
        const { type } = req.query; // 'DUE' or 'PAYMENT'
        const feeHeads = await FeeHead.find({});

        // Define Headers
        const mainHeaders = ['Admission No', 'Pin No', 'Student Name', 'Course', 'Branch', 'Year'];
        
        if (type === 'DUE') {
            // DUES TEMPLATE: Simple Matrix (One column per Fee Head)
            feeHeads.forEach(head => {
                // Sanitize head name for header (remove special chars if needed, but keeping it simple is best)
                mainHeaders.push(head.name);
            });
            // No sub-headers needed for Dues in this simple matrix format
             const ws = xlsx.utils.aoa_to_sheet([mainHeaders]);
             
             // Set widths
             const wscols = [
                { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 8 }
            ];
            feeHeads.forEach(() => wscols.push({ wch: 15 }));
            ws['!cols'] = wscols;

            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, 'Dues Template');
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Disposition', 'attachment; filename="BulkDuesTemplate.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);

        } else {
            // PAYMENTS TEMPLATE (Legacy/Detailed)
            const subHeaders = ['', '', '', '', '', ''];
            
            // Fee Heads Columns (6 per head)
            feeHeads.forEach(head => {
                mainHeaders.push(head.name, '', '', '', '', '');
                subHeaders.push('Paid', 'Mode', 'Date', 'Ref', 'Receipt', 'Remarks');
            });

             // Add Global columns
            mainHeaders.push('Global Default Mode', 'Global Default Date', 'Global Default Ref No', 'Global Default Receipt No', 'Global Default Remarks');
            subHeaders.push('', '', '', '', '');

            const wb = xlsx.utils.book_new();
            const wsData = [mainHeaders, subHeaders];
            const ws = xlsx.utils.aoa_to_sheet(wsData);

            // ... (Existing Merge Logic for Payment Template) ...
            const merges = [];
            merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
            merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } });
            merges.push({ s: { r: 0, c: 2 }, e: { r: 1, c: 2 } });
            merges.push({ s: { r: 0, c: 3 }, e: { r: 1, c: 3 } });
            merges.push({ s: { r: 0, c: 4 }, e: { r: 1, c: 4 } });
            merges.push({ s: { r: 0, c: 5 }, e: { r: 1, c: 5 } });

            let colIdx = 6;
            feeHeads.forEach(() => {
                merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + 5 } });
                colIdx += 6;
            });
            merges.push({ s: { r: 0, c: colIdx }, e: { r: 1, c: colIdx } });
            merges.push({ s: { r: 0, c: colIdx + 1 }, e: { r: 1, c: colIdx + 1 } });
            merges.push({ s: { r: 0, c: colIdx + 2 }, e: { r: 1, c: colIdx + 2 } });
            merges.push({ s: { r: 0, c: colIdx + 3 }, e: { r: 1, c: colIdx + 3 } });
            merges.push({ s: { r: 0, c: colIdx + 4 }, e: { r: 1, c: colIdx + 4 } });

            ws['!merges'] = merges;
            
             // Set column widths
            const wscols = [
                { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 8 }
            ];
            feeHeads.forEach(() => {
                wscols.push({ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 });
            });
            wscols.push({ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 });
            ws['!cols'] = wscols;

            xlsx.utils.book_append_sheet(wb, ws, 'Payment Template');
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Disposition', 'attachment; filename="BulkPaymentTemplate.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        }

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
