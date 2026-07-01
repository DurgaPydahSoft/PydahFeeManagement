import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const VerifyReceipt = () => {
    const { receiptNumber } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchReceiptData = async () => {
            try {
                setLoading(true);
                const baseURL = import.meta.env.VITE_API_URL || window.location.origin;
                const apiURL = baseURL.endsWith('/api')
                    ? `${baseURL}/public/transactions/receipt/${receiptNumber}`
                    : `${baseURL}/api/public/transactions/receipt/${receiptNumber}`;
                const res = await axios.get(apiURL);
                setData(res.data);
                setLoading(false);
            } catch (err) {
                console.error('Error verifying receipt:', err);
                setError(err.response?.data?.message || 'Receipt could not be verified or is invalid.');
                setLoading(false);
            }
        };

        if (receiptNumber) {
            fetchReceiptData();
        }
    }, [receiptNumber]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4" />
                <p className="text-gray-600 font-medium">Verifying receipt authenticity...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-red-100">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 mb-2">Verification Failed</h1>
                    <p className="text-gray-600 text-sm mb-6">{error || 'Invalid Receipt Number'}</p>
                    <div className="text-[10px] text-gray-400 font-mono">REC ID: {receiptNumber}</div>
                </div>
            </div>
        );
    }

    const { transactions, student, createdAt, paymentMode, collectedByName } = data;
    const primaryTx = transactions[0] || {};
    const totalPaid = transactions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
            {/* Header / Pydah Logo area */}
            <div className="w-full max-w-2xl text-center mb-6">
                <img src="/PYDAH_LOGO_PHOTO.jpg" alt="Pydah Group Logo" className="h-16 mx-auto mb-2 object-contain" />
                <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Pydah Group of Institutions</h2>
            </div>

            {/* Main verification card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-full max-w-2xl">
                {/* Verified Header banner */}
                <div className="bg-emerald-600 text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500 opacity-20 transform -skew-y-6 scale-150"></div>
                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-full mb-3 animate-pulse">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-black uppercase tracking-wide">Fee Receipt</h1>
                        <p className="text-emerald-100 text-xs font-semibold mt-1">Transaction Details</p>
                    </div>
                </div>

                {/* Details Section */}
                <div className="p-6 space-y-6">
                    {/* Grid of basic receipt parameters */}
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-5">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Receipt Number</span>
                            <div className="text-sm font-bold text-gray-800">{receiptNumber}</div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Payment Mode</span>
                            <div className="text-sm font-bold text-gray-850 flex items-center gap-1.5 mt-0.5">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-800 text-[9px] font-black">₹</span>
                                {paymentMode}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Date & Time</span>
                            <div className="text-sm font-semibold text-gray-700">
                                {new Date(createdAt).toLocaleDateString('en-IN')} {new Date(createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Collected By</span>
                            <div className="text-sm font-semibold text-gray-700">{collectedByName || 'Authorized Signatory'}</div>
                        </div>
                    </div>

                    {/* Student Info block */}
                    <div>
                        <h3 className="text-xs uppercase font-extrabold text-gray-800 tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Student Profile Details
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400">Student Name</span>
                                <div className="font-bold text-gray-800 uppercase">{student?.student_name || primaryTx.studentName}</div>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400">PIN / Roll No.</span>
                                <div className="font-bold text-gray-800">{student?.pin_no || '-'}</div>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400">Admission No.</span>
                                <div className="font-semibold text-gray-700">{student?.admission_number || primaryTx.studentId}</div>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400">Course & Branch</span>
                                <div className="font-semibold text-gray-700">{student?.course} - {student?.branch}</div>
                            </div>
                            <div className="md:col-span-2">
                                <span className="text-[9px] uppercase font-bold text-gray-400">College / Campus</span>
                                <div className="font-semibold text-gray-700">{student?.college}</div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Table */}
                    <div>
                        <h3 className="text-xs uppercase font-extrabold text-gray-800 tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Payment Particulars
                        </h3>
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">S.No</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 text-right w-28">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150">
                                    {transactions.map((tx, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 text-center font-medium text-gray-500">{idx + 1}</td>
                                            <td className="px-4 py-3 font-semibold text-gray-800">{tx.feeHead?.name || 'Fee'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-850">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50/20 font-bold border-t-2 border-emerald-600/30">
                                        <td colSpan="2" className="px-4 py-3.5 text-right text-emerald-800 text-xs tracking-wider uppercase font-black">Total Paid</td>
                                        <td className="px-4 py-3.5 text-right text-emerald-900 font-extrabold text-base">₹{totalPaid.toLocaleString('en-IN')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Note preservation & branding */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-gray-400">
                    <span className="font-medium">Note: System-generated verification record. No signature required.</span>
                    <span className="italic font-semibold text-gray-400">Powered by PydahSoft Portal</span>
                </div>
            </div>
        </div>
    );
};

export default VerifyReceipt;
