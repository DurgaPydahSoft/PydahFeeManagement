import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileUp, Save, CheckSquare, Square, Filter, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Download } from 'lucide-react';
import Sidebar from './Sidebar';

const BulkFeeUpload = () => {
    // Shared State
    const [metadata, setMetadata] = useState({});
    const [batches, setBatches] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        college: '',
        course: '',
        branch: '',
        batch: ''
    });

    // Upload & Data State
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]); // { id, name, pin, totalDemand, totalPaid, demands: [], payments: [] }
    const [selectedIds, setSelectedIds] = useState([]); // IDs of selected rows
    const [expandedRows, setExpandedRows] = useState({}); // { index: true/false }
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    // Metadata Fetching
    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            setMetadata(response.data.hierarchy || response.data);
            if (response.data.batches) setBatches(response.data.batches);
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    // Filter Logic
    const colleges = Object.keys(metadata);
    const courses = filters.college ? Object.keys(metadata[filters.college] || {}) : [];
    const branches = (filters.college && filters.course)
        ? metadata[filters.college][filters.course]?.branches || []
        : [];

    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [key]: value };
            if (key === 'college') { newFilters.course = ''; newFilters.branch = ''; }
            if (key === 'course') { newFilters.branch = ''; }
            return newFilters;
        });
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setPreviewData([]);
        setSelectedIds([]);
        setExpandedRows({});
        setMessage('');
        setError('');
    };

    const handleDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/bulk-fee/template`, {
                responseType: 'blob', // Important
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'BulkFeeUploadTemplate.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Error downloading template', error);
            setError('Failed to download template.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const handleUpload = async () => {
        if (!file) { setError('Please select a file first.'); return; }
        // Note: We no longer enforce filters strictly here because "Transaction Dump" mode 
        // (detected by backend) doesn't require them.

        setUploading(true);
        setError('');
        setMessage('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('college', filters.college || '');
        formData.append('course', filters.course || '');
        formData.append('branch', filters.branch || '');
        formData.append('batch', filters.batch || '');

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/bulk-fee/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const data = response.data.data;
            if (data.length === 0) {
                setError('No valid student data found in file.');
                setPreviewData([]);
                setSelectedIds([]);
            } else {
                setPreviewData(data);
                setSelectedIds(data.map((_, i) => i));
                setMessage(response.data.message || `Successfully parsed ${data.length} records.`);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Error uploading file');
        } finally {
            setUploading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.length === previewData.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(previewData.map((_, i) => i));
        }
    };

    const handleSelectRow = (index) => {
        if (selectedIds.includes(index)) {
            setSelectedIds(selectedIds.filter(id => id !== index));
        } else {
            setSelectedIds([...selectedIds, index]);
        }
    };

    const toggleRow = (index) => {
        setExpandedRows(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const handleSave = async () => {
        if (selectedIds.length === 0) { setError('Please select at least one student to upload.'); return; }

        setSaving(true);
        setError('');

        const studentsToSave = selectedIds.map(index => previewData[index]);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/bulk-fee/save`, {
                students: studentsToSave
            });
            setMessage(response.data.message);
            setFile(null);
            setPreviewData([]);
            setSelectedIds([]);
            setExpandedRows({});
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Error saving data');
        } finally {
            setSaving(false);
        }
    };

    // Helper to merge demands and payments for unified view (Individual Transactions)
    const getUnifiedDetails = (row) => {
        const demandsMap = new Map();
        // 1. Index Demands
        if (row.demands) {
            row.demands.forEach(d => {
                const key = `${d.headId}-${d.year}`;
                if (!demandsMap.has(key)) {
                    demandsMap.set(key, { ...d, matches: false });
                } else {
                    const existing = demandsMap.get(key);
                    existing.amount += d.amount;
                    demandsMap.set(key, existing);
                }
            });
        }

        const result = [];

        // 2. Process Payments (Individual Rows)
        if (row.payments) {
            row.payments.forEach(p => {
                const key = `${p.headId}-${p.year}`;
                let demandVal = 0;

                // Match with Demand
                if (demandsMap.has(key)) {
                    const d = demandsMap.get(key);
                    if (!d.matches) {
                        demandVal = d.amount;
                        d.matches = true; // Mark as displayed
                    }
                }

                result.push({
                    headId: p.headId,
                    headName: p.headName,
                    year: p.year,
                    mode: p.mode,
                    date: p.date,
                    demand: demandVal,
                    paid: p.amount,
                    remarks: p.remarks
                });
            });
        }

        // 3. Add Leftover Demands (Unpaid)
        demandsMap.forEach((d, key) => {
            if (!d.matches) {
                result.push({
                    headId: d.headId,
                    headName: d.headName,
                    year: d.year,
                    mode: '-',
                    date: null,
                    demand: d.amount,
                    paid: 0,
                    remarks: ''
                });
            }
        });

        return result;
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <header className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Upload className="text-blue-600" /> Bulk Fee Upload
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Upload Fees & Payments via Excel. Rows expand to show detailed fee breakdown.</p>
                    </div>
                </header>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded mb-4 border border-red-200">{error}</div>}
                {message && <div className="p-3 bg-green-50 text-green-700 rounded mb-4 border border-green-200">{message}</div>}

                {/* 1. Configuration */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Filter size={18} /> Configuration
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">College</label>
                            <select className="w-full border p-2 rounded text-sm" value={filters.college} onChange={e => handleFilterChange('college', e.target.value)}>
                                <option value="">Select College</option>
                                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Course</label>
                            <select className="w-full border p-2 rounded text-sm" value={filters.course} onChange={e => handleFilterChange('course', e.target.value)} disabled={!filters.college}>
                                <option value="">Select Course</option>
                                {courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Branch</label>
                            <select className="w-full border p-2 rounded text-sm" value={filters.branch} onChange={e => handleFilterChange('branch', e.target.value)} disabled={!filters.course}>
                                <option value="">Select Branch</option>
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Batch</label>
                            <select className="w-full border p-2 rounded text-sm" value={filters.batch} onChange={e => handleFilterChange('batch', e.target.value)}>
                                <option value="">Select Batch</option>
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-end gap-4 border-t pt-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">Upload Excel File (.xlsx)</label>
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-gray-700 border bg-white hover:bg-gray-50 transition mr-2`}
                        >
                            {downloadingTemplate ? 'Generating...' : <><Download size={18} /> Download Template</>}
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !file}
                            className={`flex items-center gap-2 px-6 py-2 rounded font-bold text-white shadow-md transition ${uploading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {uploading ? 'Processing...' : <><FileUp size={18} /> Parse & Preview</>}
                        </button>
                    </div>
                </div>

                {/* 2. Preview Table */}
                {previewData.length > 0 && (
                    <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Preview Data ({previewData.length} records)</h3>
                            <button
                                onClick={handleSave}
                                disabled={saving || selectedIds.length === 0}
                                className={`flex items-center gap-2 px-6 py-2 rounded font-bold text-white shadow-md transition ${saving || selectedIds.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {saving ? 'Saving...' : <><Save size={18} /> Confirm Upload ({selectedIds.length})</>}
                            </button>
                        </div>

                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-10 text-center">
                                            <button onClick={handleSelectAll} className="text-gray-600 hover:text-blue-600">
                                                {selectedIds.length === previewData.length ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </th>
                                        <th className="p-3 font-semibold text-gray-600">Student Name</th>
                                        <th className="p-3 font-semibold text-gray-600">Pin / Admission</th>
                                        <th className="p-3 font-semibold text-gray-600 text-right">Total Paid</th>
                                        <th className="p-3 font-semibold text-gray-600 w-24 text-center">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {previewData.map((row, index) => (
                                        <React.Fragment key={index}>
                                            <tr
                                                className={`hover:bg-blue-50 transition cursor-pointer ${selectedIds.includes(index) ? 'bg-blue-50/50' : 'bg-white'}`}
                                                onClick={() => toggleRow(index)}
                                            >
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => handleSelectRow(index)} className={`${selectedIds.includes(index) ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {selectedIds.includes(index) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="p-3 font-medium text-gray-800">{row.studentName}</td>
                                                <td className="p-3 font-mono text-gray-600">{row.pinNumber || row.admissionNumber}</td>
                                                <td className="p-3 text-right font-bold text-green-700">₹{(row.totalPaid || 0).toLocaleString()}</td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        className="text-gray-400 hover:text-blue-600 transition p-1 rounded-full hover:bg-blue-100"
                                                    >
                                                        {expandedRows[index] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRows[index] && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan="5" className="p-4 border-b inner-shadow">
                                                        <div className="bg-white border rounded-md shadow-sm overflow-hidden max-w-4xl mx-auto">
                                                            <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                                                                <span className="font-bold text-xs text-gray-600 uppercase">Fee Details & Transactions</span>
                                                                <span className="text-xs text-gray-500">
                                                                    Demand: <span className="font-bold text-gray-700">₹{row.totalDemand.toLocaleString()}</span> |
                                                                    Paid: <span className="font-bold text-green-700">₹{row.totalPaid.toLocaleString()}</span>
                                                                </span>
                                                            </div>
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                                                                    <tr>
                                                                        <th className="px-4 py-2">Fee Head</th>
                                                                        <th className="px-4 py-2">Year</th>
                                                                        <th className="px-4 py-2">Date</th>
                                                                        <th className="px-4 py-2 text-right">Demand (Fee)</th>
                                                                        <th className="px-4 py-2 text-right">Paid Amount</th>
                                                                        <th className="px-4 py-2 text-center">Mode</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {getUnifiedDetails(row).map((d, i) => (
                                                                        <tr key={i} className="hover:bg-gray-50">
                                                                            <td className="px-4 py-2 font-medium text-gray-800">{d.headName}</td>
                                                                            <td className="px-4 py-2 text-gray-600">Year {d.year}</td>
                                                                            <td className="px-4 py-2 text-gray-600 text-xs">
                                                                                {d.date ? new Date(d.date).toLocaleDateString('en-GB') : '-'}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-right font-mono text-gray-700">{d.demand > 0 ? `₹${d.demand.toLocaleString()}` : '-'}</td>
                                                                            <td className="px-4 py-2 text-right font-mono text-green-700">{d.paid > 0 ? `₹${d.paid.toLocaleString()}` : '-'}</td>
                                                                            <td className="px-4 py-2 text-center text-xs text-gray-500">{d.mode}</td>
                                                                        </tr>
                                                                    ))}
                                                                    {getUnifiedDetails(row).length === 0 && (
                                                                        <tr><td colSpan="5" className="p-3 text-center text-gray-400 text-xs">No fee details found for this student.</td></tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkFeeUpload;
