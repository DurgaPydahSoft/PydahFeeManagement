import React, { useState, useEffect, useRef, Fragment } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { useReactToPrint } from 'react-to-print';
import { printHtmlDocument } from '../utils/printService';
// Removed XLSX import since Export was removed
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
    Clock
} from 'lucide-react';
import CashierReportTemplate from '../components/CashierReportTemplate';
import DailyReportTemplate from '../components/DailyReportTemplate';
import CollegeReportTemplate from '../components/CollegeReportTemplate';
import AccountReportTemplate from '../components/AccountReportTemplate';
import { useCampuses } from '../hooks/useCampuses';

// PrintTriggerComponent was removed

// --- Components ---

const StatCard = ({ title, value, color, icon: Icon, note }) => {
    // Cleaner, more professional card style without excessive gradients/blobs
    const colorStyles = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        green: "text-emerald-600 bg-emerald-50 border-emerald-100",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        purple: "text-purple-600 bg-purple-50 border-purple-100",
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{title}</p>
                <h3 className="text-xl font-bold text-gray-800 tracking-tight">{value}</h3>
                {note && <p className="text-[10px] mt-1.5 text-gray-400 font-medium">{note}</p>}
            </div>
            <div className={`p-3 rounded-lg ${colorStyles[color]} bg-opacity-50`}>
                <Icon size={18} strokeWidth={2} />
            </div>
        </div>
    );
};

