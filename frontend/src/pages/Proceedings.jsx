import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Swal from 'sweetalert2';
import Sidebar from './Sidebar';
import { FileText, Plus, Search, Trash2, Edit2, Calendar, DollarSign, University, GraduationCap, Users, ChevronDown, ChevronRight, User, CheckCircle, Printer } from 'lucide-react';
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
        const end = start + 1;
        years.push(`${start}-${end}`);
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
    const [showModal, setShowModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printOptions, setPrintOptions] = useState({ abstract: true, detailed: false });
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [collegeFilter, setCollegeFilter] = useState('All');
    const [courseFilter, setCourseFilter] = useState('All');
    const [academicYearFilter, setAcademicYearFilter] = useState('All');
    const [expandedRows, setExpandedRows] = useState({}); // { id: { data: [], loading: false } }

    const [formData, setFormData] = useState({
        proceedingNumber: '',
        proceedingDate: '',
        amount: '',
        bankAccount: '',
        bankCreditedDate: '',
        college: '',
        course: '',
        caste: '',
        batch: '',
        academicYear: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [procRes, metaRes, configRes] = await Promise.all([
                api.get(`/proceedings`),
                api.get(`/students/metadata`),
                api.get(`/payment-config`)
            ]);
            setProceedings(procRes.data);
            
            // Filter metadata hierarchy by user colleges and courses
            let finalHierarchy = metaRes.data.hierarchy || {};
            const userColleges = (user?.colleges || []).map(c => c.toUpperCase().trim());
            const userCourses = (user?.courses || []).map(c => c.toUpperCase().trim());
            
            if (user?.role !== 'superadmin' && (userColleges.length > 0 || userCourses.length > 0)) {
                const filteredHierarchy = {};
                
                Object.entries(finalHierarchy).forEach(([collegeName, courseMap]) => {
                    // Filter by allowed colleges
                    if (userColleges.length > 0 && !userColleges.includes(collegeName.toUpperCase().trim())) {
                        return;
                    }
                    
                    const filteredCourses = {};
                    Object.entries(courseMap).forEach(([courseName, branchObj]) => {
                        // Filter by allowed courses (user.courses are prefixed as COLLEGE_NAME|COURSE_NAME)
                        const matchString = `${collegeName}|${courseName}`.toUpperCase().trim();
                        if (userCourses.length === 0 || userCourses.includes(matchString)) {
                            filteredCourses[courseName] = branchObj;
                        }
                    });
                    if (Object.keys(filteredCourses).length > 0) {
                        filteredHierarchy[collegeName] = filteredCourses;
                    }
                });
                finalHierarchy = filteredHierarchy;
            }
            setMetadata({
                ...metaRes.data,
                hierarchy: finalHierarchy
            });
            
            setPaymentConfigs(configRes.data.filter(c => c.is_active));
        } catch (error) {
            console.error('Error fetching data:', error);
            Swal.fire('Error', 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                const { status, approvedBy, approvedByName, approvedAt, requestedBy, requestedByName, ...editPayload } = formData;
                await api.put(`/proceedings/${formData._id}`, editPayload);
                Swal.fire('Success', 'Proceeding updated successfully', 'success');
            } else {
                await api.post(`/proceedings`, formData);
                Swal.fire('Success', 'Proceeding created — pending approval', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchInitialData();
        } catch (error) {
            console.error('Error saving proceeding:', error);
            Swal.fire('Error', error.response?.data?.message || 'Failed to save proceeding', 'error');
        }
    };

    const handleEdit = (proc) => {
        setFormData({
            ...proc,
            proceedingDate: proc.proceedingDate ? proc.proceedingDate.split('T')[0] : '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : ''
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handlePrint = () => {
        setShowPrintModal(true);
    };

    const executePrint = async () => {
        setShowPrintModal(false);
        try {
            Swal.fire({
                title: 'Preparing Print...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const printDataList = await Promise.all(filteredProceedings.map(async (proc) => {
                let studentsList = [];
                let used = proc.totalUsed || 0;
                if (printOptions.detailed) {
                    try {
                        const res = await api.get(`/proceedings/${proc._id}/summary`);
                        studentsList = res.data.transactions || [];
                        used = res.data.totalUsed || 0;
                    } catch (e) {
                        console.error("Failed to fetch summary for", proc._id, e);
                    }
                }
                return {
                    ...proc,
                    totalUsed: used,
                    students: studentsList
                };
            }));

            const response = await api.post('/print', {
                template: 'proceedings-report',
                data: {
                    reportData: printDataList,
                    includeAbstract: printOptions.abstract,
                    includeDetailed: printOptions.detailed,
                    filters: {
                        collegeFilter,
                        courseFilter,
                        statusFilter,
                        searchTerm
                    }
                }
            });

            Swal.close();
            printHtmlDocument(response.data);
        } catch (error) {
            console.error('Print failed:', error);
            Swal.close();
            Swal.fire('Error', 'Failed to generate print document', 'error');
        }
    };

    const handlePrintSingle = async (proc) => {
        try {
            Swal.fire({
                title: 'Preparing Print...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const res = await api.get(`/proceedings/${proc._id}/summary`);
            const studentsList = res.data.transactions || [];
            const totalUsed = res.data.totalUsed || 0;

            const response = await api.post('/print', {
                template: 'proceedings-report',
                data: {
                    reportData: [{
                        ...proc,
                        totalUsed,
                        students: studentsList
                    }],
                    includeAbstract: false,
                    includeDetailed: true,
                    filters: {
                        collegeFilter: proc.college,
                        courseFilter: proc.course,
                        statusFilter: 'All',
                        searchTerm: ''
                    }
                }
            });

            Swal.close();
            printHtmlDocument(response.data);
        } catch (error) {
            console.error('Print failed:', error);
            Swal.close();
            Swal.fire('Error', 'Failed to generate print document', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
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

    const handleApprove = async (proc) => {
        const result = await Swal.fire({
            title: 'Approve proceeding?',
            text: `${proc.proceedingNumber} will become Active and available for RTF fee collection.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, approve'
        });

        if (!result.isConfirmed) return;

        try {
            await api.put(`/proceedings/${proc._id}/approve`);
            Swal.fire('Approved', 'Proceeding is now Active.', 'success');
            fetchInitialData();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Failed to approve proceeding', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            proceedingNumber: '',
            proceedingDate: '',
            amount: '',
            bankAccount: '',
            bankCreditedDate: '',
            college: '',
            course: '',
            caste: '',
            batch: '',
            academicYear: ''
        });
        setIsEditing(false);
    };

    const filteredProceedings = proceedings.filter(p => {
        const matchesSearch =
            p.proceedingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.college?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.course?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        const matchesCollege = collegeFilter === 'All' || p.college === collegeFilter;
        const matchesCourse = courseFilter === 'All' || p.course === courseFilter;
        const matchesAcademicYear = academicYearFilter === 'All' || p.academicYear === academicYearFilter;
        return matchesSearch && matchesStatus && matchesCollege && matchesCourse && matchesAcademicYear;
    });

    // Summary statistics from filtered proceedings
    const summaryStats = filteredProceedings.reduce((acc, p) => {
        acc.totalAmount += p.amount || 0;
        acc.totalUsed += p.totalUsed || 0;
        acc.totalPending += p.status === 'Pending' ? (p.amount || 0) : 0;
        acc.totalActive += p.status === 'Active' ? (p.amount || 0) : 0;
        acc.count += 1;
        return acc;
    }, { totalAmount: 0, totalUsed: 0, totalPending: 0, totalActive: 0, count: 0 });
    summaryStats.totalRemaining = Math.max(0, summaryStats.totalAmount - summaryStats.totalUsed);

    const pendingCount = proceedings.filter(p => p.status === 'Pending').length;

    const toggleRow = async (id) => {
        if (expandedRows[id]) {
            const newExpanded = { ...expandedRows };
            delete newExpanded[id];
            setExpandedRows(newExpanded);
            return;
        }

        setExpandedRows(prev => ({ ...prev, [id]: { loading: true, data: [], totalUsed: 0 } }));
        try {
            const res = await api.get(`/proceedings/${id}/summary`);
            setExpandedRows(prev => ({
                ...prev,
                [id]: { loading: false, data: res.data.transactions, totalUsed: res.data.totalUsed }
            }));
        } catch (e) {
            console.error("Failed to fetch summary", e);
            setExpandedRows(prev => ({ ...prev, [id]: { loading: false, data: [], totalUsed: 0 } }));
        }
    };

    if (!canView) {
        return (
            <div className="flex min-h-screen bg-slate-50 font-sans">
                <Sidebar />
                <div className="flex-1 p-6 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center max-w-sm">
                        <div className="text-red-500 mb-4 flex justify-center">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6V9m0-6H6.22c-1.12 0-2.02.9-2.02 2.02v13.96C4.2 20.1 5.1 21 6.22 21h11.56c1.12 0 2.02-.9 2.02-2.02V7.02C19.8 5.9 18.9 5 17.78 5H15M12 3v2" /></svg>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg mb-2">Access Denied</h3>
                        <p className="text-slate-500 text-xs leading-relaxed font-semibold">You do not have view permissions for Proceedings. Please contact the administrator.</p>
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
                            <p className="text-slate-500 mt-1">Create proceedings (Pending), then approve to use in RTF collection</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrint}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 border border-slate-200"
                            >
                                <Printer size={20} /> Print Report
                            </button>
                            {canEdit && (
                                <button
                                    onClick={() => { resetForm(); setShowModal(true); }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                                >
                                    <Plus size={20} /> Create Proceeding
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 rounded-xl"><DollarSign size={18} className="text-blue-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Proceedings</div>
                                <div className="text-base font-black text-slate-800">₹{summaryStats.totalAmount.toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-xl"><University size={18} className="text-emerald-600" /></div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Credited</div>
                                <div className="text-base font-black text-emerald-700">₹{summaryStats.totalAmount.toLocaleString('en-IN')}</div>
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
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</div>
                                <div className="text-base font-black text-slate-800">{summaryStats.count} <span className="text-xs font-semibold text-slate-400">proceedings</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-3">
                        {/* Search Bar */}
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by proceeding number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                            />
                        </div>

                        {/* College Dropdown */}
                        <div className="relative">
                            <select
                                value={collegeFilter}
                                onChange={(e) => {
                                    setCollegeFilter(e.target.value);
                                    setCourseFilter('All');
                                }}
                                className="bg-slate-50 hover:bg-slate-100/80 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                            >
                                <option value="All">All Colleges</option>
                                {metadata?.hierarchy && Object.keys(metadata.hierarchy).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Course Dropdown */}
                        <div className="relative">
                            <select
                                value={courseFilter}
                                onChange={(e) => setCourseFilter(e.target.value)}
                                className="bg-slate-50 hover:bg-slate-100/80 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                            >
                                <option value="All">All Courses</option>
                                {(() => {
                                    if (collegeFilter !== 'All') {
                                        return metadata?.hierarchy?.[collegeFilter] && Object.keys(metadata.hierarchy[collegeFilter]).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ));
                                    } else {
                                        if (!metadata?.hierarchy) return null;
                                        const uniqueCourses = new Set();
                                        Object.values(metadata.hierarchy).forEach(courseObj => {
                                            if (courseObj) Object.keys(courseObj).forEach(c => uniqueCourses.add(c));
                                        });
                                        return Array.from(uniqueCourses).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ));
                                    }
                                })()}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Academic Year Dropdown */}
                        <div className="relative">
                            <select
                                value={academicYearFilter}
                                onChange={(e) => setAcademicYearFilter(e.target.value)}
                                className="bg-slate-50 hover:bg-slate-100/80 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                            >
                                <option value="All">All Academic Years</option>
                                {(() => {
                                    const years = [...new Set(proceedings.map(p => p.academicYear).filter(Boolean))].sort().reverse();
                                    return years.map(y => <option key={y} value={y}>{y}</option>);
                                })()}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Status Dropdown */}
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-slate-50 hover:bg-slate-100/80 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                            >
                                <option value="All">All Status</option>
                                <option value="Pending">Pending{pendingCount > 0 ? ` (${pendingCount})` : ''}</option>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Reset Button */}
                        {(collegeFilter !== 'All' || courseFilter !== 'All' || searchTerm !== '' || statusFilter !== 'All' || academicYearFilter !== 'All') && (
                            <button
                                onClick={() => {
                                    setCollegeFilter('All');
                                    setCourseFilter('All');
                                    setSearchTerm('');
                                    setStatusFilter('All');
                                    setAcademicYearFilter('All');
                                }}
                                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors py-2 px-3 hover:bg-red-50 rounded-xl"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-4 font-semibold text-slate-600 text-sm w-10"></th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">College / Course / Caste</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Academic Year</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Proceeding No</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Proceeding Date</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-right">Total / Used</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Bank / Credited Date</th>
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
                                                    <div className="text-[10px] text-slate-500 font-medium uppercase">
                                                        {proc.course} {proc.batch ? `(${proc.batch})` : ''} - {proc.caste || 'ALL'}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200">
                                                        {proc.academicYear || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{proc.proceedingNumber}</div>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${STATUS_BADGE[proc.status] || STATUS_BADGE.Active}`}>
                                                        {proc.status || 'Active'}
                                                    </span>
                                                    {proc.status === 'Pending' && proc.requestedByName && (
                                                        <div className="text-[9px] text-slate-400 mt-0.5">by {proc.requestedByName}</div>
                                                    )}
                                                    {proc.status === 'Active' && proc.approvedByName && (
                                                        <div className="text-[9px] text-slate-400 mt-0.5">approved by {proc.approvedByName}</div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-slate-600 font-medium">{new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="p-4 text-right">
                                                    <div className="font-bold text-slate-800">₹{proc.amount?.toLocaleString('en-IN')}</div>
                                                    {(() => {
                                                        const used = expandedRows[proc._id] ? expandedRows[proc._id].totalUsed : (proc.totalUsed || 0);
                                                        const rem = Math.max(0, (proc.amount || 0) - used);
                                                        return (
                                                            <div className="text-[10px] font-bold">
                                                                <span className="text-slate-500">USED: ₹{used.toLocaleString('en-IN')}</span>
                                                                <span className="mx-1 text-slate-300">|</span>
                                                                <span className={rem === 0 ? "text-red-600 font-extrabold" : "text-emerald-600"}>
                                                                    REM: ₹{rem.toLocaleString('en-IN')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 text-xs">{proc.bankAccount}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold">{proc.bankCreditedDate ? new Date(proc.bankCreditedDate).toLocaleDateString() : 'PENDING'}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-1 items-center">
                                                        {canApprove && proc.status === 'Pending' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApprove(proc); }}
                                                                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle size={14} /> Approve
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handlePrintSingle(proc); }} 
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                                            title="Print Proceeding"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
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
                                                    <td colSpan="8" className="p-0">
                                                        <div className="p-6 border-l-4 border-blue-500 bg-white shadow-inner animate-fadeIn">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest">
                                                                    <User size={14} className="text-blue-600" />
                                                                    Students Covered in this Proceeding
                                                                </h4>
                                                                <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                                                                    Total Residents: {expandedRows[proc._id].data.length}
                                                                </div>
                                                            </div>

                                                            {expandedRows[proc._id].loading ? (
                                                                <div className="py-10 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>
                                                            ) : expandedRows[proc._id].data.length === 0 ? (
                                                                <div className="py-10 text-center text-slate-400 italic text-sm">No transactions linked to this proceeding yet.</div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                    {expandedRows[proc._id].data.map((txn, tidx) => (
                                                                        <div key={tidx} className="bg-white border rounded-xl p-3 shadow-sm hover:border-blue-200 transition-colors flex justify-between items-center group">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">
                                                                                    {txn.studentName?.charAt(0)}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-slate-800">{txn.studentName}</div>
                                                                                    <div className="text-[10px] text-slate-400 font-mono">{txn.studentId}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xs font-black text-blue-700">₹{txn.amount.toLocaleString('en-IN')}</div>
                                                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(txn.paymentDate).toLocaleDateString()}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Proceeding Limit</div>
                                                                        <div className="text-sm font-bold text-slate-600">₹{proc.amount?.toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-slate-200"></div>
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-blue-400 uppercase">Utilized Amount</div>
                                                                        <div className="text-sm font-black text-blue-700">₹{expandedRows[proc._id].totalUsed.toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-slate-200"></div>
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-emerald-400 uppercase">Remaining</div>
                                                                        <div className="text-sm font-black text-emerald-600">₹{(proc.amount - expandedRows[proc._id].totalUsed).toLocaleString('en-IN')}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                            <h2 className="text-xl font-bold">{isEditing ? 'Edit Proceeding' : 'New Proceeding'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Proceeding Number *</label>
                                    <div className="relative group">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            name="proceedingNumber"
                                            value={formData.proceedingNumber}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                            placeholder="PR-2024-001"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Proceeding Date *</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="date"
                                            name="proceedingDate"
                                            value={formData.proceedingDate}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Amount *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Bank Info */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Bank Account *</label>
                                    <div className="relative">
                                        <University className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="bankAccount"
                                            value={formData.bankAccount}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Account</option>
                                            {paymentConfigs.map(c => (
                                                <option key={c._id} value={c.account_name}>{c.account_name} ({c.bank_name})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Bank Credited Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="date"
                                            name="bankCreditedDate"
                                            value={formData.bankCreditedDate}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Academic Year *</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                        <select
                                            name="academicYear"
                                            value={formData.academicYear}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none cursor-pointer"
                                        >
                                            <option value="">Select Academic Year</option>
                                            {getAcademicYears().map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Dynamic Hierarchy */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">College *</label>
                                    <div className="relative">
                                        <University className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="college"
                                            value={formData.college}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select College</option>
                                            {Object.keys(metadata.hierarchy).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Course *</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="course"
                                            value={formData.course}
                                            onChange={handleInputChange}
                                            required
                                            disabled={!formData.college}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none disabled:opacity-50"
                                        >
                                            <option value="">Select Course</option>
                                            {formData.college && metadata.hierarchy[formData.college] && Object.keys(metadata.hierarchy[formData.college]).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Caste</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="caste"
                                            value={formData.caste || ''}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Caste</option>
                                            {metadata.castes?.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Batch</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="batch"
                                            value={formData.batch}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Batch</option>
                                            {metadata.batches.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Status</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-10 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all"
                                >
                                    {isEditing ? 'Update Proceeding' : 'Create Proceeding'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Print Selection Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Printer size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">
                                        Print Proceedings Report
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                                        Configure report printout
                                    </p>
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
                                             checked={printOptions.abstract}
                                             onChange={e => setPrintOptions(prev => ({ ...prev, abstract: e.target.checked }))}
                                             className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                         />
                                         <label htmlFor="printSummaryOpt" className="cursor-pointer flex-1">
                                             <p className="text-xs font-bold text-gray-800">Summary Abstract</p>
                                             <p className="text-[9px] text-gray-500 font-medium">Include overall summary table containing all loaded proceedings</p>
                                         </label>
                                     </div>

                                     {/* Detailed View Option */}
                                     <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                         <input
                                             type="checkbox"
                                             id="printDetailsOpt"
                                             checked={printOptions.detailed}
                                             onChange={e => setPrintOptions(prev => ({ ...prev, detailed: e.target.checked }))}
                                             className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                         />
                                         <label htmlFor="printDetailsOpt" className="cursor-pointer flex-1">
                                             <p className="text-xs font-bold text-gray-800">Detailed View</p>
                                             <p className="text-[9px] text-gray-500 font-medium">Include row-by-row lists of covered students for each proceeding</p>
                                         </label>
                                     </div>
                                 </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-white border border-gray-200 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executePrint}
                                disabled={!printOptions.abstract && !printOptions.detailed}
                                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${(!printOptions.abstract && !printOptions.detailed) ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-gray-900 hover:bg-black shadow-gray-200'}`}
                            >
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
