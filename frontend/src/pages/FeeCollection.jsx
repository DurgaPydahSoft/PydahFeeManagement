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

    // Payment Form
    const [paymentForm, setPaymentForm] = useState({
        selectedFeeHeadId: '',
        amount: '',
        paymentMode: 'Cash',
        remarks: '',
        transactionType: 'DEBIT'
    });

    // History
    const [transactions, setTransactions] = useState([]);



    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setStudent(null);
        setFeeDetails([]);
        setFoundStudents([]);

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
        setStudent(selectedStudent);
        setFoundStudents([]);
        setLoading(true);

        try {
            // 2. Fetch Fee Details (Structure vs Paid)
            const found = selectedStudent;
            const college = found.college;
            const course = found.course;
            const branch = found.branch;
            const studentYear = found.current_year; // Use current year from DB
            const academicYear = '2024-2025'; // Default for MVP

            if (!college || !course || !branch || !studentYear) {
                console.warn("Student record missing metadata:", found);
            }

            const feesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-structures/student/${found.admission_number}`, {
                params: { college, course, branch, studentYear, academicYear }
            });
            setFeeDetails(feesRes.data);

            // 3. Fetch History
            const histRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/transactions/student/${found.admission_number}`);
            setTransactions(histRes.data);
        } catch (error) {
            console.error(error);
            setError('Error fetching student details.');
        }
        setLoading(false);
    };

    const handlePayment = async (e) => {
        e.preventDefault();

        // Validation: Fee Head is required only for DEBIT
        if (paymentForm.transactionType === 'DEBIT' && !paymentForm.selectedFeeHeadId) {
            alert('Please select a Fee Head to pay for.');
            return;
        }

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                studentId: student.admission_number,
                studentName: student.student_name,
                feeHeadId: paymentForm.selectedFeeHeadId || null,
                amount: Number(paymentForm.amount),
                paymentMode: paymentForm.paymentMode,
                transactionType: paymentForm.transactionType || 'DEBIT',
                remarks: paymentForm.remarks,
                semester: student.current_semester,
                academicYear: student.current_year,
                collectedBy: JSON.parse(localStorage.getItem('user'))?.username || 'Unknown',
                collectedByName: JSON.parse(localStorage.getItem('user'))?.name || 'Unknown'
            });

            alert(paymentForm.transactionType === 'CREDIT' ? 'Credit/Waiver Recorded Successfully!' : 'Payment Recorded Successfully!');
            handleSearch(e);
            setPaymentForm({ ...paymentForm, amount: '', remarks: '', selectedFeeHeadId: '' });
        } catch (error) {
            console.error(error);
            alert('Payment Failed');
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6">
                <header className="mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Fee Collection</h1>
                    <p className="text-sm text-gray-500 mt-1">Search student and collect fees.</p>
                </header>

                {/* Search Bar */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Enter Name, Admission No, Mobile, or Pin No..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                            Search
                        </button>
                    </form>
                    {error && <p className="text-red-500 mt-2">{error}</p>}
                </div>

                {loading && <div className="text-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>}

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
                            Search for a student by Name, Admission Number, or Mobile Number to view their fee details and record payments.
                        </p>
                    </div>
                )}

                {student && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Student Info, Fee Dues & Payment History */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Student Card */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col md:flex-row items-center md:items-start gap-4">
                                <div className="h-12 w-12 bg-blue-100 rounded-full flex flex-shrink-0 items-center justify-center text-2xl">🎓</div>
                                <div className="flex-1 w-full">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-800">{student.student_name}</h2>
                                            <p className="text-sm text-gray-500">{student.college} • {student.course} - {student.branch}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-gray-50 p-3 rounded-md border border-gray-100">
                                        <div>
                                            <span className="block text-[10px] text-gray-400 uppercase font-semibold">Admission No</span>
                                            <span className="font-bold text-gray-700">{student.admission_number}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-gray-400 uppercase font-semibold">Pin No</span>
                                            <span className="font-bold text-gray-700">{student.pin_no || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-gray-400 uppercase font-semibold">Current Year</span>
                                            <span className="font-bold text-blue-600">{student.current_year || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-gray-400 uppercase font-semibold">Semester</span>
                                            <span className="font-bold text-blue-600">{student.current_semester || '-'}</span>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="block text-[10px] text-gray-400 uppercase font-semibold">Mobile</span>
                                            <span className="font-bold text-gray-700">{student.student_mobile}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Fee Summary Table */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-700">Fee Dues Summary (Year {student.current_year})</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600">Fee Head</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Total Fee</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Paid</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-right">Balance</th>
                                            <th className="py-2 px-4 text-xs font-semibold text-gray-600 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {feeDetails.length === 0 ? (
                                            <tr><td colSpan="5" className="py-6 text-center text-gray-500">No applicable fees found for {student.college}/{student.course} Year {student.current_year}.</td></tr>
                                        ) : (
                                            feeDetails.map((fee, idx) => (
                                                <tr key={idx} className={fee.dueAmount > 0 ? "bg-red-50" : ""}>
                                                    <td className="py-2 px-4 text-sm font-medium">{fee.feeHeadName}</td>
                                                    <td className="py-2 px-4 text-sm text-right">₹{fee.totalAmount.toLocaleString()}</td>
                                                    <td className="py-2 px-4 text-sm text-right text-green-600">₹{fee.paidAmount.toLocaleString()}</td>
                                                    <td className="py-2 px-4 text-sm text-right font-bold text-red-600">₹{fee.dueAmount.toLocaleString()}</td>
                                                    <td className="py-2 px-4 text-center">
                                                        {fee.dueAmount > 0 && (
                                                            <button
                                                                onClick={() => setPaymentForm({ ...paymentForm, selectedFeeHeadId: fee.feeHeadId, amount: fee.dueAmount })}
                                                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                            >
                                                                Select
                                                            </button>
                                                        )}
                                                        {fee.dueAmount <= 0 && <span className="text-xs text-green-600 font-bold">PAID</span>}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment History - Moved under Fee Dues Summary */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <h3 className="font-bold text-gray-800 px-4 py-3 border-b">Payment History</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b">
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
                                            {transactions.length === 0 ? (
                                                <tr><td colSpan="7" className="py-6 text-center text-gray-500">No transactions found.</td></tr>
                                            ) : (
                                                transactions.map((t, i) => (
                                                    <TransactionRow
                                                        key={t._id || i}
                                                        transaction={t}
                                                        student={student}
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
                                        Debit (Receive)
                                    </button>
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${paymentForm.transactionType === 'CREDIT' ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                        onClick={() => setPaymentForm({ ...paymentForm, transactionType: 'CREDIT' })}
                                    >
                                        Credit (Give/Waive)
                                    </button>
                                </div>

                                <div className="p-4">
                                    <h3 className={`font-bold mb-3 border-b pb-2 ${paymentForm.transactionType === 'DEBIT' ? 'text-blue-700' : 'text-purple-700'}`}>
                                        {paymentForm.transactionType === 'DEBIT' ? 'Record Payment Info' : 'Record Credit / Waiver'}
                                    </h3>
                                    <form onSubmit={handlePayment} className="space-y-3">
                                        {paymentForm.transactionType === 'DEBIT' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase">Fee Head</label>
                                                <select
                                                    className="w-full border p-2 rounded mt-1 bg-white"
                                                    value={paymentForm.selectedFeeHeadId}
                                                    onChange={e => setPaymentForm({ ...paymentForm, selectedFeeHeadId: e.target.value })}
                                                    required
                                                >
                                                    <option value="">-- Select Fee --</option>
                                                    {feeDetails.map(f => (
                                                        <option key={f.feeHeadId} value={f.feeHeadId}>{f.feeHeadName} (Due: ₹{f.dueAmount})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Amount</label>
                                            <input
                                                type="number"
                                                className="w-full border p-2 rounded mt-1"
                                                value={paymentForm.amount}
                                                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Mode</label>
                                            <select
                                                className="w-full border p-2 rounded mt-1 bg-white"
                                                value={paymentForm.paymentMode}
                                                onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                                            >
                                                <option>Cash</option>
                                                <option>UPI</option>
                                                <option>Cheque</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Remarks</label>
                                            <textarea
                                                className="w-full border p-2 rounded mt-1"
                                                rows="2"
                                                value={paymentForm.remarks}
                                                onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                            ></textarea>
                                        </div>
                                        <button className={`w-full text-white font-bold py-2 rounded shadow-md transition-colors ${paymentForm.transactionType === 'DEBIT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                            {paymentForm.transactionType === 'DEBIT' ? 'Collect Payment' : 'Process Credit'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TransactionRow = ({ transaction, student }) => {
    const componentRef = useRef();

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
                            {transaction.transactionType || 'DEBIT'}
                        </span>
                    </div>
                    <span className="block text-[10px] text-gray-400">By: {transaction.collectedByName || transaction.collectedBy || 'System'}</span>
                </td>
                <td className="py-2 px-4 text-sm font-mono text-gray-700">{transaction.receiptNumber}</td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${(transaction.paymentMode || 'cash').toLowerCase() === 'online' || (transaction.paymentMode || 'cash').toLowerCase() === 'upi'
                        ? 'bg-blue-100 text-blue-700'
                        : (transaction.paymentMode || 'cash').toLowerCase() === 'cheque'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                        {(transaction.paymentMode || 'Cash').toUpperCase()}
                    </span>
                </td>
                <td className="py-2 px-4 text-sm text-gray-600 text-center font-medium">
                    {transaction.academicYear ? `${transaction.academicYear} / ${transaction.semester || '-'}` : (transaction.semester || '-')}
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
                            student={student}
                        />
                    </div>
                </td>
            </tr>
        </>
    );
};

export default FeeCollection;