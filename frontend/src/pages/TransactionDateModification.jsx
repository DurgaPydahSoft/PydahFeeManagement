import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../lib/api';
import { getStoredUser } from '../lib/auth';
import Sidebar from './Sidebar';

const TransactionDateModification = () => {
    const user = getStoredUser() || {};
    const role = user.role;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    const canAccess = role === 'superadmin' || role === 'admin' ||
        permissions.includes('fee_collection_edit') ||
        permissions.includes('fee_collection_delete');

    const getTodayFormatted = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [sourceDate, setSourceDate] = useState(getTodayFormatted());
    const [selectedCollector, setSelectedCollector] = useState('ALL');
    const [destinationDate, setDestinationDate] = useState(getTodayFormatted());

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [transactions, setTransactions] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [courseSummary, setCourseSummary] = useState({});
    const [modeSummary, setModeSummary] = useState({});
    const [totalAmount, setTotalAmount] = useState(0);

    const [selectedIds, setSelectedIds] = useState([]);
    const [rowTargetDates, setRowTargetDates] = useState({});

    const fetchTransactions = async () => {
        if (!sourceDate) {
            Swal.fire('Error', 'Please select a Source Date', 'warning');
            return;
        }
        setLoading(true);
        try {
            const res = await api.get('/transactions/by-date', {
                params: {
                    date: sourceDate,
                    collector: selectedCollector
                }
            });
            const data = res.data || {};
            const txList = data.transactions || [];

            setTransactions(txList);
            setCollectors(data.collectors || []);
            setCourseSummary(data.courseSummary || {});
            setModeSummary(data.modeSummary || {});
            setTotalAmount(data.totalAmount || 0);

            const initialTargetDates = {};
            txList.forEach(t => {
                initialTargetDates[t._id] = destinationDate;
            });
            setRowTargetDates(initialTargetDates);
            setSelectedIds([]);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            Swal.fire('Error', err.response?.data?.message || 'Failed to fetch transactions', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canAccess) {
            fetchTransactions();
        }
    }, [sourceDate]);

    useEffect(() => {
        if (canAccess && sourceDate) {
            fetchTransactions();
        }
    }, [selectedCollector]);

    // Select single row
    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Select / Deselect All
    const toggleSelectAll = () => {
        if (selectedIds.length === transactions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(transactions.map(t => t._id));
        }
    };

    // Change date for single row
    const handleRowDateChange = (id, newDateVal) => {
        setRowTargetDates(prev => ({
            ...prev,
            [id]: newDateVal
        }));
    };

    // Apply destination date to selected rows
    const handleApplyDestinationToSelected = () => {
        if (!destinationDate) {
            Swal.fire('Select Date', 'Please pick a destination date first.', 'warning');
            return;
        }
        if (selectedIds.length === 0) {
            Swal.fire('Select Items', 'Please select at least one transaction from the table.', 'info');
            return;
        }

        setRowTargetDates(prev => {
            const next = { ...prev };
            selectedIds.forEach(id => {
                next[id] = destinationDate;
            });
            return next;
        });

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Set date (${destinationDate}) for ${selectedIds.length} selected transaction(s)`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    // Apply destination date to ALL loaded rows
    const handleApplyDestinationToAll = () => {
        if (!destinationDate) {
            Swal.fire('Select Date', 'Please pick a destination date first.', 'warning');
            return;
        }
        if (transactions.length === 0) {
            Swal.fire('No Data', 'No transactions available to update.', 'info');
            return;
        }

        const allIds = transactions.map(t => t._id);
        setSelectedIds(allIds);

        setRowTargetDates(prev => {
            const next = { ...prev };
            allIds.forEach(id => {
                next[id] = destinationDate;
            });
            return next;
        });

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Selected all ${transactions.length} items and set date to ${destinationDate}`,
            showConfirmButton: false,
            timer: 2000
        });
    };

    // Save Date Modifications
    const handleSaveChanges = async () => {
        if (selectedIds.length === 0) {
            Swal.fire('No Selection', 'Please select the transactions you want to change dates for.', 'warning');
            return;
        }

        const updates = selectedIds.map(id => ({
            id,
            newDate: rowTargetDates[id] || destinationDate
        }));

        const confirm = await Swal.fire({
            title: 'Save New Transaction Dates?',
            text: `You are about to change the date for ${updates.length} transaction(s). They will now appear under the new date in all reports.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#4b5563',
            confirmButtonText: 'Yes, Save Changes',
            cancelButtonText: 'Cancel'
        });

        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            const res = await api.put('/transactions/bulk-date-update', { updates });
            Swal.fire('Saved!', res.data?.message || 'Transaction dates updated successfully.', 'success');
            fetchTransactions();
        } catch (err) {
            console.error('Error saving transaction dates:', err);
            Swal.fire('Error', err.response?.data?.message || 'Failed to update transaction dates.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amt) => {
        return '₹' + Number(amt || 0).toLocaleString('en-IN');
    };

    const formatDateDDMMYYYY = (dateVal) => {
        if (!dateVal) return '-';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };


    if (!canAccess) {
        return (
            <div className="flex h-screen bg-gray-100">
                <Sidebar />
                <div className="flex-1 p-8 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-md shadow border border-red-300 text-center max-w-md">
                        <h2 className="text-lg font-bold text-red-700 mb-2">Access Denied</h2>
                        <p className="text-gray-600 text-sm">
                            You do not have permission to access the Transaction Date Modification page.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100 text-gray-800 font-sans">
            <Sidebar />
            <div className="flex-1 p-6 max-w-7xl mx-auto overflow-y-auto">
                {/* Page Header */}
                <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200 mb-5 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Transaction Date Changes</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Select a date to view transactions, filter by user/cashier, and change transaction dates.
                        </p>
                    </div>
                    <button
                        onClick={fetchTransactions}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Refreshing...' : 'Refresh Data'}
                    </button>
                </div>

                {/* Step 1: Filter & Selection Card */}
                <div className="bg-white p-5 rounded-md shadow-sm border border-gray-200 mb-5">
                    <h2 className="text-xs font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wide">
                        Step 1: Select Original Date & User
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Original Transaction Date (Source Date) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={sourceDate}
                                onChange={(e) => setSourceDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-800 focus:outline-none focus:border-blue-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                User / Cashier Filter
                            </label>
                            <select
                                value={selectedCollector}
                                onChange={(e) => setSelectedCollector(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-800 focus:outline-none focus:border-blue-600"
                            >
                                <option value="ALL">-- All Users / Cashiers --</option>
                                {collectors.map(c => (
                                    <option key={c.username} value={c.username}>
                                        {c.name} ({c.username})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <button
                                onClick={fetchTransactions}
                                disabled={loading}
                                className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-900 text-white font-semibold text-sm rounded transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Show Transactions'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 2: Transaction Summary Box */}
                <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200 mb-5">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                        Summary for Date: <span className="text-blue-700">{formatDateDDMMYYYY(sourceDate)}</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <span className="text-xs text-blue-700 font-semibold block">Total Amount</span>
                            <span className="text-lg font-bold text-blue-900">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                            <span className="text-xs text-gray-600 font-semibold block">Total Transactions</span>
                            <span className="text-lg font-bold text-gray-800">{transactions.length}</span>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <span className="text-xs text-green-700 font-semibold block">Cash Collections</span>
                            <span className="text-lg font-bold text-green-900">{formatCurrency(modeSummary['Cash']?.totalAmount || 0)}</span>
                        </div>
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                            <span className="text-xs text-purple-700 font-semibold block">Bank / Online</span>
                            <span className="text-lg font-bold text-purple-900">
                                {formatCurrency(
                                    Object.entries(modeSummary)
                                        .filter(([m]) => m !== 'Cash')
                                        .reduce((acc, [, val]) => acc + (val.totalAmount || 0), 0)
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Course-wise summary list */}
                    {Object.keys(courseSummary).length > 0 && (
                        <div className="border-t border-gray-200 pt-3 mt-2">
                            <span className="text-xs font-bold text-gray-700 block mb-2">Course-wise Totals:</span>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(courseSummary).map(([cName, val]) => (
                                    <div key={cName} className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-xs">
                                        <span className="font-semibold text-gray-700">{cName}:</span>{' '}
                                        <span className="font-bold text-gray-900">{formatCurrency(val.totalAmount)}</span>{' '}
                                        <span className="text-gray-500">({val.count} txns)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 3: Destination Date & Apply Action Box */}
                <div className="bg-white p-5 rounded-md shadow-sm border border-gray-200 mb-5">
                    <h2 className="text-xs font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wide">
                        Step 2: Change Date & Save
                    </h2>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    New Destination Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={destinationDate}
                                    onChange={(e) => setDestinationDate(e.target.value)}
                                    className="px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-800 font-medium focus:outline-none focus:border-blue-600"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleApplyDestinationToSelected}
                                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded border border-blue-300 transition-colors"
                                >
                                    Fill Date to Selected ({selectedIds.length})
                                </button>
                                <button
                                    onClick={handleApplyDestinationToAll}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded border border-gray-300 transition-colors"
                                >
                                    Fill Date to All ({transactions.length})
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2 md:pt-0">
                            <span className="text-xs font-semibold text-gray-500">
                                Ready: <strong className="text-blue-700">{selectedIds.length}</strong> items selected
                            </span>
                            <button
                                onClick={handleSaveChanges}
                                disabled={saving || selectedIds.length === 0}
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving Changes...' : 'Save Date Modifications'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="selectAllCheck"
                                checked={transactions.length > 0 && selectedIds.length === transactions.length}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="selectAllCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                                Select All Transactions
                            </label>
                        </div>
                        <span className="text-xs text-gray-500">
                            Total Records: {transactions.length}
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            Loading transactions for {sourceDate}...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No active transactions found on <strong>{sourceDate}</strong>.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b border-gray-200">
                                    <tr>
                                        <th className="py-2.5 px-3 w-10 text-center">Select</th>
                                        <th className="py-2.5 px-3">Receipt No</th>
                                        <th className="py-2.5 px-3">Student Name</th>
                                        <th className="py-2.5 px-3">Admission / PIN</th>
                                        <th className="py-2.5 px-3">Course</th>
                                        <th className="py-2.5 px-3">Fee Head</th>
                                        <th className="py-2.5 px-3">Mode</th>
                                        <th className="py-2.5 px-3 text-right">Amount</th>
                                        <th className="py-2.5 px-3">Collector</th>
                                        <th className="py-2.5 px-3">Current Date</th>
                                        <th className="py-2.5 px-3">Change Date To</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {transactions.map((tx, idx) => {
                                        const isSelected = selectedIds.includes(tx._id);
                                        const currentPaymentDate = tx.paymentDate ? new Date(tx.paymentDate).toISOString().split('T')[0] : sourceDate;
                                        const rowDestDate = rowTargetDates[tx._id] || destinationDate;

                                        return (
                                            <tr
                                                key={tx._id}
                                                className={isSelected ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                                            >
                                                <td className="py-2 px-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectOne(tx._id)}
                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2 px-3 font-mono font-bold text-gray-800">
                                                    {tx.receiptNumber || 'N/A'}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-gray-800">
                                                    {tx.studentName || 'Student'}
                                                </td>
                                                <td className="py-2 px-3 text-gray-600 font-mono">
                                                    {tx.studentId || tx.pinNo}
                                                </td>
                                                <td className="py-2 px-3 text-gray-700">
                                                    {tx.course || 'N/A'} (Yr {tx.studentYear || '-'})
                                                </td>
                                                <td className="py-2 px-3 text-gray-700">
                                                    {tx.feeHead?.name || 'General Fee'}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                        tx.paymentMode === 'Cash' ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'
                                                    }`}>
                                                        {tx.paymentMode || 'Cash'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-gray-900">
                                                    {formatCurrency(tx.amount)}
                                                </td>
                                                <td className="py-2 px-3 text-gray-700">
                                                    {tx.collectedByName || tx.collectedBy || 'Admin'}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-gray-700 font-semibold">
                                                    {formatDateDDMMYYYY(tx.paymentDate || sourceDate)}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="date"
                                                        value={rowDestDate}
                                                        onChange={(e) => handleRowDateChange(tx._id, e.target.value)}
                                                        disabled={!isSelected}
                                                        className={`px-2 py-1 text-xs border rounded font-mono ${
                                                            isSelected
                                                                ? 'border-blue-500 bg-white font-bold text-blue-900'
                                                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionDateModification;
