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
    const [imageFile, setImageFile] = useState(null);

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
            const formDataObjs = new FormData();

            // Append Students as JSON string
            const studentsData = selectedStudents.map(s => ({
                studentId: s.admission_number,
                studentName: s.student_name,
                college: s.college_name || s.college,
                course: s.course_name || s.course,
                branch: s.branch_name || s.branch,
                batch: s.batch_name || s.batch
            }));
            formDataObjs.append('students', JSON.stringify(studentsData));

            // Append other fields
            formDataObjs.append('feeHeadId', formData.feeHeadId);
            formDataObjs.append('amount', formData.amount);
            formDataObjs.append('reason', formData.reason);
            formDataObjs.append('studentYear', formData.studentYear || '1');
            if (formData.semester) formDataObjs.append('semester', formData.semester);

            // Append Image
            if (imageFile) {
                formDataObjs.append('image', imageFile);
            }

            await axios.post(`${import.meta.env.VITE_API_URL}/api/concessions`, formDataObjs, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert('Concession Request Submitted Successfully');
            // Reset
            setSelectedStudents([]);
            setFoundStudents([]);
            setSearchQuery('');
            setFormData({ feeHeadId: '', amount: '', reason: '', studentYear: '', semester: '', college: '', course: '', branch: '', batch: '' });
            setImageFile(null); // Reset image

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
                        {isSuperAdmin && (
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
                        )}
                    </div>
                </div>

                {/* Tab Content: REQUEST */}
                {activeTab === 'request' && (
                    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">New Concession Request</h2>

                        {/* 1. Student Selection Section */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Student(s)</label>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Search by Name or Admission No..."
                                    className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <button onClick={handleSearch} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-sm">Search</button>
                            </div>

                            {/* Search Results */}
                            {foundStudents.length > 0 && (
                                <div className="mb-4 text-sm border rounded-lg overflow-hidden">
                                    {foundStudents.map(s => {
                                        const isSelected = selectedStudents.some(sel => sel.admission_number === s.admission_number);
                                        return (
                                            <div
                                                key={s.admission_number}
                                                onClick={() => toggleStudentSelection(s)}
                                                className={`p-3 cursor-pointer flex justify-between items-center border-b last:border-b-0 hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
                                            >
                                                <div>
                                                    <span className="font-bold text-gray-800">{s.student_name}</span>
                                                    <span className="text-gray-500 mx-2">|</span>
                                                    <span className="text-gray-500">{s.admission_number}</span>
                                                    <span className="text-gray-400 text-xs ml-2">({s.course} - {s.branch})</span>
                                                </div>
                                                {isSelected && <span className="text-blue-600 font-bold">Selected ✓</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Selected Chips */}
                            <div className="min-h-[50px] p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-wrap gap-2 items-center">
                                {selectedStudents.length === 0 ? (
                                    <span className="text-gray-400 text-sm">No students selected. Search and select above.</span>
                                ) : (
                                    selectedStudents.map(s => (
                                        <div key={s.admission_number} className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm">
                                            <span className="font-medium">{s.student_name}</span>
                                            <button onClick={() => toggleStudentSelection(s)} className="text-gray-400 hover:text-red-500 font-bold">×</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. Concession Details Form */}
                        <div className={`transition-opacity ${selectedStudents.length === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <h3 className="text-lg font-bold text-gray-700 mb-4">2. Application Details</h3>
                            <form onSubmit={handleSubmitRequest} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Fee Head <span className="text-red-500">*</span></label>
                                        <select
                                            className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={formData.feeHeadId}
                                            onChange={e => setFormData({ ...formData, feeHeadId: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Fee Head --</option>
                                            {feeHeads.map(fh => <option key={fh._id} value={fh._id}>{fh.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Concession Amount (₹) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Year</label>
                                        <div className="font-medium text-gray-800">{formData.studentYear || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Semester</label>
                                        <div className="font-medium text-gray-800">{formData.semester || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">College</label>
                                        <div className="text-sm text-gray-800 truncate" title={formData.college}>{formData.college || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Batch</label>
                                        <div className="text-sm text-gray-800">{formData.batch || '-'}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Reason / Justification <span className="text-red-500">*</span></label>
                                    <textarea
                                        className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                        placeholder="Ex: Merit student, Financial hardship..."
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-2">Upload Proof Document (Optional)</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-white transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={e => setImageFile(e.target.files[0])}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <span className="text-gray-500 font-medium mb-1">{imageFile ? imageFile.name : 'Click to Upload Image/PDF'}</span>
                                        <span className="text-xs text-gray-400">Max size 5MB</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg hover:bg-blue-700 transition shadow-lg mt-4"
                                >
                                    Submit Request
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
                                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic border border-gray-100 mb-4">
                                        "{selectedRequest.reason}"
                                    </div>
                                    {selectedRequest.imageUrl && (
                                        <div>
                                            <label className="block text-gray-500 mb-1 text-sm">Proof Document</label>
                                            <a href={selectedRequest.imageUrl} target="_blank" rel="noopener noreferrer" className="block w-32 h-32 border rounded overflow-hidden relative group">
                                                <img src={selectedRequest.imageUrl} alt="Proof" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-xs font-bold">View</div>
                                            </a>
                                        </div>
                                    )}
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
