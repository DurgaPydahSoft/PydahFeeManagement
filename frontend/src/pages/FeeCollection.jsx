import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import Sidebar from './Sidebar';
import ReceiptTemplate from '../components/ReceiptTemplate';

const FeeCollection = () => {
    // --- SEARCH & DATA STATE ---
    const [allStudents, setAllStudents] = useState([]); // Store ALL students
    const [searchQuery, setSearchQuery] = useState('');
    const [student, setStudent] = useState(null); // Selected Student
    const [loading, setLoading] = useState(false); // General loading (initial fetch)
    const [error, setError] = useState('');

    // --- FEE & PAYMENT STATE ---
    const [feeDetails, setFeeDetails] = useState([]);
    const [paymentConfigs, setPaymentConfigs] = useState([]);
    const [receiptSettings, setReceiptSettings] = useState(null);
    const [viewFilterYear, setViewFilterYear] = useState('ALL');

    // Multi-Select State
    const [feeRows, setFeeRows] = useState([{ id: Date.now(), feeHeadId: '', amount: '' }]);

    const [paymentForm, setPaymentForm] = useState(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        const isSuperAdmin = user?.role === 'superadmin';
        const permissions = user?.permissions || [];
        const canCollectFee = permissions.includes('fee_collection_pay');
        const canGiveConcession = permissions.includes('fee_collection_concession');

        // Default to CREDIT if only concession is allowed, otherwise DEBIT
        const defaultType = (canGiveConcession && !canCollectFee && !isSuperAdmin) ? 'CREDIT' : 'DEBIT';

        return {
            paymentMode: 'Cash',
            remarks: '',
            transactionType: defaultType,
            bankName: '',
            instrumentDate: '',
            referenceNo: '',
            paymentConfigId: ''
        };
    });

    const [paymentCategory, setPaymentCategory] = useState('Cash');
    const [transactions, setTransactions] = useState([]);

    // Modals
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [lastTransaction, setLastTransaction] = useState(null);
    const [relatedTransactions, setRelatedTransactions] = useState([]);
    const receiptRef = useRef();
    const searchInputRef = useRef(null);

    // --- PERMISSIONS ---
    const user = JSON.parse(localStorage.getItem('user'));
    const isSuperAdmin = user?.role === 'superadmin';
    const permissions = user?.permissions || [];
    const canCollectFee = permissions.includes('fee_collection_pay');
    const canGiveConcession = permissions.includes('fee_collection_concession');

    // --- INITIAL DATA LOADING ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                const isSuperAdmin = user?.role === 'superadmin';
                const collegeParam = (!isSuperAdmin && user?.college) ? `?college=${encodeURIComponent(user.college)}` : '';

                const [studentsRes, configsRes, settingsRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/api/students${collegeParam}`),
                    axios.get(`${import.meta.env.VITE_API_URL}/api/payment-config`),
                    axios.get(`${import.meta.env.VITE_API_URL}/api/receipt-settings`)
                ]);

                setAllStudents(studentsRes.data);
                setPaymentConfigs(configsRes.data.filter(c => c.is_active));
                setReceiptSettings(settingsRes.data);
            } catch (e) {
                console.error("Error fetching initial data", e);
                setError("Failed to load data. Please refresh.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // --- CLIENT-SIDE FILTERING (@Students.jsx style) ---
    const filteredStudents = useMemo(() => {
        if (!searchQuery) return [];
        const query = searchQuery.toLowerCase().trim();

        return allStudents.filter(s => {
            const admNum = s.admission_number ? String(s.admission_number).toLowerCase().trim() : '';
            const admNo = s.admission_no ? String(s.admission_no).toLowerCase().trim() : ''; // Handle both keys
            const mobile = s.student_mobile ? String(s.student_mobile).toLowerCase().trim() : '';
            const pin = s.pin_no ? String(s.pin_no).toLowerCase().trim() : '';
            const name = s.student_name ? s.student_name.toLowerCase().trim() : '';

            return (
                admNum.includes(query) ||
                admNo.includes(query) ||
                mobile.includes(query) ||
                pin.includes(query) ||
                name.includes(query)
            );
        });
    }, [allStudents, searchQuery]);


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
                params: { college, course, branch, studentYear }
            });
            setFeeDetails(feesRes.data);

            // Set Default Filter to student's current year to show active dues immediately
            setViewFilterYear(String(found.current_year));

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

    const selectStudent = async (selectedStudent) => {
        setSearchQuery(''); // Clear search on select to show student details
        setStudent(selectedStudent);
        await fetchStudentData(selectedStudent);
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

    const toggleFeeSelection = (fee) => {
        const isSelected = feeRows.some(row => row.feeHeadId === fee._id);

        if (isSelected) {
            // Remove it
            const newRows = feeRows.filter(row => row.feeHeadId !== fee._id);
            // Ensure at least one row exists
            if (newRows.length === 0) {
                setFeeRows([{ id: Date.now(), feeHeadId: '', amount: '' }]);
            } else {
                setFeeRows(newRows);
            }
        } else {
            // Check if first row is empty
            const firstRowEmpty = feeRows.length === 1 && !feeRows[0].feeHeadId && !feeRows[0].amount;
            const newRow = {
                id: Date.now(),
                feeHeadId: fee._id,
                amount: fee.dueAmount > 0 ? fee.dueAmount : ''
            };

            if (firstRowEmpty) {
                setFeeRows([newRow]);
            } else {
                setFeeRows([...feeRows, newRow]);
            }
        }
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
        setIsProcessing(true);
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
                    studentYear: selectedFee ? selectedFee.studentYear : commonData.studentYear,
                    semester: selectedFee ? selectedFee.semester : commonData.semester,
                    amount: Number(row.amount),
                    // CRITICAL: Pass the specific Fee Remarks (e.g. "Club Fee: Coding") so backend can match it.
                    // If user entered a global remark, append it? Or prioritize specific?
                    // Let's use specific remarks if available (preferred for matching), or default to common.
                    remarks: (selectedFee && selectedFee.remarks) ? selectedFee.remarks : commonData.remarks
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
        } finally {
            setIsProcessing(false);
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

    const totalDueAmount = displayedFees.reduce((acc, curr) => acc + curr.dueAmount, 0);
    const globalTotalDue = feeDetails.reduce((acc, curr) => acc + curr.dueAmount, 0);

    // Calculate Scholarship Amounts (Global & Current View)
    // Criteria: isScholarshipApplicable AND (studentScholarStatus is 'eligible', 'yes', or 'true')
    const isScholarshipEligible = (f) => f.isScholarshipApplicable && ['eligible', 'yes', 'true'].includes(String(f.studentScholarStatus || '').toLowerCase());

    const globalScholarshipAmount = feeDetails.reduce((acc, curr) => {
        return isScholarshipEligible(curr) ? acc + curr.dueAmount : acc;
    }, 0);

    const currentViewScholarshipAmount = displayedFees.reduce((acc, curr) => {
        return isScholarshipEligible(curr) ? acc + curr.dueAmount : acc;
    }, 0);

    // Auto-focus on mount
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [loading]); // Focus once loading is done

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6 relative flex flex-col">

                {/* --- HEADER WITH PERMANENT SEARCH BAR --- */}
                <header className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Fee Collection</h1>
                        <p className="text-sm text-gray-500">Search for a student to collect fees.</p>
                    </div>

                    <div className="w-full md:w-auto flex-1 max-w-xl">
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search Name, Adm No, Mobile..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (e.target.value) setStudent(null); // Deselect student when searching
                                }}
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm pl-10"
                            />
                            <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            {loading && (
                                <div className="absolute right-3 top-2.5">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {error && <p className="text-red-500 mb-4 bg-red-50 p-2 rounded border border-red-100">{error}</p>}

                {/* --- SEARCH RESULTS GRID --- */}
                {!student && searchQuery && (
                    <div className="mb-8 animate-fadeIn">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-gray-700">Search Results</h3>
                            <span className="text-sm text-gray-500">{filteredStudents.length} matches found</span>
                        </div>

                        {filteredStudents.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-lg border border-gray-200 text-gray-500">
                                No students found matching "{searchQuery}"
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredStudents.slice(0, 12).map((s) => (
                                    <div key={s.id || s.admission_number} onClick={() => selectStudent(s)}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-300 group relative overflow-hidden flex flex-col gap-3">
                                        {/* Status Stripe */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.student_status === 'Active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                                        <div className="flex justify-between items-start pl-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 group-hover:text-blue-700 truncate text-lg transition-colors">{s.student_name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100 italic">
                                                        {s.course}
                                                    </span>
                                                    <span className="text-gray-400 text-xs truncate">— {s.branch}</span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-tighter ${s.student_status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                                                {s.student_status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pl-2 mt-2 pt-3 border-t border-gray-50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-tight">Admission No</span>
                                                <span className="text-sm font-medium text-gray-700 font-mono">{s.admission_number}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-tight">Pin No</span>
                                                <span className="text-sm font-medium text-gray-700 font-mono">{s.pin_no || '—'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-tight">Current Year</span>
                                                <span className="text-sm font-medium text-gray-700">Year {s.current_year} (S{s.current_semester})</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-tight">Mobile No</span>
                                                <span className="text-sm font-medium text-gray-700 font-mono">{s.student_mobile}</span>
                                            </div>
                                        </div>

                                        {/* Subtle selection arrow */}
                                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {filteredStudents.length > 12 && (
                            <div className="text-center mt-4 text-sm text-gray-500 italic">
                                Showing top 10 results. Keep typing to refine...
                            </div>
                        )}
                    </div>
                )}

                {/* --- INITIAL EMPTY STATE --- */}
                {!student && !searchQuery && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-50">
                        <div className="bg-white p-10 rounded-full mb-4 shadow-sm">
                            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-400">Search for a student to begin</h2>
                        <p className="text-gray-400 mt-2">Use the search bar above to find students by Name, Pin, or Admission Number.</p>
                    </div>
                )}


                {/* --- STUDENT FEE DASHBOARD (Visible when student selected) --- */}
                {student && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                        {/* Left Column: Student Info, Fee Dues & Payment History */}
                        <div className="lg:col-span-2 space-y-4">

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
                                        {globalScholarshipAmount > 0 && (
                                            <div className="text-[10px] text-yellow-300 font-medium mt-1" title="Amount covered by Scholarship">
                                                (Scholarship: ₹{globalScholarshipAmount.toLocaleString()})
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* --- YEAR WISE STATS CARDS --- */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fadeIn">
                                {(() => {
                                    const yearWiseStats = {};
                                    // Initialize with all years up to current
                                    for (let i = 1; i <= (student.current_year || 0); i++) {
                                        yearWiseStats[i] = { total: 0, paid: 0, due: 0, year: i };
                                    }

                                    // Add years from feeDetails (in case there are dues for FUTURE years or old years not covered)
                                    feeDetails.forEach(curr => {
                                        const y = curr.studentYear;
                                        if (!yearWiseStats[y]) yearWiseStats[y] = { total: 0, paid: 0, due: 0, year: y };
                                        yearWiseStats[y].total += curr.totalAmount;
                                        yearWiseStats[y].paid += curr.paidAmount;
                                        yearWiseStats[y].due += curr.dueAmount;
                                    });
                                    const sortedYearStats = Object.values(yearWiseStats).sort((a, b) => Number(a.year) - Number(b.year));

                                    if (sortedYearStats.length === 0) return null;

                                    return sortedYearStats.map(stat => (
                                        <div
                                            key={stat.year}
                                            onClick={() => setViewFilterYear(String(stat.year))}
                                            className={`bg-white p-4 rounded-xl border transition-all relative overflow-hidden group cursor-pointer ${String(viewFilterYear) === String(stat.year) ? 'ring-2 ring-blue-500 shadow-md border-blue-500' : 'border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300'}`}
                                        >
                                            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent ${stat.due > 0 ? 'to-red-50/50' : 'to-green-50/50'} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>

                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${stat.due > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                        Y{stat.year}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Year {stat.year}</span>
                                                </div>
                                                {stat.due <= 0 && <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-bold uppercase">Paid</span>}
                                            </div>

                                            <div className="space-y-1 relative z-10">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Balance</span>
                                                    <span className={`text-lg font-extrabold font-mono leading-none ${stat.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{stat.due.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1">
                                                    <span>Total: ₹{stat.total.toLocaleString()}</span>
                                                    <span>Paid: <span className="text-gray-600 font-medium">₹{stat.paid.toLocaleString()}</span></span>
                                                </div>


                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
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
                                            <tr className="border-b-2 border-gray-200 bg-gray-100/80">
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider text-center w-10">Select</th>
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Fee Head / Year</th>
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider text-right">Total Fee</th>
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider text-right">Paid</th>
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider text-right">Balance</th>
                                                <th className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {displayedFees.filter(f => f.totalAmount > 0 || f.paidAmount > 0).length === 0 ? (
                                                <tr><td colSpan="6" className="py-6 text-center text-gray-500 italic text-sm">No active fees found for this selection. Use the dropdown to collect a new fee.</td></tr>
                                            ) : (
                                                <>
                                                    {displayedFees.filter(f => f.totalAmount > 0 || f.paidAmount > 0).map((fee, idx) => {
                                                        const isFullyPaid = fee.dueAmount <= 0;
                                                        const isPartial = fee.paidAmount > 0 && fee.dueAmount > 0;
                                                        const isSelected = feeRows.some(row => row.feeHeadId === fee._id);

                                                        return (
                                                            <tr
                                                                key={idx}
                                                                onClick={() => !isFullyPaid && toggleFeeSelection(fee)}
                                                                className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-100/50 hover:bg-blue-100' : 'hover:bg-blue-50/50 even:bg-gray-50/50'}`}
                                                            >
                                                                <td className="py-2 px-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        readOnly
                                                                        disabled={isFullyPaid}
                                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-4 text-sm font-medium text-gray-700">
                                                                    <div>
                                                                        {fee.feeHeadName}
                                                                        {fee.isScholarshipApplicable && ['eligible', 'yes', 'true'].includes(String(fee.studentScholarStatus || '').toLowerCase()) && (
                                                                            <span title="Scholarship Applicable" className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200 font-bold uppercase tracking-wider">
                                                                                Scholarship
                                                                            </span>
                                                                        )}
                                                                    </div>
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
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                                Unpaid
                                                                            </span>
                                                                            {isScholarshipEligible(fee) && (
                                                                                <span className="text-[9px] font-bold text-yellow-600 mt-1 whitespace-nowrap">
                                                                                    (Eligible for Scholarship)
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Total Row */}
                                                    <tr className="bg-gray-50/50 border-t border-gray-200">
                                                        <td className="py-2.5 px-4" colSpan="4">
                                                            <div className="flex justify-between items-center">
                                                                {/* Left: Stats */}
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(() => {
                                                                        const yearBreakdown = displayedFees.reduce((acc, curr) => {
                                                                            if (curr.dueAmount > 0) {
                                                                                const y = curr.studentYear;
                                                                                if (!acc[y]) acc[y] = 0;
                                                                                acc[y] += curr.dueAmount;
                                                                            }
                                                                            return acc;
                                                                        }, {});

                                                                        const sortedYears = Object.keys(yearBreakdown).sort((a, b) => Number(a) - Number(b));

                                                                        if (sortedYears.length === 0) return <span className="text-[10px] text-gray-400 italic">No Dues</span>;

                                                                        return sortedYears.map(yr => (
                                                                            <div key={yr} className="flex items-center text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-sm">
                                                                                <span className="text-gray-500 font-bold mr-1">Yr {yr}:</span>
                                                                                <span className="font-mono font-medium text-red-600">₹{yearBreakdown[yr].toLocaleString()}</span>
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>

                                                                {/* Right: Label */}
                                                                <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                                                    Total Outstanding ({viewFilterYear === 'ALL' ? 'Cumulative' : `Year ${viewFilterYear}`}):
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-4 text-right">
                                                            <div className="text-base font-extrabold text-red-600 font-mono">₹{totalDueAmount.toLocaleString()}</div>
                                                            {currentViewScholarshipAmount > 0 && (
                                                                <div className="text-[10px] text-yellow-600 font-bold mt-0.5">
                                                                    (Sch: ₹{currentViewScholarshipAmount.toLocaleString()})
                                                                </div>
                                                            )}
                                                        </td>
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
                                                        settings={receiptSettings}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Payment Form Only */}
                        {(canCollectFee || canGiveConcession || isSuperAdmin) && (
                            <div className="space-y-3">
                                {/* Payment Tabs */}
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
                                    <div className="flex border-b border-gray-100">
                                        {(canCollectFee || isSuperAdmin) && (
                                            <button
                                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'DEBIT' ? 'bg-blue-50/50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                                onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'DEBIT' })}
                                            >
                                                COLLECT FEE
                                            </button>
                                        )}
                                        {(canGiveConcession || isSuperAdmin) && (
                                            <button
                                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'CREDIT' ? 'bg-purple-50/50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                                onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'CREDIT' })}
                                            >
                                                CONCESSION
                                            </button>
                                        )}
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
                                                                        <input type="text" className="w-full border p-2 rounded-lg text-xs bg-white outline-none focus:border-blue-500" placeholder="Issuing Bank" value={paymentForm.bankName || ''} onChange={e => setPaymentForm({ ...paymentForm, bankName: e.target.value })} required />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    className={`w-full py-3 rounded-xl text-white font-bold shadow-md transition-all transform active:scale-95 ${paymentForm.transactionType === 'DEBIT' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-200' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-purple-200'}`}
                                                >
                                                    {paymentForm.transactionType === 'DEBIT' ? 'Confirm Payment' : 'Apply Concession'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Modals placed at root */}
                {showConfirmModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
                            <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-gray-800">Confirm Transaction</h3>
                                <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <div className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Total Amount</div>
                                    <div className={`text-4xl font-extrabold ${paymentForm.transactionType === 'DEBIT' ? 'text-blue-600' : 'text-purple-600'}`}>₹{totalSelectedAmount.toLocaleString()}</div>
                                </div>
                                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Student:</span>
                                        <span className="font-bold text-gray-800">{student.student_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Type:</span>
                                        <span className="font-bold text-gray-800">{paymentForm.transactionType}</span>
                                    </div>
                                    {paymentForm.transactionType === 'DEBIT' && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Mode:</span>
                                            <span className="font-bold text-gray-800">{paymentForm.paymentMode}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Verification:</span>
                                        <span className="font-bold text-gray-800">{feeRows.filter(r => r.amount > 0).length} Fee Heads</span>
                                    </div>
                                </div>

                                <button
                                    onClick={confirmAndPay}
                                    disabled={isProcessing}
                                    className={`w-full mt-6 py-3 rounded-xl text-white font-bold text-lg shadow-lg transform transition flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : (paymentForm.transactionType === 'DEBIT' ? 'bg-blue-600 hover:bg-blue-700 active:scale-95' : 'bg-purple-600 hover:bg-purple-700 active:scale-95')}`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Processing...
                                        </>
                                    ) : 'Proceed'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Receipt Modal */}
                {showReceiptModal && lastTransaction && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
                        <div className="relative w-full max-w-sm">
                            {/* Success Header Card */}
                            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-green-100 w-full max-w-sm text-center animate-scaleUp">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-inner">
                                    ✅
                                </div>
                                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Payment Successful!</h2>
                                <p className="text-sm text-gray-500 mb-8 px-4">The transaction has been recorded successfully. You can now download or print the receipt.</p>

                                <div className="space-y-3">
                                    <button
                                        onClick={handlePrintReceipt}
                                        className="w-full bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 flex items-center justify-center gap-3 shadow-xl shadow-blue-200 transition-all transform active:scale-95 text-lg"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        PRINT RECEIPT
                                    </button>

                                    <button
                                        onClick={() => setShowReceiptModal(false)}
                                        className="w-full bg-gray-50 text-gray-600 px-6 py-3 rounded-2xl font-bold hover:bg-gray-100 transition-colors text-sm"
                                    >
                                        DONE
                                    </button>
                                </div>
                            </div>

                            {/* Hidden Receipt (Accessible by Ref) */}
                            <div className="hidden">
                                <ReceiptTemplate
                                    ref={receiptRef}
                                    transaction={lastTransaction}
                                    relatedTransactions={relatedTransactions}
                                    student={student}
                                    settings={receiptSettings}
                                    totalDue={totalDueAmount}
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

// Sub-component for Row (Kept same)
const TransactionRow = ({ transaction, allTransactions, student, totalDue, settings }) => {
    // Logic to show "Print" for batch or single
    // find siblings
    // ... (This logic remains same, just simplified markup)
    // We can assume ReceiptTemplate handles the batch printing logic if we pass relatedTransactions inside the Print call.
    // For now, simpler:

    const [showPreview, setShowPreview] = useState(false);
    const printRef = useRef();

    // Identify if this is part of a batch. 
    // In our backend, we group by 'receiptNumber' usually. 
    // Let's assume all transactions with same receiptNumber (and same time) are a batch.
    const batchSiblings = allTransactions.filter(t => t.receiptNumber === transaction.receiptNumber);
    const isBatch = batchSiblings.length > 1;

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Receipt-${transaction.receiptNumber}`,
        onAfterPrint: () => setShowPreview(false)
    });

    return (
        <tr className="hover:bg-gray-50 transition-colors group">
            <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                {new Date(transaction.createdAt).toLocaleDateString()}
                <div className="text-[10px] text-gray-400">{new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td className="py-3 px-4 text-xs font-medium text-gray-800">
                {transaction.feeHead ? transaction.feeHead.name : 'Unknown Fee'}
                {/* Show batch indicator? */}
            </td>
            <td className="py-3 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">{transaction.receiptNumber}</td>
            <td className="py-3 px-4 text-center">
                <span className="px-2 py-0.5 rounded text-[10px] border border-gray-200 bg-white text-gray-600">
                    {transaction.paymentMode}
                </span>
            </td>
            <td className="py-3 px-4 text-center text-xs text-gray-500">
                {transaction.studentYear ? `Yr ${transaction.studentYear}` : '-'}
            </td>
            <td className={`py-3 px-4 text-xs font-bold text-right font-mono ${transaction.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-green-600'}`}>
                {transaction.transactionType === 'CREDIT' ? '-' : '+'}₹{transaction.amount.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-xs text-gray-500 max-w-[150px] truncate" title={transaction.remarks}>
                {transaction.remarks || '-'}
            </td>
            <td className="py-3 px-4 text-right">
                <button
                    onClick={() => setShowPreview(true)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition"
                    title="Print Receipt"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>

                {/* Hidden Print Template */}
                {showPreview && (
                    <div className="hidden">
                        <ReceiptTemplate
                            ref={printRef}
                            transaction={transaction}
                            relatedTransactions={batchSiblings} // Pass all siblings for full receipt
                            student={student}
                            settings={settings}
                            totalDue={totalDue}
                        />
                    </div>
                )}
                {/* Auto-trigger print when preview opens. 
                    Actually useReactToPrint doesn't auto-trigger by just rendering. 
                    We need to call handlePrint(). 
                    We can use a small effect or just call it directly.
                */}
                {showPreview && <PrintTrigger trigger={handlePrint} />}
            </td>
        </tr>
    );
};

const PrintTrigger = ({ trigger }) => {
    useEffect(() => {
        trigger();
    }, []);
    return null;
};

export default FeeCollection;