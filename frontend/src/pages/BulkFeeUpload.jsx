import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileUp, Save, CheckSquare, Square, Download, CreditCard, Banknote } from 'lucide-react';
import Sidebar from './Sidebar';

const BulkFeeUpload = () => {
    // Shared State
    const [uploadType, setUploadType] = useState('PAYMENT'); // 'PAYMENT' or 'DUE'

    // Upload & Data State
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [expandedRows, setExpandedRows] = useState({});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [isPendingMode, setIsPendingMode] = useState(false);

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
                params: { type: uploadType },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = uploadType === 'DUE' ? 'BulkDuesTemplate.xlsx' : 'BulkPaymentTemplate.xlsx';
            link.setAttribute('download', filename);
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

        setUploading(true);
        setError('');
        setMessage('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadType', uploadType);
        formData.append('isPendingMode', isPendingMode);

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

    // Helper to merge demands and payments
    const getUnifiedDetails = (row) => {
        // Different display logic for PAYMENT vs DUE modes? 
        // For debugging/preview, showing everything is fine.
        const demandsMap = new Map();
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
        if (row.payments) {
            row.payments.forEach(p => {
                const key = `${p.headId}-${p.year}`;
                let demandVal = 0;
                if (demandsMap.has(key)) {
                    const d = demandsMap.get(key);
                    if (!d.matches) {
                        demandVal = d.amount;
                        d.matches = true;
                    }
                }

                result.push({
                    headName: p.headName,
                    year: p.year,
                    semester: p.semester, // Display sem from payment
                    mode: p.mode,
                    date: p.date,
                    demand: demandVal,
                    paid: p.amount,
                    remarks: p.remarks,
                    meta: p.meta
                });
            });
        }

        demandsMap.forEach((d) => {
            if (!d.matches) {
                result.push({
                    headName: d.headName,
                    year: d.year,
                    semester: d.semester, // Display sem from demand
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
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Upload className="text-blue-600" /> Bulk Fee Upload
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Upload Fees via Excel. Switch tabs to choose mode.</p>
                </header>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded mb-4 border border-red-200">{error}</div>}
                {message && <div className="p-3 bg-green-50 text-green-700 rounded mb-4 border border-green-200">{message}</div>}

                {/* Tabs */}
                <div className="flex gap-4 mb-4 border-b">
                    <button
                        onClick={() => { setUploadType('PAYMENT'); setPreviewData([]); setFile(null); }}
                        className={`pb-2 px-4 font-semibold transition flex items-center gap-2 ${uploadType === 'PAYMENT' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <CreditCard size={18} /> Payments
                    </button>
                    <button
                        onClick={() => { setUploadType('DUE'); setPreviewData([]); setFile(null); }}
                        className={`pb-2 px-4 font-semibold transition flex items-center gap-2 ${uploadType === 'DUE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Banknote size={18} /> Dues (Demand)
                    </button>

                    {uploadType === 'DUE' && (
                        <div className="ml-auto flex items-center gap-2 pr-4">
                            <input
                                type="checkbox"
                                id="pendingMode"
                                checked={isPendingMode}
                                onChange={e => setIsPendingMode(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor="pendingMode" className="text-sm font-bold text-gray-700 cursor-pointer select-none" title="If checked, uploaded values are treated as 'Existing Due'. System will calculate 'Paid = Total - Due' and create a Transaction.">
                                Upload as Pending Dues (Auto-Calc Payment)
                            </label>
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="flex items-end gap-6">
                        <div className="flex-1">
                            <label className="text-sm font-bold text-gray-700 block mb-2">
                                Upload Excel File for {uploadType === 'PAYMENT' ? 'Payments' : 'Dues'}
                            </label>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                key={uploadType} // Force reset on tab switch
                            />
                        </div>
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className="flex items-center gap-2 px-4 py-2 rounded font-bold text-gray-700 border bg-white hover:bg-gray-50 transition"
                        >
                            <Download size={18} /> Template
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

                {/* Preview Table */}
                {previewData.length > 0 && (
                    <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Preview ({uploadType} Mode) - {previewData.length} records</h3>
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
                                        <th className="p-3 font-semibold text-gray-600 text-right">
                                            {uploadType === 'PAYMENT' ? 'Total Paid' : (isPendingMode ? 'Total Pending Uploaded' : 'Total Demand')}
                                        </th>
                                        <th className="p-3 font-semibold text-gray-600 text-center">Batch Match</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {previewData.map((row, index) => (
                                        <React.Fragment key={index}>
                                            <tr className={`hover:bg-blue-50 transition cursor-pointer ${selectedIds.includes(index) ? 'bg-blue-50/50' : 'bg-white'}`} onClick={() => toggleRow(index)}>
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => handleSelectRow(index)} className={`${selectedIds.includes(index) ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {selectedIds.includes(index) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="p-3 font-medium text-gray-800">{row.studentName}</td>
                                                <td className="p-3 font-mono text-gray-600">{row.pinNumber || row.admissionNumber || row.displayId}</td>
                                                <td className={`p-3 text-right font-bold ${uploadType === 'PAYMENT' ? 'text-green-700' : 'text-orange-700'}`}>
                                                    ₹{(uploadType === 'PAYMENT' ? row.totalPaid : row.totalDemand).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {row.admissionNumber ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Found</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Not Found</span>}
                                                </td>
                                            </tr>
                                            {expandedRows[index] && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan="5" className="p-4 border-b inner-shadow">
                                                        <div className="bg-white border rounded-md shadow-sm overflow-hidden max-w-4xl mx-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-gray-100 text-xs text-gray-500 uppercase border-b">
                                                                    <tr>
                                                                        <th className="px-4 py-2">Head</th>
                                                                        <th className="px-4 py-2">Year</th>
                                                                        <th className="px-4 py-2">Sem</th>
                                                                        {uploadType === 'DUE' && isPendingMode ? (
                                                                            <>
                                                                                <th className="px-4 py-2 text-right">Total Fee</th>
                                                                                <th className="px-4 py-2 text-right">Uploaded Due</th>
                                                                                <th className="px-4 py-2 text-right">Calc. Paid</th>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <th className="px-4 py-2">Date</th>
                                                                                <th className="px-4 py-2 text-right">Demand</th>
                                                                                <th className="px-4 py-2 text-right">Paid</th>
                                                                            </>
                                                                        )}
                                                                        <th className="px-4 py-2">Remarks</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {getUnifiedDetails(row).map((d, i) => (
                                                                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                                            <td className="px-4 py-2 font-medium">{d.headName}</td>
                                                                            <td className="px-4 py-2">{d.year}</td>
                                                                            <td className="px-4 py-2">{d.semester || '-'}</td>

                                                                            {/* Pending Mode Columns */}
                                                                            {uploadType === 'DUE' && isPendingMode ? (
                                                                                <>
                                                                                    <td className="px-4 py-2 text-right font-mono text-gray-500">₹{d.meta?.totalDemand || '-'}</td>
                                                                                    <td className="px-4 py-2 text-right font-mono text-orange-600">₹{d.meta?.pendingAmount || '-'}</td>
                                                                                    <td className="px-4 py-2 text-right font-mono text-green-700 font-bold">₹{d.paid}</td>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <td className="px-4 py-2 text-xs">{d.date ? new Date(d.date).toLocaleDateString() : '-'}</td>
                                                                                    <td className="px-4 py-2 text-right font-mono">{d.demand > 0 ? d.demand : '-'}</td>
                                                                                    <td className="px-4 py-2 text-right font-mono text-green-700">{d.paid > 0 ? d.paid : '-'}</td>
                                                                                </>
                                                                            )}

                                                                            <td className="px-4 py-2 text-xs text-gray-500">{d.remarks}</td>
                                                                        </tr>
                                                                    ))}
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
