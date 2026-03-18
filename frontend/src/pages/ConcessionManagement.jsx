import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Upload, X, Check, Save, Calendar, Filter } from 'lucide-react';
import Sidebar from './Sidebar';

const ConcessionManagement = () => {
    const [activeTab, setActiveTab] = useState('request'); // 'request', 'approvals', 'approvers'
    const [user, setUser] = useState(null);

    const searchInputRef = React.useRef(null);

    useEffect(() => {
        if (activeTab === 'request' && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [activeTab]);

    // Request State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null); // Single student only

    const [feeHeads, setFeeHeads] = useState([]);
    const [formData, setFormData] = useState({
        feeHeadId: '',
        amount: '',
        reason: '',
        studentYear: '',
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
    
    // Approver Management State
    const [approvers, setApprovers] = useState([]);
    const [newApprover, setNewApprover] = useState({ name: '', designation: '' });
    const [isApproverLoading, setIsApproverLoading] = useState(false);

    // Reports State
    const [reportFilters, setReportFilters] = useState({
        startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        concessionGivenBy: '',
        college: '',
        status: 'APPROVED'
    });
    const [reportData, setReportData] = useState([]);
    const [isReportLoading, setIsReportLoading] = useState(false);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
        fetchFeeHeads();
        fetchMetadata();
        if (activeTab === 'approvals') {
            fetchPendingRequests();
        }
        if (activeTab === 'approvers' || activeTab === 'reports') {
            fetchApprovers();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab, reportFilters]);

    const fetchReports = async () => {
        setIsReportLoading(true);
        try {
            const params = new URLSearchParams(reportFilters);
            Object.keys(reportFilters).forEach(key => {
                if (!reportFilters[key] && key !== 'status') params.delete(key);
            });

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/concessions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setReportData(res.data);
        } catch (e) { console.error(e); }
        setIsReportLoading(false);
    };

    // Search Logic (Debounced)
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (activeTab === 'request' && searchTerm.length >= 3) {
                setIsSearching(true);
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/search?q=${searchTerm}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    setSearchResults(res.data);
                } catch (error) { console.error(error); }
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, activeTab]);

    const selectStudent = (s) => {
        setSelectedStudent(s);
        setFormData(prev => ({
            ...prev,
            studentYear: s.current_year,
            semester: s.current_semester,
            college: s.college,
            course: s.course,
            branch: s.branch,
            batch: s.batch
        }));
        setSearchTerm('');
        setSearchResults([]);
    };

    const fetchMetadata = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setMetadata(res.data);
            setCollegeList(Object.keys(res.data.hierarchy || {}));
            setBatchList(res.data.batches || []);
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


    const fetchFeeHeads = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-heads`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
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
            Object.keys(filters).forEach(key => {
                if (!filters[key] && key !== 'status') params.delete(key);
            });

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/concessions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setPendingRequests(res.data);
        } catch (e) { console.error(e); }
    };

    // Approver CRUD
    const fetchApprovers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/concession-approvers/all`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setApprovers(res.data);
        } catch (e) { console.error(e); }
    };

    const handleAddApprover = async (e) => {
        e.preventDefault();
        if (!newApprover.name || !newApprover.designation) return alert('Please fill all fields');
        setIsApproverLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/concession-approvers`, newApprover, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setNewApprover({ name: '', designation: '' });
            fetchApprovers();
        } catch (e) { alert('Failed to add'); }
        setIsApproverLoading(false);
    };

    const toggleApprover = async (id) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/concession-approvers/${id}/toggle`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchApprovers();
        } catch (e) { alert('Failed to toggle'); }
    };

    const deleteApprover = async (id) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/concession-approvers/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchApprovers();
        } catch (e) { alert('Failed to delete'); }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (!selectedStudent) return alert('Please select a student');

        try {
            const formDataObjs = new FormData();

            // Single Student Array
            const studentsData = [{
                studentId: selectedStudent.admission_number,
                studentName: selectedStudent.student_name,
                college: selectedStudent.college,
                course: selectedStudent.course,
                branch: selectedStudent.branch,
                batch: selectedStudent.batch
            }];
            formDataObjs.append('students', JSON.stringify(studentsData));

            // Append other fields
            formDataObjs.append('feeHeadId', formData.feeHeadId);
            formDataObjs.append('amount', formData.amount);
            formDataObjs.append('reason', formData.reason);
            formDataObjs.append('studentYear', formData.studentYear || '1');
            if (formData.semester) formDataObjs.append('semester', formData.semester);

            if (imageFile) {
                formDataObjs.append('image', imageFile);
            }

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/concessions`, formDataObjs, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const createdVoucherId = response.data.data?.[0]?.voucherId || 'N/A';
            alert(`Concession Request Submitted Successfully! Voucher ID: ${createdVoucherId}`);
            // Reset
            setSelectedStudent(null);
            setFormData({ feeHeadId: '', amount: '', reason: '', studentYear: '', semester: '', college: '', course: '', branch: '', batch: '' });
            setImageFile(null);

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
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <header className="bg-white border-b px-6 py-3 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Concession Management</h1>
                        <p className="text-xs text-gray-500">Manage student fee concessions and approvals</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'request' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setActiveTab('request')}
                        >
                            Request
                        </button>
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && (
                            <button
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'approvals' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('approvals')}
                            >
                                Approvals
                                {pendingRequests.length > 0 && (
                                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'approvals' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                        )}
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvers')) && (
                            <button
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'approvers' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('approvers')}
                            >
                                Approvers
                            </button>
                        )}
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && (
                            <button
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('reports')}
                            >
                                Reports
                            </button>
                        )}
                    </div>
                </header>

                {/* Content Area - Request Tab */}
                {activeTab === 'request' && (
                    <div className="flex-1 overflow-hidden p-6 flex gap-6 max-w-[1700px] mx-auto w-full">
                        {/* LEFT COLUMN: Student Context & Search */}
                        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-gray-50">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Find Student</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        className="pl-10 w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Name, ID or Pin (min 3 chars)..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setSelectedStudent(null); }}
                                    />
                                    {isSearching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">...</div>}

                                    {/* Search Dropdown */}
                                    {(searchResults.length > 0 || isSearching) && (
                                        <div className="absolute z-20 w-full bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1 left-0">
                                            {searchResults.map(s => (
                                                <div
                                                    key={s.admission_number}
                                                    onClick={() => selectStudent(s)}
                                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                                >
                                                    <div className="font-bold text-gray-800 text-sm">{s.student_name}</div>
                                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                        <span>{s.admission_number}</span>
                                                        <span>{s.course} - {s.branch}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {isSearching && (
                                                <div className="p-3 text-center text-xs text-gray-500 italic bg-gray-50">
                                                    Searching...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Student Card Details */}
                            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
                                {selectedStudent ? (
                                    <div className="flex flex-col items-center text-center space-y-4 animate-fade-in">
                                        {selectedStudent.student_photo ? (
                                            <img
                                                src={selectedStudent.student_photo}
                                                alt="Student"
                                                className="w-24 h-24 rounded-full border-4 border-white shadow object-cover"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold border-4 border-white shadow">
                                                {selectedStudent.student_name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-800">{selectedStudent.student_name}</h2>
                                            <p className="text-sm text-gray-500 font-mono tracking-wide">{selectedStudent.admission_number}</p>
                                        </div>

                                        <div className="w-full bg-white rounded-lg border border-gray-100 p-4 text-left space-y-3 shadow-sm">
                                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                                <span className="text-xs text-gray-400 uppercase">College</span>
                                                <span className="text-sm font-medium text-gray-700">{selectedStudent.college}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                                <span className="text-xs text-gray-400 uppercase">Course</span>
                                                <span className="text-sm font-medium text-gray-700">{selectedStudent.course}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                                <span className="text-xs text-gray-400 uppercase">Branch</span>
                                                <span className="text-sm font-medium text-gray-700">{selectedStudent.branch}</span>
                                            </div>
                                            <div className="flex justify-between pb-1">
                                                <span className="text-xs text-gray-400 uppercase">Batch</span>
                                                <span className="text-sm font-medium text-gray-700">{selectedStudent.batch}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 w-full">
                                            <div className="flex-1 bg-blue-50 rounded p-2 text-center">
                                                <div className="text-xs text-blue-400 font-bold uppercase">Year</div>
                                                <div className="text-lg font-bold text-blue-700">{selectedStudent.current_year}</div>
                                            </div>
                                            <div className="flex-1 bg-purple-50 rounded p-2 text-center">
                                                <div className="text-xs text-purple-400 font-bold uppercase">Sem</div>
                                                <div className="text-lg font-bold text-purple-700">{selectedStudent.current_semester || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                        <Search className="w-12 h-12 opacity-20" />
                                        <p className="text-sm font-medium">Search & Select a student to proceed</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Action Form */}
                        <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${!selectedStudent ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
                            <div className="p-4 border-b flex items-center gap-2">
                                <div className="bg-blue-600 text-white rounded p-1"><Check size={16} /></div>
                                <h2 className="font-bold text-gray-700">Concession Details</h2>
                            </div>

                            <form onSubmit={handleSubmitRequest} className="flex-1 p-6 overflow-y-auto space-y-5">
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">Fee Head <span className="text-red-500">*</span></label>
                                        <select
                                            className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition hover:border-blue-300"
                                            value={formData.feeHeadId}
                                            onChange={e => setFormData({ ...formData, feeHeadId: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Fee Component</option>
                                            {feeHeads.map(fh => <option key={fh._id} value={fh._id}>{fh.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">Amount (₹) <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 p-2.5 rounded-lg text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Justification / Reason <span className="text-red-500">*</span></label>
                                    <textarea
                                        className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition h-24 resize-none"
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                        placeholder="Enter detailed reason for this concession..."
                                    ></textarea>
                                </div>

                                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4">
                                    <label className="text-xs font-bold text-gray-500 block mb-2">Proof Document (Optional)</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-md text-sm hover:bg-gray-50 hover:border-gray-300 shadow-sm transition">
                                            <Upload size={16} />
                                            <span>{imageFile ? 'Change File' : 'Upload File'}</span>
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={e => setImageFile(e.target.files[0])}
                                                className="hidden"
                                            />
                                        </label>
                                        {imageFile && (
                                            <span className="text-xs text-blue-600 font-medium truncate max-w-[200px]">{imageFile.name}</span>
                                        )}
                                        {!imageFile && <span className="text-xs text-gray-400">PDF, JPG or PNG (Max 5MB)</span>}
                                    </div>
                                </div>
                            </form>

                            <div className="p-4 border-t bg-gray-50 flex justify-end">
                                <button
                                    onClick={handleSubmitRequest}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition transform active:scale-95"
                                >
                                    <Save size={18} />
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Area - Approvals Tab */}
                {activeTab === 'approvals' && (
                    <div className="flex-1 p-6 overflow-hidden flex flex-col max-w-[1700px] mx-auto w-full">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            {/* Filters Toolbar */}
                            <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={filters.status}
                                            onChange={e => setFilters({ ...filters, status: e.target.value })}
                                        >
                                            <option value="PENDING">Status: Pending</option>
                                            <option value="APPROVED">Status: Approved</option>
                                            <option value="REJECTED">Status: Rejected</option>
                                            <option value="ALL">Status: All</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={filters.college}
                                            onChange={e => setFilters({ ...filters, college: e.target.value, course: '', branch: '' })}
                                        >
                                            <option value="">All Colleges</option>
                                            {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 w-full sm:w-auto">
                                        <input
                                            type="text"
                                            placeholder="Search by student name..."
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 outline-none w-full min-w-[200px]"
                                            value={filters.search}
                                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchPendingRequests}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-900 transition shadow-sm"
                                    >
                                        <Filter size={14} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/80 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6">Date</th>
                                            <th className="py-4 px-6">Voucher #</th>
                                            <th className="py-4 px-6">Student</th>
                                            <th className="py-4 px-6">Fee Head</th>
                                            <th className="py-4 px-6 text-right">Amount</th>
                                            <th className="py-4 px-6">Reason</th>
                                            <th className="py-4 px-6">By</th>
                                            <th className="py-4 px-6 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {pendingRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="py-32 text-center pointer-events-none">
                                                    <div className="flex flex-col items-center justify-center gap-4 opacity-50">
                                                        <div className="bg-gray-100 p-4 rounded-full">
                                                            <Search size={32} className="text-gray-400" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-gray-900 font-bold text-lg">No concession requests found.</p>
                                                            <p className="text-gray-500 text-sm">Try adjusting your filters.</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingRequests.map(req => (
                                                <tr
                                                    key={req._id}
                                                    className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                                                    onClick={() => openModal(req)}
                                                >
                                                    <td className="py-4 px-6 text-sm text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                    <td className="py-4 px-6">
                                                        <span className="font-mono text-xs font-bold text-gray-800">
                                                            #{req.voucherId || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-gray-800 text-sm">{req.studentName}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{req.studentId}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-600">
                                                        {req.feeHead?.name}
                                                        <div className="text-[10px] text-gray-400">Yr {req.studentYear}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm font-semibold text-gray-800 text-right">
                                                        ₹{req.amount.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-600 max-w-[200px] truncate">{req.reason}</td>
                                                    <td className="py-4 px-6 text-sm font-medium text-purple-700">{req.requestedBy}</td>
                                                    <td className="py-4 px-6 text-right">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
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
                        </div>
                    </div>
                )}

                {/* Content Area - Approvers Tab */}
                {activeTab === 'approvers' && (
                    <div className="flex-1 p-6 overflow-hidden flex flex-col max-w-[1700px] mx-auto w-full">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden h-full">
                            {/* Left: Add Form */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-fit">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Add Permission Giver</h3>
                                <form onSubmit={handleAddApprover} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Full Name</label>
                                        <input 
                                            type="text" 
                                            className="w-full border p-2 rounded-lg text-sm"
                                            value={newApprover.name}
                                            onChange={e => setNewApprover({...newApprover, name: e.target.value})}
                                            placeholder="e.g. Dr. Ramesh Babu"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Designation</label>
                                        <select 
                                            className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-blue-500"
                                            value={newApprover.designation}
                                            onChange={e => setNewApprover({...newApprover, designation: e.target.value})}
                                        >
                                            <option value="">-- Select Designation --</option>
                                            <option value="Principal">Principal</option>
                                            <option value="Dean">Dean</option>
                                            <option value="Vice Principal">Vice Principal</option>
                                            <option value="Manager">Manager</option>
                                            <option value="Academic Director">Academic Director</option>
                                        </select>
                                    </div>
                                    <button 
                                        type="submit"
                                        disabled={isApproverLoading}
                                        className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        Add Approver
                                    </button>
                                </form>
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed italic">
                                    These people will appear in the "Concession Given By" dropdown on the Fee Collection page for cashiers.
                                </div>
                            </div>

                            {/* Center/Right: List */}
                            <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                                <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center">
                                    <h3 className="font-bold text-gray-700 text-sm">Managed Approvers</h3>
                                    <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-full">{approvers.length} Total</span>
                                </div>
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50/80 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold sticky top-0 z-10">
                                            <tr>
                                                <th className="py-4 px-6">Name</th>
                                                <th className="py-4 px-6">Designation</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {approvers.map(a => (
                                                <tr key={a._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                                    <td className="py-4 px-6 font-bold text-gray-800 text-sm">{a.name}</td>
                                                    <td className="py-4 px-6 text-sm text-gray-600">{a.designation}</td>
                                                    <td className="py-4 px-6">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.isActive ? 'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                                                            {a.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right space-x-2">
                                                        <button 
                                                            onClick={() => toggleApprover(a._id)}
                                                            className={`text-xs font-bold px-3 py-1 rounded border transition ${a.isActive ? 'border-orange-200 text-orange-600 hover:bg-orange-50':'border-green-200 text-green-600 hover:bg-green-50'}`}
                                                        >
                                                            {a.isActive ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteApprover(a._id)}
                                                            className="text-xs font-bold px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {approvers.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="py-32 text-center text-gray-400 italic pointer-events-none">
                                                        <div className="flex flex-col items-center justify-center gap-4 opacity-50">
                                                            <div className="bg-gray-100 p-4 rounded-full">
                                                                <Search size={32} className="text-gray-400" />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-gray-900 font-bold text-lg">No approvers added yet.</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Area - Reports Tab */}
                {activeTab === 'reports' && (
                    <div className="flex-1 p-6 overflow-hidden flex flex-col max-w-[1700px] mx-auto w-full">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            {/* Toolbar (Filters) */}
                            <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <Calendar size={14} className="text-gray-400" />
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer w-32 outline-none"
                                            value={reportFilters.startDate}
                                            onChange={e => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                                        />
                                        <span className="text-gray-300 mx-1">to</span>
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer w-32 outline-none"
                                            value={reportFilters.endDate}
                                            onChange={e => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={reportFilters.concessionGivenBy}
                                            onChange={e => setReportFilters({ ...reportFilters, concessionGivenBy: e.target.value })}
                                        >
                                            <option value="">All Approvers</option>
                                            {approvers.map(a => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={reportFilters.college}
                                            onChange={e => setReportFilters({ ...reportFilters, college: e.target.value })}
                                        >
                                            <option value="">All Colleges</option>
                                            {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer outline-none"
                                            value={reportFilters.status}
                                            onChange={e => setReportFilters({ ...reportFilters, status: e.target.value })}
                                        >
                                            <option value="ALL">All Statuses</option>
                                            <option value="APPROVED">Approved</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="REJECTED">Rejected</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchReports}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-900 transition shadow-sm"
                                    >
                                        <Filter size={14} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Reports Table */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/80 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6">Date</th>
                                            <th className="py-4 px-6">Voucher #</th>
                                            <th className="py-4 px-6">Student</th>
                                            <th className="py-4 px-6">Fee Head</th>
                                            <th className="py-4 px-6 text-right">Amount</th>
                                            <th className="py-4 px-6">Approver</th>
                                            <th className="py-4 px-6 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {isReportLoading ? (
                                            <tr>
                                                <td colSpan="7" className="py-32 text-center pointer-events-none">
                                                    <div className="flex flex-col items-center justify-center gap-4">
                                                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-gray-400 font-medium animate-pulse">Loading reports...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : reportData.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="py-32 text-center pointer-events-none">
                                                    <div className="flex flex-col items-center justify-center gap-4 opacity-50">
                                                        <div className="bg-gray-100 p-4 rounded-full">
                                                            <Search size={32} className="text-gray-400" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-gray-900 font-bold text-lg">No reports found.</p>
                                                            <p className="text-gray-500 text-sm">Try adjusting your filters.</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            reportData.map(req => (
                                                <tr key={req._id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                                    <td className="py-4 px-6 text-sm text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                    <td className="py-4 px-6">
                                                        <span className="font-mono text-xs font-bold text-gray-800">
                                                            #{req.voucherId || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-gray-800 text-sm">{req.studentName}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{req.studentId}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-600">
                                                        {req.feeHead?.name}
                                                    </td>
                                                    <td className="py-4 px-6 text-sm font-semibold text-gray-800 text-right">
                                                        ₹{req.amount.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-6 text-sm font-medium text-purple-700">
                                                        {req.concessionGivenBy || '---'}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
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
                                    {!isReportLoading && reportData.length > 0 && (
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td colSpan="4" className="py-4 px-6 text-right font-bold text-gray-800 text-xs uppercase tracking-wide">GRAND TOTAL</td>
                                                <td className="py-4 px-6 text-right font-extrabold text-lg text-blue-900">
                                                    ₹{reportData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                                                </td>
                                                <td colSpan="2" className="py-4 px-6"></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL (Reused logic) */}
                {selectedRequest && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-start mb-4 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Request Details</h2>
                                    <p className="text-xs text-gray-500">Review concession application</p>
                                </div>
                                <button onClick={closeModal} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition"><X size={16} className="text-gray-600" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">Student</label>
                                        <div className="font-semibold text-gray-800">{selectedRequest.studentName}</div>
                                        <div className="text-xs text-gray-500">{selectedRequest.studentId}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">Voucher #</label>
                                        <div className="font-mono font-bold text-blue-600">#{selectedRequest.voucherId || '---'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold">Fee Head</label>
                                        <div className="font-semibold text-gray-800">{selectedRequest.feeHead?.name}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-400 uppercase font-bold">Amount Requested</label>
                                        <div className="font-bold text-blue-600 text-lg">₹{selectedRequest.amount.toLocaleString()}</div>
                                    </div>
                                    {selectedRequest.concessionGivenBy && (
                                        <div className="col-span-2 pt-2 border-t border-gray-100">
                                            <label className="text-xs text-gray-400 uppercase font-bold">Concession Authorized By</label>
                                            <div className="font-bold text-purple-700 flex items-center gap-1">
                                                <div className="bg-purple-100 p-1 rounded-full"><Save size={12} /></div>
                                                {selectedRequest.concessionGivenBy}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">Reason</label>
                                    <div className="text-sm text-gray-700 bg-white border p-3 rounded-lg italic">"{selectedRequest.reason}"</div>
                                </div>

                                {selectedRequest.imageUrl && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1">Proof Document</label>
                                        <a href={selectedRequest.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-50 transition group cursor-pointer">
                                            <div className="bg-gray-200 p-2 rounded"><Upload size={16} className="text-gray-600" /></div>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-blue-600 underline decoration-dotted group-hover:text-blue-800">View Document</div>
                                                <div className="text-xs text-gray-400">Click to open in new tab</div>
                                            </div>
                                        </a>
                                    </div>
                                )}

                                {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                        <label className="text-xs font-bold text-red-500 block">Rejection Reason</label>
                                        <p className="text-sm text-red-700">{selectedRequest.rejectionReason}</p>
                                    </div>
                                )}

                                {/* Approval Sections */}
                                {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && selectedRequest.status === 'PENDING' && (
                                    <div className="pt-4 border-t space-y-3">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Approved Amount</label>
                                            <input
                                                type="number"
                                                className="w-full border p-2 rounded font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                                                value={modalAmount}
                                                onChange={e => setModalAmount(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Rejection Reason (If rejecting)</label>
                                            <textarea
                                                className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="Required if rejecting..."
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t shrink-0 flex gap-3">
                                {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && selectedRequest.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprovalAction('APPROVE')}
                                            className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 shadow-sm transition flex justify-center items-center gap-2"
                                            disabled={approvalLoading}
                                        >
                                            <Check size={18} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleApprovalAction('REJECT')}
                                            className="flex-1 bg-white border border-red-200 text-red-600 font-bold py-2.5 rounded-lg hover:bg-red-50 transition"
                                            disabled={approvalLoading}
                                        >
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200">Close</button>
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
