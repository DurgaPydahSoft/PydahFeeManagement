import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import {
    Calendar,
    Printer,
    Wallet,
    Landmark,
    CreditCard,
    TrendingUp,
    FileText,
    Users,
    Filter,
    Search,
    ChevronDown,
    ChevronUp,
    Download
} from 'lucide-react';
import CashierReportTemplate from '../components/CashierReportTemplate';
import DailyReportTemplate from '../components/DailyReportTemplate';

// --- Components ---

const StatCard = ({ title, value, color, icon: Icon, note }) => {
    const colorStyles = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        green: "bg-emerald-50 text-emerald-600 border-emerald-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
    };

    return (
        <div className={`p-4 rounded-2xl border ${colorStyles[color]} relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h3 className="text-2xl font-bold tracking-tight mb-1">{value}</h3>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{title}</p>
                    {note && <p className="text-[10px] mt-2 opacity-70 font-medium">{note}</p>}
                </div>
                <div className={`p-2 rounded-xl bg-white/60 backdrop-blur-md shadow-sm transition-transform group-hover:scale-110`}>
                    <Icon size={20} strokeWidth={2} />
                </div>
            </div>
            {/* Decorative circle */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/20 z-0"></div>
        </div>
    );
};

const ReportRow = ({ row, idx, activeTab, expandedRows, toggleRow, dateRange }) => {
    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `${activeTab}_Report_${row._id}_${Date.now()}`
    });

    const isExpanded = expandedRows.includes(idx);
    const RowIcon = activeTab === 'cashier' ? Users : activeTab === 'feeHead' ? FileText : Calendar;
    const formattedDate = row._id?.day ? `${row._id.day}-${row._id.month}-${row._id.year}` : 'Date';

    // Label determination logic
    const rowLabel = activeTab === 'daily'
        ? <span className="font-mono text-gray-700 tracking-tight">{formattedDate}</span>
        : activeTab === 'feeHead'
            ? (row.name || 'Unknown Fee Head')
            : (row.name || row._id || 'Unknown');

    return (
        <React.Fragment>
            <tr
                onClick={() => (activeTab === 'cashier' || activeTab === 'daily') && toggleRow(idx)}
                className={`
                    group border-b border-gray-100 transition-all duration-200
                    ${isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50 cursor-pointer'}
                `}
            >
                {/* Identifier */}
                <td className="py-2.5 px-4">
                    <div className="flex items-center gap-4">
                        <div className={`
                            p-2 rounded-xl transition-colors duration-200
                            ${isExpanded ? 'bg-blue-500 text-white shadow-blue-200 shadow-md' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}
                        `}>
                            <RowIcon size={16} strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-900">{rowLabel}</p>
                            {(activeTab === 'cashier' || activeTab === 'daily') && (
                                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mt-0.5 group-hover:text-blue-500 transition-colors">
                                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    {isExpanded ? 'Collapse' : 'Expand Details'}
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                <td className="py-2 px-4 text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        {row.count || row.totalCount}
                    </span>
                </td>

                {/* Cash/Bank Breakdown */}
                <td className="py-2 px-4 text-right">
                    {(activeTab === 'cashier' || activeTab === 'feeHead') ? (
                        <div className="flex flex-col items-end gap-1.5 opacity-80">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                                <Wallet size={12} /> ₹{(row.cashAmount || 0).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700">
                                <Landmark size={12} /> ₹{(row.bankAmount || 0).toLocaleString()}
                            </div>
                        </div>
                    ) : (
                        <span className="text-gray-300 text-xs">-</span>
                    )}
                </td>

                <td className="py-4 px-6 text-right font-medium text-gray-600">₹{row.debitAmount.toLocaleString()}</td>
                <td className="py-4 px-6 text-right font-medium text-purple-600">₹{row.creditAmount.toLocaleString()}</td>
                <td className="py-2 px-4 text-right">
                    <span className="text-sm font-bold text-gray-900">₹{row.totalAmount.toLocaleString()}</span>
                </td>

                {/* Actions */}
                {(activeTab === 'cashier' || activeTab === 'daily') && (
                    <td className="py-2 px-4 text-right">
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrint(); }}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-100/50 transition-all active:scale-95"
                            title="Print Report"
                        >
                            <Printer size={18} />
                        </button>
                        {/* Hidden refs for printing */}
                        <div className="hidden">
                            {activeTab === 'cashier' ? (
                                <CashierReportTemplate ref={printRef} data={row} dateRange={dateRange} />
                            ) : (
                                <DailyReportTemplate ref={printRef} data={row} />
                            )}
                        </div>
                    </td>
                )}
            </tr>

            {/* EXPANDED CONTENT: Cashier Fee Head Breakdown */}
            {activeTab === 'cashier' && row.feeHeads && isExpanded && (
                <tr className="bg-blue-50/40">
                    <td colSpan="100%" className="p-0">
                        <div className="p-4 pl-[4.5rem] pr-6 border-b border-blue-100">
                            <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
                                <h4 className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-widest mb-4">
                                    <FileText size={14} /> Fee Head Breakdown
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries(row.feeHeads.reduce((acc, curr) => {
                                        acc[curr.name] = (acc[curr.name] || 0) + curr.amount;
                                        return acc;
                                    }, {})).map(([name, amount], i) => (
                                        <div key={i} className="flex flex-col p-3 rounded-lg bg-gray-50 border border-gray-100">
                                            <span className="text-[10px] text-gray-500 font-semibold uppercase truncate mb-1" title={name}>{name}</span>
                                            <span className="text-sm font-bold text-gray-800">₹{amount.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* EXPANDED CONTENT: Daily Transactions List */}
            {activeTab === 'daily' && row.transactions && isExpanded && (
                <tr className="bg-blue-50/40">
                    <td colSpan="100%" className="p-0">
                        <div className="p-3 pl-[3.5rem] pr-4 border-b border-blue-100">
                            <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                                <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-widest">
                                        <CreditCard size={14} /> Transaction Details
                                    </h4>
                                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                        {row.transactions.length} Records
                                    </span>
                                </div>
                                <div className="overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap">Receipt #</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Student Name</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Pin No</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Course / Branch</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Year</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Mode</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {row.transactions.map((tx, i) => (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-2 font-mono text-gray-500">{tx.receiptNo || '-'}</td>
                                                    <td className="px-4 py-2 font-bold text-gray-800">{tx.studentName}</td>
                                                    <td className="px-4 py-2 text-gray-600">{tx.pinNo}</td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 border border-gray-200 mr-1">{tx.course}</span>
                                                        {tx.branch}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">{tx.studentYear}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tx.paymentMode === 'CASH' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                            {tx.paymentMode === 'CASH' ? <Wallet size={8} /> : <Landmark size={8} />}
                                                            {tx.paymentMode}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold text-gray-900">₹{tx.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
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
        setExpandedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const fetchReport = async () => {
        setLoading(true);
        setExpandedRows([]);
        try {
            let groupBy = activeTab;
            if (activeTab === 'daily') groupBy = 'day';
            else if (activeTab === 'cashier') groupBy = 'cashier';
            else if (activeTab === 'feeHead') groupBy = 'feeHead';

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/reports/transactions`, {
                params: { startDate, endDate, groupBy: groupBy === 'daily' ? 'day' : groupBy }
            });
            setData(res.data);

            const tot = res.data.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
            const cnt = res.data.reduce((acc, curr) => acc + (curr.count || 0), 0);
            const cash = res.data.reduce((acc, curr) => acc + (curr.cashAmount || 0), 0);
            const bank = res.data.reduce((acc, curr) => acc + (curr.bankAmount || 0), 0);

            setSummary({ totalConfirm: tot, count: cnt, totalCash: cash, totalBank: bank });

        } catch (error) {
            console.error(error);
            // alert('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!data || data.length === 0) return alert("No data to export");

        const headers = [
            activeTab === 'daily' ? 'Date' : activeTab === 'cashier' ? 'Cashier' : 'Fee Head',
            "Transactions",
            "Cash",
            "Bank",
            "Collected",
            "Concession",
            "Net Total"
        ];

        const rows = data.map(row => {
            let identifier = '';
            if (activeTab === 'daily') {
                identifier = row._id?.day ? `${row._id.day}-${row._id.month}-${row._id.year}` : 'Date';
            } else if (activeTab === 'feeHead') {
                identifier = row.name || 'Unknown Fee Head';
            } else {
                identifier = row.name || row._id || 'Unknown';
            }

            return [
                identifier,
                row.count || row.totalCount || 0,
                row.cashAmount || 0,
                row.bankAmount || 0,
                row.debitAmount || 0,
                row.creditAmount || 0,
                row.totalAmount || 0
            ];
        });

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `Report_${activeTab}_${startDate}_to_${endDate}.csv`);
    };

    useEffect(() => {
        fetchReport();
    }, [activeTab, startDate, endDate]);

    return (
        <div className="flex h-screen bg-gray-50/30 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <header className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp className="text-gray-800" size={24} /> Reports & Analytics
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Monitor financial performance and generate detailed statements.</p>
                        </div>

                        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm self-start xl:self-auto">
                            {['daily', 'cashier', 'feeHead'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setData([]); }}
                                    className={`
                                        px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 capitalize whitespace-nowrap
                                        ${activeTab === tab
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                                    `}
                                >
                                    {tab === 'feeHead' ? 'Fee Head' : tab}
                                </button>
                            ))}
                        </div>
                    </header>
                    <div className="max-w-[1600px] mx-auto space-y-6">

                        {/* 1. Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <StatCard
                                title="Net Collection"
                                value={`₹${summary.totalConfirm.toLocaleString()}`}
                                color="blue"
                                icon={TrendingUp}
                            />
                            <StatCard
                                title="Cash Received"
                                value={`₹${(summary.totalCash || 0).toLocaleString()}`}
                                color="green"
                                icon={Wallet}
                            />
                            <StatCard
                                title="Bank Transfers"
                                value={`₹${(summary.totalBank || 0).toLocaleString()}`}
                                color="indigo"
                                icon={Landmark}
                            />
                            <StatCard
                                title="Transactions"
                                value={summary.count}
                                color="purple"
                                icon={CreditCard}
                                note="Total records found"
                            />
                        </div>

                        {/* 2. Main Data Section */}
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

                            {/* Toolbar (Filters) */}
                            <div className="p-3 border-b border-gray-100 bg-white flex flex-wrap justify-between items-center gap-4">
                                <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 pl-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Range:</label>
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-800 focus:ring-0 cursor-pointer w-32"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                        />
                                        <span className="text-gray-300">to</span>
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-800 focus:ring-0 cursor-pointer w-32"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={exportToCSV}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition"
                                    >
                                        <Download size={16} /> Export CSV
                                    </button>
                                    <button
                                        onClick={fetchReport}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition"
                                    >
                                        <Filter size={16} /> Refresh Data
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto min-h-[400px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-bold">
                                            <th className="py-3 px-4 w-1/4">
                                                {activeTab === 'daily' ? 'Date' : activeTab === 'cashier' ? 'Cashier' : 'Fee Head'}
                                            </th>
                                            <th className="py-3 px-4 text-right">Transactions</th>
                                            <th className="py-3 px-4 text-right">Method</th>
                                            <th className="py-3 px-4 text-right text-gray-600">Collected</th>
                                            <th className="py-3 px-4 text-right text-gray-600">Concession</th>
                                            <th className="py-3 px-4 text-right text-black">Net Total</th>
                                            {(activeTab === 'cashier' || activeTab === 'daily') && <th className="py-3 px-4 text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="8" className="py-32 text-center pointer-events-none">
                                                    <div className="flex flex-col items-center justify-center gap-4">
                                                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-gray-400 font-medium animate-pulse">Computing financials...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : data.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="py-32 text-center pointer-events-none">
                                                    <div className="flex flex-col items-center justify-center gap-4 opacity-50">
                                                        <div className="bg-gray-100 p-4 rounded-full">
                                                            <Search size={32} className="text-gray-400" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-gray-900 font-bold text-lg">No reports found.</p>
                                                            <p className="text-gray-500 text-sm">Try adjusting your date filters.</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
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

                                    {/* Footer Summary */}
                                    {!loading && data.length > 0 && (
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td className="py-3 px-4 font-bold text-gray-800 text-xs text-left uppercase tracking-wide">GRAND TOTAL</td>
                                                <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{summary.count}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {(activeTab === 'cashier' || activeTab === 'feeHead') ? (
                                                        <div className="flex flex-col items-end gap-0.5 text-[10px] font-mono font-medium text-gray-500">
                                                            <span>C: {(summary.totalCash || 0).toLocaleString()}</span>
                                                            <span>B: {(summary.totalBank || 0).toLocaleString()}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-sm text-emerald-700">
                                                    ₹{data.reduce((a, c) => a + (c.debitAmount || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-sm text-purple-700">
                                                    ₹{data.reduce((a, c) => a + (c.creditAmount || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-right font-extrabold text-base text-gray-900">
                                                    ₹{summary.totalConfirm.toLocaleString()}
                                                </td>
                                                {(activeTab === 'cashier' || activeTab === 'daily') && <td></td>}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Reports;
