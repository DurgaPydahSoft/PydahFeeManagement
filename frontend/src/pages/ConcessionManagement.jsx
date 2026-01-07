import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';

const ConcessionManagement = () => {
    const [activeTab, setActiveTab] = useState('request'); // 'request' or 'approvals'
    const [user, setUser] = useState(null);

    // Request State
    const [searchQuery, setSearchQuery] = useState('');
    const [foundStudents, setFoundStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]); // List of students to apply concession to
    const [feeHeads, setFeeHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        feeHeadId: '',
        amount: '',
        reason: '',
        studentYear: '', // Default to 1
        semester: '',
        college: '',
        course: '',
        branch: '',
        batch: ''
    });

    // Approval State
    const [pendingRequests, setPendingRequests] = useState([]);
    const [approvalLoading, setApprovalLoading] = useState(false);

    const [filters, setFilters] = useState({
        status: 'PENDING',
        college: '',
        course: '',
        branch: '',
        batch: '',
        search: ''
    });

    // Modal State
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [modalAmount, setModalAmount] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    // Metadata for filters
    const [metadata, setMetadata] = useState({ hierarchy: {}, batches: [] });
    // Derived lists based on selection
    const [collegeList, setCollegeList] = useState([]);
    const [courseList, setCourseList] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [batchList, setBatchList] = useState([]);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
        fetchFeeHeads();
        fetchMetadata();
        if (activeTab === 'approvals') {
            fetchPendingRequests();
        }
    }, [activeTab]);

    const fetchMetadata = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            setMetadata(res.data);
            setCollegeList(Object.keys(res.data.hierarchy));
            setBatchList(res.data.batches);
        } catch (e) { console.error(e); }
    };

    // Update dependent dropdowns when filters change
    useEffect(() => {
        if (!filters.college) {
            setCourseList([]);
            setBranchList([]);
            return;
        }
        const courses = metadata.hierarchy[filters.college] ? Object.keys(metadata.hierarchy[filters.college]) : [];
        setCourseList(courses);

        if (!filters.course) {
            setBranchList([]);
            return;
        }
        const branches = metadata.hierarchy[filters.college][filters.course] ? metadata.hierarchy[filters.college][filters.course].branches : [];
        setBranchList(branches);

    }, [filters.college, filters.course, metadata]);

    // Auto-fill Year/Sem/Demographics when first student is selected
    useEffect(() => {
        if (selectedStudents.length > 0) {
            // Use the most recently selected student (or the first one)
            const latest = selectedStudents[selectedStudents.length - 1];
            setFormData(prev => ({
                ...prev,
                studentYear: latest.current_year || prev.studentYear,
                semester: latest.current_semester || prev.semester,
                college: latest.college || '',
                course: latest.course || '',
                branch: latest.branch || '',
                batch: latest.batch || ''
            }));
        }
    }, [selectedStudents]);

    const fetchFeeHeads = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-heads`);
            setFeeHeads(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (activeTab === 'approvals') {
            fetchPendingRequests();
        }
    }, [activeTab, filters]); // Refetch when filters change

    const fetchPendingRequests = async () => {
        try {
            const params = new URLSearchParams(filters);
            // If status is ALL, don't send it or send ALL depending on backend. Backend handles ALL.
            // Remove empty filters
            Object.keys(filters).forEach(key => {
                if (!filters[key] && key !== 'status') params.delete(key);
            });

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/concessions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setPendingRequests(res.data);
        } catch (e) { console.error(e); }
    };

    // --- Search Logic (Simplified from FeeCollection) ---
    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students`); // Fetch all then filter locally for simplicity as in FeeCollection
            // Optimize later to use backend search if available
            const query = searchQuery.toLowerCase().trim();
            const matches = res.data.filter(s =>
                (s.admission_number && s.admission_number.toLowerCase().includes(query)) ||
                (s.student_name && s.student_name.toLowerCase().includes(query))
            );
            setFoundStudents(matches);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const toggleStudentSelection = (student) => {
        if (selectedStudents.find(s => s.admission_number === student.admission_number)) {
            setSelectedStudents(selectedStudents.filter(s => s.admission_number !== student.admission_number));
        } else {
            setSelectedStudents([...selectedStudents, student]);
        }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (selectedStudents.length === 0) return alert('Please select at least one student');

        try {
            const payload = {
                students: selectedStudents.map(s => ({
                    studentId: s.admission_number,
                    studentName: s.student_name,
                    // Pass demographic info so it's stored in the request
                    college: s.college_name || s.college,
                    course: s.course_name || s.course,
                    branch: s.branch_name || s.branch,
                    batch: s.batch_name || s.batch
                })),
                feeHeadId: formData.feeHeadId,
                amount: formData.amount,
                reason: formData.reason,
                studentYear: formData.studentYear || '1',
                semester: formData.semester
            };

            await axios.post(`${import.meta.env.VITE_API_URL}/api/concessions`, payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            alert('Concession Request Submitted Successfully');
            // Reset
            setSelectedStudents([]);
            setFoundStudents([]);
            setSearchQuery('');
            setFormData({ feeHeadId: '', amount: '', reason: '', studentYear: '', semester: '' });

        } catch (error) {
            console.error(error);
            alert('Failed to submit request');
        }
    };

    const openModal = (req) => {
        setSelectedRequest(req);
        setModalAmount(req.amount);
        setRejectionReason('');
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setModalAmount('');
        setRejectionReason('');
    };

    const handleApprovalAction = async (action) => {
        if (!selectedRequest) return;
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

        setApprovalLoading(true);
        try {
            const payload = { action };
            if (action === 'APPROVE') {
                payload.approvedAmount = modalAmount;
            } else if (action === 'REJECT') {
                payload.rejectionReason = rejectionReason;
            }

            await axios.put(`${import.meta.env.VITE_API_URL}/api/concessions/${selectedRequest._id}/process`, payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            closeModal();
            fetchPendingRequests(); // Refresh list
        } catch (error) {
            console.error(error);
            alert('Action Failed');
        } finally {
            setApprovalLoading(false);
        }
    };

    const isSuperAdmin = user?.role === 'superadmin';

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-gray-200 pb-4 gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Concession Management</h1>

                    {/* Tabs (Pill Style) */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${activeTab === 'request' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('request')}
                        >
                            Request Concession
                        </button>
                        <button
                            className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${activeTab === 'approvals' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('approvals')}
                        >
                            Approval Queue
                            {pendingRequests.length > 0 && (
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === 'approvals' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tab Content: REQUEST */}
                {activeTab === 'request' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left: Find Students */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-700 mb-4">1. Select Students</h2>
                            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Search Name or Admission No..."
                                    className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Search</button>
                            </form>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {loading && <p className="text-center text-gray-400">Searching...</p>}
                                {foundStudents.map(s => {
                                    const isSelected = selectedStudents.some(sel => sel.admission_number === s.admission_number);
                                    return (
                                        <div
                                            key={s.admission_number}
                                            onClick={() => toggleStudentSelection(s)}
                                            className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50 border-gray-200'}`}
                                        >
                                            <div>
                                                <p className="font-bold text-gray-800">{s.student_name}</p>
                                                <p className="text-xs text-gray-500">{s.admission_number} | {s.course}</p>
                                            </div>
                                            {isSelected && <div className="text-blue-600 font-bold">✓</div>}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedStudents.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="font-bold text-gray-700">{selectedStudents.length} students selected</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedStudents.map(s => (
                                            <span key={s.admission_number} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                                                {s.student_name}
                                                <button onClick={() => toggleStudentSelection(s)} className="text-gray-400 hover:text-red-500">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Concession Details */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                            <h2 className="text-lg font-bold text-gray-700 mb-4">2. Concession Details</h2>
                            <form onSubmit={handleSubmitRequest} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Fee Head</label>
                                    <select
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.feeHeadId}
                                        onChange={e => setFormData({ ...formData, feeHeadId: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Select Fee Head --</option>
                                        {feeHeads.map(fh => <option key={fh._id} value={fh._id}>{fh.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">College</label>
                                        <input type="text" className="w-full border p-2 rounded-lg bg-gray-100 text-gray-500" value={formData.college} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Course</label>
                                        <input type="text" className="w-full border p-2 rounded-lg bg-gray-100 text-gray-500" value={formData.course} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Branch</label>
                                        <input type="text" className="w-full border p-2 rounded-lg bg-gray-100 text-gray-500" value={formData.branch} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Batch</label>
                                        <input type="text" className="w-full border p-2 rounded-lg bg-gray-100 text-gray-500" value={formData.batch} readOnly />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Student Year</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500"
                                            value={formData.studentYear}
                                            readOnly
                                            placeholder="e.g. 1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Semester</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500"
                                            value={formData.semester}
                                            readOnly
                                            placeholder="e.g. 1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Concession Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Reason / Justification</label>
                                    <textarea
                                        className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                        placeholder="Enter reason for concession..."
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    disabled={selectedStudents.length === 0}
                                >
                                    Submit Request ({selectedStudents.length})
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Tab Content: APPROVALS */}
                {activeTab === 'approvals' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                        {/* Filters Toolbar */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-4 items-center">
                            <select
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value })}
                            >
                                <option value="PENDING">Status: Pending</option>
                                <option value="APPROVED">Status: Approved</option>
                                <option value="REJECTED">Status: Rejected</option>
                                <option value="ALL">Status: All</option>
                            </select>

                            <select
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[150px]"
                                value={filters.college}
                                onChange={e => setFilters({ ...filters, college: e.target.value, course: '', branch: '' })}
                            >
                                <option value="">All Colleges</option>
                                {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <select
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[150px]"
                                value={filters.course}
                                onChange={e => setFilters({ ...filters, course: e.target.value, branch: '' })}
                                disabled={!filters.college}
                            >
                                <option value="">All Courses</option>
                                {courseList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <select
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[150px]"
                                value={filters.branch}
                                onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                disabled={!filters.course}
                            >
                                <option value="">All Branches</option>
                                {branchList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>

                            <select
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]"
                                value={filters.batch}
                                onChange={e => setFilters({ ...filters, batch: e.target.value })}
                            >
                                <option value="">All Batches</option>
                                {batchList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>

                            <input
                                type="text"
                                placeholder="Search Student..."
                                className="border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>

                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Student</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fee Head / Year</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Amount</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Reason</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Requested By</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pendingRequests.length === 0 ? (
                                    <tr><td colSpan="6" className="p-8 text-center text-gray-500 italic">No pending requests found.</td></tr>
                                ) : (
                                    pendingRequests.map(req => (
                                        <tr
                                            key={req._id}
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => openModal(req)}
                                        >
                                            <td className="p-4 text-sm text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800">{req.studentName}</div>
                                                <div className="text-xs text-gray-500">{req.studentId}</div>
                                                <div className="text-xs text-blue-600 font-medium">{req.course} - {req.branch}</div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">
                                                {req.feeHead?.name}
                                                <div className="text-xs text-gray-400">Year {req.studentYear} {req.semester ? `(S${req.semester})` : ''}</div>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-gray-800 text-right">
                                                ₹{req.amount.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 max-w-xs truncate">{req.reason}</td>
                                            <td className="p-4 text-sm text-gray-600">{req.requestedBy}</td>
                                            <td className="p-4 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* MODAL */}
                {selectedRequest && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 animate-fade-in">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-800">Request Details</h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="block text-gray-500 mb-1">Student</label>
                                        <div className="font-bold text-gray-800">{selectedRequest.studentName}</div>
                                        <div className="text-xs text-gray-500">{selectedRequest.studentId}</div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 mb-1">Course / Branch</label>
                                        <div className="font-bold text-gray-800">{selectedRequest.course}</div>
                                        <div className="text-xs text-gray-500">{selectedRequest.branch}</div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 mb-1">Fee Head</label>
                                        <div className="font-bold text-gray-800">{selectedRequest.feeHead?.name}</div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 mb-1">Requested Amount</label>
                                        <div className="font-bold text-blue-600 text-lg">₹{selectedRequest.amount.toLocaleString()}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-500 mb-1 text-sm">Reason</label>
                                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic border border-gray-100">
                                        "{selectedRequest.reason}"
                                    </div>
                                </div>

                                {isSuperAdmin && selectedRequest.status === 'PENDING' && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Approved Amount (Editable)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded-lg font-bold text-lg focus:ring-2 focus:ring-blue-500"
                                            value={modalAmount}
                                            onChange={e => setModalAmount(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Modify this amount if you wish to approve a partial concession.</p>
                                    </div>
                                )}

                                {isSuperAdmin && selectedRequest.status === 'PENDING' && (
                                    <div className="pt-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Rejection Reason (Optional)</label>
                                        <textarea
                                            className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                                            placeholder="Reason for rejection..."
                                            value={rejectionReason}
                                            onChange={e => setRejectionReason(e.target.value)}
                                        />
                                    </div>
                                )}

                            </div>

                            <div className="flex gap-3">
                                {isSuperAdmin && selectedRequest.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprovalAction('APPROVE')}
                                            className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                            disabled={approvalLoading}
                                        >
                                            {approvalLoading ? (
                                                <>
                                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                                    Processing...
                                                </>
                                            ) : (
                                                `Approve (₹${Number(modalAmount).toLocaleString()})`
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleApprovalAction('REJECT')}
                                            className="flex-1 bg-white border border-red-500 text-red-500 font-bold py-3 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={approvalLoading}
                                        >
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={closeModal}
                                        className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConcessionManagement;
