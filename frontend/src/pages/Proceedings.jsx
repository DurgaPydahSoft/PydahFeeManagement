import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import Swal from 'sweetalert2';
import Sidebar from './Sidebar';
import { FileText, Plus, Search, Trash2, Edit2, Calendar, DollarSign, University, GraduationCap, Users, ChevronDown, ChevronRight, User, CheckCircle, Printer, Loader2 } from 'lucide-react';
import { printHtmlDocument } from '../utils/printService';

const STATUS_BADGE = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Completed: 'bg-slate-100 text-slate-600 border-slate-200',
    Cancelled: 'bg-red-50 text-red-600 border-red-200'
};

const getAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -4; i <= 4; i++) {
        const start = currentYear + i;
        years.push(`${start}-${start + 1}`);
    }
    return years;
};

const Proceedings = () => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const permissions = user?.permissions || [];
    const canApprove = user?.role === 'superadmin' || permissions.includes('proceedings_approve');
    const canEdit = user?.role === 'superadmin' || user?.role === 'admin' || permissions.includes('proceedings_edit');
    const canView = user?.role === 'superadmin' || user?.role === 'admin' || permissions.includes('proceedings_view') || permissions.includes('/proceedings');

    const [proceedings, setProceedings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState({ hierarchy: {}, batches: [], categories: [], castes: [] });
    const [paymentConfigs, setPaymentConfigs] = useState([]);
    const [feeHeads, setFeeHeads] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printOptions, setPrintOptions] = useState({ abstract: true, detailed: false });
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [collegeFilter, setCollegeFilter] = useState('All');
    const [courseFilter, setCourseFilter] = useState('All');
    const [academicYearFilter, setAcademicYearFilter] = useState('All');
    const [expandedRows, setExpandedRows] = useState({});

    // Create form
    const [formData, setFormData] = useState({
        proceedingNumber: '', proceedingDate: '', amount: '', bankCreditedAmount: '', bankAccount: '', bankCreditedDate: '', college: '', course: '', caste: '', batch: '', academicYear: ''
    });
    const [loadedStudents, setLoadedStudents] = useState([]);
    const [studentChecks, setStudentChecks] = useState({});
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [studentQuotaFilter, setStudentQuotaFilter] = useState('All');

    // Approve form
    const [approveData, setApproveData] = useState({ bankAccount: '', bankCreditedDate: '', amount: '', feeHead: '' });
    const [approvingProc, setApprovingProc] = useState(null);
    const [approveStudents, setApproveStudents] = useState([]);

    useEffect(() => { fetchInitialData(); }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [procRes, metaRes, configRes, fhRes] = await Promise.all([
                api.get('/proceedings'),
                api.get('/students/metadata'),
                api.get('/payment-config'),
                api.get('/fee-heads?all=true')
            ]);
            setProceedings(procRes.data);

            let finalHierarchy = metaRes.data.hierarchy || {};
            const userColleges = (user?.colleges || []).map(c => c.toUpperCase().trim());
            const userCourses = (user?.courses || []).map(c => c.toUpperCase().trim());
            if (user?.role !== 'superadmin' && (userColleges.length > 0 || userCourses.length > 0)) {
                const fh = {};
                Object.entries(finalHierarchy).forEach(([cn, cm]) => {
                    if (userColleges.length > 0 && !userColleges.includes(cn.toUpperCase().trim())) return;
                    const fc = {};
                    Object.entries(cm).forEach(([courseName, branchObj]) => {
                        const ms = `${cn}|${courseName}`.toUpperCase().trim();
                        if (userCourses.length === 0 || userCourses.includes(ms)) fc[courseName] = branchObj;
                    });
                    if (Object.keys(fc).length > 0) fh[cn] = fc;
                });
                finalHierarchy = fh;
            }
            setMetadata({ ...metaRes.data, hierarchy: finalHierarchy });
            setPaymentConfigs(configRes.data.filter(c => c.is_active));
            setFeeHeads(Array.isArray(fhRes.data) ? fhRes.data : []);
        } catch (error) {
            console.error('Error fetching data:', error);
            Swal.fire('Error', 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ─── Load students for the create form ─────────────────────────────
    const handleLoadStudents = async () => {
        if (!formData.college || !formData.course) {
            Swal.fire('Warning', 'Please select College and Course first', 'warning');
            return;
        }
        setLoadingStudents(true);
        setStudentQuotaFilter('All');
        try {
            const params = { college: formData.college, course: formData.course };
            if (formData.caste) params.caste = formData.caste;
            if (formData.batch) params.batch = formData.batch;
            const res = await api.get('/proceedings/load-students', { params });
            setLoadedStudents(res.data);
            const checks = {};
            res.data.forEach(s => { checks[s.studentId] = true; });
            setStudentChecks(checks);
        } catch (e) {
            Swal.fire('Error', e.response?.data?.message || 'Failed to load students', 'error');
        } finally {
            setLoadingStudents(false);
        }
    };

    const toggleAllStudents = (checked) => {
        const newChecks = {};
        filteredLoadedStudents.forEach(s => { newChecks[s.studentId] = checked; });
        setStudentChecks(prev => ({ ...prev, ...newChecks }));
    };

    const studentQuotas = useMemo(() => {
        const set = new Set();
        loadedStudents.forEach(s => { if (s.studType) set.add(s.studType); });
        return Array.from(set).sort();
    }, [loadedStudents]);

    const filteredLoadedStudents = useMemo(() => {
        return loadedStudents.filter(s => {
            if (studentQuotaFilter !== 'All' && (s.studType || '') !== studentQuotaFilter) return false;
            if (!studentSearch.trim()) return true;
            const q = studentSearch.toLowerCase();
            return s.studentName?.toLowerCase().includes(q) || s.admissionNumber?.toLowerCase().includes(q) || s.pinNo?.toLowerCase().includes(q);
        });
    }, [loadedStudents, studentSearch, studentQuotaFilter]);

    const selectedCount = Object.values(studentChecks).filter(Boolean).length;

    // ─── Submit create ──────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedStudents = loadedStudents.filter(s => studentChecks[s.studentId]);
        if (!isEditing && selectedStudents.length === 0) {
            Swal.fire('Warning', 'Please load and select at least one student', 'warning');
            return;
        }
        try {
            if (isEditing) {
                const { status, approvedBy, approvedByName, approvedAt, requestedBy, requestedByName, totalUsed, studentCount, feeHead, transactionsGenerated, ...editPayload } = formData;
                editPayload.students = selectedStudents;
                await api.put(`/proceedings/${formData._id}`, editPayload);
                Swal.fire('Success', 'Proceeding updated successfully', 'success');
            } else {
                await api.post('/proceedings', { ...formData, students: selectedStudents });
                Swal.fire('Success', 'Proceeding created — pending approval', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchInitialData();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Failed to save proceeding', 'error');
        }
    };

    const handleEdit = async (proc) => {
        setFormData({
            ...proc,
            proceedingDate: proc.proceedingDate ? proc.proceedingDate.split('T')[0] : '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : ''
        });
        setIsEditing(true);
        setShowModal(true);

        // Load existing mapped students
        try {
            const res = await api.get(`/proceedings/${proc._id}`);
            if (res.data.students) {
                setLoadedStudents(res.data.students);
                const checks = {};
                res.data.students.forEach(s => { checks[s.studentId] = true; });
                setStudentChecks(checks);
            }
        } catch (e) {
            console.error('Failed to load proceeding students', e);
        }
    };

    // ─── Approve modal ──────────────────────────────────────────────────
    const openApproveModal = async (proc) => {
        setApprovingProc(proc);
        setApproveData({
            bankAccount: proc.bankAccount || '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : '',
            amount: proc.amount || '',
            bankCreditedAmount: proc.bankCreditedAmount || '',
            feeHead: proc.feeHead?._id || proc.feeHead || ''
        });
        setShowApproveModal(true);

        try {
            const res = await api.get(`/proceedings/${proc._id}`);
            setApproveStudents(res.data.students || []);
        } catch (e) {
            setApproveStudents([]);
        }
    };

    const handleApproveSubmit = async (generateNow) => {
        if (!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead) {
            Swal.fire('Warning', 'Please fill Bank Account, Bank Credited Amount, Bank Credited Date, and Fee Head', 'warning');
            return;
        }

        const confirm = await Swal.fire({
            title: generateNow ? 'Approve & Create Transactions Now?' : 'Approve for Nightly Run?',
            html: generateNow
                ? `<p>${approvingProc.proceedingNumber} will become Active and <b>${approveStudents.length} DEBIT transactions</b> will be created immediately.</p>`
                : `<p>${approvingProc.proceedingNumber} will become Active. Transactions will be auto-generated during the nightly run.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: generateNow ? 'Approve & Create Now' : 'Approve for Nightly'
        });
        if (!confirm.isConfirmed) return;

        Swal.fire({
            title: generateNow ? 'Approving & Creating Transactions...' : 'Approving Proceeding...',
            html: generateNow
                ? `<p>Generating ${approveStudents.length} transactions, please wait...</p>`
                : '<p>Please wait...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await api.put(`/proceedings/${approvingProc._id}/approve`, {
                ...approveData,
                generateTransactionsNow: generateNow
            });
            Swal.fire('Success', res.data.message, 'success');
            setShowApproveModal(false);
            setApprovingProc(null);
            fetchInitialData();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Failed to approve', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?', text: "This will delete the proceeding and all mapped students.",
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await api.delete(`/proceedings/${id}`);
                Swal.fire('Deleted!', 'Proceeding has been deleted.', 'success');
                fetchInitialData();
            } catch (error) {
                Swal.fire('Error', error.response?.data?.message || 'Failed to delete proceeding', 'error');
            }
        }
    };

    const handlePrint = () => setShowPrintModal(true);

    const executePrint = async () => {
        setShowPrintModal(false);
        try {
            Swal.fire({ title: 'Preparing Print...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const printDataList = await Promise.all(filteredProceedings.map(async (proc) => {
                let studentsList = []; let used = proc.totalUsed || 0;
                if (printOptions.detailed) {
                    try { const res = await api.get(`/proceedings/${proc._id}/summary`); studentsList = res.data.transactions || []; used = res.data.totalUsed || 0; } catch (e) {}
                }
                return { ...proc, totalUsed: used, students: studentsList };
            }));
            const response = await api.post('/print', {
                template: 'proceedings-report',
                data: { reportData: printDataList, includeAbstract: printOptions.abstract, includeDetailed: printOptions.detailed, filters: { collegeFilter, courseFilter, statusFilter, searchTerm } }
            });
            Swal.close();
            printHtmlDocument(response.data);
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Failed to generate print document', 'error');
        }
    };

    const handlePrintSingle = async (proc) => {
        try {
            Swal.fire({ title: 'Preparing Print...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await api.get(`/proceedings/${proc._id}/summary`);
            const response = await api.post('/print', {
                template: 'proceedings-report',
                data: { reportData: [{ ...proc, totalUsed: res.data.totalUsed, students: res.data.transactions || [] }], includeAbstract: false, includeDetailed: true, filters: { collegeFilter: proc.college, courseFilter: proc.course, statusFilter: 'All', searchTerm: '' } }
            });
            Swal.close();
            printHtmlDocument(response.data);
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Failed to generate print document', 'error');
        }
    };

    const resetForm = () => {
        setFormData({ proceedingNumber: '', proceedingDate: '', amount: '', bankCreditedAmount: '', bankAccount: '', bankCreditedDate: '', college: '', course: '', caste: '', batch: '', academicYear: '' });
        setIsEditing(false);
        setLoadedStudents([]);
        setStudentChecks({});
        setStudentSearch('');
    };

    const filteredProceedings = proceedings.filter(p => {
        const matchesSearch = p.proceedingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || p.college?.toLowerCase().includes(searchTerm.toLowerCase()) || p.course?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        const matchesCollege = collegeFilter === 'All' || p.college === collegeFilter;
        const matchesCourse = courseFilter === 'All' || p.course === courseFilter;
        const matchesAcademicYear = academicYearFilter === 'All' || p.academicYear === academicYearFilter;
        return matchesSearch && matchesStatus && matchesCollege && matchesCourse && matchesAcademicYear;
    });

    const summaryStats = filteredProceedings.reduce((acc, p) => {
        acc.totalAmount += p.amount || 0; acc.totalUsed += p.totalUsed || 0; acc.count += 1;
        return acc;
    }, { totalAmount: 0, totalUsed: 0, count: 0 });
    summaryStats.totalRemaining = Math.max(0, summaryStats.totalAmount - summaryStats.totalUsed);

    const pendingCount = proceedings.filter(p => p.status === 'Pending').length;

    const toggleRow = async (id) => {
        if (expandedRows[id]) { setExpandedRows(prev => { const n = { ...prev }; delete n[id]; return n; }); return; }
        setExpandedRows(prev => ({ ...prev, [id]: { loading: true, data: [], totalUsed: 0, mappedStudents: [] } }));
        try {
            const res = await api.get(`/proceedings/${id}/summary`);
            setExpandedRows(prev => ({ ...prev, [id]: { loading: false, data: res.data.transactions, totalUsed: res.data.totalUsed, mappedStudents: res.data.mappedStudents || [] } }));
        } catch (e) {
            setExpandedRows(prev => ({ ...prev, [id]: { loading: false, data: [], totalUsed: 0, mappedStudents: [] } }));
        }
    };

    if (!canView) {
        return (
            <div className="flex min-h-screen bg-slate-50 font-sans">
                <Sidebar />
                <div className="flex-1 p-6 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center max-w-sm">
                        <h3 className="font-bold text-slate-800 text-lg mb-2">Access Denied</h3>
                        <p className="text-slate-500 text-xs font-semibold">You do not have view permissions for Proceedings.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6">
                <div className="w-full">
                    {/* Header */}
                    <div className="mb-8 flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Proceedings Management</h1>
                            <p className="text-slate-500 mt-1">Create proceedings with students, then approve to generate CREDIT transactions</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handlePrint} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 border border-slate-200">
                                <Printer size={20} /> Print Report
                            </button>
                            {canEdit && (
                                <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                                    <Plus size={20} /> Create Proceeding
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 rounded-xl"><DollarSign size={18} className="text-blue-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</div>
                                <div className="text-base font-black text-slate-800">₹{summaryStats.totalAmount.toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 rounded-xl"><FileText size={18} className="text-indigo-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilized</div>
                                <div className="text-base font-black text-indigo-700">₹{summaryStats.totalUsed.toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 rounded-xl"><Calendar size={18} className="text-amber-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining</div>
                                <div className="text-base font-black text-amber-700">₹{summaryStats.totalRemaining.toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-slate-100 rounded-xl"><GraduationCap size={18} className="text-slate-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Records</div>
                                <div className="text-base font-black text-slate-800">{summaryStats.count}</div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                        </div>
                        <div className="relative">
                            <select value={collegeFilter} onChange={(e) => { setCollegeFilter(e.target.value); setCourseFilter('All'); }} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                <option value="All">All Colleges</option>
                                {metadata?.hierarchy && Object.keys(metadata.hierarchy).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                <option value="All">All Courses</option>
                                {(() => {
                                    if (collegeFilter !== 'All') return metadata?.hierarchy?.[collegeFilter] && Object.keys(metadata.hierarchy[collegeFilter]).map(c => <option key={c} value={c}>{c}</option>);
                                    const u = new Set();
                                    if (metadata?.hierarchy) Object.values(metadata.hierarchy).forEach(co => { if (co) Object.keys(co).forEach(c => u.add(c)); });
                                    return Array.from(u).map(c => <option key={c} value={c}>{c}</option>);
                                })()}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                <option value="All">All Years</option>
                                {[...new Set(proceedings.map(p => p.academicYear).filter(Boolean))].sort().reverse().map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                <option value="All">All Status</option>
                                <option value="Pending">Pending{pendingCount > 0 ? ` (${pendingCount})` : ''}</option>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                        {(collegeFilter !== 'All' || courseFilter !== 'All' || searchTerm || statusFilter !== 'All' || academicYearFilter !== 'All') && (
                            <button onClick={() => { setCollegeFilter('All'); setCourseFilter('All'); setSearchTerm(''); setStatusFilter('All'); setAcademicYearFilter('All'); }} className="text-xs font-bold text-red-500 hover:text-red-600 py-2 px-3 hover:bg-red-50 rounded-xl">Clear Filters</button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-4 w-10"></th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">College / Course / Caste</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Academic Year</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Proceeding No</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Date</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-center">Students</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-right">Amount / Used</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Bank</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredProceedings.map(proc => (
                                    <React.Fragment key={proc._id}>
                                        <tr className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => toggleRow(proc._id)}>
                                            <td className="p-4">
                                                {expandedRows[proc._id] ? <ChevronDown size={18} className="text-blue-600" /> : <ChevronRight size={18} className="text-slate-400" />}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700 text-xs">{proc.college}</div>
                                                <div className="text-[10px] text-slate-500 font-medium uppercase">{proc.course} {proc.batch ? `(${proc.batch})` : ''} - {proc.caste || 'ALL'}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200">{proc.academicYear || '-'}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{proc.proceedingNumber}</div>
                                                <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${STATUS_BADGE[proc.status] || STATUS_BADGE.Active}`}>{proc.status || 'Active'}</span>
                                                {proc.status === 'Pending' && proc.requestedByName && <div className="text-[9px] text-slate-400 mt-0.5">by {proc.requestedByName}</div>}
                                                {proc.status === 'Active' && proc.approvedByName && <div className="text-[9px] text-slate-400 mt-0.5">approved by {proc.approvedByName}</div>}
                                            </td>
                                            <td className="p-4 text-slate-600 font-medium text-sm">{new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                            <td className="p-4 text-center">
                                                <span className="px-2 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-100">{proc.studentCount || 0}</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="font-bold text-slate-800">₹{(proc.amount || 0).toLocaleString('en-IN')}</div>
                                                {(() => {
                                                    const used = expandedRows[proc._id] ? expandedRows[proc._id].totalUsed : (proc.totalUsed || 0);
                                                    const rem = Math.max(0, (proc.amount || 0) - used);
                                                    return (
                                                        <div className="text-[10px] font-bold">
                                                            <span className="text-slate-500">USED: ₹{used.toLocaleString('en-IN')}</span>
                                                            <span className="mx-1 text-slate-300">|</span>
                                                            <span className={rem === 0 ? "text-red-600 font-extrabold" : "text-emerald-600"}>REM: ₹{rem.toLocaleString('en-IN')}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                {proc.bankAccount ? (
                                                    <>
                                                        <div className="font-bold text-slate-700 text-xs">{proc.bankAccount}</div>
                                                        {proc.bankCreditedAmount > 0 && <div className="text-[10px] font-bold text-emerald-600">₹{proc.bankCreditedAmount.toLocaleString('en-IN')}</div>}
                                                        <div className="text-[10px] text-slate-500 font-bold">{proc.bankCreditedDate ? new Date(proc.bankCreditedDate).toLocaleDateString() : 'PENDING'}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-1 items-center">
                                                    {canApprove && proc.status === 'Pending' && (
                                                        <button onClick={(e) => { e.stopPropagation(); openApproveModal(proc); }} className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1" title="Approve">
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); handlePrintSingle(proc); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print"><Printer size={16} /></button>
                                                    {canEdit && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(proc); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(proc._id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows[proc._id] && (
                                            <tr className="bg-slate-50/30">
                                                <td colSpan="9" className="p-0">
                                                    <div className="p-6 border-l-4 border-blue-500 bg-white shadow-inner">
                                                        {expandedRows[proc._id].loading ? (
                                                            <div className="py-10 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>
                                                        ) : (
                                                            <>
                                                                {/* Mapped Students */}
                                                                {expandedRows[proc._id].mappedStudents.length > 0 && (
                                                                    <div className="mb-6">
                                                                        <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest mb-3">
                                                                            <Users size={14} className="text-blue-600" /> Mapped Students ({expandedRows[proc._id].mappedStudents.length})
                                                                        </h4>
                                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                            {expandedRows[proc._id].mappedStudents.map((s, i) => (
                                                                                <div key={i} className="bg-slate-50 border rounded-lg p-2 flex items-center gap-2">
                                                                                    <div className="h-7 w-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-[10px] uppercase">{s.studentName?.charAt(0)}</div>
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-[11px] font-bold text-slate-800 truncate">{s.studentName}</div>
                                                                                        <div className="text-[9px] text-slate-400 font-mono">{s.admissionNumber} {s.pinNo && s.pinNo !== '-' ? `| ${s.pinNo}` : ''}</div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Transactions */}
                                                                <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest mb-3">
                                                                    <User size={14} className="text-blue-600" /> Transactions ({expandedRows[proc._id].data.length})
                                                                </h4>
                                                                {expandedRows[proc._id].data.length === 0 ? (
                                                                    <div className="py-6 text-center text-slate-400 italic text-sm">
                                                                        {proc.status === 'Pending' ? 'Transactions will be created after approval.' : 'No transactions linked yet.'}
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                        {expandedRows[proc._id].data.map((txn, tidx) => (
                                                                            <div key={tidx} className="bg-white border rounded-xl p-3 shadow-sm hover:border-blue-200 transition-colors flex justify-between items-center group">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">{txn.studentName?.charAt(0)}</div>
                                                                                    <div>
                                                                                        <div className="text-xs font-bold text-slate-800">{txn.studentName}</div>
                                                                                        <div className="text-[10px] text-slate-400 font-mono">{txn.studentId}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="text-xs font-black text-blue-700">₹{txn.amount.toLocaleString('en-IN')}</div>
                                                                                    <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(txn.paymentDate || txn.createdAt).toLocaleDateString()}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {proc.amount > 0 && (
                                                                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Limit</div>
                                                                                <div className="text-sm font-bold text-slate-600">₹{proc.amount?.toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                            <div className="w-px h-8 bg-slate-200"></div>
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] font-bold text-blue-400 uppercase">Utilized</div>
                                                                                <div className="text-sm font-black text-blue-700">₹{expandedRows[proc._id].totalUsed.toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                            <div className="w-px h-8 bg-slate-200"></div>
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] font-bold text-emerald-400 uppercase">Remaining</div>
                                                                                <div className="text-sm font-black text-emerald-600">₹{(proc.amount - expandedRows[proc._id].totalUsed).toLocaleString('en-IN')}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
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
            </div>

            {/* ═══ CREATE / EDIT MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                            <h2 className="text-xl font-bold">{isEditing ? 'Edit Proceeding' : 'New Proceeding'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                            {/* Proceeding Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Proceeding Number *</label>
                                    <input type="text" name="proceedingNumber" value={formData.proceedingNumber} onChange={handleInputChange} required placeholder="PR-2024-001" className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Proceeding Date *</label>
                                    <input type="date" name="proceedingDate" value={formData.proceedingDate} onChange={handleInputChange} required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Academic Year *</label>
                                    <div className="relative">
                                        <select name="academicYear" value={formData.academicYear} onChange={handleInputChange} required className="w-full px-3 py-2 pr-8 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                            <option value="">Select</option>
                                            {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Proceeding Amount *</label>
                                    <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm font-mono" />
                                </div>
                            </div>

                            {/* Filters for student loading */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Student Filters</div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">College *</label>
                                        <div className="relative">
                                            <select name="college" value={formData.college} onChange={handleInputChange} required className="w-full px-3 py-2 pr-8 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                                <option value="">Select</option>
                                                {Object.keys(metadata.hierarchy).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Course *</label>
                                        <div className="relative">
                                            <select name="course" value={formData.course} onChange={handleInputChange} required disabled={!formData.college} className="w-full px-3 py-2 pr-8 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none disabled:opacity-50 cursor-pointer">
                                                <option value="">Select</option>
                                                {formData.college && metadata.hierarchy[formData.college] && Object.keys(metadata.hierarchy[formData.college]).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Caste</label>
                                        <div className="relative">
                                            <select name="caste" value={formData.caste || ''} onChange={handleInputChange} className="w-full px-3 py-2 pr-8 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                                <option value="">All Castes</option>
                                                {metadata.castes?.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">Batch</label>
                                        <div className="relative">
                                            <select name="batch" value={formData.batch} onChange={handleInputChange} className="w-full px-3 py-2 pr-8 bg-white border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                                <option value="">All Batches</option>
                                                {metadata.batches?.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleLoadStudents} disabled={loadingStudents} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 justify-center disabled:opacity-50">
                                        {loadingStudents ? <><Loader2 size={16} className="animate-spin" /> Loading...</> : <><Users size={16} /> Load Students</>}
                                    </button>
                                </div>
                            </div>

                            {/* Student Grid */}
                            {loadedStudents.length > 0 && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 p-3 flex items-center justify-between border-b border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={selectedCount === loadedStudents.length} onChange={(e) => toggleAllStudents(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                                <span className="text-xs font-bold text-slate-600">Select All</span>
                                            </label>
                                            <span className="text-xs font-bold text-blue-600">{selectedCount} / {loadedStudents.length} selected</span>
                                            {selectedCount > 0 && (
                                                <button type="button" onClick={() => { const cleared = {}; loadedStudents.forEach(s => { cleared[s.studentId] = false; }); setStudentChecks(cleared); }} className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                                                    Clear Selection
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {studentQuotas.length > 0 && (
                                                <div className="relative">
                                                    <select value={studentQuotaFilter} onChange={(e) => setStudentQuotaFilter(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 pr-7 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                                        <option value="All">All Quotas ({loadedStudents.length})</option>
                                                        {studentQuotas.map(q => {
                                                            const count = loadedStudents.filter(s => s.studType === q).length;
                                                            return <option key={q} value={q}>{q} ({count})</option>;
                                                        })}
                                                    </select>
                                                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            )}
                                            <div className="relative">
                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search students..." className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 w-48" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-left">
                                            <thead className="sticky top-0 bg-white border-b">
                                                <tr>
                                                    <th className="p-2 w-10"></th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">PIN</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Quota</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Caste</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Year</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {filteredLoadedStudents.map(s => (
                                                    <tr key={s.studentId} className={`hover:bg-blue-50/30 transition-colors ${studentChecks[s.studentId] ? '' : 'opacity-50'}`}>
                                                        <td className="p-2">
                                                            <input type="checkbox" checked={!!studentChecks[s.studentId]} onChange={(e) => setStudentChecks(prev => ({ ...prev, [s.studentId]: e.target.checked }))} className="rounded text-blue-600 focus:ring-blue-500" />
                                                        </td>
                                                        <td className="p-2 text-xs font-bold text-slate-800">{s.studentName}</td>
                                                        <td className="p-2 text-xs font-mono text-slate-600">{s.admissionNumber}</td>
                                                        <td className="p-2 text-xs font-mono text-slate-500">{s.pinNo || '-'}</td>
                                                        <td className="p-2 text-xs text-slate-500">{s.studType || '-'}</td>
                                                        <td className="p-2 text-xs text-slate-500">{s.caste || '-'}</td>
                                                        <td className="p-2 text-xs text-slate-500">{s.studentYear || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={!isEditing && selectedCount === 0} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isEditing ? 'Update Proceeding' : `Create Proceeding (${selectedCount} students)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ APPROVE MODAL ═══ */}
            {showApproveModal && approvingProc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowApproveModal(false)}></div>
                    <div className="relative bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-emerald-600 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 className="text-xl font-bold">Approve Proceeding</h2>
                                <p className="text-emerald-100 text-sm mt-1">{approvingProc.proceedingNumber} — {approvingProc.college} / {approvingProc.course}</p>
                            </div>
                            <button onClick={() => setShowApproveModal(false)} className="text-white/80 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Mapped students preview */}
                            <div className="mb-6">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Mapped Students ({approveStudents.length})</div>
                                <div className="bg-slate-50 rounded-xl p-3 max-h-[150px] overflow-y-auto">
                                    {approveStudents.length === 0 ? (
                                        <div className="text-xs text-slate-400 italic text-center py-4">Loading students...</div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {approveStudents.map((s, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs">
                                                    <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-[9px] uppercase shrink-0">{s.studentName?.charAt(0)}</div>
                                                    <div className="min-w-0 truncate font-medium text-slate-700">{s.studentName}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Proceeding amount (read-only) */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-700">Proceeding Amount</span>
                                <span className="text-sm font-black text-blue-800">₹{(approvingProc.amount || 0).toLocaleString('en-IN')}</span>
                            </div>

                            {/* Approval fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Account *</label>
                                    <div className="relative">
                                        <select value={approveData.bankAccount} onChange={(e) => setApproveData(prev => ({ ...prev, bankAccount: e.target.value }))} required className="w-full px-3 py-2 pr-8 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                            <option value="">Select Account</option>
                                            {paymentConfigs.map(c => <option key={c._id} value={c.account_name}>{c.account_name} ({c.bank_name})</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Credited Date *</label>
                                    <input type="date" value={approveData.bankCreditedDate} onChange={(e) => setApproveData(prev => ({ ...prev, bankCreditedDate: e.target.value }))} required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Credited Amount *</label>
                                    <input type="number" value={approveData.bankCreditedAmount} onChange={(e) => setApproveData(prev => ({ ...prev, bankCreditedAmount: e.target.value }))} required placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Fee Head * <span className="text-slate-400 font-normal">(for CREDIT transactions)</span></label>
                                    <div className="relative">
                                        <select value={approveData.feeHead} onChange={(e) => setApproveData(prev => ({ ...prev, feeHead: e.target.value }))} required className="w-full px-3 py-2 pr-8 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                            <option value="">Select Fee Head</option>
                                            {feeHeads.map(fh => <option key={fh._id} value={fh._id}>{fh.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {approveStudents.length > 0 && approveData.bankCreditedAmount && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs font-bold text-slate-600 text-center">
                                    Split equally: <span className="text-blue-700">₹{(Math.round((Number(approveData.bankCreditedAmount) / approveStudents.length) * 100) / 100).toLocaleString('en-IN')}</span> per student ({approveStudents.length} students)
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button type="button" onClick={() => handleApproveSubmit(true)} disabled={!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead} className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                                    <CheckCircle size={18} /> Approve & Create Transactions Now
                                </button>
                                <button type="button" onClick={() => handleApproveSubmit(false)} disabled={!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                                    <Calendar size={18} /> Approve for Nightly Run
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ PRINT MODAL ═══ */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Printer size={24} /></div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Print Proceedings Report</h3>
                                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Configure report printout</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <input type="checkbox" id="printSummaryOpt" checked={printOptions.abstract} onChange={e => setPrintOptions(prev => ({ ...prev, abstract: e.target.checked }))} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                                    <label htmlFor="printSummaryOpt" className="cursor-pointer flex-1">
                                        <p className="text-xs font-bold text-gray-800">Summary Abstract</p>
                                        <p className="text-[9px] text-gray-500">Include overall summary table</p>
                                    </label>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <input type="checkbox" id="printDetailsOpt" checked={printOptions.detailed} onChange={e => setPrintOptions(prev => ({ ...prev, detailed: e.target.checked }))} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                                    <label htmlFor="printDetailsOpt" className="cursor-pointer flex-1">
                                        <p className="text-xs font-bold text-gray-800">Detailed View</p>
                                        <p className="text-[9px] text-gray-500">Include student lists for each proceeding</p>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setShowPrintModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-white border border-gray-200">Cancel</button>
                            <button onClick={executePrint} disabled={!printOptions.abstract && !printOptions.detailed} className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 ${(!printOptions.abstract && !printOptions.detailed) ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black shadow-lg shadow-gray-200'}`}>
                                <Printer size={16} /> Generate Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proceedings;
