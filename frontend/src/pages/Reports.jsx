import React, { useState, useEffect, useRef, forwardRef } from 'react';
import Sidebar from './Sidebar';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import CashierReportTemplate from '../components/CashierReportTemplate';

// Row Component to handle Printing Ref independently

import DailyReportTemplate from '../components/DailyReportTemplate';

// Row Component to handle Printing Ref independently
const ReportRow = ({ row, idx, activeTab, expandedRows, toggleRow, dateRange }) => {
    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `${activeTab}_Report_${row._id}_${Date.now()}`
    });

    return (
        <React.Fragment>
            <tr
                className={`hover:bg-gray-50 cursor-pointer transition ${expandedRows.includes(idx) ? 'bg-blue-50' : ''}`}
                onClick={() => (activeTab === 'cashier' || activeTab === 'daily') && toggleRow(idx)}
            >
                <td className="py-3 px-6 text-sm font-medium text-gray-800">
                    {/* Safer Rendering Logic */}
                    {activeTab === 'daily' && row._id?.day
                        ? `${row._id.day}-${row._id.month}-${row._id.year}`
                        : (activeTab === 'feeHead' ? (row.name || 'Unknown Fee Head') : (typeof row._id === 'object' ? 'Date' : (row.name || row._id || 'Unknown')))}
                    {(activeTab === 'cashier' || activeTab === 'daily') && (
                        <span className="text-[10px] text-blue-500 font-normal ml-2 flex items-center gap-1 inline-flex">
                            {expandedRows.includes(idx) ? 'Hide Details' : 'View Details'}
                            <svg className={`w-3 h-3 transform transition ${expandedRows.includes(idx) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </span>
                    )}
                </td>
                <td className="py-3 px-6 text-sm text-gray-600 text-right">{row.count || row.totalCount}</td>

                {/* Cashier AND Fee Head Specifics */}
                {(activeTab === 'cashier' || activeTab === 'feeHead') && (
                    <>
                        <td className="py-3 px-6 text-sm text-gray-600 text-right font-mono">₹{(row.cashAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-6 text-sm text-gray-600 text-right font-mono">₹{(row.bankAmount || 0).toLocaleString()}</td>
                    </>
                )}

                <td className="py-3 px-6 text-sm text-green-600 text-right font-medium">₹{row.debitAmount.toLocaleString()}</td>
                <td className="py-3 px-6 text-sm text-purple-600 text-right font-medium">₹{row.creditAmount.toLocaleString()}</td>
                <td className="py-3 px-6 text-sm text-gray-900 text-right font-bold">₹{row.totalAmount.toLocaleString()}</td>

                {/* Action Column for Print */}
                {(activeTab === 'cashier' || activeTab === 'daily') && (
                    <td className="py-3 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handlePrint} className="text-gray-500 hover:text-blue-600 p-1" title={`Print ${activeTab} Report`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                        <div style={{ display: 'none' }}>
                            {activeTab === 'cashier' ? (
                                <CashierReportTemplate ref={printRef} data={row} dateRange={dateRange} />
                            ) : (
                                <DailyReportTemplate ref={printRef} data={row} />
                            )}
                        </div>
                    </td>
                )}
            </tr>

            {/* Detailed Fee Head Breakdown Row for Cashier */}
            {activeTab === 'cashier' && row.feeHeads && expandedRows.includes(idx) && (
                <tr className="bg-gray-50">
                    <td colSpan="8" className="p-4 pl-10 border-t border-blue-100 shadow-inner">
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fee Head Separation</div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.values(row.feeHeads.reduce((acc, curr) => {
                                if (!acc[curr.name]) acc[curr.name] = 0;
                                acc[curr.name] += curr.amount;
                                return acc;
                            }, {})).map((amt, i, arr) => {
                                const name = Object.keys(row.feeHeads.reduce((acc, curr) => { if (!acc[curr.name]) acc[curr.name] = 0; acc[curr.name] += curr.amount; return acc; }, {}))[i];
                                return (
                                    <div key={i} className="flex justify-between border-b border-gray-200 pb-1 text-xs">
                                        <span className="text-gray-600">{name}</span>
                                        <span className="font-bold">₹{amt.toLocaleString()}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </td>
                </tr>
            )}

            {/* Detailed Transactions Row for Daily */}
            {activeTab === 'daily' && row.transactions && expandedRows.includes(idx) && (
                <tr className="bg-gray-50">
                    <td colSpan="8" className="p-4 pl-10 border-t border-blue-100 shadow-inner">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transactions Details</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs bg-white rounded border">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-2 border-r">Receipt No</th>
                                        <th className="p-2 border-r">Student Name</th>
                                        <th className="p-2 border-r">Admission No</th>
                                        <th className="p-2 border-r">Mode</th>
                                        <th className="p-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {row.transactions.map((tx, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50">
                                            <td className="p-2 border-r font-mono">{tx.receiptNo || '-'}</td>
                                            <td className="p-2 border-r">{tx.studentName || '-'}</td>
                                            <td className="p-2 border-r">{tx.studentId || '-'}</td>
                                            <td className="p-2 border-r">{tx.paymentMode}</td>
                                            <td className="p-2 text-right font-bold text-gray-700">₹{tx.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

const Reports = () => {
    const [activeTab, setActiveTab] = useState('daily');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({ totalConfirm: 0, count: 0 });
    const [expandedRows, setExpandedRows] = useState([]);

    const toggleRow = (idx) => {
        if (expandedRows.includes(idx)) {
            setExpandedRows(expandedRows.filter(i => i !== idx));
        } else {
            setExpandedRows([...expandedRows, idx]);
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        setExpandedRows([]); // Reset expansion on refetch
        try {
            let groupBy = 'day';
            if (activeTab === 'cashier') groupBy = 'cashier';
            if (activeTab === 'feeHead') groupBy = 'feeHead';
            if (activeTab === 'mode') groupBy = 'mode';

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/reports/transactions`, {
                params: { startDate, endDate, groupBy }
            });
            setData(res.data);

            // Calc summary
            const tot = res.data.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
            const cnt = res.data.reduce((acc, curr) => acc + (curr.count || 0), 0);
            setSummary({ totalConfirm: tot, count: cnt });

        } catch (error) {
            console.error(error);
            alert('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setData([]); // Clear previous data to prevent render mismatch
        fetchReport();
    }, [activeTab]);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8">
                <header className="mb-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
                            <p className="text-sm text-gray-500 mt-1">Generate financial reports and statements.</p>
                        </div>

                        {/* Tabs in Header - Clean No Background */}
                        <div className="flex items-center gap-6 border-b border-gray-200 pb-1">
                            <button
                                onClick={() => { setActiveTab('daily'); setData([]); }}
                                className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'daily' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >Daily</button>
                            <button
                                onClick={() => { setActiveTab('cashier'); setData([]); }}
                                className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'cashier' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >Cashier</button>
                            <button
                                onClick={() => { setActiveTab('feeHead'); setData([]); }}
                                className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'feeHead' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >Fee Head</button>
                        </div>
                    </div>
                </header>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b bg-white flex flex-wrap gap-4 items-end">
                        {/* Tabs removed from here */}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
                            <input
                                type="date"
                                className="border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
                            <input
                                type="date"
                                className="border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={fetchReport}
                            className="bg-gray-800 text-white px-5 py-1.5 rounded text-sm font-bold hover:bg-gray-900 h-[34px]"
                        >
                            Filter
                        </button>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-600 font-bold uppercase">Total Collection</p>
                            <p className="text-2xl font-bold text-blue-900">₹{summary.totalConfirm.toLocaleString()}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <p className="text-xs text-purple-600 font-bold uppercase">Transactions</p>
                            <p className="text-2xl font-bold text-purple-900">{summary.count}</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase">
                                        {activeTab === 'daily' ? 'Date' :
                                            activeTab === 'cashier' ? 'Cashier Name' :
                                                'Fee Head'}
                                    </th>
                                    <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Transactions</th>

                                    {/* Additional Columns for Cashier AND Fee Head */}
                                    {(activeTab === 'cashier' || activeTab === 'feeHead') && (
                                        <>
                                            <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Cash</th>
                                            <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Bank</th>
                                        </>
                                    )}

                                    <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Collected (DEBIT)</th>
                                    <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Concession (CREDIT)</th>
                                    <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Net Amount</th>
                                    {(activeTab === 'cashier' || activeTab === 'daily') && <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase text-right">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan="9" className="py-10 text-center text-gray-500">Loading data...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan="9" className="py-10 text-center text-gray-500">No records found for selected period.</td></tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <ReportRow
                                            key={idx}
                                            row={row}
                                            idx={idx}
                                            activeTab={activeTab}
                                            expandedRows={expandedRows}
                                            toggleRow={toggleRow}
                                            dateRange={{ start: startDate, end: endDate }}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
