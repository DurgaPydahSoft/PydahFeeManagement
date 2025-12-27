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
    const [paymentConfigs, setPaymentConfigs] = useState([]);
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
        referenceNo: '',
        paymentConfigId: ''
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

    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/payment-config`);
                setPaymentConfigs(res.data.filter(c => c.is_active));
            } catch (e) { console.error("Error fetching payment configs", e); }
        };
        fetchConfigs();
    }, []);

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

            // Set Default Filter to Student's Current Year
            if (found.current_year) {
                setViewFilterYear(found.current_year);
            } else {
                setViewFilterYear('ALL');
            }

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
                    // Use _id (which is stored in value) to find the correct row
                    const selectedFee = feeDetails.find(f => f._id === value);
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
                    commonData.paymentConfigId = paymentForm.paymentConfigId;
                    const selectedConfig = paymentConfigs.find(c => c._id === paymentForm.paymentConfigId);
                    if (selectedConfig) {
                        commonData.depositedToAccount = selectedConfig.account_name;
                    }
                }
            } else {
                commonData.paymentMode = 'Credit';
            }

            // Create Batch Array
            const batchTransactions = validRows.map(row => {
                const selectedFee = feeDetails.find(f => f._id === row.feeHeadId);
                return {
                    ...commonData,
                    feeHeadId: selectedFee ? selectedFee.feeHeadId : row.feeHeadId,
                    amount: Number(row.amount)
                };
            });

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
    const uniqueStudentYears = [...new Set(feeDetails.map(f => f.studentYear))].sort((a, b) => b - a);

    const displayedFees = feeDetails.filter(f => {
        if (viewFilterYear === 'ALL') return true;
        return Number(f.studentYear) === Number(viewFilterYear);
    });

    // Total Due calculation should be based on displayed, or total?
    // Usually "Total Due" implies everything the student owes. User wants to see "All years", so Total Due should match view or match all.
    // Let's make "Total Due" represent EVERYTHING (Global Debt), but table shows breakdown.
    // Or simpler: Total Due matches the table bottom line. 
    // Let's stick to: Total Due at bottom of table = Sum of displayed rows.
    const totalDueAmount = displayedFees.reduce((acc, curr) => acc + curr.dueAmount, 0);
    const globalTotalDue = feeDetails.reduce((acc, curr) => acc + curr.dueAmount, 0);

    const inputRef = useRef(null);

    // Auto-focus on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Modified Header to conditionally show search (Refined condition)
    // We want to show header if:
    // 1. Student is selected
    // 2. Multiple students found
    // 3. Loading (maybe)
    // 4. Searching is Active (User typed something and hit enter - result might be error or found)
    // But initially, searchQuery is empty.
    const isSearchMode = student || foundStudents.length > 0 || (loading && searchQuery);
    // Actually, simply: if we have a selected student OR we have search results OR we are searching.
    // Let's use a simpler check: If we are "ready to collect" (student selected), show header.
    // If not, and no search query, show center.
    // But if I type "Abc" and search, I want it to move up even if no result?
    // User said: "after searching it should goes to current place".

    // Let's try:
    const showHeader = student || foundStudents.length > 0 || loading || error;
    // If successful search -> student or foundStudents.
    // If failed search -> error.
    // If searching -> loading.

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6 relative flex flex-col">

                {/* Header - Search moves here */}
                <header className={`mb-4 flex flex-col md:flex-row justify-between items-center gap-4 px-2 transition-all duration-500 ${!isSearchMode ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
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

                {/* Center Search State */}
                {!isSearchMode && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 transition-all duration-500">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 max-w-lg w-full">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Search Student
                            </h2>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Student Fee Collection</h2>
                            <p className="text-gray-500 mb-8">Search for a student to view details and collect fees.</p>

                            <form onSubmit={handleSearch} className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Enter Admission No, Mobile or Name..."
                                    className="w-full pl-5 pr-12 py-4 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-lg shadow-sm transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {student && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Student Info, Fee Dues & Payment History */}
                        <div className="lg:col-span-2 space-y-4">

                            {/* Student Profile Card - Professional Design */}
                            {/* Student Profile Card - Compact Professional Design */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
                                <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-4 text-white flex flex-col md:flex-row items-center md:items-start gap-4">
                                    {/* Photo */}
                                    <div className="h-14 w-14 rounded-full border-2 border-white/20 shadow-md overflow-hidden shrink-0 bg-white">
                                        {student.student_photo ? (
                                            <img
                                                src={student.student_photo.startsWith('data:') ? student.student_photo : `data:image/jpeg;base64,${student.student_photo}`}
                                                alt="Student"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xl font-bold text-gray-400">
                                                {student.student_name?.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 text-center md:text-left min-w-0">
                                        <div className="flex flex-col md:flex-row md:items-baseline md:gap-3">
                                            <h2 className="text-lg font-bold truncate">{student.student_name}</h2>
                                            <p className="text-blue-200 text-xs font-medium truncate">{student.course} - {student.branch}</p>
                                        </div>

                                        <div className="flex flex-wrap justify-center md:justify-start gap-2 text-xs mt-1">
                                            <div className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 flex items-center">
                                                <span className="text-blue-200 mr-1.5 uppercase text-[10px] font-bold">Adm:</span>
                                                <span className="font-mono font-bold">{student.admission_number}</span>
                                            </div>
                                            <div className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 flex items-center">
                                                <span className="text-blue-200 mr-1.5 uppercase text-[10px] font-bold">Pin:</span>
                                                <span className="font-mono font-bold">{student.pin_no || '-'}</span>
                                            </div>
                                            <div className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 flex items-center">
                                                <span className="text-blue-200 mr-1.5 uppercase text-[10px] font-bold">Yr:</span>
                                                <span className="font-bold">{student.current_year} (S{student.current_semester})</span>
                                            </div>
                                            <div className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 flex items-center">
                                                <span className="text-blue-200 mr-1.5 uppercase text-[10px] font-bold">Mob:</span>
                                                <span className="font-mono font-bold">{student.student_mobile}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions / Status */}
                                    <div className="flex flex-col gap-1 text-right shrink-0">
                                        <div className="text-[10px] text-blue-200 uppercase font-bold">Total Due</div>
                                        <div className="text-xl font-bold text-white leading-none">₹{globalTotalDue.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Fee Summary Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <div className="bg-blue-100 p-1.5 rounded text-blue-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        </div>
                                        Fee Dues Breakdown
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        {loading && <span className="text-xs text-blue-500 animate-pulse font-medium">Updating...</span>}
                                        <select
                                            className="text-sm border-gray-200 border rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                                            value={viewFilterYear}
                                            onChange={(e) => setViewFilterYear(e.target.value)}
                                        >
                                            <option value="ALL">All Years</option>
                                            {uniqueStudentYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fee Head / Year</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Total Fee</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Paid</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Balance</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {displayedFees.length === 0 ? (
                                                <tr><td colSpan="5" className="py-6 text-center text-gray-500 italic text-sm">No fees found for this selection.</td></tr>
                                            ) : (
                                                <>
                                                    {displayedFees.map((fee, idx) => {
                                                        const isFullyPaid = fee.dueAmount <= 0;
                                                        const isPartial = fee.paidAmount > 0 && fee.dueAmount > 0;
                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="py-2 px-4 text-sm font-medium text-gray-700">
                                                                    <div>{fee.feeHeadName}</div>
                                                                    <div className="text-[10px] text-gray-400">Year {fee.studentYear} • Sem {fee.semester || '-'}</div>
                                                                </td>
                                                                <td className="py-2 px-4 text-sm text-right text-gray-600 font-mono">₹{fee.totalAmount.toLocaleString()}</td>
                                                                <td className="py-2 px-4 text-sm text-right text-green-600 font-mono font-medium">₹{fee.paidAmount.toLocaleString()}</td>
                                                                <td className="py-2 px-4 text-sm text-right font-bold text-gray-800 font-mono">₹{fee.dueAmount.toLocaleString()}</td>
                                                                <td className="py-2 px-4 text-center">
                                                                    {isFullyPaid ? (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                            Paid
                                                                        </span>
                                                                    ) : isPartial ? (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                                            Partial
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                            Unpaid
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Total Row */}
                                                    <tr className="bg-gray-50/50 border-t border-gray-200">
                                                        <td className="py-2.5 px-4 text-sm font-bold text-gray-800 text-right uppercase tracking-wide" colSpan="3">Total Outstanding ({viewFilterYear === 'ALL' ? 'Cumulative' : `Year ${viewFilterYear}`}):</td>
                                                        <td className="py-2.5 px-4 text-base font-extrabold text-right text-red-600 font-mono">₹{totalDueAmount.toLocaleString()}</td>
                                                        <td></td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Payment History */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <div className="bg-green-100 p-1.5 rounded text-green-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        Transaction History
                                    </h3>
                                    <div className="flex gap-2 text-xs">
                                        <select className="border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-green-500 shadow-sm" value={historyFilter.mode} onChange={e => setHistoryFilter({ ...historyFilter, mode: e.target.value })}>
                                            <option value="">All Modes</option>
                                            <option>Cash</option>
                                            <option>UPI</option>
                                            <option>Cheque</option>
                                            <option>DD</option>
                                            <option>Waiver</option>
                                        </select>
                                        <select className="border border-gray-200 rounded-lg px-2 py-1 max-w-[150px] bg-white outline-none focus:ring-2 focus:ring-green-500 shadow-sm" value={historyFilter.feeHead} onChange={e => setHistoryFilter({ ...historyFilter, feeHead: e.target.value })}>
                                            <option value="">All Fee Heads</option>
                                            {uniqueFeeHeads.map(fh => <option key={fh} value={fh}>{fh}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Receipt No</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Mode</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Year / Sem</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remarks</th>
                                                <th className="py-2 px-4 text-[11px] font-bold text-right text-gray-400 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredTransactions.length === 0 ? (
                                                <tr><td colSpan="8" className="py-8 text-center text-gray-500 italic">No matching transactions found.</td></tr>
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
                        <div className="space-y-3">
                            {/* Payment Tabs */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
                                <div className="flex border-b border-gray-100">
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'DEBIT' ? 'bg-blue-50/50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                        onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'DEBIT' })}
                                    >
                                        COLLECT FEE
                                    </button>
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'CREDIT' ? 'bg-purple-50/50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                        onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'CREDIT' })}
                                    >
                                        CONCESSION
                                    </button>
                                </div>

                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                                        <div>
                                            <h3 className={`text-base font-bold ${paymentForm.transactionType === 'DEBIT' ? 'text-gray-800' : 'text-purple-800'}`}>
                                                {paymentForm.transactionType === 'DEBIT' ? 'Payment Details' : 'Concession Details'}
                                            </h3>
                                            <p className="text-[11px] text-gray-400 mt-0.5">Add fee heads and amount below</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addFeeRow}
                                            className="bg-gray-100 text-gray-600 p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition duration-200 border border-gray-200 shadow-sm"
                                            title="Add Another Fee Head"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                    </div>

                                    <form onSubmit={handlePrePayment} className="space-y-3">

                                        {/* Dynamic Rows */}
                                        <div className="space-y-2">
                                            {feeRows.map((row, index) => (
                                                <div key={row.id} className="flex gap-2 items-start p-2 rounded-lg bg-gray-50/80 border border-gray-200/60 transition-all hover:border-blue-200 hover:shadow-sm group">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Select Fee</label>
                                                        <select
                                                            className="w-full border border-gray-300 rounded-lg p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                            value={row.feeHeadId}
                                                            onChange={e => updateFeeRow(row.id, 'feeHeadId', e.target.value)}
                                                            required
                                                        >
                                                            <option value="">-- Select Fee Head --</option>
                                                            {displayedFees.map(f => (
                                                                <option key={f._id} value={f._id}>
                                                                    [{f.academicYear}] (Yr {f.studentYear}) {f.feeHeadName} (Due: ₹{f.dueAmount})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Amount</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
                                                            <input
                                                                type="number"
                                                                className="w-full border border-gray-300 rounded-lg p-1.5 pl-5 text-xs font-bold text-gray-700 bg-white focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-300"
                                                                value={row.amount}
                                                                onChange={e => updateFeeRow(row.id, 'amount', e.target.value)}
                                                                required
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                    {feeRows.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeeRow(row.id)}
                                                            className="mt-6 text-gray-300 hover:text-red-500 transition-colors bg-white rounded-full p-0.5 border border-transparent hover:border-red-100 hover:bg-red-50"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total Summary */}
                                        <div className="flex justify-between items-end py-2 border-t border-dashed border-gray-200 mt-1">
                                            <span className="text-xs font-medium text-gray-500">Total Amount</span>
                                            <span className="text-2xl font-extrabold text-gray-800 tracking-tight">₹{totalSelectedAmount.toLocaleString()}</span>
                                        </div>

                                        {/* PAYMENT MODE SELECTION (Only for DEBIT) */}
                                        {paymentForm.transactionType === 'DEBIT' && (
                                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-200/60">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</label>
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <label className={`flex items-center justify-center gap-2 cursor-pointer p-2 rounded-lg border transition-all ${paymentCategory === 'Cash' ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                        <input type="radio" className="sr-only" name="cat" checked={paymentCategory === 'Cash'} onChange={() => { setPaymentCategory('Cash'); setPaymentForm({ ...paymentForm, paymentMode: 'Cash' }); }} />
                                                        <span className="font-bold text-xs text-gray-700">Cash</span>
                                                    </label>
                                                    <label className={`flex items-center justify-center gap-2 cursor-pointer p-2 rounded-lg border transition-all ${paymentCategory === 'Bank' ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                        <input type="radio" className="sr-only" name="cat" checked={paymentCategory === 'Bank'} onChange={() => { setPaymentCategory('Bank'); setPaymentForm({ ...paymentForm, paymentMode: 'UPI' }); }} />
                                                        <span className="font-bold text-xs text-gray-700">Bank / Online</span>
                                                    </label>
                                                </div>

                                                {/* Sub-options for Bank */}
                                                {paymentCategory === 'Bank' && (
                                                    <div className="space-y-2 animate-fadeIn">
                                                        {/* Target Account Selection */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Account *</label>
                                                            <select
                                                                className="w-full border border-gray-300 p-2 rounded-lg text-xs bg-white focus:border-blue-500 outline-none"
                                                                value={paymentForm.paymentConfigId}
                                                                onChange={e => {
                                                                    const selected = paymentConfigs.find(c => c._id === e.target.value);
                                                                    setPaymentForm({
                                                                        ...paymentForm,
                                                                        paymentConfigId: e.target.value,
                                                                        // Auto-fill bank name if empty or just helpful
                                                                        bankName: selected ? selected.bank_name : paymentForm.bankName
                                                                    });
                                                                }}
                                                            >
                                                                <option value="">-- Select Account --</option>
                                                                {paymentConfigs.map(c => (
                                                                    <option key={c._id} value={c._id}>
                                                                        {c.account_name} ({c.bank_name})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Bank Instrument</label>
                                                            <select className="w-full border border-gray-300 p-2 rounded-lg text-xs bg-white focus:border-blue-500 outline-none" value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                                                                <option value="UPI">UPI (GPay / PhonePe/ etc)</option>
                                                                <option value="Net Banking">Net Banking</option>
                                                                <option value="Card">Debit / Credit Card</option>
                                                                <option value="Cheque">Cheque</option>
                                                                <option value="DD">Demand Draft (DD)</option>
                                                            </select>
                                                        </div>
                                                        {['UPI', 'Net Banking', 'Card'].includes(paymentForm.paymentMode) && (
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Reference Number *</label>
                                                                <input type="text" className="w-full border p-2 rounded-lg text-xs bg-white outline-none focus:border-blue-500" placeholder="e.g. Transaction ID" value={paymentForm.referenceNo || ''} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} required />
                                                            </div>
                                                        )}
                                                        {['Cheque', 'DD'].includes(paymentForm.paymentMode) && (
                                                            <>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">No *</label>
                                                                        <input type="text" className="w-full border p-2 rounded-lg text-xs bg-white outline-none focus:border-blue-500" value={paymentForm.referenceNo || ''} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} required />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date *</label>
                                                                        <input type="date" className="w-full border p-2 rounded-lg text-xs bg-white outline-none focus:border-blue-500" value={paymentForm.instrumentDate || ''} onChange={e => setPaymentForm({ ...paymentForm, instrumentDate: e.target.value })} required />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Bank Name *</label>
                                                                    <input type="text" className="w-full border p-2 rounded-lg text-xs bg-white outline-none focus:border-blue-500" placeholder="e.g. SBI, HDFC" value={paymentForm.bankName || ''} onChange={e => setPaymentForm({ ...paymentForm, bankName: e.target.value })} required />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remarks (Optional)</label>
                                            <textarea
                                                className="w-full border border-gray-300 p-2 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                rows="2"
                                                placeholder="Add notes..."
                                                value={paymentForm.remarks}
                                                onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                            ></textarea>
                                        </div>

                                        <button
                                            disabled={totalSelectedAmount <= 0}
                                            className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2
                                                ${totalSelectedAmount <= 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : (paymentForm.transactionType === 'DEBIT' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-purple-500/30')}
                                            `}
                                        >
                                            {totalSelectedAmount > 0 && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                            {paymentForm.transactionType === 'DEBIT' ? `COLLECT ₹${totalSelectedAmount.toLocaleString()}` : `CONCESSION ₹${totalSelectedAmount.toLocaleString()}`}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIRMATION / RECEIPT PREVIEW MODAL */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-all duration-300">
                        {/* Receipt Container */}
                        <div className="bg-white rounded-sm shadow-2xl max-w-sm w-full overflow-hidden relative transform scale-100 transition-transform">

                            <div className="p-6 font-mono text-sm leading-relaxed">
                                {/* Header */}
                                <div className="text-center mb-6">
                                    <h2 className="text-lg font-bold text-gray-800 uppercase tracking-widest border-b-2 border-gray-800 pb-1 inline-block mb-1">Payment Preview</h2>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Please review before processing</p>
                                </div>

                                {/* Meta Info */}
                                <div className="flex justify-between text-xs text-gray-500 mb-4 border-b border-dashed border-gray-300 pb-2">
                                    <div className="space-y-0.5">
                                        <div><span className="font-bold text-gray-700">Date:</span> {new Date().toLocaleDateString()}</div>
                                        <div><span className="font-bold text-gray-700">Time:</span> {new Date().toLocaleTimeString()}</div>
                                    </div>
                                    <div className="text-right space-y-0.5">
                                        <div className="uppercase font-bold text-gray-800">{student?.student_name}</div>
                                        <div className="text-[10px]">Adm: {student?.admission_number}</div>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="mb-4">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-800 text-[10px] uppercase">
                                                <th className="pb-1 text-gray-600">Fee Description</th>
                                                <th className="pb-1 text-right text-gray-600">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {feeRows.filter(r => r.feeHeadId && r.amount > 0).map((row, idx) => {
                                                const fh = feeDetails.find(f => f._id === row.feeHeadId);
                                                return (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 pr-2">
                                                            <div className="font-bold text-gray-800">{fh ? fh.feeHeadName : 'Fee Head'}</div>
                                                            {/* <div className="text-[9px] text-gray-400 truncate">Sem {student?.current_semester}</div> */}
                                                        </td>
                                                        <td className="py-1.5 text-right font-medium text-gray-800">
                                                            ₹{Number(row.amount).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {/* Footer Totals */}
                                        <tfoot className="border-t border-dashed border-gray-400 mt-2">
                                            {/* <div className="my-2 border-b border-dashed border-gray-400"></div> */}
                                            <tr>
                                                <td className="pt-3 font-bold text-gray-800 uppercase text-xs">Total Amount</td>
                                                <td className="pt-3 text-right text-lg font-bold text-gray-900">₹{totalSelectedAmount.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Payment Details Box */}
                                <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-6 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-500">Payment Mode:</span>
                                        <span className="font-bold text-gray-800 uppercase">{paymentForm.paymentMode}</span>
                                    </div>
                                    {paymentForm.transactionType === 'DEBIT' && paymentForm.paymentMode !== 'Cash' && (
                                        <div className="space-y-0.5 pt-1 mt-1 border-t border-gray-100">
                                            {paymentForm.bankName && <div className="flex justify-between"><span>Bank:</span> <span className="font-medium">{paymentForm.bankName}</span></div>}
                                            {paymentForm.referenceNo && <div className="flex justify-between"><span>Ref No:</span> <span className="font-medium">{paymentForm.referenceNo}</span></div>}
                                            {paymentForm.instrumentDate && <div className="flex justify-between"><span>Inst. Date:</span> <span className="font-medium">{paymentForm.instrumentDate}</span></div>}
                                        </div>
                                    )}
                                    {paymentForm.remarks && (
                                        <div className="mt-2 pt-2 border-t border-gray-200 italic text-gray-500 text-[10px]">
                                            "{paymentForm.remarks}"
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={confirmAndPay}
                                        className="w-full bg-blue-600 text-white py-3 rounded shadow-lg hover:bg-blue-700 font-sans font-bold uppercase tracking-wide text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="w-full bg-white text-gray-500 py-2 rounded border border-gray-200 hover:bg-gray-50 hover:text-gray-700 font-sans font-medium text-xs uppercase tracking-wide transition-all"
                                    >
                                        Cancel Transaction
                                    </button>
                                </div>
                            </div>

                            {/* Decorative Bottom Edge */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100"></div>
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
            <tr className="hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0">
                <td className="py-2 px-4 text-sm text-gray-600 whitespace-nowrap">
                    <div className="font-medium text-gray-800">{new Date(transaction.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-gray-400">{new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="py-2 px-4 text-sm text-gray-800 font-medium">
                    <div className="flex flex-col">
                        <span>{transaction.feeHead?.name}</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${transaction.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-blue-600'}`}>
                            {transaction.transactionType}
                        </span>
                    </div>
                    <span className="block text-[10px] text-gray-400 mt-0.5">By: {transaction.collectedByName || transaction.collectedBy || 'System'}</span>
                </td>
                <td className="py-2 px-4 text-sm font-mono text-gray-600">{transaction.receiptNumber}</td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(transaction.paymentMode || 'cash').toLowerCase() === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {(transaction.paymentMode || 'Cash').toUpperCase()}
                    </span>
                    {(transaction.paymentMode !== 'Cash') && (
                        <div className="text-[10px] text-gray-500 mt-2 text-left pl-3 border-l-2 border-gray-200">
                            {transaction.bankName && <div className="font-semibold">{transaction.bankName}</div>}
                            {transaction.referenceNo && <div>Ref: {transaction.referenceNo}</div>}
                            {transaction.instrumentDate && <div>Dt: {new Date(transaction.instrumentDate).toLocaleDateString()}</div>}
                        </div>
                    )}
                </td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center font-medium">
                    {transaction.studentYear ? `${transaction.studentYear} / ${transaction.semester || '-'}` : (transaction.semester || '-')}
                </td>
                <td className={`py-2 px-4 text-sm font-bold text-right font-mono ${transaction.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-green-600'}`}>
                    {transaction.transactionType === 'CREDIT' ? '-' : '+'}₹{transaction.amount.toLocaleString()}
                </td>
                <td className="py-2 px-4 text-sm text-gray-500 italic max-w-xs truncate" title={transaction.remarks}>{transaction.remarks || '-'}</td>
                <td className="py-2 px-4 text-right">
                    <button
                        onClick={handlePrint}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                        title="Print Receipt"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
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