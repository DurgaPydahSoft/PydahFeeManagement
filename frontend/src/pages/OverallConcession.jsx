import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';
import { Search, Filter, Trash2, Plus, User, Award, ShieldAlert, Check, Eye, Clock, CheckCircle, XCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Status badge helper ───────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        PENDING:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock size={11} />,        label: 'Pending'  },
        APPROVED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={11} />, label: 'Approved' },
        REJECTED: { cls: 'bg-rose-50 text-rose-700 border-rose-200',      icon: <XCircle size={11} />,      label: 'Rejected' }
    };
    const { cls, icon, label } = map[status] || map.PENDING;
    return (
        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cls}`}>
            {icon}{label}
        </span>
    );
};

const OverallConcession = () => {
    const user        = JSON.parse(localStorage.getItem('user')) || {};
    const permissions = user.permissions || [];
    const role        = user.role;
    const isAdminRole = role === 'superadmin' || role === 'admin';
    const hasPermission = isAdminRole || permissions.includes('/overall-concessions');

    // ── filter metadata ──────────────────────────────────────────────────
    const [metadata,    setMetadata]    = useState({});
    const [colleges,    setColleges]    = useState([]);
    const [courses,     setCourses]     = useState([]);
    const [branches,    setBranches]    = useState([]);
    const [batches,     setBatches]     = useState([]);
    const [feeHeads,    setFeeHeads]    = useState([]);
    const [courseYears, setCourseYears] = useState({});
    // ── filters & student list ───────────────────────────────────────────
    const [filters,     setFilters]     = useState({ college: '', course: '', branch: '', batch: '' });
    const [searchTerm,  setSearchTerm]  = useState('');
    const [students,    setStudents]    = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // ── selected student & form state ────────────────────────────────────
    const [selectedStudent,  setSelectedStudent]  = useState(null);
    const [activeEditHeads,  setActiveEditHeads]  = useState([]);
    const [draftAmounts,     setDraftAmounts]     = useState({});
    const [concessionTypes,  setConcessionTypes]  = useState({});
    const [selectedNewHead,  setSelectedNewHead]  = useState('');
    const [isSaving,         setIsSaving]         = useState(false);
    const [successMessage,   setSuccessMessage]   = useState('');
    const [errorMessage,     setErrorMessage]     = useState('');
    const [isFormDirty,      setIsFormDirty]      = useState(false);
    const formDirtyRef = useRef(false);

    // ── tabs ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('add'); // 'add' | 'view' | 'requests'

    // ── requests tab state ───────────────────────────────────────────────
    const [requests,          setRequests]          = useState([]);
    const [requestsLoading,   setRequestsLoading]   = useState(false);
    const [reqStatusFilter,   setReqStatusFilter]   = useState('PENDING');
    const [expandedRequestId, setExpandedRequestId] = useState(null);
    // per-request approve modal state
    const [approvingId,       setApprovingId]       = useState(null);
    const [approveBusy,       setApproveBusy]       = useState(false);
    // per-request reject state
    const [rejectingId,       setRejectingId]       = useState(null);
    const [rejectReason,      setRejectReason]      = useState('');
    const [rejectBusy,        setRejectBusy]        = useState(false);

    // ── pending requests map (admissionNumber → true) for badge ──────────
    const [pendingAdmSet, setPendingAdmSet] = useState(new Set());

    // ── helpers ──────────────────────────────────────────────────────────
    const markFormDirty = () => { formDirtyRef.current = true;  setIsFormDirty(true);  };
    const markFormClean = () => { formDirtyRef.current = false; setIsFormDirty(false); };

    const normalizeConcessionType = (type) =>
        String(type ?? 'CONCESSION').trim().toUpperCase() === 'REVISED' ? 'REVISED' : 'CONCESSION';
    const normalizeFeeHeadId = (id) => String(id ?? '').trim();
    const getRowConcessionType = (fhId) =>
        normalizeConcessionType(concessionTypes[normalizeFeeHeadId(fhId)] || 'CONCESSION');

    const resolveRevisedFeeHeadId = useCallback((rf) => {
        const directId = normalizeFeeHeadId(rf.feeHeadId);
        if (directId) {
            const matched = feeHeads.find(h => normalizeFeeHeadId(h._id) === directId);
            return matched ? normalizeFeeHeadId(matched._id) : directId;
        }
        const code = (rf.feeHeadCode || '').trim().toUpperCase();
        if (!code) return '';
        const byCode = feeHeads.find(h => (h.code || '').trim().toUpperCase() === code);
        return byCode ? normalizeFeeHeadId(byCode._id) : '';
    }, [feeHeads]);

    const buildDraftKey = (feeHeadId, studentYear) =>
        `${normalizeFeeHeadId(feeHeadId)}_${Number(studentYear)}`;

    const getConcessionDisplayAmount = (rf) => {
        const raw = rf?.amount ?? rf?.revisedAmount;
        if (raw === undefined || raw === null || raw === '') return '';
        return String(raw);
    };

    const getFeeHeadName = (id, code = '') => {
        let fh = feeHeads.find(h => normalizeFeeHeadId(h._id) === normalizeFeeHeadId(id));
        if (!fh && code) fh = feeHeads.find(h => h.code === code);
        return fh ? fh.name : (code || 'Unknown Fee Component');
    };

    const getYearSuffix = (yr) => {
        if (yr === 1) return '1st'; if (yr === 2) return '2nd';
        if (yr === 3) return '3rd'; return `${yr}th`;
    };

    const applyStudentConcessionsToForm = useCallback((student) => {
        if (!student) return;
        const revisedFees = student.revisedFees || [];
        const headIds = []; const initialDrafts = {}; const initialTypes = {};
        revisedFees.forEach(rf => {
            const fhId = resolveRevisedFeeHeadId(rf);
            if (!fhId) return;
            if (!headIds.includes(fhId)) headIds.push(fhId);
            initialTypes[fhId] = normalizeConcessionType(rf.concessionType);
            const amountStr = getConcessionDisplayAmount(rf);
            if (amountStr !== '') initialDrafts[buildDraftKey(fhId, rf.studentYear)] = amountStr;
        });
        setActiveEditHeads(headIds);
        setDraftAmounts(initialDrafts);
        setConcessionTypes(initialTypes);
        markFormClean();
    }, [resolveRevisedFeeHeadId]);

    // ── initial data load ────────────────────────────────────────────────
    useEffect(() => {
        if (!hasPermission) return;
        const fetchInitialData = async () => {
            try {
                const calls = [api.get('/students/metadata'), api.get('/fee-heads')];
                const [metaRes, headsRes] = await Promise.all(calls);
                const meta = metaRes.data.hierarchy || metaRes.data;
                setMetadata(meta);
                setColleges(Object.keys(meta));
                setBatches(metaRes.data.batches || []);
                setFeeHeads(headsRes.data || []);
                setCourseYears(metaRes.data.courseYears || {});            } catch (err) { console.error('Error fetching initial data', err); }
        };
        fetchInitialData();
    }, [hasPermission, isAdminRole]);

    useEffect(() => {
        if (!selectedStudent || formDirtyRef.current) return;
        applyStudentConcessionsToForm(selectedStudent);
    }, [selectedStudent?.admission_number, selectedStudent?.revisedFees, feeHeads.length, applyStudentConcessionsToForm]);

    // ── fetch requests (for requests tab) ────────────────────────────────
    const fetchRequests = useCallback(async () => {
        if (!isAdminRole) return;
        setRequestsLoading(true);
        try {
            const res = await api.get('/overall-concessions/requests', {
                params: { status: reqStatusFilter || undefined }
            });
            setRequests(res.data);
            // Build pending set for badge
            if (reqStatusFilter === 'PENDING' || reqStatusFilter === '') {
                const pending = new Set(res.data.filter(r => r.status === 'PENDING').map(r => r.admissionNumber));
                setPendingAdmSet(pending);
            }
        } catch (err) { console.error('Error fetching requests', err); }
        finally { setRequestsLoading(false); }
    }, [isAdminRole, reqStatusFilter]);

    useEffect(() => {
        if (activeTab === 'requests') fetchRequests();
    }, [activeTab, fetchRequests]);

    // also load pending set on mount for badge in Add/Manage tab
    useEffect(() => {
        if (!isAdminRole) return;
        api.get('/overall-concessions/requests', { params: { status: 'PENDING' } })
            .then(res => setPendingAdmSet(new Set(res.data.map(r => r.admissionNumber))))
            .catch(() => {});
    }, [isAdminRole]);

    // ── access denied screen ─────────────────────────────────────────────
    if (!hasPermission) {
        return (
            <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert size={40} className="text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            You don't have the required permissions to view or manage Overall Concessions.
                        </p>
                        <button onClick={() => window.history.back()}
                            className="mt-8 w-full py-3 px-6 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg cursor-pointer">
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── filter cascade ───────────────────────────────────────────────────
    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFilters({ ...filters, college, course: '', branch: '' });
        setCourses(college ? Object.keys(metadata[college] || {}) : []);
        setBranches([]);
    };
    const handleCourseChange = (e) => {
        const course = e.target.value;
        setFilters({ ...filters, course, branch: '' });
        if (course && filters.college) setBranches(metadata[filters.college][course]?.branches || []);
        else setBranches([]);
    };

    // ── fetch students ───────────────────────────────────────────────────
    const fetchStudents = async () => {
        const hasFilters = filters.college && filters.course && filters.branch && filters.batch;
        if (!hasFilters && !searchTerm.trim()) {
            alert('Please select all filters or enter a search query.');
            return;
        }
        setLoading(true); setHasSearched(true); setSelectedStudent(null);
        try {
            const res = await api.get('/overall-concessions', { params: { ...filters, search: searchTerm } });
            setStudents(res.data);
        } catch { alert('Failed to load students.'); }
        finally { setLoading(false); }
    };

    // ── select a student ─────────────────────────────────────────────────
    const handleSelectStudent = (student) => {
        markFormClean();
        setSelectedStudent(student);
        setSuccessMessage(''); setErrorMessage(''); setSelectedNewHead('');
        applyStudentConcessionsToForm(student);
    };

    // ── form interactions ────────────────────────────────────────────────
    const handleAddEditHead = () => {
        if (!selectedNewHead) return;
        const fhId = normalizeFeeHeadId(selectedNewHead);
        if (!activeEditHeads.includes(fhId)) {
            setActiveEditHeads([...activeEditHeads, fhId]);
            setConcessionTypes(prev => ({ ...prev, [fhId]: 'CONCESSION' }));
        }
        markFormDirty(); setSelectedNewHead('');
    };

    const handleConcessionTypeChange = (fhId, type) => {
        markFormDirty();
        setConcessionTypes(prev => ({ ...prev, [normalizeFeeHeadId(fhId)]: normalizeConcessionType(type) }));
    };

    const handleAmountChange = (feeHeadId, year, val) => {
        markFormDirty();
        setDraftAmounts({ ...draftAmounts, [buildDraftKey(feeHeadId, year)]: val });
    };

    const duration   = (selectedStudent?.course && courseYears[selectedStudent.course]) || 4;
    const yearsArray = Array.from({ length: duration }, (_, i) => i + 1);

    const buildConcessionsPayload = (heads, drafts, types) => {
        const payload = [];
        heads.forEach(fhId => {
            const fh    = feeHeads.find(h => normalizeFeeHeadId(h._id) === normalizeFeeHeadId(fhId));
            const fhCode = fh ? fh.code : '';
            const cType  = normalizeConcessionType(types[normalizeFeeHeadId(fhId)] || 'CONCESSION');
            yearsArray.forEach(yr => {
                const val = drafts[buildDraftKey(fhId, yr)];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    payload.push({ feeHeadId: fhId, feeHeadCode: fhCode, studentYear: yr, semester: null, amount: Number(val), concessionType: cType });
                }
            });
        });
        return payload;
    };

    // ── submit for approval (replaces direct bulk save) ──────────────────
    const handleSubmitForApproval = async () => {
        if (!selectedStudent) return;
        const payload = buildConcessionsPayload(activeEditHeads, draftAmounts, concessionTypes);
        if (payload.length === 0) {
            setErrorMessage('Add at least one fee component with an amount before submitting.');
            return;
        }
        setIsSaving(true); setSuccessMessage(''); setErrorMessage('');
        try {
            await api.post('/overall-concessions/request', {
                admissionNumber: selectedStudent.admission_number,
                pinNo:           selectedStudent.pin_no,
                studentName:     selectedStudent.student_name,
                college:         selectedStudent.college,
                course:          selectedStudent.course,
                branch:          selectedStudent.branch,
                batch:           selectedStudent.batch,
                category:        selectedStudent.stud_type,
                concessions:     payload
            });
            setSuccessMessage('Request submitted for approval successfully!');
            markFormClean();
            // update pending badge set
            setPendingAdmSet(prev => new Set([...prev, selectedStudent.admission_number]));
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── remove a fee head (still calls bulk directly to restore standard) ─
    const handleRemoveEditHead = async (fhId) => {
        if (!selectedStudent) return;
        if (!window.confirm('Remove this fee component and restore its standard fee amounts?')) return;
        const normalizedId = normalizeFeeHeadId(fhId);
        const nextHeads    = activeEditHeads.filter(id => normalizeFeeHeadId(id) !== normalizedId);
        const updatedDrafts = { ...draftAmounts };
        Object.keys(updatedDrafts).forEach(k => { if (k.startsWith(`${normalizedId}_`)) delete updatedDrafts[k]; });
        const nextTypes = { ...concessionTypes }; delete nextTypes[normalizedId];
        setActiveEditHeads(nextHeads); setDraftAmounts(updatedDrafts); setConcessionTypes(nextTypes);
        setIsSaving(true); setSuccessMessage(''); setErrorMessage('');
        try {
            const res = await api.post('/overall-concessions/bulk', {
                admissionNumber: selectedStudent.admission_number,
                pinNo: selectedStudent.pin_no, studentName: selectedStudent.student_name,
                college: selectedStudent.college, course: selectedStudent.course,
                branch: selectedStudent.branch,  batch: selectedStudent.batch,
                category: selectedStudent.stud_type,
                concessions: buildConcessionsPayload(nextHeads, updatedDrafts, nextTypes)
            });
            const updated = { ...selectedStudent, revisedFees: res.data.revisedFees };
            setSelectedStudent(updated); markFormClean(); applyStudentConcessionsToForm(updated);
            setStudents(students.map(s => s.admission_number === selectedStudent.admission_number ? updated : s));
            setSuccessMessage('Fee component removed and standard fees restored.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Failed to remove fee component.');
            applyStudentConcessionsToForm(selectedStudent);
        } finally { setIsSaving(false); }
    };

    // ── approve a request ─────────────────────────────────────────────────
    const handleApprove = async (requestId) => {
        setApproveBusy(true);
        try {
            await api.put(`/overall-concessions/requests/${requestId}/approve`, {});
            setApprovingId(null);
            // refresh requests list and update pending set
            await fetchRequests();
            setSuccessMessage('Request approved and fees updated!');
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            const data = err.response?.data;
            const warningText = Array.isArray(data?.warnings) && data.warnings.length
                ? data.warnings.join(' ')
                : '';
            setErrorMessage(warningText || data?.message || 'Failed to approve request.');
            setTimeout(() => setErrorMessage(''), 8000);
        } finally { setApproveBusy(false); }
    };

    // ── reject a request ──────────────────────────────────────────────────
    const handleReject = async (requestId) => {
        if (!rejectReason.trim()) { alert('Please enter a rejection reason.'); return; }
        setRejectBusy(true);
        try {
            await api.put(`/overall-concessions/requests/${requestId}/reject`, { rejectionReason: rejectReason });
            setRejectingId(null); setRejectReason('');
            await fetchRequests();
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Failed to reject request.');
        } finally { setRejectBusy(false); }
    };

    // ════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════
    return (
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">

                    {/* ── Header ── */}
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Award className="text-blue-600" size={26} /> Overall Concessions (Revised Fees)
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Set year-wise revised fee structures directly for specific students.</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-slate-200/80 p-1 rounded-xl border border-slate-300/40 shrink-0">
                            <button onClick={() => setActiveTab('add')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                                <Plus size={14} /> Add / Manage
                            </button>
                            <button onClick={() => setActiveTab('view')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === 'view' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                                <Eye size={14} /> View Overview
                            </button>
                            {isAdminRole && (
                                <button onClick={() => setActiveTab('requests')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === 'requests' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                                    <Clock size={14} /> Requests
                                    {pendingAdmSet.size > 0 && (
                                        <span className="bg-amber-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                                            {pendingAdmSet.size}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </header>

                    {/* ── Filter Bar (shown on add + view tabs) ── */}
                    {activeTab !== 'requests' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
                            <div className="flex flex-col xl:flex-row gap-4 items-end">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto flex-1">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">College</label>
                                        <select className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            value={filters.college} onChange={handleCollegeChange}>
                                            <option value="">Select College</option>
                                            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Course</label>
                                        <select className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            value={filters.course} onChange={handleCourseChange} disabled={!filters.college}>
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch</label>
                                        <select className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            value={filters.batch} onChange={e => setFilters({ ...filters, batch: e.target.value })}>
                                            <option value="">Select Batch</option>
                                            {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Branch</label>
                                        <select className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            value={filters.branch} onChange={e => setFilters({ ...filters, branch: e.target.value })} disabled={!filters.course}>
                                            <option value="">Select Branch</option>
                                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full xl:w-auto">
                                    <div className="relative flex-1 xl:w-64">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <Search size={14} className="text-slate-400" />
                                        </div>
                                        <input type="text"
                                            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2.5"
                                            placeholder="Quick Search (Name/Adm/Pin)..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && fetchStudents()} />
                                    </div>
                                    <button onClick={fetchStudents} disabled={loading}
                                        className="text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-lg text-xs px-5 py-2.5 transition flex items-center justify-center gap-2 whitespace-nowrap shadow-sm">
                                        <Filter size={14} /> {loading ? 'Searching...' : 'Load Students'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════
                        ADD / MANAGE TAB
                    ══════════════════════════════════════════════════ */}
                    {activeTab === 'add' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                            {/* Student Roster */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                                    <h2 className="text-sm font-bold text-slate-800">Matching Students</h2>
                                </div>
                                <div className="overflow-y-auto flex-1 max-h-[600px] divide-y divide-slate-100">
                                    {loading ? (
                                        <div className="text-center py-20 text-slate-400 italic">Querying SQL database...</div>
                                    ) : students.length === 0 ? (
                                        <div className="text-center py-24 text-slate-400 p-6">
                                            {hasSearched ? 'No active regular students found matching criteria.' : 'Select filters and click Load Students.'}
                                        </div>
                                    ) : (
                                        students.map(s => {
                                            const isSelected = selectedStudent?.admission_number === s.admission_number;
                                            const hasPending  = pendingAdmSet.has(s.admission_number);
                                            return (
                                                <div key={s.admission_number} onClick={() => handleSelectStudent(s)}
                                                    className={`p-4 hover:bg-blue-50/50 cursor-pointer transition-all duration-150 flex items-start gap-3 ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600 pl-3' : ''}`}>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                                        {s.student_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-slate-900 text-sm truncate">{s.student_name}</div>
                                                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                                                            <span>Pin: <b>{s.pin_no}</b></span>
                                                            <span>•</span>
                                                            <span>Adm: {s.admission_number}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                            <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">{s.course}</span>
                                                            <span className="bg-slate-50 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate max-w-[100px]">{s.branch}</span>
                                                            {s.revisedFees?.length > 0 && (
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 text-[10px] font-extrabold">{s.revisedFees.length} Revised</span>
                                                            )}
                                                            {hasPending && (
                                                                <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 text-[10px] font-extrabold flex items-center gap-0.5">
                                                                    <Clock size={9} /> Pending
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right panel: concession editor */}
                            <div className="lg:col-span-3 space-y-6">
                                {selectedStudent ? (
                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6 animate-fadeIn">

                                        {/* Student card */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-900">{selectedStudent.student_name}</h2>
                                                    <p className="text-xs text-slate-500">
                                                        PIN: <span className="font-semibold text-slate-700 mr-2">{selectedStudent.pin_no}</span>
                                                        Adm No: <span className="font-semibold text-slate-700">{selectedStudent.admission_number}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.batch} Batch</span>
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.course}</span>
                                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.stud_type}</span>
                                            </div>
                                        </div>

                                        {/* Alerts */}
                                        {successMessage && (
                                            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-semibold">
                                                <Check size={16} /> {successMessage}
                                            </div>
                                        )}
                                        {errorMessage && (
                                            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-2 text-sm font-semibold">
                                                <ShieldAlert size={16} /> {errorMessage}
                                            </div>
                                        )}

                                        {/* Fee component editor */}
                                        <div className="border-t border-slate-100 pt-6 space-y-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <h3 className="text-sm font-bold text-slate-800">Set Revised Fee (Concession)</h3>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <select className="border border-slate-300 rounded-lg p-2 bg-slate-50 focus:ring-blue-500 focus:border-blue-500"
                                                        value={selectedNewHead} onChange={e => setSelectedNewHead(e.target.value)}>
                                                        <option value="">Select Fee Component to Add...</option>
                                                        {feeHeads.filter(fh => !activeEditHeads.includes(normalizeFeeHeadId(fh._id))).map(fh => (
                                                            <option key={fh._id} value={normalizeFeeHeadId(fh._id)}>{fh.name} ({fh.code || 'N/A'})</option>
                                                        ))}
                                                    </select>
                                                    <button type="button" onClick={handleAddEditHead} disabled={!selectedNewHead}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0">
                                                        <Plus size={14} /> Add Component
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {activeEditHeads.length === 0 ? (
                                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs italic bg-white">
                                                        No fee components added yet. Select a component above and click "Add Component".
                                                    </div>
                                                ) : (
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                                        <div className="overflow-x-auto w-full">
                                                            <table className="w-full text-xs text-left border-collapse table-fixed">
                                                                <colgroup>
                                                                    <col className="w-[168px]" /><col className="w-[118px]" />
                                                                    {yearsArray.map(yr => <col key={yr} />)}
                                                                    <col className="w-12" />
                                                                </colgroup>
                                                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold text-[10px] uppercase">
                                                                    <tr>
                                                                        <th className="px-3 py-3 text-left">Fee Component</th>
                                                                        <th className="px-2 py-3 text-center">Type</th>
                                                                        {yearsArray.map(yr => <th key={yr} className="px-2 py-3 text-center">{getYearSuffix(yr)} Year (₹)</th>)}
                                                                        <th className="px-2 py-3 text-center">Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                                                    {activeEditHeads.map(fhId => {
                                                                        const matchingFee = selectedStudent?.revisedFees?.find(rf => resolveRevisedFeeHeadId(rf) === normalizeFeeHeadId(fhId));
                                                                        const headCode = matchingFee ? matchingFee.feeHeadCode : '';
                                                                        const headName = getFeeHeadName(fhId, headCode);
                                                                        const rowType  = getRowConcessionType(fhId);
                                                                        return (
                                                                            <tr key={fhId} className="hover:bg-slate-50/20">
                                                                                <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{headName}</td>
                                                                                <td className="px-2 py-3">
                                                                                    <div className="flex justify-center">
                                                                                        <select value={rowType} onChange={e => handleConcessionTypeChange(fhId, e.target.value)}
                                                                                            className="w-[112px] border border-slate-300 rounded-lg p-1.5 bg-slate-50 text-xs font-semibold">
                                                                                            <option value="REVISED">Revised Fee</option>
                                                                                            <option value="CONCESSION">Concession</option>
                                                                                        </select>
                                                                                    </div>
                                                                                </td>
                                                                                {yearsArray.map(yr => (
                                                                                    <td key={yr} className="px-2 py-3 text-center">
                                                                                        <div className="relative w-full max-w-[120px] mx-auto">
                                                                                            <span className="absolute left-2.5 top-2 text-slate-400 font-medium">₹</span>
                                                                                            <input type="number" placeholder={rowType === 'CONCESSION' ? 'Deduction' : 'Revised fee'}
                                                                                                value={draftAmounts[buildDraftKey(fhId, yr)] || ''}
                                                                                                onChange={e => handleAmountChange(fhId, yr, e.target.value)}
                                                                                                className="w-full border border-slate-300 pl-6 pr-2 py-1.5 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500 text-xs font-semibold" />
                                                                                        </div>
                                                                                    </td>
                                                                                ))}
                                                                                <td className="px-2 py-3 text-center">
                                                                                    <button type="button" onClick={() => handleRemoveEditHead(fhId)} disabled={isSaving}
                                                                                        className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition disabled:opacity-40" title="Remove component">
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Submit for Approval button */}
                                            {(activeEditHeads.length > 0 || isFormDirty) && (
                                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                                    <button type="button" onClick={handleSubmitForApproval} disabled={isSaving}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 text-xs">
                                                        <Send size={14} />
                                                        {isSaving ? 'Submitting...' : 'Submit for Approval'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-slate-400 min-h-[500px] flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                                            <User size={32} className="text-slate-300" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-700">No Student Selected</h3>
                                            <p className="text-xs mt-1 max-w-sm mx-auto">Select a student from the left panel to define revised fee components.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════
                        VIEW OVERVIEW TAB
                    ══════════════════════════════════════════════════ */}
                    {activeTab === 'view' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-800">Concessions Overview Roster</h2>
                                <span className="text-xs text-slate-500 font-semibold">{students.length} Students Loaded</span>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold text-[10px] uppercase">
                                        <tr>
                                            <th className="p-4 w-3/12">Student Info</th>
                                            <th className="p-4 w-5/12">Revised Fees</th>
                                            <th className="p-4 w-2/12">College / Batch</th>
                                            <th className="p-4 w-2/12">Course / Branch</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="4" className="text-center py-20 text-slate-400 italic">Querying SQL database...</td></tr>
                                        ) : students.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-24 text-slate-400 p-6">
                                                {hasSearched ? 'No active regular students found matching criteria.' : 'Select filters and click Load Students.'}
                                            </td></tr>
                                        ) : (
                                            students.map(s => {
                                                const grouped = {};
                                                (s.revisedFees || []).forEach(rf => {
                                                    const fhId = resolveRevisedFeeHeadId(rf) || normalizeFeeHeadId(rf.feeHeadId);
                                                    if (!fhId) return;
                                                    if (!grouped[fhId]) grouped[fhId] = [];
                                                    grouped[fhId].push(rf);
                                                });
                                                const hasConcessions = Object.keys(grouped).length > 0;
                                                return (
                                                    <tr key={s.admission_number} className="hover:bg-slate-50/30">
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-900 text-sm">{s.student_name}</div>
                                                            <div className="text-slate-500 mt-0.5 font-medium">Pin: <span className="font-semibold text-slate-700">{s.pin_no}</span> | Adm: {s.admission_number}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            {hasConcessions ? (
                                                                <div className="space-y-2">
                                                                    {Object.entries(grouped).map(([fhId, items]) => (
                                                                        <div key={fhId} className="flex flex-col sm:flex-row sm:items-start gap-2">
                                                                            <span className="font-bold text-slate-700 bg-slate-100 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide inline-block shrink-0 mt-0.5">
                                                                                {getFeeHeadName(fhId, items[0]?.feeHeadCode)}:
                                                                            </span>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {items.map(rf => (
                                                                                    <span key={rf.id} className={`border rounded px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${rf.concessionType === 'CONCESSION' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                                        Yr {rf.studentYear}: {rf.concessionType === 'CONCESSION' ? '-' : ''}₹{(rf.amount ?? rf.revisedAmount ?? 0).toLocaleString()} {rf.concessionType === 'CONCESSION' ? '(Conc.)' : '(Revised)'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 font-bold text-sm">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-semibold text-slate-800 uppercase">{s.college}</div>
                                                            <div className="text-slate-500 mt-0.5">{s.batch} Batch</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-semibold text-slate-800 uppercase">{s.course}</div>
                                                            <div className="text-slate-500 mt-0.5 truncate max-w-[180px]">{s.branch}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════
                        REQUESTS TAB (admin/superadmin only)
                    ══════════════════════════════════════════════════ */}
                    {activeTab === 'requests' && isAdminRole && (
                        <div className="space-y-4 animate-fadeIn">

                            {/* alerts inside requests tab */}
                            {successMessage && (
                                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-semibold">
                                    <Check size={16} /> {successMessage}
                                </div>
                            )}
                            {errorMessage && (
                                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-2 text-sm font-semibold">
                                    <ShieldAlert size={16} /> {errorMessage}
                                </div>
                            )}

                            {/* Status filter */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter by Status:</span>
                                {['PENDING', 'APPROVED', 'REJECTED', ''].map(s => (
                                    <button key={s || 'ALL'} onClick={() => { setReqStatusFilter(s); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${reqStatusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                                        {s || 'All'}
                                    </button>
                                ))}
                                <button onClick={fetchRequests} disabled={requestsLoading}
                                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1">
                                    <Filter size={12} /> {requestsLoading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>

                            {/* Requests list */}
                            {requestsLoading ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 italic">Loading requests...</div>
                            ) : requests.length === 0 ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                                    No requests found for the selected filter.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {requests.map(req => {
                                        const isExpanded  = expandedRequestId === req._id;
                                        const isApprovingThis = approvingId === req._id;
                                        const isRejectingThis = rejectingId === req._id;
                                        return (
                                            <div key={req._id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                                                {/* Request header row */}
                                                <div className="p-4 flex flex-wrap items-start gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-900 text-sm">{req.studentName}</span>
                                                            <StatusBadge status={req.status} />
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            Adm: <b>{req.admissionNumber}</b> &nbsp;|&nbsp;
                                                            Pin: <b>{req.pinNo}</b> &nbsp;|&nbsp;
                                                            {req.course} — {req.branch} &nbsp;|&nbsp;
                                                            Batch: <b>{req.batch}</b>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-1">
                                                            Requested by <b>{req.requestedByName || req.requestedBy}</b> on {new Date(req.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                        </div>
                                                        {req.status === 'APPROVED' && (
                                                            <div className="text-[10px] text-emerald-600 mt-0.5">
                                                                Approved by <b>{req.approvedByName || req.approvedBy}</b>
                                                            </div>
                                                        )}
                                                        {req.status === 'REJECTED' && (
                                                            <div className="text-[10px] text-rose-600 mt-0.5">
                                                                Rejected by <b>{req.approvedByName || req.approvedBy}</b>
                                                                {req.rejectionReason && <> — "{req.rejectionReason}"</>}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Action buttons (PENDING only) */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {req.status === 'PENDING' && (
                                                            <>
                                                                <button onClick={() => { setApprovingId(isApprovingThis ? null : req._id); setRejectingId(null); }}
                                                                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm">
                                                                    <CheckCircle size={13} /> Approve
                                                                </button>
                                                                <button onClick={() => { setRejectingId(isRejectingThis ? null : req._id); setApprovingId(null); }}
                                                                    className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm">
                                                                    <XCircle size={13} /> Reject
                                                                </button>
                                                            </>
                                                        )}
                                                        <button onClick={() => setExpandedRequestId(isExpanded ? null : req._id)}
                                                            className="px-2 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition flex items-center gap-1">
                                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Approve inline form */}
                                                {isApprovingThis && (
                                                    <div className="border-t border-slate-100 bg-emerald-50/50 p-4 flex flex-wrap items-end gap-3">
                                                        <button onClick={() => handleApprove(req._id)} disabled={approveBusy}
                                                            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                                                            <Check size={13} /> {approveBusy ? 'Approving...' : 'Confirm Approve'}
                                                        </button>
                                                        <button onClick={() => setApprovingId(null)} className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Reject inline form */}
                                                {isRejectingThis && (
                                                    <div className="border-t border-slate-100 bg-rose-50/50 p-4 flex flex-wrap items-end gap-3">
                                                        <div className="flex-1 min-w-[200px]">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rejection Reason <span className="text-rose-500">*</span></label>
                                                            <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                                                placeholder="Enter reason for rejection..."
                                                                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white" />
                                                        </div>
                                                        <button onClick={() => handleReject(req._id)} disabled={rejectBusy || !rejectReason.trim()}
                                                            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                                                            <XCircle size={13} /> {rejectBusy ? 'Rejecting...' : 'Confirm Reject'}
                                                        </button>
                                                        <button onClick={() => setRejectingId(null)} className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Expanded concessions detail */}
                                                {isExpanded && (() => {
                                                    // Derive unique sorted years from this request's concessions
                                                    const reqYears = [...new Set(req.concessions.map(c => c.studentYear))].sort((a, b) => a - b);
                                                    // Group concessions by feeHeadId
                                                    const byHead = {};
                                                    req.concessions.forEach(c => {
                                                        const key = c.feeHeadId;
                                                        if (!byHead[key]) byHead[key] = { name: c.feeHeadName || c.feeHeadCode || c.feeHeadId, concessionType: c.concessionType, years: {} };
                                                        byHead[key].years[c.studentYear] = c.amount;
                                                        // if different rows have the same head but different type, last one wins (shouldn't happen)
                                                        byHead[key].concessionType = c.concessionType;
                                                    });
                                                    const getYrSfx = yr => yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : `${yr}th`;
                                                    return (
                                                        <div className="border-t border-slate-100 p-4 bg-slate-50/30">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                                Requested Concessions ({req.concessions.length} entries)
                                                            </p>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase">
                                                                            <th className="px-3 py-2 text-left">Fee Component</th>
                                                                            <th className="px-3 py-2 text-center">Type</th>
                                                                            {reqYears.map(yr => (
                                                                                <th key={yr} className="px-3 py-2 text-right">{getYrSfx(yr)} Yr (₹)</th>
                                                                            ))}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {Object.entries(byHead).map(([fhId, row]) => (
                                                                            <tr key={fhId} className="bg-white hover:bg-slate-50/40">
                                                                                <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.concessionType === 'CONCESSION' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                                        {row.concessionType}
                                                                                    </span>
                                                                                </td>
                                                                                {reqYears.map(yr => (
                                                                                    <td key={yr} className="px-3 py-2 text-right font-bold text-slate-900">
                                                                                        {row.years[yr] !== undefined
                                                                                            ? `₹${Number(row.years[yr]).toLocaleString()}`
                                                                                            : <span className="text-slate-300 font-normal">—</span>}
                                                                                    </td>
                                                                                ))}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

export default OverallConcession;