const ReportRow = ({ row, idx, activeTab, expandedRows, toggleRow, dateRange, role, setPrintModalData }) => {
    const printRef = useRef();
    const handlePrint = async () => {
        try {
            let template = '';
            let data = {};
            if (activeTab === 'cashier') {
                template = 'cashier-report';
                data = { cashierData: row, dateRange, options: { mode: 'all' } };
            } else if (activeTab === 'college') {
                template = 'college-report';
                data = { displayData: row, dateRange, options: { mode: 'all' } };
            } else if (activeTab === 'account') {
                template = 'account-report';
                data = { displayData: row, dateRange, options: { mode: 'all' } };
            } else if (activeTab === 'daily') {
                template = 'daily-report';
                data = { reportData: row };
            }

            const response = await api.post('/print', { template, data });
            printHtmlDocument(response.data);
        } catch (err) {
            console.error('Print failed:', err);
            alert('Failed to generate print document');
        }
    };

    const isExpanded = expandedRows.includes(idx);
    const RowIcon = activeTab === 'cashier' ? Users : activeTab === 'college' ? Landmark : activeTab === 'account' ? CreditCard : Calendar;
    const formattedDate = row._id?.day ? `${row._id.day}-${row._id.month}-${row._id.year}` : 'Date';

    // Label determination logic
    const rowLabel = activeTab === 'daily'
        ? <span className="font-mono text-gray-700 tracking-tight font-bold">{formattedDate}</span>
        : activeTab === 'college'
            ? (row._id || 'Unknown College')
            : activeTab === 'account'
                ? (row.account_name || 'Direct / Unassigned')
                : (row.name || row._id || 'Unknown');

    // Calculate Net Total (Cash + Bank) - equivalent to debitAmount
    const netTotal = (row.cashAmount || 0) + (row.bankAmount || 0);

    return (
        <React.Fragment>
            <tr
                onClick={() => (activeTab === 'cashier' || activeTab === 'daily' || activeTab === 'college' || activeTab === 'account') && toggleRow(idx)}
                className={`
                    group border-b border-gray-100 transition-all duration-200 text-xs
                    ${isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50 cursor-pointer'}
                `}
            >
                {/* Identifier */}
                <td className="py-4 px-6 md:w-1/4">
                    <div className="flex items-start gap-3">
                        <div className={`
                            p-2 rounded-lg transition-colors duration-200 mt-0.5
                            ${isExpanded ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-white border border-transparent group-hover:border-gray-200'}
                        `}>
                            <RowIcon size={16} strokeWidth={2} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">{rowLabel}</p>
                            {activeTab === 'account' && (
                                <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                                    {row.bank_name !== 'Cash / General' ? (
                                        <>
                                            <div className="font-semibold text-gray-700">{row.bank_name} <span className="font-mono text-[9px]">({row.account_number})</span></div>
                                            {row.is_global || !row.college || ['N/A', 'All Colleges', 'All'].includes(String(row.college).trim()) ? (
                                                <div className="text-[8px] text-purple-700 bg-purple-50 border border-purple-100 px-1 py-0.5 rounded inline-block font-bold mt-0.5">Global Account</div>
                                            ) : (
                                                <div className="text-[8px] text-blue-600 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded inline-block font-bold mt-0.5">{row.college} - {row.course}</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-[8px] text-gray-500 bg-gray-100 border border-gray-200 px-1 py-0.5 rounded inline-block font-bold mt-0.5">General Cash/Other Collections</div>
                                    )}
                                </div>
                            )}
                            {(activeTab === 'cashier' || activeTab === 'daily' || activeTab === 'college' || activeTab === 'account') && (
                                <div className="flex items-center gap-1 text-[9px] font-medium text-gray-400 mt-1 group-hover:text-blue-500 transition-colors uppercase tracking-wide">
                                    {isExpanded ? 'Collapse' : 'Click for Details'}
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                {/* Transactions Count */}
                <td className="py-4 px-6 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
                        {row.count || row.totalCount}
                    </span>
                </td>

                {/* Cash */}
                <td className="py-4 px-6 text-right font-medium text-emerald-600">
                    {Number(row.cashAmount || 0).toLocaleString()}
                </td>

                {/* Bank */}
                <td className="py-4 px-6 text-right font-medium text-indigo-600">
                    {Number(row.bankAmount || 0).toLocaleString()}
                </td>

                {/* Concession */}
                <td className="py-4 px-6 text-right font-medium text-purple-600">
                    {Number(row.creditAmount || 0).toLocaleString()}
                </td>

                {/* Net Total */}
                <td className="py-4 px-6 text-right">
                    <span className="text-xs font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        {Number(netTotal || 0).toLocaleString()}
                    </span>
                </td>

                {/* Actions */}
                {(activeTab === 'cashier' || activeTab === 'daily' || activeTab === 'college' || activeTab === 'account') && (
                    <td className="py-4 px-6 text-right">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (activeTab === 'cashier' || activeTab === 'college' || activeTab === 'account') {
                                    setPrintModalData({ row, dateRange });
                                } else {
                                    handlePrint();
                                }
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Print Report"
                        >
                            <Printer size={18} />
                        </button>
                        {/* Hidden refs for printing */}
                        <div className="hidden">
                            {activeTab === 'cashier' ? (
                                <CashierReportTemplate ref={printRef} data={row} dateRange={dateRange} />
                            ) : activeTab === 'college' ? (
                                <CollegeReportTemplate ref={printRef} data={row} dateRange={dateRange} />
                            ) : activeTab === 'account' ? (
                                <AccountReportTemplate ref={printRef} data={row} dateRange={dateRange} />
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
                            <div className="bg-white rounded-lg border border-blue-100 p-4 shadow-sm">
                                <h4 className="flex items-center gap-2 text-[11px] font-bold text-blue-900 uppercase tracking-widest mb-4">
                                    <FileText size={12} /> Fee Head Breakdown
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries((row.feeHeads || []).reduce((acc, curr) => {
                                        acc[curr.name] = (acc[curr.name] || 0) + curr.amount;
                                        return acc;
                                    }, {})).map(([name, amount], i) => (
                                        <div key={i} className="flex flex-col p-3 rounded bg-gray-50 border border-gray-100">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase truncate mb-1" title={name}>{name}</span>
                                            <span className="text-xs font-bold text-gray-800">{Number(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* EXPANDED CONTENT: College Cashier Breakdown */}
            {activeTab === 'college' && row.cashiers && isExpanded && (
                <tr className="bg-blue-50/40">
                    <td colSpan="100%" className="p-0">
                        <div className="p-4 pl-[4.5rem] pr-6 border-b border-blue-100 space-y-6">
                            
                            {/* Table A: College Fee Head-wise summary */}
                            {row.feeHeads && row.feeHeads.length > 0 && (
                                <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                                    <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                                        <h4 className="flex items-center gap-2 text-[11px] font-bold text-blue-900 uppercase tracking-widest">
                                            <FileText size={12} /> Fee Head-wise Collections
                                        </h4>
                                        <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                            {row.feeHeads.length} Fee Heads
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-3 w-[50px]">S.No</th>
                                                    <th className="px-4 py-3">Fee Head Name</th>
                                                    <th className="px-4 py-3 text-right">Cash</th>
                                                    <th className="px-4 py-3 text-right">Bank</th>
                                                    <th className="px-4 py-3 text-right">Collection</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {row.feeHeads.map((fh, fhIdx) => (
                                                    <tr key={fhIdx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-2 text-gray-500">{fhIdx + 1}</td>
                                                        <td className="px-4 py-2 font-bold text-gray-800">{fh.name}</td>
                                                        <td className="px-4 py-2 text-right text-emerald-600">₹{Number(fh.cashAmount || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right text-indigo-600">₹{Number(fh.bankAmount || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-extrabold text-blue-900">₹{Number(fh.netTotal || 0).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Table B: User-wise Consolidated Collections with inline fee heads */}
                            <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                                <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                                    <h4 className="flex items-center gap-2 text-[11px] font-bold text-blue-900 uppercase tracking-widest">
                                        <Users size={12} /> User-wise Consolidated Collections
                                    </h4>
                                    <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                        {row.cashiers.length} Cashiers
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 w-[50px]">S.No</th>
                                                <th className="px-4 py-3">Cashier Name / Fee Heads Collected</th>
                                                <th className="px-4 py-3 text-center">Receipts</th>
                                                <th className="px-4 py-3 text-right">Cash</th>
                                                <th className="px-4 py-3 text-right">Bank</th>
                                                <th className="px-4 py-3 text-right">Collection</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {row.cashiers.map((c, i) => {
                                                const subRows = [];
                                                // Cashier Total Row
                                                subRows.push(
                                                    <tr key={`c-total-${i}`} className="bg-gray-50/50 font-semibold hover:bg-gray-100/50 transition-colors">
                                                        <td className="px-4 py-2 text-center text-gray-500">{i + 1}</td>
                                                        <td className="px-4 py-2 font-bold text-gray-800 uppercase">
                                                            {c.name} <span className="text-[9px] text-gray-400 font-medium font-mono ml-2">({c.username})</span>
                                                        </td>
                                                        <td className="px-4 py-2 text-center font-bold text-gray-700">{c.count}</td>
                                                        <td className="px-4 py-2 text-right text-emerald-600">₹{Number(c.cashAmount || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right text-indigo-600">₹{Number(c.bankAmount || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-extrabold text-blue-900">₹{Number(c.netTotal || 0).toLocaleString()}</td>
                                                    </tr>
                                                );
                                                // Cashier Fee Head Breakdown
                                                if (c.feeHeads && c.feeHeads.length > 0) {
                                                    c.feeHeads.forEach((fh, fhIdx) => {
                                                        subRows.push(
                                                            <tr key={`c-fh-${i}-${fhIdx}`} className="hover:bg-gray-50 transition-colors border-none">
                                                                <td></td>
                                                                <td className="px-4 py-1.5 pl-8 text-[10px] font-bold text-gray-800">
                                                                    {fh.name}
                                                                </td>
                                                                <td></td>
                                                                <td className="px-4 py-1.5 text-right text-[10px] text-emerald-600 font-bold">₹{Number(fh.cashAmount || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-1.5 text-right text-[10px] text-indigo-600 font-bold">₹{Number(fh.bankAmount || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-1.5 text-right text-[10px] font-extrabold text-gray-900">₹{Number(fh.netTotal || 0).toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    });
                                                }
                                                return subRows;
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* EXPANDED CONTENT: Account Fee Head Breakdown */}
            {activeTab === 'account' && row.transactions && isExpanded && (() => {
                const isGlobalRow = row.is_global || !row.college || ['N/A', 'All Colleges', 'All'].includes(String(row.college || '').trim());
                const collegeTree = {};
                if (isGlobalRow) {
                    (row.transactions || [])
                        .filter(tx => tx.transactionType === 'DEBIT' && tx.status !== 'cancelled')
                        .forEach(tx => {
                            const college = tx.college || 'Unknown College';
                            const course = tx.course || 'Unknown Course';
                            const fh = tx.feeHead || 'Unknown';
                            const amt = tx.amount || 0;
                            const isCash = tx.paymentMode === 'Cash';
                            if (!collegeTree[college]) collegeTree[college] = { college, cash: 0, bank: 0, total: 0, courses: {} };
                            const c = collegeTree[college];
                            c.total += amt;
                            if (isCash) c.cash += amt; else c.bank += amt;
                            if (!c.courses[course]) c.courses[course] = { course, cash: 0, bank: 0, total: 0, feeHeads: {} };
                            const co = c.courses[course];
                            co.total += amt;
                            if (isCash) co.cash += amt; else co.bank += amt;
                            if (!co.feeHeads[fh]) co.feeHeads[fh] = { name: fh, cash: 0, bank: 0, total: 0 };
                            const f = co.feeHeads[fh];
                            f.total += amt;
                            if (isCash) f.cash += amt; else f.bank += amt;
                        });
                }
                const colleges = Object.values(collegeTree)
                    .map(c => ({
                        ...c,
                        courses: Object.values(c.courses)
                            .map(co => ({ ...co, feeHeads: Object.values(co.feeHeads).sort((a, b) => b.total - a.total) }))
                            .sort((a, b) => b.total - a.total)
                    }))
                    .sort((a, b) => b.total - a.total);

                return (
                <tr className="bg-blue-50/40">
                    <td colSpan="100%" className="p-0">
                        <div className="p-4 pl-[4.5rem] pr-6 border-b border-blue-100 space-y-4">
                            {isGlobalRow && colleges.length > 0 && (
                                <div className="bg-white rounded-lg border border-purple-100 p-4 shadow-sm">
                                    <h4 className="flex items-center gap-2 text-[11px] font-bold text-purple-900 uppercase tracking-widest mb-4">
                                        <Landmark size={12} /> College-wise Consolidated Collections
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold">
                                                <tr>
                                                    <th className="px-3 py-2">College / Course / Fee Head</th>
                                                    <th className="px-3 py-2 text-right">Cash</th>
                                                    <th className="px-3 py-2 text-right">Bank</th>
                                                    <th className="px-3 py-2 text-right">Collection</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {colleges.map((college, ci) => (
                                                    <Fragment key={`c-${ci}`}>
                                                        <tr className="bg-gray-100 font-bold">
                                                            <td className="px-3 py-2 uppercase text-gray-900">{college.college}</td>
                                                            <td className="px-3 py-2 text-right text-emerald-700">₹{Number(college.cash).toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-indigo-700">₹{Number(college.bank).toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-blue-900">₹{Number(college.total).toLocaleString()}</td>
                                                        </tr>
                                                        {college.courses.map((course, coi) => (
                                                            <Fragment key={`co-${ci}-${coi}`}>
                                                                <tr className="bg-gray-50/80 font-semibold">
                                                                    <td className="px-3 py-1.5 pl-6 uppercase text-gray-800">- {course.course}</td>
                                                                    <td className="px-3 py-1.5 text-right text-emerald-600">₹{Number(course.cash).toLocaleString()}</td>
                                                                    <td className="px-3 py-1.5 text-right text-indigo-600">₹{Number(course.bank).toLocaleString()}</td>
                                                                    <td className="px-3 py-1.5 text-right text-blue-900">₹{Number(course.total).toLocaleString()}</td>
                                                                </tr>
                                                                {course.feeHeads.map((fh, fi) => (
                                                                    <tr key={`fh-${ci}-${coi}-${fi}`} className="hover:bg-gray-50">
                                                                        <td className="px-3 py-1 pl-10 text-gray-700">{fh.name}</td>
                                                                        <td className="px-3 py-1 text-right text-emerald-600">₹{Number(fh.cash).toLocaleString()}</td>
                                                                        <td className="px-3 py-1 text-right text-indigo-600">₹{Number(fh.bank).toLocaleString()}</td>
                                                                        <td className="px-3 py-1 text-right font-bold text-gray-900">₹{Number(fh.total).toLocaleString()}</td>
                                                                    </tr>
                                                                ))}
                                                            </Fragment>
                                                        ))}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-lg border border-blue-100 p-4 shadow-sm">
                                <h4 className="flex items-center gap-2 text-[11px] font-bold text-blue-900 uppercase tracking-widest mb-4">
                                    <FileText size={12} /> Fee Head Breakdown
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {Object.entries(
                                        (row.transactions || [])
                                            .filter(tx => tx.transactionType === 'DEBIT' && tx.status !== 'cancelled')
                                            .reduce((acc, curr) => {
                                                const fhName = curr.feeHead || 'Unknown';
                                                acc[fhName] = (acc[fhName] || 0) + (curr.amount || 0);
                                                return acc;
                                            }, {})
                                    ).map(([name, amount], i) => (
                                        <div key={i} className="flex flex-col p-3 rounded bg-gray-50 border border-gray-100">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase truncate mb-1" title={name}>{name}</span>
                                            <span className="text-xs font-bold text-gray-800">₹{Number(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
                );
            })()}

            {/* EXPANDED CONTENT: Daily Transactions List */}
            {activeTab === 'daily' && row.transactions && isExpanded && (
                <tr className="bg-blue-50/40">
                    <td colSpan="100%" className="p-0">
                        <div className="p-4 pl-[4.5rem] pr-6 border-b border-blue-100">
                            <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                                <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                                    <h4 className="flex items-center gap-2 text-[11px] font-bold text-blue-900 uppercase tracking-widest">
                                        <CreditCard size={12} /> Transaction Details
                                    </h4>
                                    <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                        {row.transactions.length} Records
                                    </span>
                                </div>
                                <div className="overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="w-full text-[11px] text-left">
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
                                                    {/* Updated Pin No Access: Verify backend sends 'pinNo' */}
                                                    <td className="px-4 py-2 text-gray-600 font-mono">{tx.pinNo || '-'}</td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 border border-gray-200 mr-1">{tx.course}</span>
                                                        {tx.branch}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">{tx.studentYear}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border ${tx.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                            {tx.paymentMode === 'Cash' ? <Wallet size={8} /> : <Landmark size={8} />}
                                                            {tx.paymentMode}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-2 text-right font-bold ${tx.transactionType === 'CREDIT' ? 'text-purple-600' : 'text-gray-900'}`}>
                                                        {tx.transactionType === 'CREDIT' ? '-' : ''}{Number(tx.amount).toLocaleString()}
                                                    </td>
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
    const [printModalData, setPrintModalData] = useState(null);
    const [printOptions, setPrintOptions] = useState({
        mode: 'all',
        showSummary: true,
        showDetails: true,
        includeCash: true,
        includeBank: true,
    });

    // --- Fee Head Groups Filtering ---
    const [feeGroups, setFeeGroups] = useState([]);
    const [selectedFeeGroupId, setSelectedFeeGroupId] = useState('');

    const buildPrintOptions = () => {
        const includeCash = printOptions.includeCash !== false;
        const includeBank = printOptions.includeBank !== false;
        let mode = 'all';
        if (includeCash && !includeBank) mode = 'Cash';
        else if (!includeCash && includeBank) mode = 'Online';
        else if (!includeCash && !includeBank) mode = 'none';

        const selectedGroup = feeGroups.find((g) => g._id === selectedFeeGroupId);
        return {
            ...printOptions,
            mode,
            includeCash,
            includeBank,
            selectedGroupName: selectedGroup?.name,
            allowedFeeHeads: selectedGroup
                ? selectedGroup.feeHeads.map((fh) => (fh.name || fh).toString().trim().toLowerCase())
                : null,
        };
    };

    const updatePaymentFilter = (key, checked) => {
        setPrintOptions((prev) => {
            const next = { ...prev, [key]: checked };
            const includeCash = key === 'includeCash' ? checked : next.includeCash !== false;
            const includeBank = key === 'includeBank' ? checked : next.includeBank !== false;
            if (includeCash && includeBank) next.mode = 'all';
            else if (includeCash) next.mode = 'Cash';
            else if (includeBank) next.mode = 'Online';
            else next.mode = 'none';
            return next;
        });
    };
    const [selectedCampusId, setSelectedCampusId] = useState(() => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        if (u.campuses?.length === 1) return String(u.campuses[0]);
        return 'all';
    });
    const { campuses } = useCampuses();

    const modalPrintRef = useRef(null);
    const handleModalPrint = async () => {
        if (!printModalData) return;
        try {
            const template = activeTab === 'college' ? 'college-report' : activeTab === 'account' ? 'account-report' : 'cashier-report';
            const options = buildPrintOptions();
            if (options.mode === 'none') {
                alert('Select at least Cash or Bank/Online to generate the report.');
                return;
            }

            const response = await api.post('/print', {
                template,
                data: {
                    displayData: printModalData.isAll ? printModalData.rows : printModalData.row,
                    cashierData: printModalData.isAll ? printModalData.rows : printModalData.row,
                    options,
                    dateRange: printModalData.dateRange,
                    hideGeneratedInfo: true
                }
            });
            printHtmlDocument(response.data);
        } catch (err) {
            console.error('Print failed:', err);
            alert('Failed to generate print document');
        }
    };

    const toggleRow = (idx) => {
        setExpandedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const [activePreset, setActivePreset] = useState('today'); // Default to 'today'

    // Date Presets
    const applyDatePreset = (preset) => {
        setActivePreset(preset);
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'today':
                // defaults are already today
                break;
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'week':
                start.setDate(today.getDate() - 7);
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            default:
                break;
        }
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const handleDateChange = (type, value) => {
        if (type === 'start') setStartDate(value);
        else setEndDate(value);
        setActivePreset('custom'); // clear preset if user manually changes date
    };

    const fetchReport = async () => {
        setLoading(true);
        setExpandedRows([]);
        try {
            let groupBy = activeTab;
            if (activeTab === 'daily') groupBy = 'day';
            else if (activeTab === 'cashier') groupBy = 'cashier';
            else if (activeTab === 'college') groupBy = 'college';
            else if (activeTab === 'account') groupBy = 'account';

            const res = await api.get(`/reports/transactions`, {
                params: {
                    startDate,
                    endDate,
                    groupBy: groupBy === 'daily' ? 'day' : groupBy,
                    ...(selectedCampusId !== 'all' ? { campusId: selectedCampusId } : {}),
                }
            });
            setData(res.data);

            const tot = res.data.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
            const cnt = res.data.reduce((acc, curr) => acc + (curr.count || curr.totalCount || 0), 0);

            // New Summaries based on Debit Amount (Real Collection)
            const debitSum = res.data.reduce((acc, curr) => acc + (curr.debitAmount || 0), 0);
            const creditSum = res.data.reduce((acc, curr) => acc + (curr.creditAmount || 0), 0);
            const cash = res.data.reduce((acc, curr) => acc + (curr.cashAmount || 0), 0);
            const bank = res.data.reduce((acc, curr) => acc + (curr.bankAmount || 0), 0);

            // Use Debit Sum as the main "Total Collected" metric
            setSummary({ totalConfirm: debitSum, count: cnt, totalCash: cash, totalBank: bank, totalCredit: creditSum });

        } catch (error) {
            console.error(error);
            if (error.response?.status === 403) {
                alert('You do not have permission to view this report. Ensure Reports access is enabled in User Management.');
            }
        } finally {
            setLoading(false);
        }
    };

    // exportToCSV was removed

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const role = user.role;
    const permissions = user.permissions || [];
    const isScopedUser = role !== 'superadmin' && role !== 'admin' && (user.campuses?.length > 0 || user.colleges?.length > 0);

    const allTabs = [
        { id: 'daily', label: 'Daily Collection', permission: 'reports_daily_collection' },
        { id: 'cashier', label: 'Cashiers', permission: 'reports_cashier_summary' },
        { id: 'college', label: 'College-wise', permission: 'reports_fee_head_summary' },
        { id: 'account', label: 'Account-wise', permission: 'reports_account_wise' },
    ];

    const reportSubPermissions = ['reports_daily_collection', 'reports_cashier_summary', 'reports_fee_head_summary', 'reports_account_wise'];
    const hasGranularReportPerms = reportSubPermissions.some((p) => permissions.includes(p));

    const tabs = role === 'superadmin' || role === 'admin'
        ? allTabs
        : allTabs.filter((tab) =>
            permissions.includes(tab.permission) ||
            (permissions.includes('/reports') && !hasGranularReportPerms)
        );

    // Fetch fee groups on mount
    useEffect(() => {
        const fetchFeeGroups = async () => {
            try {
                const res = await api.get('/fee-groups');
                setFeeGroups(res.data);
            } catch (err) {
                console.error("Error fetching fee groups in reports page", err);
            }
        };
        fetchFeeGroups();
    }, []);

    useEffect(() => {
        // Automatically switch to the first available tab if the active one isn't permitted
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    useEffect(() => {
        // Only fetch if tab is valid
        if (tabs.length > 0 && tabs.find(t => t.id === activeTab)) {
            fetchReport();
        }
    }, [activeTab, startDate, endDate, selectedCampusId]);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <header className="mb-6">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-6">
                            <div>
                                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <TrendingUp className="text-blue-600" size={20} /> Reports & Analytics
                                </h1>
                                <p className="text-xs text-gray-500 mt-1">Monitor financial performance and generate detailed statements.</p>
                            </div>

                            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm self-start xl:self-auto">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setActiveTab(tab.id); setData([]); }}
                                        className={`
                                            px-4 py-2 rounded-md text-xs font-bold transition-all duration-300 capitalize whitespace-nowrap
                                            ${activeTab === tab.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                                        `}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    {/* Print Options Modal */}
                    {printModalData && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                            <Printer size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900">
                                                {printModalData.isAll 
                                                    ? (activeTab === 'cashier' ? 'Print All Cashier Reports' : activeTab === 'college' ? 'Print All College Reports' : 'Print All Account Reports') 
                                                    : (activeTab === 'cashier' ? 'Print Cashier Report' : activeTab === 'college' ? 'Print College Report' : 'Print Account Report')}
                                            </h3>
                                            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                                                {printModalData.isAll 
                                                    ? (activeTab === 'cashier' ? 'Combined Cashier Summaries' : activeTab === 'college' ? 'Combined College Summaries' : 'Combined Account Summaries') 
                                                    : (activeTab === 'cashier' ? `Cashier: ${printModalData.row?._id || 'N/A'}` : activeTab === 'college' ? `College: ${printModalData.row?._id || 'N/A'}` : `Account: ${printModalData.row?.account_name || 'N/A'}`)}
                                            </p>
                                            {selectedFeeGroupId && (
                                                <span className="inline-flex mt-1.5 bg-blue-50 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                                                    Group: {feeGroups.find(g => g._id === selectedFeeGroupId)?.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">

                                         {/* Printing Options Checkboxes */}
                                         <div className="space-y-3">
                                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Print Sections</label>
                                             
                                             {/* Summary Option */}
                                             <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                 <input
                                                     type="checkbox"
                                                     id="printSummaryOpt"
                                                     checked={printOptions.showSummary}
                                                     onChange={e => setPrintOptions(prev => ({ ...prev, showSummary: e.target.checked }))}
                                                     className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                 />
                                                 <label htmlFor="printSummaryOpt" className="cursor-pointer flex-1">
                                                     <p className="text-xs font-bold text-gray-800">Summary Abstract</p>
                                                     <p className="text-[9px] text-gray-500 font-medium">Include overall summary, global fee heads, and college breakdowns</p>
                                                 </label>
                                             </div>

                                             {/* Detailed View Option */}
                                             <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                 <input
                                                     type="checkbox"
                                                     id="printDetailsOpt"
                                                     checked={printOptions.showDetails}
                                                     onChange={e => setPrintOptions(prev => ({ ...prev, showDetails: e.target.checked }))}
                                                     className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                 />
                                                 <label htmlFor="printDetailsOpt" className="cursor-pointer flex-1">
                                                     <p className="text-xs font-bold text-gray-800">Detailed View</p>
                                                     <p className="text-[9px] text-gray-500 font-medium">Include row-by-row list of individual transactions</p>
                                                 </label>
                                             </div>

                                             {/* Fee Head Group Option — college & cashier */}
                                             {feeGroups.length > 0 && (
                                                 <div className="space-y-2 pt-2 border-t border-gray-100">
                                                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Filter by Fee Group</label>
                                                     <select
                                                         value={selectedFeeGroupId}
                                                         onChange={e => setSelectedFeeGroupId(e.target.value)}
                                                         className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                                                     >
                                                         <option value="">All Fee Groups</option>
                                                         {feeGroups.map(g => (
                                                             <option key={g._id} value={g._id}>{g.name}</option>
                                                         ))}
                                                     </select>
                                                 </div>
                                             )}

                                             {/* Payment mode filters */}
                                             <div className="space-y-2 pt-2 border-t border-gray-100">
                                                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Payment Mode</label>
                                                 <div className="grid grid-cols-2 gap-3">
                                                     <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                         <input
                                                             type="checkbox"
                                                             id="printCashOpt"
                                                             checked={printOptions.includeCash !== false}
                                                             onChange={e => updatePaymentFilter('includeCash', e.target.checked)}
                                                             className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                         />
                                                         <label htmlFor="printCashOpt" className="cursor-pointer flex-1">
                                                             <p className="text-xs font-bold text-gray-800">Cash</p>
                                                         </label>
                                                     </div>
                                                     <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                         <input
                                                             type="checkbox"
                                                             id="printBankOpt"
                                                             checked={printOptions.includeBank !== false}
                                                             onChange={e => updatePaymentFilter('includeBank', e.target.checked)}
                                                             className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                         />
                                                         <label htmlFor="printBankOpt" className="cursor-pointer flex-1">
                                                             <p className="text-xs font-bold text-gray-800">Bank / Online</p>
                                                         </label>
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                                     <button
                                         onClick={() => setPrintModalData(null)}
                                         className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-white border border-gray-200 transition-all active:scale-95"
                                     >
                                         Cancel
                                     </button>
                                     <button
                                         onClick={handleModalPrint}
                                         disabled={(!printOptions.showSummary && !printOptions.showDetails) || (!printOptions.includeCash && !printOptions.includeBank)}
                                         className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${((!printOptions.showSummary && !printOptions.showDetails) || (!printOptions.includeCash && !printOptions.includeBank)) ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-gray-900 hover:bg-black shadow-gray-200'}`}
                                     >
                                         <Printer size={16} /> Generate Print
                                     </button>
                                 </div>
                            </div>
                        </div>
                    )}

                    {/* Hidden template for the modal print */}
                    <div className="hidden">
                        {printModalData && (
                            activeTab === 'college' ? (
                                <CollegeReportTemplate
                                    ref={modalPrintRef}
                                    data={printModalData.isAll ? printModalData.rows : printModalData.row}
                                    options={buildPrintOptions()}
                                    dateRange={printModalData.dateRange}
                                />
                            ) : activeTab === 'account' ? (
                                <AccountReportTemplate
                                    ref={modalPrintRef}
                                    data={printModalData.isAll ? printModalData.rows : printModalData.row}
                                    options={buildPrintOptions()}
                                    dateRange={printModalData.dateRange}
                                />
                            ) : (
                                <CashierReportTemplate
                                    ref={modalPrintRef}
                                    data={printModalData.isAll ? printModalData.rows : printModalData.row}
                                    options={buildPrintOptions()}
                                    dateRange={printModalData.dateRange}
                                />
                            )
                        )}
                    </div>

                    {tabs.length === 0 ? (
                        <div className="max-w-[1700px] mx-auto">
                            <div className="bg-white rounded-xl border border-amber-200 p-8 text-center">
                                <p className="text-base font-bold text-gray-900">No report access configured</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    Your account can open this page but does not have report permissions. Ask an administrator to enable
                                    <span className="font-semibold"> Reports &amp; Analytics</span> in User Management.
                                </p>
                            </div>
                        </div>
                    ) : (
                    <div className="max-w-[1700px] mx-auto space-y-6">

                        {/* 1. Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Net Collection"
                                value={`${Number(summary.totalConfirm).toLocaleString()}`}
                                color="blue"
                                icon={TrendingUp}
                            />
                            <StatCard
                                title="Cash Received"
                                value={`${Number(summary.totalCash || 0).toLocaleString()}`}
                                color="green"
                                icon={Wallet}
                            />
                            <StatCard
                                title="Bank Transfers"
                                value={`${Number(summary.totalBank || 0).toLocaleString()}`}
                                color="indigo"
                                icon={Landmark}
                            />
                            {/* Added Concession Stat */}
                            <StatCard
                                title="Concessions"
                                value={`${Number(summary.totalCredit || 0).toLocaleString()}`}
                                color="purple"
                                icon={CreditCard}
                            />
                        </div>

                        {/* 2. Main Data Section */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

                            {/* Toolbar (Filters) */}
                            <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center bg-gray-50 p-1.5 rounded-lg border border-gray-200 gap-1">
                                        {[
                                            { id: 'today', label: 'Today' },
                                            { id: 'yesterday', label: 'Yesterday' },
                                            { id: 'week', label: 'Last 7 Days' },
                                            { id: 'month', label: 'This Month' }
                                        ].map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => applyDatePreset(preset.id)}
                                                className={`
                                                    px-3 py-1.5 text-[11px] font-bold rounded-md transition-all duration-200
                                                    ${activePreset === preset.id
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm'}
                                                `}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase">Campus</span>
                                        <select
                                            value={selectedCampusId}
                                            onChange={(e) => setSelectedCampusId(e.target.value)}
                                            className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer"
                                        >
                                            {!isScopedUser ? (
                                                <option value="all">All Campuses</option>
                                            ) : (
                                                <option value="all">All My Campuses</option>
                                            )}
                                            {campuses.map((campus) => (
                                                <option key={campus.id} value={campus.id}>{campus.name} ({campus.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <Calendar size={12} className="text-gray-400" />
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer w-32"
                                            value={startDate}
                                            onChange={e => handleDateChange('start', e.target.value)}
                                        />
                                        <span className="text-gray-300 mx-1">to</span>
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer w-32"
                                            value={endDate}
                                            onChange={e => handleDateChange('end', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {(activeTab === 'cashier' || activeTab === 'college' || activeTab === 'account') && data.length > 0 && (
                                        <button
                                            onClick={() => setPrintModalData({ isAll: true, rows: data, dateRange: { start: startDate, end: endDate } })}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                                        >
                                            <Printer size={12} /> {activeTab === 'cashier' ? 'Print All Cashiers' : activeTab === 'college' ? 'Print All Colleges' : 'Print All Accounts'}
                                        </button>
                                    )}
                                    <button
                                        onClick={fetchReport}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold bg-gray-800 text-white hover:bg-gray-900 transition shadow-sm"
                                    >
                                        <Filter size={12} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto min-h-[400px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                                            <th className="py-4 px-6 w-1/4">
                                                {tabs.find(t => t.id === activeTab)?.label || 'Identifier'}
                                            </th>
                                            <th className="py-4 px-6 text-right">Transactions</th>

                                            {/* Columns for ALL tabs now, but specifically requested for Daily */}
                                            <th className="py-4 px-6 text-right text-emerald-600">Cash</th>
                                            <th className="py-4 px-6 text-right text-indigo-600 text-nowrap">Bank (Online)</th>
                                            <th className="py-4 px-6 text-right text-purple-600">Concession</th>
                                            <th className="py-4 px-6 text-right text-black font-extrabold">Net Total</th>

                                            {(activeTab === 'cashier' || activeTab === 'daily' || activeTab === 'college') && <th className="py-4 px-6 text-right">Actions</th>}
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
                                                            <p className="text-gray-900 font-bold text-base">No reports found.</p>
                                                            <p className="text-gray-500 text-xs">Try adjusting your date filters.</p>
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
                                                    role={role}
                                                    setPrintModalData={setPrintModalData}
                                                />
                                            ))
                                        )}
                                    </tbody>

                                    {/* Footer Summary */}
                                    {!loading && data.length > 0 && (
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td className="py-4 px-6 font-bold text-gray-800 text-[11px] text-left uppercase tracking-wide">GRAND TOTAL</td>
                                                <td className="py-4 px-6 text-right font-bold text-xs text-gray-800">{summary.count}</td>

                                                <td className="py-4 px-6 text-right font-bold text-xs text-emerald-600">
                                                    {Number(summary.totalCash || 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-xs text-indigo-600">
                                                    {Number(summary.totalBank || 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-xs text-purple-700">
                                                    {Number(summary.totalCredit || 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6 text-right font-extrabold text-base text-blue-900">
                                                    {Number(summary.totalConfirm).toLocaleString()}
                                                </td>

                                                {(activeTab === 'cashier' || activeTab === 'daily' || activeTab === 'college' || activeTab === 'account') && <td></td>}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Reports;
