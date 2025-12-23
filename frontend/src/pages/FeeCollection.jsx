import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import Sidebar from './Sidebar';
import ReceiptTemplate from '../components/ReceiptTemplate';

const FeeCollection = () => {
    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [student, setStudent] = useState(null);
    const [foundStudents, setFoundStudents] = useState([]); // Array for multiple matches
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fee Details
    const [feeDetails, setFeeDetails] = useState([]);
    // View Filter (Year)
    const [viewFilterYear, setViewFilterYear] = useState('ALL');

    // Multi-Select State (Dynamic Inputs)
    // List of { id: unique_id, feeHeadId: '', amount: '' }
    const [feeRows, setFeeRows] = useState([{ id: Date.now(), feeHeadId: '', amount: '' }]);

    // Payment Form (Global settings for the batch)
    const [paymentForm, setPaymentForm] = useState({
        paymentMode: 'Cash',
        remarks: '',
        transactionType: 'DEBIT',
        bankName: '',
        instrumentDate: '',
        referenceNo: ''
    });

    const [paymentCategory, setPaymentCategory] = useState('Cash'); // 'Cash' | 'Bank'

    // History
    const [transactions, setTransactions] = useState([]);

    // Modals
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false); // Confirmation Modal

    const [lastTransaction, setLastTransaction] = useState(null); // Primary transaction object
    const [relatedTransactions, setRelatedTransactions] = useState([]); // All transactions in the batch
    const receiptRef = useRef();

    // Print Handler
    const handlePrintReceipt = useReactToPrint({
        contentRef: receiptRef,
        documentTitle: lastTransaction ? `Receipt-${lastTransaction.receiptNumber}` : 'Receipt',
        onAfterPrint: () => setShowReceiptModal(false)
    });


    // Helper: Fetch Student Data (Avoids UI flicker/reset)
    const fetchStudentData = async (selectedStudent) => {
        try {
            // 1. Fetch Full Student Details (including Photo)
            const fullStudentRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/${selectedStudent.admission_number}`);
            const found = fullStudentRes.data;

            const college = found.college;
            const course = found.course;
            const branch = found.branch;
            const studentYear = found.current_year;
            // 2. Fetch Fee Details (Fetch ALL Years)
            const feesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-structures/student/${found.admission_number}`, {
                params: { college, course, branch, studentYear } // Removed academicYear to fetch all history
            });
            setFeeDetails(feesRes.data);

            // 3. Fetch History
            const histRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/transactions/student/${found.admission_number}`);
            setTransactions(histRes.data);

            // Update student object in case it changed (though unlikely for same ID)
            setStudent(found);

        } catch (error) {
            console.error(error);
            setError('Error refreshing student details.');
        }
    };


    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        setStudent(null);
        setFeeDetails([]);
        setViewFilterYear('ALL');
        setFoundStudents([]);
        setTransactions([]);
        setFeeRows([{ id: Date.now(), feeHeadId: '', amount: '' }]); // Reset Rows

        try {
            // 1. Fetch Student from SQL (Scoped)
            const user = JSON.parse(localStorage.getItem('user'));
            const isSuperAdmin = user?.role === 'superadmin';
            const collegeParam = (!isSuperAdmin && user?.college) ? `?college=${encodeURIComponent(user.college)}` : '';

            const studentsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/students${collegeParam}`);

            // Allow searching by Name, Admission No, Mobile, or Pin No
            const matches = studentsRes.data.filter(s =>
                s.admission_number === searchQuery ||
                s.admission_no === searchQuery ||
                s.student_mobile === searchQuery ||
                s.pin_no === searchQuery ||
                (s.student_name && s.student_name.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            if (matches.length === 0) {
                setError('Student not found. Please check Admission No, Mobile, or Pin No.');
                setLoading(false);
                return;
            }

            if (matches.length === 1) {
                selectStudent(matches[0]);
            } else {
                setFoundStudents(matches);
                setLoading(false);
            }

        } catch (err) {
            console.error(err);
            setError('Error fetching data. Ensure student has valid details.');
            setLoading(false);
        }
    };

    const selectStudent = async (selectedStudent) => {
        setFoundStudents([]);
        setLoading(true);
        setStudent(selectedStudent);
        await fetchStudentData(selectedStudent);
        setLoading(false);
    };

    // --- Dynamic Row Handlers ---
    const addFeeRow = () => {
        setFeeRows([...feeRows, { id: Date.now(), feeHeadId: '', amount: '' }]);
    };

    const removeFeeRow = (id) => {
        if (feeRows.length === 1) return; // Don't remove the last row
        setFeeRows(feeRows.filter(row => row.id !== id));
    };

    const updateFeeRow = (id, field, value) => {
        const newRows = feeRows.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [field]: value };
                // Auto-fill amount if feeHeadId changes
                if (field === 'feeHeadId') {
                    const selectedFee = feeDetails.find(f => f.feeHeadId === value);
                    if (selectedFee) {
                        updatedRow.amount = selectedFee.dueAmount > 0 ? selectedFee.dueAmount : '';
                    } else {
                        updatedRow.amount = '';
                    }
                }
                return updatedRow;
            }
            return row;
        });
        setFeeRows(newRows);
    };
    // ----------------------------

    // Step 1: Trigger Confirmation
    const handlePrePayment = (e) => {
        e.preventDefault();

        // Validation
        const validRows = feeRows.filter(r => r.feeHeadId && Number(r.amount) > 0);
        if (validRows.length === 0) {
            alert('Please select at least one Fee Head and enter a valid amount.');
            return;
        }

        setShowConfirmModal(true);
    };

    // Step 2: Actual Submission
    const confirmAndPay = async () => {
        try {
            const validRows = feeRows.filter(r => r.feeHeadId && Number(r.amount) > 0);

            // Build Common Data
            const commonData = {
                studentId: student.admission_number,
                studentName: student.student_name,
                semester: student.current_semester,
                studentYear: student.current_year,
                transactionType: paymentForm.transactionType || 'DEBIT',
                remarks: paymentForm.remarks,
                collectedBy: JSON.parse(localStorage.getItem('user'))?.username || 'Unknown',
                collectedByName: JSON.parse(localStorage.getItem('user'))?.name || 'Unknown'
            };

            // Payment Mode Details
            if (paymentForm.transactionType === 'DEBIT') {
                commonData.paymentMode = paymentForm.paymentMode;
                if (paymentCategory === 'Bank') {
                    commonData.bankName = paymentForm.bankName;
                    commonData.instrumentDate = paymentForm.instrumentDate;
                    commonData.referenceNo = paymentForm.referenceNo;
                }
            } else {
                commonData.paymentMode = 'Credit';
            }

            // Create Batch Array
            const batchTransactions = validRows.map(row => ({
                ...commonData,
                feeHeadId: row.feeHeadId,
                amount: Number(row.amount)
            }));

            // Send as { transactions: [...] } to match Backend Batch Interface
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                transactions: batchTransactions
            });

            // Success!!
            const responseData = res.data;
            setLastTransaction(responseData);
            setRelatedTransactions(responseData.relatedTransactions || [responseData]);

            setShowConfirmModal(false); // Close Confirm
            setShowReceiptModal(true); // Show Receipt

            // Refresh Data
            await fetchStudentData(student);
            setFeeRows([{ id: Date.now(), feeHeadId: '', amount: '' }]); // Reset to 1 empty row

            setPaymentForm(prev => ({
                ...prev,
                remarks: '',
                amount: '',
                bankName: '', instrumentDate: '', referenceNo: ''
            }));

        } catch (error) {
            console.error(error);
            alert('Payment Failed');
            setShowConfirmModal(false);
        }
    };

    // Filter Logic
    const [historyFilter, setHistoryFilter] = useState({ mode: '', feeHead: '' });
    const uniqueFeeHeads = [...new Set(transactions.map(t => t.feeHead?.name).filter(Boolean))];
    const filteredTransactions = transactions.filter(t => {
        if (historyFilter.mode && t.paymentMode !== historyFilter.mode) return false;
        if (historyFilter.feeHead && t.feeHead?.name !== historyFilter.feeHead) return false;
        return true;
    });

    const totalSelectedAmount = feeRows.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    // Filter Fee Details for Display
    const uniqueAcademicYears = [...new Set(feeDetails.map(f => f.academicYear))].sort().reverse();

    const displayedFees = feeDetails.filter(f => {
        if (viewFilterYear === 'ALL') return true;
        return f.academicYear === viewFilterYear;
    });

    // Total Due calculation should be based on displayed, or total?
    // Usually "Total Due" implies everything the student owes. User wants to see "All years", so Total Due should match view or match all.
    // Let's make "Total Due" represent EVERYTHING (Global Debt), but table shows breakdown.
    // Or simpler: Total Due matches the table bottom line. 
    // Let's stick to: Total Due at bottom of table = Sum of displayed rows.
    const totalDueAmount = displayedFees.reduce((acc, curr) => acc + curr.dueAmount, 0);
    const globalTotalDue = feeDetails.reduce((acc, curr) => acc + curr.dueAmount, 0);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6 relative">

                {/* Header with Search */}
                <header className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4 px-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Fee Collection</h1>
                        <p className="text-sm text-gray-500">Collect fees and manage transactions.</p>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Admn No / Mobile / Name"
                            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition text-sm shadow-sm">
                            Search
                        </button>
                    </form>
                </header>

                {error && <p className="text-red-500 mb-4 bg-red-50 p-2 rounded border border-red-100">{error}</p>}

                {loading && !student && <div className="text-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>}

                {foundStudents.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-gray-700 mb-3">Select Student ({foundStudents.length} matches found)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {foundStudents.map((s) => (
                                <div key={s.admission_number} onClick={() => selectStudent(s)} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition">
                                    <h4 className="font-bold text-blue-900">{s.student_name}</h4>
                                    <p className="text-sm text-gray-600">{s.course} - {s.branch}</p>
                                    <p className="text-xs text-gray-500 mt-1">Adm: {s.admission_number} | Year: {s.current_year}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Placeholder State */}
                {!loading && !student && foundStudents.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm border border-gray-200 border-dashed">
                        <div className="bg-blue-50 p-6 rounded-full mb-4">
                            <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to Collect Fees</h3>
                        <p className="text-gray-500 max-w-sm text-center">
                            Search for a student using the bar above to get started.
                        </p>
                    </div>
                )}

                {student && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Student Info, Fee Dues & Payment History */}
                        <div className="lg:col-span-2 space-y-4">

                            {/* Student Card (Compact - Single Row) */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-wrap items-center gap-6 text-sm">
                                {/* Image & Name */}
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                                        {student.student_photo ? (
                                            <img
                                                src={student.student_photo.startsWith('data:') ? student.student_photo : `data:image/jpeg;base64,${student.student_photo}`}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xl">🎓</div>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-800 text-lg">{student.student_name}</h2>
                                        <p className="text-xs text-blue-600 font-semibold">{student.course} - {student.branch}</p>
                                    </div>
                                </div>

                                <div className="hidden md:block h-10 w-px bg-gray-200"></div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 md:flex md:items-center gap-x-6 gap-y-2">
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Admission No</span>
                                        <span className="font-bold text-gray-700 font-mono">{student.admission_number}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Pin No</span>
                                        <span className="font-bold text-gray-700 font-mono">{student.pin_no || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Year</span>
                                        <span className="font-bold text-gray-700">{student.current_year}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Sem</span>
                                        <span className="font-bold text-gray-700 font-mono">{student.current_semester}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Mobile</span>
                                        <span className="font-bold text-gray-700">{student.student_mobile}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fee Summary Table */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-gray-700">Fee Dues ({viewFilterYear === 'ALL' ? 'All Years' : viewFilterYear})</h3>
                                        <select
                                            className="text-xs border border-gray-300 rounded p-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={viewFilterYear}
                                            onChange={(e) => setViewFilterYear(e.target.value)}
                                        >
                                            <option value="ALL">All Years</option>
                                            {uniqueAcademicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-xs font-bold text-gray-500">Global Due: <span className="text-red-600">₹{globalTotalDue.toLocaleString()}</span></span>
                                        {loading && <span className="text-xs text-blue-500 animate-pulse">Refreshing...</span>}
                                    </div>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600">Year / Sem</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600">Fee Head</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Total Fee</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Paid</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {displayedFees.length === 0 ? (
                                            <tr><td colSpan="5" className="py-6 text-center text-gray-500">No fees found for this selection.</td></tr>
                                        ) : (
                                            <>
                                                {displayedFees.map((fee, idx) => (
                                                    <tr key={idx} className={fee.dueAmount > 0 ? "bg-red-50" : ""}>
                                                        <td className="py-2 px-4 text-xs text-gray-500">
                                                            <div className="font-bold">{fee.academicYear}</div>
                                                            <div>Yr {fee.studentYear} {fee.semester ? `- S${fee.semester}` : ''}</div>
                                                        </td>
                                                        <td className="py-2 px-4 text-sm font-medium">{fee.feeHeadName}</td>
                                                        <td className="py-2 px-4 text-sm text-right">₹{fee.totalAmount.toLocaleString()}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-green-600">₹{fee.paidAmount.toLocaleString()}</td>
                                                        <td className="py-2 px-4 text-sm text-right font-bold text-red-600">₹{fee.dueAmount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                {/* Total Row */}
                                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                                    <td className="py-2 px-4 text-sm text-gray-800 text-right" colSpan="4">Total Due ({viewFilterYear === 'ALL' ? 'All' : viewFilterYear}):</td>
                                                    <td className="py-2 px-4 text-sm text-right text-red-700">₹{totalDueAmount.toLocaleString()}</td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment History */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-gray-800">Payment History</h3>
                                    <div className="flex gap-2 text-xs">
                                        <select className="border rounded p-1" value={historyFilter.mode} onChange={e => setHistoryFilter({ ...historyFilter, mode: e.target.value })}>
                                            <option value="">All Modes</option>
                                            <option>Cash</option>
                                            <option>UPI</option>
                                            <option>Cheque</option>
                                            <option>DD</option>
                                            <option>Waiver</option>
                                        </select>
                                        <select className="border rounded p-1 max-w-[150px]" value={historyFilter.feeHead} onChange={e => setHistoryFilter({ ...historyFilter, feeHead: e.target.value })}>
                                            <option value="">All Fee Heads</option>
                                            {uniqueFeeHeads.map(fh => <option key={fh} value={fh}>{fh}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b sticky top-0">
                                            <tr>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600 whitespace-nowrap">Date</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600">Description</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600 whitespace-nowrap">Receipt No</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-center">Mode</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-center">Year / Sem</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Amount</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-gray-600">Remarks</th>
                                                <th className="py-2 px-4 text-xs font-semibold text-right text-gray-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredTransactions.length === 0 ? (
                                                <tr><td colSpan="8" className="py-6 text-center text-gray-500">No matching transactions found.</td></tr>
                                            ) : (
                                                filteredTransactions.map((t, i) => (
                                                    <TransactionRow
                                                        key={t._id || i}
                                                        transaction={t}
                                                        allTransactions={transactions} // Pass full history to find batch siblings
                                                        student={student}
                                                        totalDue={totalDueAmount}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Payment Form Only */}
                        <div className="space-y-4">
                            {/* Payment Tabs */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="flex border-b">
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'DEBIT' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'DEBIT' })}
                                    >
                                        Collect Fee
                                    </button>
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'CREDIT' ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'CREDIT' })}
                                    >
                                        Concession
                                    </button>
                                </div>

                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                                        <h3 className={`font-bold ${paymentForm.transactionType === 'DEBIT' ? 'text-blue-700' : 'text-purple-700'}`}>
                                            {paymentForm.transactionType === 'DEBIT' ? 'Record Payment Info' : 'Record Concession / Waiver'}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={addFeeRow}
                                            className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200 transition"
                                            title="Add Another Fee Head"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                    </div>

                                    <form onSubmit={handlePrePayment} className="space-y-3">

                                        {/* Dynamic Rows */}
                                        <div className="space-y-3">
                                            {feeRows.map((row, index) => (
                                                <div key={row.id} className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-200">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fee Head {index + 1}</label>
                                                        <select
                                                            className="w-full border p-1 rounded text-sm"
                                                            value={row.feeHeadId}
                                                            onChange={e => updateFeeRow(row.id, 'feeHeadId', e.target.value)}
                                                            required
                                                        >
                                                            <option value="">-- Select --</option>
                                                            {displayedFees.map(f => ( // Updated to show filtered
                                                                <option key={f.feeHeadId} value={f.feeHeadId}>
                                                                    [{f.academicYear}] {f.feeHeadName} (Due: ₹{f.dueAmount})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount</label>
                                                        <input
                                                            type="number"
                                                            className="w-full border p-1 rounded text-sm"
                                                            value={row.amount}
                                                            onChange={e => updateFeeRow(row.id, 'amount', e.target.value)}
                                                            required
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    {feeRows.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeeRow(row.id)}
                                                            className="mt-6 text-gray-400 hover:text-red-500"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total Summary */}
                                        <div className="flex justify-between items-center py-2 border-t border-b mt-2">
                                            <span className="font-bold text-gray-600">Total Amount:</span>
                                            <span className="text-xl font-bold text-blue-700">₹{totalSelectedAmount}</span>
                                        </div>

                                        {/* PAYMENT MODE SELECTION (Only for DEBIT) */}
                                        {paymentForm.transactionType === 'DEBIT' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Mode</label>
                                                <div className="flex gap-4 mb-2">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="cat" checked={paymentCategory === 'Cash'} onChange={() => { setPaymentCategory('Cash'); setPaymentForm({ ...paymentForm, paymentMode: 'Cash' }); }} />
                                                        <span className="text-sm font-medium">Cash</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="cat" checked={paymentCategory === 'Bank'} onChange={() => { setPaymentCategory('Bank'); setPaymentForm({ ...paymentForm, paymentMode: 'UPI' }); }} />
                                                        <span className="text-sm font-medium">Bank</span>
                                                    </label>
                                                </div>

                                                {/* Sub-options for Bank */}
                                                {paymentCategory === 'Bank' && (
                                                    <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-400">Bank Option</label>
                                                            <select className="w-full border p-2 rounded mt-1 bg-white" value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                                                                <option value="UPI">UPI</option>
                                                                <option value="Cheque">Cheque</option>
                                                                <option value="DD">Demand Draft (DD)</option>
                                                                <option value="Card">Card</option>
                                                                <option value="Net Banking">Net Banking</option>
                                                            </select>
                                                        </div>
                                                        {['UPI', 'Net Banking', 'Card'].includes(paymentForm.paymentMode) && (
                                                            <div>
                                                                <label className="text-xs font-bold text-gray-400">Transaction / Ref No *</label>
                                                                <input type="text" className="w-full border p-2 rounded mt-1" placeholder="e.g. UPI Ref No" value={paymentForm.referenceNo || ''} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} required />
                                                            </div>
                                                        )}
                                                        {['Cheque', 'DD'].includes(paymentForm.paymentMode) && (
                                                            <>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="text-xs font-bold text-gray-400">{paymentForm.paymentMode} No *</label>
                                                                        <input type="text" className="w-full border p-2 rounded mt-1" value={paymentForm.referenceNo || ''} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} required />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-bold text-gray-400">Date *</label>
                                                                        <input type="date" className="w-full border p-2 rounded mt-1" value={paymentForm.instrumentDate || ''} onChange={e => setPaymentForm({ ...paymentForm, instrumentDate: e.target.value })} required />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-bold text-gray-400">Bank Name *</label>
                                                                    <input type="text" className="w-full border p-2 rounded mt-1" placeholder="e.g. SBI, HDFC" value={paymentForm.bankName || ''} onChange={e => setPaymentForm({ ...paymentForm, bankName: e.target.value })} required />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Remarks</label>
                                            <textarea
                                                className="w-full border p-2 rounded mt-1"
                                                rows="2"
                                                value={paymentForm.remarks}
                                                onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                            ></textarea>
                                        </div>
                                        <button disabled={totalSelectedAmount <= 0} className={`w-full text-white font-bold py-2 rounded shadow-md transition-colors ${totalSelectedAmount <= 0 ? 'bg-gray-400 cursor-not-allowed' : (paymentForm.transactionType === 'DEBIT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700')}`}>
                                            {paymentForm.transactionType === 'DEBIT' ? `Collect ₹${totalSelectedAmount}` : `Process Concession ₹${totalSelectedAmount}`}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIRMATION MODAL */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 transition-all duration-300">
                        <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden border border-gray-100 transform scale-100 transition-transform">
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Payment?</h3>

                                <div className="space-y-2 mb-6">
                                    {feeRows.filter(r => r.feeHeadId && r.amount > 0).map((row, idx) => {
                                        const fh = feeDetails.find(f => f.feeHeadId === row.feeHeadId);
                                        return (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-gray-600">{fh ? fh.feeHeadName : 'Fee Head'}</span>
                                                <span className="font-bold">₹{row.amount}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base mt-2">
                                        <span>Total</span>
                                        <span className="text-blue-600">₹{totalSelectedAmount}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2">
                                        Mode: <span className="font-semibold">{paymentForm.paymentMode}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={confirmAndPay}
                                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700"
                                    >
                                        Yes, Confirm
                                    </button>
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* RECEIPT MODAL */}
                {showReceiptModal && (lastTransaction || relatedTransactions.length > 0) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 transition-all duration-300">
                        <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transform scale-100 transition-transform">
                            <div className="bg-green-600 text-white p-4 flex justify-between items-center">
                                <h3 className="text-lg font-bold">✓ Transaction Successful</h3>
                                <button onClick={() => setShowReceiptModal(false)} className="text-white hover:bg-green-700 rounded-full p-1">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 text-center">
                                <div className="mb-4">
                                    <p className="text-gray-600">Successfully recorded transaction(s).</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-1">₹{relatedTransactions.reduce((acc, t) => acc + t.amount, 0)}</p>
                                    <p className="text-sm text-gray-500 mt-2">Receipt No: {lastTransaction?.receiptNumber}</p>

                                    {/* Small breakdown if multiple */}
                                    {relatedTransactions.length > 1 && (
                                        <div className="mt-4 bg-gray-50 p-2 rounded text-xs text-left max-h-32 overflow-y-auto">
                                            {relatedTransactions.map((t, i) => (
                                                <div key={i} className="flex justify-between border-b last:border-0 py-1">
                                                    <span>{t.feeHead?.name || 'Fee'}</span>
                                                    <span className="font-bold">₹{t.amount}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={handlePrintReceipt}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Print Receipt
                                    </button>
                                    <button
                                        onClick={() => setShowReceiptModal(false)}
                                        className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-200"
                                    >
                                        Close
                                    </button>
                                </div>

                                {/* Hidden Receipt Component for Printing */}
                                <div style={{ display: 'none' }}>
                                    <ReceiptTemplate
                                        ref={receiptRef}
                                        transaction={lastTransaction} // We might need to pass array if template supports it. For now, template prints single. 
                                        transactions={relatedTransactions} // Pass array
                                        student={student}
                                        totalDue={totalDueAmount}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TransactionRow = ({ transaction, allTransactions = [], student, totalDue }) => {
    const componentRef = useRef();

    // Filter all transactions that match this receipt number (for batch printing)
    const relatedBatch = allTransactions.filter(t => t.receiptNumber === transaction.receiptNumber);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Receipt-${transaction.receiptNumber}`,
    });

    return (
        <>
            <tr className="hover:bg-gray-50">
                <td className="py-2 px-4 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                    <span className="block text-[10px] text-gray-400">{new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td className="py-2 px-4 text-sm text-gray-800 font-medium">
                    <div className="flex flex-col">
                        <span>{transaction.feeHead?.name}</span>
                        <span className={`text-[10px] uppercase font-bold ${transaction.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-blue-600'}`}>
                            {transaction.transactionType}
                        </span>
                    </div>
                    <span className="block text-[10px] text-gray-400">By: {transaction.collectedByName || transaction.collectedBy || 'System'}</span>
                </td>
                <td className="py-2 px-4 text-sm font-mono text-gray-700">{transaction.receiptNumber}</td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${(transaction.paymentMode || 'cash').toLowerCase() === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {(transaction.paymentMode || 'Cash').toUpperCase()}
                    </span>
                    {(transaction.paymentMode !== 'Cash') && (
                        <div className="text-[10px] text-gray-500 mt-1 text-left pl-2 border-l-2 border-gray-200">
                            {transaction.bankName && <div className="font-semibold">{transaction.bankName}</div>}
                            {transaction.referenceNo && <div>Ref: {transaction.referenceNo}</div>}
                            {transaction.instrumentDate && <div>Dt: {new Date(transaction.instrumentDate).toLocaleDateString()}</div>}
                        </div>
                    )}
                </td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center font-medium">
                    {transaction.studentYear ? `${transaction.studentYear} / ${transaction.semester || '-'}` : (transaction.semester || '-')}
                </td>
                <td className={`py-2 px-4 text-sm font-bold text-right ${transaction.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-green-600'}`}>
                    {transaction.transactionType === 'CREDIT' ? '-' : '+'}₹{transaction.amount}
                </td>
                <td className="py-2 px-4 text-sm text-gray-500 italic">{transaction.remarks || '-'}</td>
                <td className="py-2 px-4 text-right">
                    <button
                        onClick={handlePrint}
                        className="text-gray-500 hover:text-blue-600"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                    {/* Hidden Receipt for this row */}
                    <div style={{ display: 'none' }}>
                        <ReceiptTemplate
                            ref={componentRef}
                            transaction={transaction}
                            transactions={relatedBatch.length > 0 ? relatedBatch : [transaction]}
                            student={student}
                            totalDue={totalDue}
                        />
                    </div>
                </td>
            </tr>
        </>
    );
};

export default FeeCollection;