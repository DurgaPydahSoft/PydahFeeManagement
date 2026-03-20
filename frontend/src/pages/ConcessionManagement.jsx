import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Upload, X, Check, Save, Calendar, Filter, Landmark, Users, Printer, Edit2 } from 'lucide-react';
import Sidebar from './Sidebar';
import { useReactToPrint } from 'react-to-print';
import ConcessionReportPrint from '../components/ConcessionReportPrint';

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
    const [selectedStudents, setSelectedStudents] = useState([]); // Array of selected students
    const [previewStudent, setPreviewStudent] = useState(null); // For displaying details

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
    const [bulkAmounts, setBulkAmounts] = useState({}); // {requestId: amount}


    const reportPrintRef = React.useRef();
    const handlePrint = useReactToPrint({
        contentRef: reportPrintRef,
        documentTitle: 'Concession_Fee_Advice_Report',
    });

    // Metadata for filters
    const [metadata, setMetadata] = useState({ hierarchy: {}, batches: [] });
    // Derived lists based on selection
    const [collegeList, setCollegeList] = useState([]);
    const [courseList, setCourseList] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [batchList, setBatchList] = useState([]);
    // New state for filtered student list
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    
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
        course: '',
        branch: '',
        batch: '',
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

    const toggleStudentSelection = (s) => {
        // Toggle selection
        const alreadySelected = selectedStudents.some(sel => sel.admission_number === s.admission_number);
        if (alreadySelected) {
            setSelectedStudents(prev => prev.filter(sel => sel.admission_number !== s.admission_number));
        } else {
            setSelectedStudents(prev => [...prev, s]);
        }
        // Set preview for details view
        setPreviewStudent(s);
        // Update formData for year/semester based on first selected (if any)
        if (!alreadySelected) {
            setFormData(prev => ({
                ...prev,
                studentYear: s.current_year,
                semester: s.current_semester,
                college: s.college,
                course: s.course,
                branch: s.branch,
                batch: s.batch
            }));
        }
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

    const openEditModal = (req) => {
        setEditingRequest(req);
        setEditAmount(req.amount);
        setEditReason(req.reason);
        setEditConcessionGivenBy(req.concessionGivenBy || '');
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async () => {
        if (!editAmount || isNaN(editAmount) || Number(editAmount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        setEditLoading(true);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/concessions/modify-approved/${editingRequest._id}`, {
                amount: Number(editAmount),
                reason: editReason,
                concessionGivenBy: editConcessionGivenBy
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            setIsEditModalOpen(false);
            fetchReports(); // Refresh report data
            alert('Concession updated successfully');
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || 'Update failed');
        } finally {
            setEditLoading(false);
        }
    };

    const fetchFilteredStudents = async () => {
        if (!formData.college) return alert('Please select a college at least');
        setIsFetchingStudents(true);
        try {
            const params = new URLSearchParams();
            if (formData.college) params.append('college', formData.college);
            if (formData.course) params.append('course', formData.course);
            if (formData.branch) params.append('branch', formData.branch);
            if (formData.batch) params.append('batch', formData.batch);

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students?${params.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setFilteredStudents(res.data);
            // Optionally clear existing selections if filters majorly change, 
            // but user might want to select from different filters sequentially.
            // For now, let's keep it simple and clear.
            setSelectedStudents([]);
        } catch (e) { console.error(e); }
        setIsFetchingStudents(false);
    };

    // Consolidated effect to update dropdown lists based on active tab filtering
    useEffect(() => {
        // Decide which filter source to use
        let currentCollege = '';
        let currentCourse = '';

        if (activeTab === 'request') {
            currentCollege = formData.college;
            currentCourse = formData.course;
        } else if (activeTab === 'approvals') {
            currentCollege = filters.college;
            currentCourse = filters.course;
        } else if (activeTab === 'reports') {
            currentCollege = reportFilters.college;
            currentCourse = reportFilters.course;
        }

        if (!currentCollege) {
            setCourseList([]);
            setBranchList([]);
            return;
        }

        const courses = metadata.hierarchy[currentCollege] ? Object.keys(metadata.hierarchy[currentCollege]) : [];
        setCourseList(courses);

        if (!currentCourse) {
            setBranchList([]);
            return;
        }

        const branches = metadata.hierarchy[currentCollege][currentCourse] ? metadata.hierarchy[currentCollege][currentCourse].branches : [];
        setBranchList(branches);

    }, [activeTab, formData.college, formData.course, filters.college, filters.course, reportFilters.college, reportFilters.course, metadata]);


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
        setApprovalLoading(true);
        try {
            const params = new URLSearchParams(filters);
            Object.keys(filters).forEach(key => {
                if (!filters[key] && key !== 'status') params.delete(key);
            });

            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/concessions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            // Group requests by voucherId for bulk display
            const grouped = [];
            const voucherMap = {};

            res.data.forEach(req => {
                const vId = req.voucherId || `single-${req._id}`;
                if (!voucherMap[vId]) {
                    voucherMap[vId] = {
                        isBulk: !!req.voucherId,
                        voucherId: req.voucherId,
                        createdAt: req.createdAt,
                        college: req.college,
                        course: req.course,
                        branch: req.branch,
                        batch: req.batch,
                        feeHeads: [], // Track unique fee heads
                        reason: req.reason,
                        requests: [],
                        totalAmount: 0
                    };
                    grouped.push(voucherMap[vId]);
                }
                voucherMap[vId].requests.push(req);
                voucherMap[vId].totalAmount += req.amount;
                
                // Track unique fee heads in the group
                if (req.feeHead && !voucherMap[vId].feeHeads.some(h => h._id === req.feeHead._id)) {
                    voucherMap[vId].feeHeads.push(req.feeHead);
                }
            });

            setPendingRequests(grouped);
        } catch (error) {
            console.error(error);
        } finally {
            setApprovalLoading(false);
        }
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
        if (selectedStudents.length === 0) return alert('Please select at least one student');

        try {
            const formDataObjs = new FormData();

            // Bulk Students Array
            const studentsData = selectedStudents.map(s => ({
                studentId: s.admission_number,
                studentName: s.student_name,
                studentPin: s.pin_no, // [NEW]
                college: s.college,
                course: s.course,
                branch: s.branch,
                batch: s.batch
            }));
            formDataObjs.append('students', JSON.stringify(studentsData));

            // Append other fields
            formDataObjs.append('feeHeadId', formData.feeHeadId);
            formDataObjs.append('amount', formData.amount);
            formDataObjs.append('reason', formData.reason);
            formDataObjs.append('studentYear', formData.studentYear || '1');
            if (formData.semester) formDataObjs.append('semester', formData.semester);

            if (formData.concessionGivenBy) {
                formDataObjs.append('concessionGivenBy', formData.concessionGivenBy);
            }

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
            // Reset selections and form
            setSelectedStudents([]);
            setFormData({ feeHeadId: '', amount: '', reason: '', studentYear: '', semester: '', college: '', course: '', branch: '', batch: '' });
            setImageFile(null);

        } catch (error) {
            console.error(error);
            alert('Failed to submit request');
        }
    };

    const openModal = (group) => {
        setSelectedRequest(group);
        if (group.isBulk) {
            const initialAmounts = {};
            group.requests.forEach(r => initialAmounts[r._id] = r.amount);
            setBulkAmounts(initialAmounts);
        } else {
            setModalAmount(group.requests[0].amount);
        }
        setRejectionReason('');
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setModalAmount('');
        setBulkAmounts({});
        setRejectionReason('');
    };

    const handleApprovalAction = async (action) => {
        if (!selectedRequest) return;
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

        setApprovalLoading(true);
        try {
            if (selectedRequest.requests[0].status === 'APPROVED' && action === 'APPROVE') {
                // MODIFICATION logic for already approved requests
                const promises = selectedRequest.requests.map(r => {
                    const newAmount = selectedRequest.isBulk ? bulkAmounts[r._id] : modalAmount;
                    return axios.put(`${import.meta.env.VITE_API_URL}/api/concessions/modify-approved/${r._id}`, {
                        amount: Number(newAmount),
                        reason: r.reason // Keep existing reason or you could add a way to edit it
                    }, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                });
                await Promise.all(promises);
            } else if (selectedRequest.isBulk) {
                // Bulk Process (Regular Approval)
                const requestsPayload = selectedRequest.requests.map(r => ({
                    id: r._id,
                    approvedAmount: action === 'APPROVE' ? bulkAmounts[r._id] : r.amount
                }));

                await axios.put(`${import.meta.env.VITE_API_URL}/api/concessions/bulk-process`, {
                    requests: requestsPayload,
                    action,
                    rejectionReason
                }, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            } else {
                // Single Process (Regular Approval)
                const payload = { action };
                if (action === 'APPROVE') {
                    payload.approvedAmount = modalAmount;
                } else if (action === 'REJECT') {
                    payload.rejectionReason = rejectionReason;
                }

                await axios.put(`${import.meta.env.VITE_API_URL}/api/concessions/${selectedRequest.requests[0]._id}/process`, payload, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            }

            closeModal();
            fetchPendingRequests();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Action Failed');
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
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
                        <button
                            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'request' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                            onClick={() => setActiveTab('request')}
                        >
                            Raise Request
                        </button>
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && (
                            <button
                                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                                onClick={() => setActiveTab('approvals')}
                            >
                                Approvals
                                {pendingRequests.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'approvals' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                        )}
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvers')) && (
                            <button
                                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'approvers' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                                onClick={() => setActiveTab('approvers')}
                            >
                                Approvers
                            </button>
                        )}
                        {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && (
                            <button
                                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
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
                        {/* LEFT COLUMN: Student Context & Filters */}
                        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2 font-sans tracking-tight">Find Student</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className="pl-10 w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            placeholder="Search by Name, ID or Pin..."
                                            value={searchTerm}
                                            onChange={e => { setSearchTerm(e.target.value); if (e.target.value === '') setSearchResults([]); }}
                                        />
                                        {isSearching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">...</div>}

                                        {/* Search Dropdown */}
                                        {(searchResults.length > 0 || isSearching) && (
                                            <div className="absolute z-20 w-full bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1 left-0">
                                                {searchResults.map(s => (
                                                    <div
                                                        key={s.admission_number}
                                                        onClick={() => toggleStudentSelection(s)}
                                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                                    >
                                                        <div className="font-bold text-gray-800 text-sm">{s.student_name}</div>
                                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                            <span>{s.pin_number || s.admission_number}</span>
                                                            <span>{s.course} - {s.branch}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Filters For Bulk Selection */}
                                <div className="space-y-3 pt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.college}
                                            onChange={e => setFormData({ ...formData, college: e.target.value, course: '', branch: '' })}
                                        >
                                            <option value="">Select College</option>
                                            {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.course}
                                            onChange={e => setFormData({ ...formData, course: e.target.value, branch: '' })}
                                        >
                                            <option value="">Select Course</option>
                                            {courseList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.branch}
                                            onChange={e => setFormData({ ...formData, branch: e.target.value })}
                                        >
                                            <option value="">Select Branch</option>
                                            {branchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.batch}
                                            onChange={e => setFormData({ ...formData, batch: e.target.value })}
                                        >
                                            <option value="">Select Batch</option>
                                            {batchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        onClick={fetchFilteredStudents}
                                        disabled={isFetchingStudents || !formData.college}
                                        className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Filter className="w-4 h-4" />
                                        {isFetchingStudents ? 'Loading Students...' : 'Load Student List'}
                                    </button>
                                </div>
                            </div>

                            {/* Student List Display */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50">
                                {filteredStudents.length > 0 ? (
                                    <div className="divide-y divide-gray-200">
                                        <div className="p-3 bg-white sticky top-0 z-10 border-b flex items-center justify-between shadow-sm">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Filtered Students ({filteredStudents.length})</span>
                                            <button 
                                                onClick={() => {
                                                    if (selectedStudents.length === filteredStudents.length) {
                                                        setSelectedStudents([]);
                                                    } else {
                                                        setSelectedStudents(filteredStudents);
                                                    }
                                                }}
                                                className="text-xs text-blue-600 font-extrabold hover:underline"
                                            >
                                                {selectedStudents.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                        {filteredStudents.map(s => {
                                            const isSelected = selectedStudents.some(sel => sel.admission_number === s.admission_number);
                                            return (
                                                <div 
                                                    key={s.admission_number}
                                                    className={`p-3 border-b hover:bg-blue-50 transition-colors flex items-center gap-3 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                                                    onClick={() => toggleStudentSelection(s)}
                                                >
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 scale-110' : 'border-gray-300 bg-white'}`}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-gray-800 text-sm truncate">{s.student_name}</div>
                                                        <div className="flex justify-between text-xs text-gray-500">
                                                            <span>{s.pin_number || s.admission_number}</span>
                                                            <span className="truncate ml-2">{s.course}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-3">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                            <Filter className="w-8 h-8 opacity-20" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-500">No Students Loaded</p>
                                            <p className="text-xs mt-1">Select college and course above to load students for bulk selection, or use search for individual students.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Action Form */}
                        <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${selectedStudents.length === 0 ? 'opacity-50 pointer-events-none grayscale-[0.0]' : ''}`}>
                            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-600 text-white rounded p-1.5 shadow-sm"><Check size={18} /></div>
                                    <div>
                                        <h2 className="font-bold text-gray-800">Concession Details</h2>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Raising for {selectedStudents.length} Students</p>
                                    </div>
                                </div>
                                {selectedStudents.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedStudents([])}
                                        className="text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-700"
                                    >
                                        <X size={14} /> Clear Selection
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSubmitRequest} className="flex-1 p-6 overflow-y-auto space-y-6">
                                {/* Selected Students Summary Bagde */}
                                {selectedStudents.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                        <h3 className="text-xs font-extrabold text-blue-800 uppercase mb-3 flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5" /> Selected Students ({selectedStudents.length})
                                        </h3>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
                                            {selectedStudents.map(s => (
                                                <div key={s.admission_number} className="bg-white px-2 py-1 rounded border border-blue-200 flex items-center gap-2 text-[11px] font-bold text-blue-700 animate-fade-in">
                                                    <span>{s.student_name}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); toggleStudentSelection(s); }} className="hover:text-red-500"><X size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-1">
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
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">Amount (₹) <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">₹</span>
                                            <input
                                                type="number"
                                                className="w-full border border-gray-300 pl-8 p-2.5 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                required
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block mb-1">Concession Authorized By / Given By <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full border border-gray-300 p-2.5 rounded-lg text-sm font-bold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition hover:border-blue-300"
                                        value={formData.concessionGivenBy}
                                        onChange={e => setFormData({ ...formData, concessionGivenBy: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Select Authority --</option>
                                        {approvers.filter(a => a.isActive).map(a => (
                                            <option key={a._id} value={a.name}>{a.name} ({a.designation})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 block">Justification / Reason <span className="text-red-500">*</span></label>
                                    <textarea
                                        className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition h-24 resize-none shadow-sm"
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                        placeholder="Enter detailed reason for this concession request..."
                                    ></textarea>
                                </div>

                                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5 hover:bg-gray-100/50 transition-colors">
                                    <label className="text-xs font-bold text-gray-600 block mb-3">Supporting Document (Proof)</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-bold hover:shadow-md transition active:scale-95 shadow-sm">
                                            <Upload size={18} className="text-blue-600" />
                                            <span>{imageFile ? 'Change File' : 'Choose File'}</span>
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={e => setImageFile(e.target.files[0])}
                                                className="hidden"
                                            />
                                        </label>
                                        {imageFile && (
                                            <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200">
                                                <span className="text-xs text-blue-800 font-bold truncate max-w-[150px]">{imageFile.name}</span>
                                                <button onClick={() => setImageFile(null)} className="text-blue-500 hover:text-red-500"><X size={14} /></button>
                                            </div>
                                        )}
                                        {!imageFile && <span className="text-[11px] text-gray-400 italic">No file selected (Supports PDF, JPG, PNG)</span>}
                                    </div>
                                </div>
                            </form>

                            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                                <div className="text-xs font-bold text-gray-500">
                                    {selectedStudents.length > 0 && `Ready to raise concession for ${selectedStudents.length} students.`}
                                </div>
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={selectedStudents.length === 0}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-extrabold shadow-lg flex items-center gap-2 transition transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    <Save size={20} />
                                    Submit Bulk Concession
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
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Filter size={14} className="text-gray-400" />
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={filters.status}
                                            onChange={e => setFilters({ ...filters, status: e.target.value })}
                                        >
                                            <option value="PENDING">Pending Action</option>
                                            <option value="APPROVED">Approved Requests</option>
                                            <option value="REJECTED">Rejected Requests</option>
                                            <option value="ALL">All Statuses</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Landmark size={14} className="text-gray-400" />
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[140px] outline-none"
                                            value={filters.college}
                                            onChange={e => setFilters({ ...filters, college: e.target.value, course: '', branch: '' })}
                                        >
                                            <option value="">All Colleges</option>
                                            {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={filters.course}
                                            onChange={e => setFilters({ ...filters, course: e.target.value, branch: '' })}
                                        >
                                            <option value="">All Courses</option>
                                            {courseList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={filters.branch}
                                            onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                        >
                                            <option value="">All Branches</option>
                                            {branchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[100px] outline-none"
                                            value={filters.batch}
                                            onChange={e => setFilters({ ...filters, batch: e.target.value })}
                                        >
                                            <option value="">All Batches</option>
                                            {batchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                        <Search size={14} className="text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 outline-none w-full min-w-[200px]"
                                            value={filters.search}
                                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={fetchPendingRequests}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-extrabold bg-blue-600 text-white hover:bg-blue-700 transition shadow-md active:scale-95"
                                >
                                    <Filter size={14} /> Filter Approvals
                                </button>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6">Requested Date</th>
                                            <th className="py-4 px-6">Voucher ID</th>
                                            <th className="py-4 px-6">Student Information</th>
                                            <th className="py-4 px-6">Course/Branch</th>
                                            <th className="py-4 px-6">Fee Head</th>
                                            <th className="py-4 px-6 text-right">Requested Amount</th>
                                            <th className="py-4 px-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {pendingRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="py-40 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-40">
                                                        <div className="bg-gray-100 p-6 rounded-full border-2 border-dashed border-gray-300 mb-4">
                                                            <Search size={40} className="text-gray-400" />
                                                        </div>
                                                        <h4 className="text-xl font-bold text-gray-800">No matching requests found</h4>
                                                        <p className="text-sm text-gray-500 mt-1">Try broadening your search or filters.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingRequests.map(group => (
                                                <tr key={group.voucherId || group.requests[0]._id} className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-0">
                                                    <td className="py-4 px-6">
                                                        <span className="text-xs font-bold text-gray-500">{new Date(group.createdAt).toLocaleDateString()}</span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[10px] font-black bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-800 w-fit">
                                                                #{group.voucherId || 'SINGLE'}
                                                            </span>
                                                            {group.isBulk && <span className="text-[9px] font-bold text-blue-600 mt-1 uppercase tracking-tighter">Bulk Request</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-800">
                                                                {group.requests.length === 1 ? group.requests[0].studentName : `${group.requests[0].studentName} + ${group.requests.length - 1} more`}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase">{group.requests[0].studentPin || group.requests[0].studentId}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-gray-700">{group.course}</span>
                                                            <span className="text-[10px] text-gray-400">{group.branch}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {group.feeHeads.length > 1 ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-tight w-fit">
                                                                    Mixed Heads ({group.feeHeads.length})
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 font-medium italic">Multiple components</span>
                                                            </div>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 uppercase tracking-tight">
                                                                {group.feeHeads[0]?.name || 'N/A'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="text-right">
                                                            <span className="text-sm font-black text-gray-900">₹{group.totalAmount.toLocaleString()}</span>
                                                            {group.isBulk && <div className="text-[10px] text-gray-400 font-bold">Total for {group.requests.length} students</div>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                            <button
                                                                onClick={() => openModal(group)}
                                                                className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm active:scale-95 ${filters.status === 'APPROVED' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                            >
                                                                {filters.status === 'APPROVED' ? 'Modify' : 'Review'}
                                                            </button>
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
                    <div className="flex-1 p-6 overflow-hidden flex flex-col max-w-[1700px] mx-auto w-full animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden h-full">
                            {/* Left: Add Form (Sidebar style) */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-fit">
                                    <div className="mb-6">
                                        <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-1">Add Authority</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Register new permission giver</p>
                                    </div>
                                    <form onSubmit={handleAddApprover} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block ml-1">Full Name</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50"
                                                value={newApprover.name}
                                                onChange={e => setNewApprover({...newApprover, name: e.target.value})}
                                                placeholder="e.g. Dr. Ramesh Babu"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block ml-1">Designation</label>
                                            <select 
                                                className="w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold text-gray-800 bg-gray-50/50 outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                                                value={newApprover.designation}
                                                onChange={e => setNewApprover({...newApprover, designation: e.target.value})}
                                                required
                                            >
                                                <option value="">-- Choose Role --</option>
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
                                            className="w-full bg-blue-600 text-white font-extrabold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 mt-2 flex items-center justify-center gap-2"
                                        >
                                            <Save size={16} /> Save Approver
                                        </button>
                                    </form>
                                    <div className="mt-8 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-[10px] text-indigo-700 leading-relaxed font-medium italic">
                                        <div className="font-bold mb-1 flex items-center gap-1"><Landmark size={12}/> Role Insight:</div>
                                        These authorities will appear in the "Concession Given By" dropdown on the Fee Collection page.
                                    </div>
                                </div>
                            </div>

                            {/* Center/Right: List */}
                            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                            <Users size={16} strokeWidth={3} />
                                        </div>
                                        <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider">Authority Database</h3>
                                    </div>
                                    <span className="text-[10px] text-blue-700 font-extrabold bg-blue-100 px-3 py-1 rounded-full border border-blue-200 uppercase tracking-widest">{approvers.length} Records</span>
                                </div>
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold sticky top-0 z-10">
                                            <tr>
                                                <th className="py-4 px-6">Person Name</th>
                                                <th className="py-4 px-6">Official Role</th>
                                                <th className="py-4 px-6">Availability</th>
                                                <th className="py-4 px-6 text-right">Management Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {approvers.map(a => (
                                                <tr key={a._id} className="hover:bg-gray-50/80 transition-all duration-200 group">
                                                    <td className="py-4 px-6 font-bold text-gray-800 text-sm flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[10px] text-gray-500 font-black uppercase">
                                                            {a.name.substring(0,2)}
                                                        </div>
                                                        {a.name}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{a.designation}</span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${a.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${a.isActive ? 'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                                                                {a.isActive ? 'Active' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-right space-x-2">
                                                        <button 
                                                            onClick={() => toggleApprover(a._id)}
                                                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${a.isActive ? 'border-orange-200 text-orange-600 bg-orange-50/50 hover:bg-orange-100':'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100'}`}
                                                        >
                                                            {a.isActive ? 'Turn Off' : 'Turn On'}
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteApprover(a._id)}
                                                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-100 transition-all"
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {approvers.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="py-40 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <div className="bg-gray-100 p-6 rounded-full border border-dashed border-gray-300 mb-4">
                                                                <Users size={40} className="text-gray-400" />
                                                            </div>
                                                            <h4 className="text-xl font-bold text-gray-800">No authorities defined</h4>
                                                            <p className="text-sm text-gray-500 mt-1">Add your first permission giver using the form on the left.</p>
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
                    <div className="flex-1 p-6 overflow-hidden flex flex-col max-w-[1700px] mx-auto w-full animate-fade-in">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                            {/* Toolbar (Filters) */}
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Calendar size={14} className="text-gray-400" />
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-[11px] font-black uppercase text-gray-700 focus:ring-0 cursor-pointer w-28 outline-none"
                                            value={reportFilters.startDate}
                                            onChange={e => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                                        />
                                        <span className="text-gray-300 mx-0.5">-</span>
                                        <input
                                            type="date"
                                            className="bg-transparent border-none p-0 text-[11px] font-black uppercase text-gray-700 focus:ring-0 cursor-pointer w-28 outline-none"
                                            value={reportFilters.endDate}
                                            onChange={e => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Users size={14} className="text-gray-400" />
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={reportFilters.concessionGivenBy}
                                            onChange={e => setReportFilters({ ...reportFilters, concessionGivenBy: e.target.value })}
                                        >
                                            <option value="">All Approvers</option>
                                            {approvers.map(a => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Landmark size={14} className="text-gray-400" />
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[140px] outline-none"
                                            value={reportFilters.college}
                                            onChange={e => setReportFilters({ ...reportFilters, college: e.target.value, course: '', branch: '' })}
                                        >
                                            <option value="">All Colleges</option>
                                            {collegeList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={reportFilters.course}
                                            onChange={e => setReportFilters({ ...reportFilters, course: e.target.value, branch: '' })}
                                        >
                                            <option value="">All Courses</option>
                                            {courseList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[120px] outline-none"
                                            value={reportFilters.branch}
                                            onChange={e => setReportFilters({ ...reportFilters, branch: e.target.value })}
                                        >
                                            <option value="">All Branches</option>
                                            {branchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer min-w-[100px] outline-none"
                                            value={reportFilters.batch}
                                            onChange={e => setReportFilters({ ...reportFilters, batch: e.target.value })}
                                        >
                                            <option value="">All Batches</option>
                                            {batchList.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <Filter size={14} className="text-gray-400" />
                                        <select
                                            className="bg-transparent border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer outline-none"
                                            value={reportFilters.status}
                                            onChange={e => setReportFilters({ ...reportFilters, status: e.target.value })}
                                        >
                                            <option value="ALL">All Statuses</option>
                                            <option value="APPROVED">Approved Only</option>
                                            <option value="PENDING">Pending Only</option>
                                            <option value="REJECTED">Rejected Only</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={fetchReports}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-extrabold bg-gray-800 text-white hover:bg-black transition shadow-md active:scale-95"
                                    >
                                        <Filter size={14} /> Update Report
                                    </button>
                                    
                                    {reportData.length > 0 && (
                                        <button
                                            onClick={handlePrint}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md active:scale-95"
                                        >
                                            <Printer size={14} /> Print Advice
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reports Table */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6">Entry Date</th>
                                            <th className="py-4 px-6">Voucher #</th>
                                            <th className="py-4 px-6">Student Detail</th>
                                            <th className="py-4 px-6">Fee Component</th>
                                            <th className="py-4 px-6 text-right">Net Amount</th>
                                            <th className="py-4 px-6">Approving Authority</th>
                                            <th className="py-4 px-6 text-right">Final Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {isReportLoading ? (
                                            <tr>
                                                <td colSpan="7" className="py-40 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-4">
                                                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-sm font-extrabold text-blue-600 uppercase tracking-widest animate-pulse">Syncing Audit Logs...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : reportData.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="py-40 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-40">
                                                        <div className="bg-gray-100 p-6 rounded-full border border-dashed border-gray-300 mb-4">
                                                            <Search size={40} className="text-gray-400" />
                                                        </div>
                                                        <h4 className="text-xl font-bold text-gray-800">No report data found</h4>
                                                        <p className="text-sm text-gray-500 mt-1">Adjust your date range or filters above.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            reportData.map(req => (
                                                <tr key={req._id} className="hover:bg-gray-50/80 transition-all duration-200">
                                                    <td className="py-4 px-6 text-sm font-bold text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                    <td className="py-4 px-6">
                                                        <span className="font-mono text-[10px] font-black bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-800">
                                                            #{req.voucherId || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-gray-800 text-sm italic">{req.studentName}</div>
                                                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{req.studentPin || req.studentId}</div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{req.feeHead?.name}</span>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm font-black text-gray-900 text-right">
                                                        ₹{req.amount.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                                            <span className="text-xs font-bold text-purple-700">{req.concessionGivenBy || 'Not Specified'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-gray-100 ${req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}>
                                                            {req.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {!isReportLoading && reportData.length > 0 && (
                                        <tfoot className="bg-gray-50/50 border-t-2 border-gray-200">
                                            <tr>
                                                <td colSpan="4" className="py-5 px-6 text-right font-black text-gray-500 text-[10px] uppercase tracking-[0.2em]">Grand Aggregate Totals</td>
                                                <td className="py-5 px-6 text-right">
                                                    <span className="text-xl font-black text-blue-900 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
                                                        ₹{reportData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td colSpan="2" className="py-5 px-6"></td>
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
                        <div className={`bg-white rounded-xl shadow-2xl ${selectedRequest.isBulk ? 'max-w-3xl' : 'max-w-lg'} w-full p-6 animate-fade-in flex flex-col max-h-[90vh]`}>
                            <div className="flex justify-between items-start mb-4 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {selectedRequest.requests[0].status === 'APPROVED' ? 'Modify Approved' : selectedRequest.isBulk ? 'Bulk Concession Review' : 'Request Details'}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        {selectedRequest.requests[0].status === 'APPROVED' ? 'Adjust concession amounts for finalized request' : selectedRequest.isBulk ? `Processing requests for ${selectedRequest.requests.length} students` : 'Review concession application'}
                                    </p>
                                </div>
                                <button onClick={closeModal} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition"><X size={16} className="text-gray-600" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                {!selectedRequest.isBulk ? (
                                    // SINGLE REQUEST DISPLAY
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase font-bold">Student</label>
                                            <div className="font-semibold text-gray-800">{selectedRequest.requests[0].studentName}</div>
                                            <div className="text-xs text-gray-500">{selectedRequest.requests[0].studentPin || selectedRequest.requests[0].studentId}</div>
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
                                            <div className="font-bold text-blue-600 text-lg">₹{selectedRequest.totalAmount.toLocaleString()}</div>
                                        </div>
                                    </div>
                                ) : (
                                    // BULK REQUEST DISPLAY (Student List)
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                            <div>
                                                <label className="text-xs text-gray-400 uppercase font-bold">Voucher #</label>
                                                <div className="font-mono font-bold text-blue-600">#{selectedRequest.voucherId}</div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 uppercase font-bold">Fee Head</label>
                                                <div className="font-semibold text-gray-800">{selectedRequest.feeHead?.name}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="border rounded-lg overflow-hidden bg-white">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-gray-100 uppercase text-[9px] font-black tracking-wider text-gray-500">
                                                    <tr>
                                                        <th className="p-3">Student Name / PIN</th>
                                                        <th className="p-3">Fee Component</th>
                                                        <th className="p-3">Requested</th>
                                                        <th className="p-3 text-right">Approved Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedRequest.requests.map(r => (
                                                        <tr key={r._id} className="hover:bg-gray-50 transition">
                                                            <td className="p-3">
                                                                <div className="font-bold text-gray-800">{r.studentName}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono uppercase">{r.studentPin || r.studentId}</div>
                                                            </td>
                                                            <td className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                                                {r.feeHead?.name || 'General'}
                                                            </td>
                                                            <td className="p-3 font-bold text-gray-600">₹{r.amount.toLocaleString()}</td>
                                                            <td className="p-3 text-right">
                                                                <input
                                                                    type="number"
                                                                    className="w-24 border border-gray-200 p-1.5 rounded font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none text-right"
                                                                    value={bulkAmounts[r._id] || ''}
                                                                    onChange={e => setBulkAmounts({...bulkAmounts, [r._id]: e.target.value})}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50 font-bold border-t">
                                                    <tr>
                                                        <td className="p-3" colSpan="2">Grand Total</td>
                                                        <td className="p-3">₹{selectedRequest.totalAmount.toLocaleString()}</td>
                                                        <td className="p-3 text-blue-600 text-right">
                                                            ₹{Object.values(bulkAmounts).reduce((sum, val) => sum + (Number(val) || 0), 0).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-tight">Reason / Justification</label>
                                    <div className="text-sm text-gray-700 bg-white border p-3 rounded-lg italic">"{selectedRequest.reason}"</div>
                                </div>

                                {selectedRequest.requests[0].imageUrl && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-tight">Proof Document</label>
                                        <a href={selectedRequest.requests[0].imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-50 transition group cursor-pointer">
                                            <div className="bg-gray-200 p-2 rounded"><Upload size={16} className="text-gray-600" /></div>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-blue-600 underline decoration-dotted group-hover:text-blue-800">View Document</div>
                                                <div className="text-xs text-gray-400">Click to open in new tab</div>
                                            </div>
                                        </a>
                                    </div>
                                )}

                                {/* Approval Action Inputs */}
                                {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) && (
                                    <div className="pt-4 border-t space-y-3">
                                        {!selectedRequest.isBulk && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Approval Amount</label>
                                                <input
                                                    type="number"
                                                    className="w-full border p-2.5 rounded-lg font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50"
                                                    value={modalAmount}
                                                    onChange={e => setModalAmount(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rejection Remarks (If rejecting)</label>
                                            <textarea
                                                className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-gray-50/50"
                                                placeholder="Clarification or reason for rejection..."
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t shrink-0 flex gap-3">
                                {(isSuperAdmin || (user?.permissions || []).includes('concession_approvals')) ? (
                                    selectedRequest.requests[0].status === 'PENDING' ? (
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
                                    ) : selectedRequest.requests[0].status === 'APPROVED' ? (
                                        <button
                                            onClick={() => handleApprovalAction('APPROVE')}
                                            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition flex justify-center items-center gap-2 active:scale-95"
                                            disabled={approvalLoading}
                                        >
                                            {approvalLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
                                            Update Approved Concession
                                        </button>
                                    ) : (
                                        <button onClick={closeModal} className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200">Close</button>
                                    )
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-200">Close</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* Hidden Print Component */}
                <div style={{ display: 'none' }}>
                    <ConcessionReportPrint ref={reportPrintRef} data={reportData} filters={reportFilters} />
                </div>
            </div>
        </div>
    );
};

export default ConcessionManagement;
