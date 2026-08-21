import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/api';
import Swal from 'sweetalert2';
import Sidebar from './Sidebar';
import { FileText, Search, Trash2, Edit2, Calendar, DollarSign, GraduationCap, Users, ChevronDown, ChevronRight, User, CheckCircle, ShieldCheck, Printer, Loader2 } from 'lucide-react';
import { printHtmlDocument } from '../utils/printService';

const STATUS_BADGE = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Verified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Completed: 'bg-slate-100 text-slate-600 border-slate-200',
    Cancelled: 'bg-red-50 text-red-600 border-red-200'
};

const TAB_META = {
    list: { title: 'All Proceedings', desc: 'Active proceedings ready for fee collection' },
    pending: { title: 'Pending Queue', desc: 'Verify and approve pending proceeding requests' },
    create: { title: 'Create Proceeding', desc: 'Create a new proceeding and map students' },
    guide: { title: 'Guide', desc: 'Step-by-step process for creating, verifying, and approving proceedings' }
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

/** batch 2024 + academicYear 2025-2026 => 2 */
const computeProceedingYear = (batch, academicYear) => {
    const batchStart = parseInt(String(batch || '').split('-')[0], 10);
    const ayStart = parseInt(String(academicYear || '').split('-')[0], 10);
    if (!Number.isFinite(batchStart) || !Number.isFinite(ayStart)) return null;
    const yearNum = ayStart - batchStart + 1;
    return yearNum >= 1 && yearNum <= 10 ? yearNum : null;
};

const formatYearLabel = (year) => {
    const n = Number(year);
    if (!Number.isFinite(n) || n < 1) return '-';
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${suffix} Year`;
};

const emptyForm = () => ({
    proceedingNumber: '', proceedingDate: '', amount: '', bankCreditedAmount: '', bankAccount: '', bankCreditedDate: '', college: '', course: '', caste: '', batch: '', academicYear: ''
});

const getProceedingDraftKey = (username) => `proceeding_create_draft_${username || 'anon'}`;

const readProceedingDraft = (username) => {
    try {
        const raw = localStorage.getItem(getProceedingDraftKey(username));
        if (!raw) return null;
        const draft = JSON.parse(raw);
        if (!draft || typeof draft !== 'object') return null;
        return draft;
    } catch {
        return null;
    }
};

const Proceedings = () => {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const permissions = user?.permissions || [];
    const canApprove = user?.role === 'superadmin' || permissions.includes('proceedings_approve');
    const canVerify = user?.role === 'superadmin' || permissions.includes('proceedings_verify');
    const canEdit = user?.role === 'superadmin' || user?.role === 'admin' || permissions.includes('proceedings_edit');
    const canView = user?.role === 'superadmin' || user?.role === 'admin' || permissions.includes('proceedings_view') || permissions.includes('/proceedings');

    const getTabFromHash = (hash) => {
        const cleaned = (hash || '').replace('#', '');
        if (cleaned === 'create' && !canEdit) return 'list';
        if (['list', 'pending', 'create', 'guide'].includes(cleaned)) return cleaned;
        return 'list';
    };

    const [activeTab, setActiveTab] = useState(() => getTabFromHash(location.hash));
    const [proceedings, setProceedings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState({ hierarchy: {}, batches: [], categories: [], castes: [] });
    const [paymentConfigs, setPaymentConfigs] = useState([]);
    const [feeHeads, setFeeHeads] = useState([]);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printOptions, setPrintOptions] = useState({ abstract: true, detailed: false });
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('All');
    const [courseFilter, setCourseFilter] = useState('All');
    const [academicYearFilter, setAcademicYearFilter] = useState('All');
    const [expandedRows, setExpandedRows] = useState({});
    const [pendingSearch, setPendingSearch] = useState('');

    const [formData, setFormData] = useState(emptyForm());
    const [loadedStudents, setLoadedStudents] = useState([]);
    const [studentChecks, setStudentChecks] = useState({});
    const [studentShareAmounts, setStudentShareAmounts] = useState({});
    const [studentsLocked, setStudentsLocked] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [studentQuotaFilter, setStudentQuotaFilter] = useState('All');

    const [approveData, setApproveData] = useState({ bankAccount: '', bankCreditedDate: '', amount: '', feeHead: '' });
    const [approvingProc, setApprovingProc] = useState(null);
    const [approveStudents, setApproveStudents] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [draftAvailable, setDraftAvailable] = useState(() => !!readProceedingDraft(user?.username));
    const [draftSavedAt, setDraftSavedAt] = useState(null);
    const skipNextDraftSave = useRef(false);

    useEffect(() => { fetchInitialData(); }, []);

    useEffect(() => {
        const tab = getTabFromHash(location.hash);
        setActiveTab(tab);
        if (tab === 'create') {
            setShowEditModal(false);
            setIsEditing(false);
            const draft = readProceedingDraft(user?.username);
            setDraftAvailable(!!draft);
            setDraftSavedAt(draft?.savedAt || null);
        }
    }, [location.hash, canEdit, user?.username]);

    // Auto-save create draft (survives refresh)
    useEffect(() => {
        if (activeTab !== 'create' || isEditing) return;
        if (skipNextDraftSave.current) {
            skipNextDraftSave.current = false;
            return;
        }
        const hasContent = !!(
            formData.proceedingNumber
            || formData.amount
            || formData.college
            || formData.course
            || formData.academicYear
            || loadedStudents.length > 0
            || Object.keys(studentShareAmounts).length > 0
        );
        if (!hasContent) return;

        const timer = setTimeout(() => {
            try {
                const payload = {
                    formData,
                    loadedStudents,
                    studentChecks,
                    studentShareAmounts,
                    studentsLocked,
                    studentSearch,
                    studentQuotaFilter,
                    savedAt: Date.now()
                };
                localStorage.setItem(getProceedingDraftKey(user?.username), JSON.stringify(payload));
                setDraftAvailable(true);
                setDraftSavedAt(payload.savedAt);
            } catch (e) {
                console.warn('Failed to save proceeding draft', e);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [
        activeTab, isEditing, formData, loadedStudents, studentChecks,
        studentShareAmounts, studentsLocked, studentSearch, studentQuotaFilter, user?.username
    ]);

    const clearCreateDraft = () => {
        try {
            localStorage.removeItem(getProceedingDraftKey(user?.username));
        } catch { /* ignore */ }
        setDraftAvailable(false);
        setDraftSavedAt(null);
    };

    const restoreCreateDraft = () => {
        const draft = readProceedingDraft(user?.username);
        if (!draft) {
            Swal.fire('Info', 'No saved draft found', 'info');
            setDraftAvailable(false);
            return;
        }
        skipNextDraftSave.current = true;
        setFormData({ ...emptyForm(), ...(draft.formData || {}) });
        setLoadedStudents(Array.isArray(draft.loadedStudents) ? draft.loadedStudents : []);
        setStudentChecks(draft.studentChecks || {});
        setStudentShareAmounts(draft.studentShareAmounts || {});
        setStudentsLocked(!!draft.studentsLocked);
        setStudentSearch(draft.studentSearch || '');
        setStudentQuotaFilter(draft.studentQuotaFilter || 'All');
        setDraftAvailable(true);
        setDraftSavedAt(draft.savedAt || null);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Draft restored — continue where you left off',
            showConfirmButton: false,
            timer: 2200
        });
    };

    const discardCreateDraft = async () => {
        const confirm = await Swal.fire({
            title: 'Discard draft?',
            text: 'Saved create progress will be cleared.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Discard',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
        clearCreateDraft();
        skipNextDraftSave.current = true;
        resetForm();
    };

    // After create, navigate via hash so sidebar stays in sync
    const goToTab = (tab) => {
        window.location.hash = tab;
        setActiveTab(tab);
    };

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
            // Do not select all by default — user selects via quota filter
            setStudentChecks({});
            setStudentShareAmounts({});
            setStudentsLocked(false);
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

    const lockedStudents = useMemo(
        () => loadedStudents.filter(s => studentChecks[s.studentId]),
        [loadedStudents, studentChecks]
    );

    const sharesTotal = useMemo(() => {
        return lockedStudents.reduce((sum, s) => sum + (Number(studentShareAmounts[s.studentId]) || 0), 0);
    }, [lockedStudents, studentShareAmounts]);

    const proceedingAmountNum = Number(formData.amount) || 0;
    const remainingBalance = Math.round((proceedingAmountNum - sharesTotal) * 100) / 100;

    const allSharesValid = studentsLocked
        && lockedStudents.length > 0
        && lockedStudents.every(s => Number(studentShareAmounts[s.studentId]) > 0);

    const canSubmitProceeding = allSharesValid && Math.abs(remainingBalance) <= 0.009 && proceedingAmountNum > 0;

    const lockSelectedStudents = () => {
        if (!formData.academicYear) {
            Swal.fire('Warning', 'Please select Academic Year first — it is used to calculate each student\'s proceeding year', 'warning');
            return;
        }
        if (!(Number(formData.amount) > 0)) {
            Swal.fire('Warning', 'Please enter the Proceeding Amount at the top first', 'warning');
            return;
        }
        if (selectedCount === 0) {
            Swal.fire('Warning', 'Please select at least one student first', 'warning');
            return;
        }
        setStudentShareAmounts(prev => {
            const next = { ...prev };
            lockedStudents.forEach(s => {
                if (next[s.studentId] === undefined) next[s.studentId] = '';
            });
            return next;
        });
        setStudentsLocked(true);
    };

    const unlockStudents = () => {
        setStudentsLocked(false);
    };

    const handleStudentShareChange = (studentId, value) => {
        setStudentShareAmounts(prev => ({ ...prev, [studentId]: value }));
    };

    const resetForm = () => {
        setFormData(emptyForm());
        setIsEditing(false);
        setLoadedStudents([]);
        setStudentChecks({});
        setStudentShareAmounts({});
        setStudentsLocked(false);
        setStudentSearch('');
        setStudentQuotaFilter('All');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!studentsLocked) {
            Swal.fire('Warning', 'Please confirm/lock the selected students, then enter each share amount', 'warning');
            return;
        }
        const selectedStudents = lockedStudents;
        if (selectedStudents.length === 0) {
            Swal.fire('Warning', 'Please load and select at least one student', 'warning');
            return;
        }
        const missing = selectedStudents.find(s => !(Number(studentShareAmounts[s.studentId]) > 0));
        if (missing) {
            Swal.fire('Warning', `Share amount must be greater than zero for ${missing.studentName || missing.admissionNumber}`, 'warning');
            return;
        }
        if (!(Number(formData.amount) > 0)) {
            Swal.fire('Warning', 'Please enter the Proceeding Amount', 'warning');
            return;
        }
        if (remainingBalance < 0) {
            Swal.fire('Warning', `Shares exceed proceeding amount by ₹${Math.abs(remainingBalance).toLocaleString('en-IN')}`, 'warning');
            return;
        }
        if (Math.abs(remainingBalance) > 0.009) {
            Swal.fire('Warning', `Balance must be ₹0 to create. Remaining: ₹${remainingBalance.toLocaleString('en-IN')}`, 'warning');
            return;
        }
        const studentsPayload = selectedStudents.map(s => ({
            ...s,
            shareAmount: Math.round(Number(studentShareAmounts[s.studentId]) * 100) / 100,
            proceedingYear: computeProceedingYear(s.batch, formData.academicYear)
                ?? (Number(s.proceedingYear) > 0 ? Number(s.proceedingYear) : null),
            studentYear: s.studentYear != null && s.studentYear !== '' ? String(s.studentYear) : ''
        }));
        const totalAmount = Math.round(Number(formData.amount) * 100) / 100;
        setIsSaving(true);
        try {
            if (isEditing) {
                const { status, approvedBy, approvedByName, approvedAt, verifiedBy, verifiedByName, verifiedAt, requestedBy, requestedByName, totalUsed, studentCount, feeHead, transactionsGenerated, ...editPayload } = formData;
                editPayload.students = studentsPayload;
                editPayload.amount = totalAmount;
                await api.put(`/proceedings/${formData._id}`, editPayload);
                Swal.fire('Success', 'Proceeding updated successfully', 'success');
                resetForm();
                setShowEditModal(false);
                fetchInitialData();
            } else {
                await api.post('/proceedings', {
                    ...formData,
                    amount: totalAmount,
                    students: studentsPayload
                });
                Swal.fire('Success', 'Proceeding created — pending verification', 'success');
                clearCreateDraft();
                skipNextDraftSave.current = true;
                resetForm();
                goToTab('pending');
                fetchInitialData();
            }
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Failed to save proceeding', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = async (proc) => {
        if (proc.status !== 'Pending') {
            Swal.fire('Not allowed', 'Only Pending proceedings can be edited.', 'warning');
            return;
        }
        setFormData({
            ...proc,
            proceedingDate: proc.proceedingDate ? proc.proceedingDate.split('T')[0] : '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : ''
        });
        setIsEditing(true);
        setShowEditModal(true);

        try {
            const res = await api.get(`/proceedings/${proc._id}`);
            if (res.data.students) {
                setLoadedStudents(res.data.students);
                const checks = {};
                const amounts = {};
                res.data.students.forEach(s => {
                    checks[s.studentId] = true;
                    amounts[s.studentId] = s.shareAmount != null && s.shareAmount !== '' ? String(s.shareAmount) : '';
                });
                setStudentChecks(checks);
                setStudentShareAmounts(amounts);
                setStudentsLocked(true);
            }
        } catch (e) {
            console.error('Failed to load proceeding students', e);
        }
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setIsEditing(false);
        setFormData(emptyForm());
        setLoadedStudents([]);
        setStudentChecks({});
        setStudentShareAmounts({});
        setStudentsLocked(false);
        setStudentSearch('');
        setStudentQuotaFilter('All');
    };

    const handleVerify = async (proc) => {
        const confirm = await Swal.fire({
            title: 'Verify Proceeding?',
            html: `<p><b>${proc.proceedingNumber}</b> will move to <b>Verified</b> status and await approval.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Verify'
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.put(`/proceedings/${proc._id}/verify`);
            Swal.fire('Success', 'Proceeding verified successfully', 'success');
            fetchInitialData();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Failed to verify', 'error');
        }
    };

    const openApproveModal = async (proc) => {
        if (proc.status !== 'Verified') {
            Swal.fire('Not allowed', 'Only Verified proceedings can be approved.', 'warning');
            return;
        }
        setApprovingProc(proc);
        setApproveData({
            bankAccount: proc.bankAccount || '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : '',
            amount: proc.amount || '',
            bankCreditedAmount: proc.bankCreditedAmount || '',
            feeHead: proc.feeHead?._id || proc.feeHead || ''
        });
        setApproveStudents([]);
        setShowApproveModal(true);

        try {
            const res = await api.get(`/proceedings/${proc._id}`);
            setApproveStudents((res.data.students || []).map(s => ({
                ...s,
                originalShareAmount: Number(s.shareAmount) || 0,
                shareAmount: Number(s.shareAmount) || 0
            })));
        } catch (e) {
            setApproveStudents([]);
        }
    };

    const zeroApproveStudentShare = (studentId) => {
        setApproveStudents(prev => prev.map(s =>
            s.studentId === studentId
                ? { ...s, shareAmount: 0 }
                : s
        ));
    };

    const restoreApproveStudentShare = (studentId) => {
        setApproveStudents(prev => prev.map(s =>
            s.studentId === studentId
                ? { ...s, shareAmount: Number(s.originalShareAmount) || 0 }
                : s
        ));
    };

    const approveSharesTotal = useMemo(
        () => Math.round(approveStudents.reduce((t, s) => t + (Number(s.shareAmount) || 0), 0) * 100) / 100,
        [approveStudents]
    );

    const approveBankAmount = Number(approveData.bankCreditedAmount) || 0;
    const approveShareBankDiff = Math.round((approveSharesTotal - approveBankAmount) * 100) / 100;
    const bankLessThanProceeding = approveBankAmount > 0 && approveBankAmount < Number(approvingProc?.amount || 0);
    const approveSharesMatchBank = approveBankAmount > 0 && Math.abs(approveShareBankDiff) <= 0.009;
    const approveTxnCount = approveStudents.filter(s => Number(s.shareAmount) > 0).length;

    const handleApproveSubmit = async (generateNow) => {
        if (!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead) {
            Swal.fire('Warning', 'Please fill Bank Account, Bank Credited Amount, Bank Credited Date, and Fee Head', 'warning');
            return;
        }
        if (approveBankAmount > Number(approvingProc?.amount || 0) + 0.009) {
            Swal.fire('Warning', 'Bank credited amount cannot be greater than proceeding amount', 'warning');
            return;
        }
        if (!approveSharesMatchBank) {
            Swal.fire(
                'Warning',
                approveShareBankDiff > 0
                    ? `Shares total (₹${approveSharesTotal.toLocaleString('en-IN')}) is higher than bank credit (₹${approveBankAmount.toLocaleString('en-IN')}) by ₹${approveShareBankDiff.toLocaleString('en-IN')}. Zero some student shares (students stay mapped).`
                    : `Shares total (₹${approveSharesTotal.toLocaleString('en-IN')}) is less than bank credit (₹${approveBankAmount.toLocaleString('en-IN')}). Restore shares or check bank amount.`,
                'warning'
            );
            return;
        }

        const confirm = await Swal.fire({
            title: generateNow ? 'Approve & Create Transactions Now?' : 'Approve for Nightly Run?',
            html: generateNow
                ? `<p>${approvingProc.proceedingNumber} will become Active and <b>${approveTxnCount} Bank/RTF DEBIT transactions</b> will be created (same as Fee Collection → Bank → RTF). Students with ₹0 share stay mapped, no txn.</p>`
                : `<p>${approvingProc.proceedingNumber} will become Active. Bank/RTF transactions will be auto-generated during the nightly run for students with share &gt; 0.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: generateNow ? 'Approve & Create Now' : 'Approve for Nightly'
        });
        if (!confirm.isConfirmed) return;

        Swal.fire({
            title: generateNow ? 'Approving & Creating Transactions...' : 'Approving Proceeding...',
            html: generateNow
                ? `<p>Generating ${approveTxnCount} transactions, please wait...</p>`
                : '<p>Please wait...</p>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const res = await api.put(`/proceedings/${approvingProc._id}/approve`, {
                ...approveData,
                generateTransactionsNow: generateNow,
                studentShares: approveStudents.map(s => ({
                    studentId: s.studentId,
                    shareAmount: Number(s.shareAmount) || 0
                }))
            });
            Swal.fire('Success', res.data.message, 'success');
            setShowApproveModal(false);
            setApprovingProc(null);
            setApproveStudents([]);
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
                data: { reportData: printDataList, includeAbstract: printOptions.abstract, includeDetailed: printOptions.detailed, filters: { collegeFilter, courseFilter, statusFilter: 'Active', searchTerm } }
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

    const filteredProceedings = proceedings.filter(p => {
        // All Proceedings tab: Active only (Pending/Verified live in Pending Queue)
        if (p.status !== 'Active') return false;
        const matchesSearch = p.proceedingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || p.college?.toLowerCase().includes(searchTerm.toLowerCase()) || p.course?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCollege = collegeFilter === 'All' || p.college === collegeFilter;
        const matchesCourse = courseFilter === 'All' || p.course === courseFilter;
        const matchesAcademicYear = academicYearFilter === 'All' || p.academicYear === academicYearFilter;
        return matchesSearch && matchesCollege && matchesCourse && matchesAcademicYear;
    });

    const summaryStats = filteredProceedings.reduce((acc, p) => {
        acc.totalAmount += p.amount || 0; acc.totalUsed += p.totalUsed || 0; acc.count += 1;
        return acc;
    }, { totalAmount: 0, totalUsed: 0, count: 0 });
    summaryStats.totalRemaining = Math.max(0, summaryStats.totalAmount - summaryStats.totalUsed);

    const pendingQueue = proceedings.filter(p => {
        if (p.status !== 'Pending' && p.status !== 'Verified') return false;
        if (!pendingSearch.trim()) return true;
        const q = pendingSearch.toLowerCase();
        return p.proceedingNumber?.toLowerCase().includes(q) || p.college?.toLowerCase().includes(q) || p.course?.toLowerCase().includes(q);
    });

    const pendingQueueCount = proceedings.filter(p => p.status === 'Pending' || p.status === 'Verified').length;

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

    const renderAuditLine = (proc) => {
        const parts = [];
        if (proc.requestedByName) parts.push(`requested by ${proc.requestedByName}`);
        if (proc.verifiedByName) parts.push(`verified by ${proc.verifiedByName}`);
        if (proc.approvedByName) parts.push(`approved by ${proc.approvedByName}`);
        if (parts.length === 0) return null;
        return <div className="text-[9px] text-slate-400 mt-0.5">{parts.join(' · ')}</div>;
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
            <div className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6">
                <div className="w-full max-w-full">
                    {/* Header */}
                    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                                <FileText className="text-gray-800 shrink-0" size={22} />
                                <span className="break-words">Proceedings {TAB_META[activeTab] ? `– ${TAB_META[activeTab].title}` : ''}</span>
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                {TAB_META[activeTab]?.desc || 'Create → Verify → Approve to generate RTF transactions'}
                            </p>
                        </div>
                        {activeTab === 'list' && (
                            <button onClick={handlePrint} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border border-slate-200 self-start sm:self-auto shrink-0">
                                <Printer size={16} /> Print Report
                            </button>
                        )}
                    </div>

                    {/* ═══ LIST TAB ═══ */}
                    {activeTab === 'list' && (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-50 rounded-xl"><DollarSign size={18} className="text-blue-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Amount</div>
                                        <div className="text-base font-bold text-slate-800">₹{summaryStats.totalAmount.toLocaleString('en-IN')}</div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl"><FileText size={18} className="text-indigo-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Utilized</div>
                                        <div className="text-base font-bold text-indigo-700">₹{summaryStats.totalUsed.toLocaleString('en-IN')}</div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-50 rounded-xl"><Calendar size={18} className="text-amber-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Remaining</div>
                                        <div className="text-base font-bold text-amber-700">₹{summaryStats.totalRemaining.toLocaleString('en-IN')}</div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                                    <div className="p-2.5 bg-slate-100 rounded-xl"><GraduationCap size={18} className="text-slate-600" /></div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Records</div>
                                        <div className="text-base font-bold text-slate-800">{summaryStats.count}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-3">
                                <div className="relative min-w-[200px] flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                                </div>
                                <div className="relative">
                                    <select value={collegeFilter} onChange={(e) => { setCollegeFilter(e.target.value); setCourseFilter('All'); }} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                        <option value="All">All Colleges</option>
                                        {metadata?.hierarchy && Object.keys(metadata.hierarchy).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                </div>
                                <div className="relative">
                                    <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
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
                                    <select value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)} className="bg-slate-50 border-none rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer">
                                        <option value="All">All Years</option>
                                        {[...new Set(proceedings.filter(p => p.status === 'Active').map(p => p.academicYear).filter(Boolean))].sort().reverse().map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                </div>
                                {(collegeFilter !== 'All' || courseFilter !== 'All' || searchTerm || academicYearFilter !== 'All') && (
                                    <button onClick={() => { setCollegeFilter('All'); setCourseFilter('All'); setSearchTerm(''); setAcademicYearFilter('All'); }} className="text-xs font-bold text-red-500 hover:text-red-600 py-2 px-3 hover:bg-red-50 rounded-xl">Clear Filters</button>
                                )}
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                {loading ? (
                                    <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
                                ) : (
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
                                            {filteredProceedings.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="p-12 text-center text-slate-400 italic text-sm">No active proceedings found</td>
                                                </tr>
                                            ) : filteredProceedings.map(proc => (
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
                                                            {renderAuditLine(proc)}
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
                                                                <button onClick={(e) => { e.stopPropagation(); handlePrintSingle(proc); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print"><Printer size={16} /></button>
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
                                                                            {expandedRows[proc._id].mappedStudents.length > 0 && (
                                                                                <div className="mb-6">
                                                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest mb-3">
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

                                                                            <h4 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest mb-3">
                                                                                <User size={14} className="text-blue-600" /> Transactions ({expandedRows[proc._id].data.length})
                                                                            </h4>
                                                                            {expandedRows[proc._id].data.length === 0 ? (
                                                                                <div className="py-6 text-center text-slate-400 italic text-sm">
                                                                                    {proc.status === 'Pending' || proc.status === 'Verified'
                                                                                        ? 'Transactions will be created after approval.'
                                                                                        : 'No transactions linked yet.'}
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
                                                                                                <div className="text-xs font-bold text-blue-700">₹{txn.amount.toLocaleString('en-IN')}</div>
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
                                                                                            <div className="text-sm font-bold text-blue-700">₹{expandedRows[proc._id].totalUsed.toLocaleString('en-IN')}</div>
                                                                                        </div>
                                                                                        <div className="w-px h-8 bg-slate-200"></div>
                                                                                        <div className="text-right">
                                                                                            <div className="text-[10px] font-bold text-emerald-400 uppercase">Remaining</div>
                                                                                            <div className="text-sm font-bold text-emerald-600">₹{(proc.amount - expandedRows[proc._id].totalUsed).toLocaleString('en-IN')}</div>
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
                                )}
                            </div>
                        </>
                    )}

                    {/* ═══ CREATE TAB (inline, create only) ═══ */}
                    {activeTab === 'create' && canEdit && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="bg-blue-600 p-6 text-white">
                                <h2 className="text-lg font-bold">New Proceeding</h2>
                                <p className="text-blue-100 text-sm mt-1">Fill details, load students, then submit for verification</p>
                            </div>

                            {draftAvailable && (
                                <div className="mx-6 mt-4 mb-0 p-3 rounded-xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="text-xs font-semibold text-amber-800">
                                        Draft saved{draftSavedAt ? ` · ${new Date(draftSavedAt).toLocaleString()}` : ''}. Restore to continue after refresh.
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={restoreCreateDraft} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg">
                                            Restore Draft
                                        </button>
                                        <button type="button" onClick={discardCreateDraft} className="px-3 py-1.5 bg-white border border-amber-200 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-100">
                                            Discard
                                        </button>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="p-6">
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
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            required
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm font-mono"
                                        />
                                    </div>
                                </div>

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
                                        <button type="button" onClick={handleLoadStudents} disabled={loadingStudents || studentsLocked} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 justify-center disabled:opacity-50">
                                            {loadingStudents ? <><Loader2 size={16} className="animate-spin" /> Loading...</> : <><Users size={16} /> Load Students</>}
                                        </button>
                                    </div>
                                </div>

                                {loadedStudents.length > 0 && (
                                    <>
                                    {!studentsLocked ? (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 p-3 flex items-center justify-between border-b border-slate-200 flex-wrap gap-2">
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={filteredLoadedStudents.length > 0 && filteredLoadedStudents.every(s => studentChecks[s.studentId])} onChange={(e) => toggleAllStudents(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-xs font-bold text-slate-600">Select All (filtered)</span>
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
                                        <div className="max-h-[360px] overflow-y-auto">
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
                                        <div className="p-3 border-t border-slate-200 bg-white flex justify-end">
                                            <button type="button" onClick={lockSelectedStudents} disabled={selectedCount === 0} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                                                Confirm Selection ({selectedCount}) & Enter Amounts
                                            </button>
                                        </div>
                                    </div>
                                    ) : (
                                    <div className="border border-indigo-200 rounded-xl overflow-hidden">
                                        <div className="bg-indigo-50 p-3 flex items-center justify-between border-b border-indigo-100 flex-wrap gap-2">
                                            <div>
                                                <div className="text-xs font-bold text-indigo-800">Locked students — enter share for each</div>
                                                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                                    {lockedStudents.length} students · Allocated ₹{sharesTotal.toLocaleString('en-IN')}
                                                    {formData.academicYear ? ` · AY ${formData.academicYear}` : ''}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-sm font-bold ${remainingBalance < 0 ? 'text-red-600' : remainingBalance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    Balance ₹{remainingBalance.toLocaleString('en-IN')}
                                                </div>
                                                <div className="text-[10px] text-indigo-500 font-semibold">of ₹{proceedingAmountNum.toLocaleString('en-IN')}</div>
                                            </div>
                                            <button type="button" onClick={unlockStudents} className="text-xs font-bold text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg">
                                                Change Selection
                                            </button>
                                        </div>
                                        <div className="max-h-[360px] overflow-y-auto">
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 bg-white border-b">
                                                    <tr>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">PIN</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Quota</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Batch</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Current Yr</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Proc. Yr</th>
                                                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase w-36">Share Amount *</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {lockedStudents.map(s => {
                                                        const procYear = computeProceedingYear(s.batch, formData.academicYear)
                                                            ?? (Number(s.proceedingYear) > 0 ? Number(s.proceedingYear) : null);
                                                        return (
                                                        <tr key={s.studentId} className="hover:bg-indigo-50/30">
                                                            <td className="p-2 text-xs font-bold text-slate-800">{s.studentName}</td>
                                                            <td className="p-2 text-xs font-mono text-slate-600">{s.admissionNumber}</td>
                                                            <td className="p-2 text-xs font-mono text-slate-500">{s.pinNo || '-'}</td>
                                                            <td className="p-2 text-xs text-slate-500">{s.studType || '-'}</td>
                                                            <td className="p-2 text-xs font-mono text-slate-600">{s.batch || '-'}</td>
                                                            <td className="p-2 text-xs text-slate-600">{formatYearLabel(s.studentYear)}</td>
                                                            <td className="p-2 text-xs font-bold text-indigo-700">{formatYearLabel(procYear)}</td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    value={studentShareAmounts[s.studentId] ?? ''}
                                                                    onChange={(e) => handleStudentShareChange(s.studentId, e.target.value)}
                                                                    placeholder="0.00"
                                                                    className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-100 ${
                                                                        !(Number(studentShareAmounts[s.studentId]) > 0)
                                                                            ? 'bg-red-50 border border-red-300'
                                                                            : 'bg-slate-50 border border-slate-200'
                                                                    }`}
                                                                />
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-3 border-t border-indigo-100 bg-indigo-50 flex items-center justify-between gap-3 flex-wrap text-xs font-bold">
                                            <span className="text-indigo-800">Proceeding Amount: ₹{proceedingAmountNum.toLocaleString('en-IN')}</span>
                                            <span className="text-indigo-700">Allocated: ₹{sharesTotal.toLocaleString('en-IN')}</span>
                                            <span className={remainingBalance < 0 ? 'text-red-600' : remainingBalance === 0 ? 'text-emerald-700' : 'text-amber-600'}>
                                                Balance: ₹{remainingBalance.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                    )}
                                    </>
                                )}

                                <div className="mt-6 flex justify-end gap-3">
                                    <button type="submit" disabled={!canSubmitProceeding || isSaving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                        {isSaving ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : `Create Proceeding (${lockedStudents.length || selectedCount} students)`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ═══ PENDING QUEUE TAB ═══ */}
                    {activeTab === 'pending' && (
                        <>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-3">
                                <div className="relative min-w-[200px] flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" placeholder="Search pending / verified..." value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                                </div>
                                {pendingSearch && (
                                    <button onClick={() => setPendingSearch('')} className="text-xs font-bold text-red-500 hover:text-red-600 py-2 px-3 hover:bg-red-50 rounded-xl">Clear</button>
                                )}
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                {loading ? (
                                    <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="p-4 font-semibold text-slate-600 text-sm">Proceeding No</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm">College / Course</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Amount</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Students</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm">Requested By</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm">Verified By</th>
                                                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {pendingQueue.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="p-12 text-center text-slate-400 italic text-sm">No pending or verified proceedings</td>
                                                </tr>
                                            ) : pendingQueue.map(proc => (
                                                <tr key={proc._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800">{proc.proceedingNumber}</div>
                                                        <div className="text-[10px] text-slate-500 font-medium">
                                                            {proc.proceedingDate ? new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                            {proc.academicYear ? ` · ${proc.academicYear}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-700 text-xs">{proc.college}</div>
                                                        <div className="text-[10px] text-slate-500 font-medium uppercase">{proc.course} {proc.batch ? `(${proc.batch})` : ''} - {proc.caste || 'ALL'}</div>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-slate-800">₹{(proc.amount || 0).toLocaleString('en-IN')}</td>
                                                    <td className="p-4 text-center">
                                                        <span className="px-2 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-100">{proc.studentCount || 0}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${STATUS_BADGE[proc.status] || STATUS_BADGE.Pending}`}>{proc.status}</span>
                                                    </td>
                                                    <td className="p-4 text-xs font-medium text-slate-600">{proc.requestedByName || '-'}</td>
                                                    <td className="p-4 text-xs font-medium text-slate-600">{proc.verifiedByName || '-'}</td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-1 items-center flex-wrap">
                                                            {proc.status === 'Pending' && canVerify && (
                                                                <button onClick={() => handleVerify(proc)} className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1" title="Verify">
                                                                    <ShieldCheck size={14} /> Verify
                                                                </button>
                                                            )}
                                                            {proc.status === 'Verified' && canApprove && (
                                                                <button onClick={() => openApproveModal(proc)} className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1" title="Approve">
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                            )}
                                                            {proc.status === 'Pending' && canEdit && (
                                                                <>
                                                                    <button onClick={() => handleEdit(proc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                                    <button onClick={() => handleDelete(proc._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}

                    {/* ═══ GUIDE TAB ═══ */}
                    {activeTab === 'guide' && (
                        <div className="w-full space-y-4 sm:space-y-5">
                            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 lg:p-8">
                                <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-1">Proceedings workflow</h2>
                                <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6 leading-relaxed">
                                    Follow these steps end-to-end. Flow:{' '}
                                    <span className="font-semibold text-slate-700">Create → Verify → Approve → Transactions (now or nightly)</span>
                                </p>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                                    {[
                                        {
                                            step: 1,
                                            title: 'Create Proceeding',
                                            who: 'User with Create / Edit permission',
                                            color: 'blue',
                                            points: [
                                                'Open Create Proceeding and enter Proceeding Number, Date, Academic Year, and Proceeding Amount (fixed at top).',
                                                'Select College / Course (and optional Caste / Batch), then Load Students.',
                                                'Students are not selected by default — filter by quota and select the required students.',
                                                'Click Confirm Selection & Enter Amounts to lock the list.',
                                                'Enter a share amount for every student (must be greater than zero).',
                                                'Balance = Proceeding Amount − Allocated shares. Create is allowed only when Balance is ₹0.',
                                                'Proceeding Year is calculated from Batch + Academic Year (e.g. batch 2024 + AY 2025-2026 = 2nd Year).',
                                                'Draft is auto-saved; after refresh use Restore Draft to continue.',
                                                'On success the proceeding is saved as Pending.'
                                            ]
                                        },
                                        {
                                            step: 2,
                                            title: 'Verify Proceeding',
                                            who: 'User with Verify permission',
                                            color: 'indigo',
                                            points: [
                                                'Open Pending Queue and find proceedings with status Pending.',
                                                'Review details and mapped students.',
                                                'Click Verify — status becomes Verified.',
                                                'Only Pending proceedings can be edited or deleted.'
                                            ]
                                        },
                                        {
                                            step: 3,
                                            title: 'Approve Proceeding',
                                            who: 'User with Approve permission',
                                            color: 'emerald',
                                            points: [
                                                'Only Verified proceedings can be approved.',
                                                'Enter Bank Account, Bank Credited Date, Bank Credited Amount, and Fee Head.',
                                                'If bank credit is less than proceeding amount, use Zero Share on some students so shares total equals bank credit (students stay mapped).',
                                                'Approve is allowed only when Sum of shares = Bank credited amount.',
                                                'Choose either Approve & Create Transactions Now, or Approve for Nightly Run.'
                                            ]
                                        },
                                        {
                                            step: 4,
                                            title: 'Transactions (Bank → RTF)',
                                            who: 'System (on approve or nightly job)',
                                            color: 'violet',
                                            points: [
                                                'Transactions are created like Fee Collection: Mode Bank / Online, Instrument RTF (paymentMode = RTF).',
                                                'Type: DEBIT · Linked to proceeding · Fee head from approval.',
                                                'Collected by = Approver name · Transaction date = Approval date.',
                                                'Students with ₹0 share remain mapped but get no transaction.',
                                                'Immediate: created right away. Nightly: status Active with transactionsGenerated = false, then created at 3:00 AM IST by the scheduler.'
                                            ]
                                        },
                                        {
                                            step: 5,
                                            title: 'Reports',
                                            who: 'Anyone with report access',
                                            color: 'amber',
                                            points: [
                                                'RTF / proceeding transactions appear in a separate table in College, Account, Cashier, and Daily report templates.',
                                                'That table shows Proceeding Number and Approved By.',
                                                'They are not mixed into the normal Bank / Online list.'
                                            ]
                                        }
                                    ].map((block) => (
                                        <div
                                            key={block.step}
                                            className={`rounded-xl sm:rounded-2xl border border-slate-100 overflow-hidden h-full flex flex-col ${
                                                block.step === 5 ? 'xl:col-span-2' : ''
                                            }`}
                                        >
                                            <div className={`px-3 sm:px-4 py-3 flex items-start gap-3 ${
                                                block.color === 'blue' ? 'bg-blue-50' :
                                                block.color === 'indigo' ? 'bg-indigo-50' :
                                                block.color === 'emerald' ? 'bg-emerald-50' :
                                                block.color === 'violet' ? 'bg-violet-50' : 'bg-amber-50'
                                            }`}>
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                                                    block.color === 'blue' ? 'bg-blue-600' :
                                                    block.color === 'indigo' ? 'bg-indigo-600' :
                                                    block.color === 'emerald' ? 'bg-emerald-600' :
                                                    block.color === 'violet' ? 'bg-violet-600' : 'bg-amber-600'
                                                }`}>
                                                    {block.step}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-800 text-sm sm:text-base">{block.title}</div>
                                                    <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{block.who}</div>
                                                </div>
                                            </div>
                                            <ul className="px-3 sm:px-5 py-3 sm:py-4 space-y-2 bg-white flex-1">
                                                {block.points.map((p, i) => (
                                                    <li key={i} className="text-xs sm:text-sm text-slate-600 flex gap-2 leading-relaxed">
                                                        <span className="text-slate-300 font-bold shrink-0 mt-0.5">•</span>
                                                        <span className="min-w-0 break-words">{p}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 text-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm leading-relaxed">
                                <div className="font-bold mb-3 text-white text-sm sm:text-base">Quick status path</div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-semibold">
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30">Pending</span>
                                    <span className="text-slate-500 hidden sm:inline">→</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">Verified</span>
                                    <span className="text-slate-500 hidden sm:inline">→</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">Active</span>
                                    <span className="text-slate-500 hidden sm:inline">→</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-200 border border-violet-400/30">RTF Transactions</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ EDIT MODAL (from Pending Queue only) ═══ */}
            {showEditModal && isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeEditModal}></div>
                    <div className="relative bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 className="text-lg font-bold">Edit Proceeding</h2>
                                <p className="text-blue-100 text-sm mt-1">{formData.proceedingNumber || 'Update pending proceeding details'}</p>
                            </div>
                            <button type="button" onClick={closeEditModal} className="text-white/80 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Proceeding Number *</label>
                                    <input type="text" name="proceedingNumber" value={formData.proceedingNumber} onChange={handleInputChange} required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm" />
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
                                    <input
                                        type="number"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm font-mono"
                                    />
                                </div>
                            </div>

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
                                    <button type="button" onClick={handleLoadStudents} disabled={loadingStudents || studentsLocked} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 justify-center disabled:opacity-50">
                                        {loadingStudents ? <><Loader2 size={16} className="animate-spin" /> Loading...</> : <><Users size={16} /> Load Students</>}
                                    </button>
                                </div>
                            </div>

                            {loadedStudents.length > 0 && (
                                <>
                                {!studentsLocked ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 p-3 flex items-center justify-between border-b border-slate-200 flex-wrap gap-2">
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={filteredLoadedStudents.length > 0 && filteredLoadedStudents.every(s => studentChecks[s.studentId])} onChange={(e) => toggleAllStudents(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                                <span className="text-xs font-bold text-slate-600">Select All (filtered)</span>
                                            </label>
                                            <span className="text-xs font-bold text-blue-600">{selectedCount} / {loadedStudents.length} selected</span>
                                        </div>
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search students..." className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 w-48" />
                                        </div>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto">
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
                                    <div className="p-3 border-t border-slate-200 bg-white flex justify-end">
                                        <button type="button" onClick={lockSelectedStudents} disabled={selectedCount === 0} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                                            Confirm Selection ({selectedCount}) & Enter Amounts
                                        </button>
                                    </div>
                                </div>
                                ) : (
                                <div className="border border-indigo-200 rounded-xl overflow-hidden">
                                    <div className="bg-indigo-50 p-3 flex items-center justify-between border-b border-indigo-100 flex-wrap gap-2">
                                        <div>
                                            <div className="text-xs font-bold text-indigo-800">Locked students — enter share for each</div>
                                            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                                {lockedStudents.length} students · Allocated ₹{sharesTotal.toLocaleString('en-IN')}
                                                {formData.academicYear ? ` · AY ${formData.academicYear}` : ''}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${remainingBalance < 0 ? 'text-red-600' : remainingBalance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                Balance ₹{remainingBalance.toLocaleString('en-IN')}
                                            </div>
                                            <div className="text-[10px] text-indigo-500 font-semibold">of ₹{proceedingAmountNum.toLocaleString('en-IN')}</div>
                                        </div>
                                        <button type="button" onClick={unlockStudents} className="text-xs font-bold text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg">
                                            Change Selection
                                        </button>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto">
                                        <table className="w-full text-left">
                                            <thead className="sticky top-0 bg-white border-b">
                                                <tr>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">PIN</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Quota</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Batch</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Current Yr</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">Proc. Yr</th>
                                                    <th className="p-2 text-[10px] font-bold text-slate-500 uppercase w-36">Share Amount *</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {lockedStudents.map(s => {
                                                    const procYear = computeProceedingYear(s.batch, formData.academicYear)
                                                        ?? (Number(s.proceedingYear) > 0 ? Number(s.proceedingYear) : null);
                                                    return (
                                                    <tr key={s.studentId} className="hover:bg-indigo-50/30">
                                                        <td className="p-2 text-xs font-bold text-slate-800">{s.studentName}</td>
                                                        <td className="p-2 text-xs font-mono text-slate-600">{s.admissionNumber}</td>
                                                        <td className="p-2 text-xs font-mono text-slate-500">{s.pinNo || '-'}</td>
                                                        <td className="p-2 text-xs text-slate-500">{s.studType || '-'}</td>
                                                        <td className="p-2 text-xs font-mono text-slate-600">{s.batch || '-'}</td>
                                                        <td className="p-2 text-xs text-slate-600">{formatYearLabel(s.studentYear)}</td>
                                                        <td className="p-2 text-xs font-bold text-indigo-700">{formatYearLabel(procYear)}</td>
                                                        <td className="p-2">
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                step="0.01"
                                                                value={studentShareAmounts[s.studentId] ?? ''}
                                                                onChange={(e) => handleStudentShareChange(s.studentId, e.target.value)}
                                                                placeholder="0.00"
                                                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-100 ${
                                                                    !(Number(studentShareAmounts[s.studentId]) > 0)
                                                                        ? 'bg-red-50 border border-red-300'
                                                                        : 'bg-slate-50 border border-slate-200'
                                                                }`}
                                                            />
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-3 border-t border-indigo-100 bg-indigo-50 flex items-center justify-between gap-3 flex-wrap text-xs font-bold">
                                        <span className="text-indigo-800">Proceeding Amount: ₹{proceedingAmountNum.toLocaleString('en-IN')}</span>
                                        <span className="text-indigo-700">Allocated: ₹{sharesTotal.toLocaleString('en-IN')}</span>
                                        <span className={remainingBalance < 0 ? 'text-red-600' : remainingBalance === 0 ? 'text-emerald-700' : 'text-amber-600'}>
                                            Balance: ₹{remainingBalance.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                                )}
                                </>
                            )}

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={closeEditModal} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                                <button type="submit" disabled={!canSubmitProceeding || isSaving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> Updating...</> : 'Update Proceeding'}
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
                    <div className="relative bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-emerald-600 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 className="text-xl font-bold">Approve Proceeding</h2>
                                <p className="text-emerald-100 text-sm mt-1">{approvingProc.proceedingNumber} — {approvingProc.college} / {approvingProc.course}{approvingProc.academicYear ? ` · AY ${approvingProc.academicYear}` : ''}</p>
                            </div>
                            <button onClick={() => setShowApproveModal(false)} className="text-white/80 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-700">Proceeding Amount</span>
                                <span className="text-sm font-bold text-blue-800">₹{(approvingProc.amount || 0).toLocaleString('en-IN')}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Account * <span className="text-slate-400 font-normal">(Fee Collection deposit account)</span></label>
                                    <div className="relative">
                                        <select value={approveData.bankAccount} onChange={(e) => setApproveData(prev => ({ ...prev, bankAccount: e.target.value }))} required className="w-full px-3 py-2 pr-8 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                            <option value="">Select Account</option>
                                            {paymentConfigs.map(c => <option key={c._id} value={c.account_name}>{c.account_name} ({c.bank_name})</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Credited Date * <span className="text-slate-400 font-normal">(instrument / payment date)</span></label>
                                    <input type="date" value={approveData.bankCreditedDate} onChange={(e) => setApproveData(prev => ({ ...prev, bankCreditedDate: e.target.value }))} required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Bank Credited Amount *</label>
                                    <input type="number" value={approveData.bankCreditedAmount} onChange={(e) => setApproveData(prev => ({ ...prev, bankCreditedAmount: e.target.value }))} required placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600">Fee Head * <span className="text-slate-400 font-normal">(Bank → RTF instrument)</span></label>
                                    <div className="relative">
                                        <select value={approveData.feeHead} onChange={(e) => setApproveData(prev => ({ ...prev, feeHead: e.target.value }))} required className="w-full px-3 py-2 pr-8 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 text-sm appearance-none cursor-pointer">
                                            <option value="">Select Fee Head</option>
                                            {feeHeads.map(fh => <option key={fh._id} value={fh._id}>{fh.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4 p-3 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-800 text-xs font-semibold">
                                Transactions will be created like Fee Collection: <span className="font-bold">Mode Bank / Online · Instrument RTF</span>
                                {' '}(paymentMode = RTF, deposited to selected bank account, date = bank credited date).
                            </div>

                            {approveBankAmount > Number(approvingProc.amount || 0) + 0.009 && (
                                <div className="mb-4 p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-semibold">
                                    Bank credited amount cannot be greater than proceeding amount (₹{Number(approvingProc.amount || 0).toLocaleString('en-IN')}).
                                </div>
                            )}

                            {bankLessThanProceeding && (
                                <div className="mb-4 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold">
                                    Bank credit is less than proceeding amount by ₹{(Number(approvingProc.amount || 0) - approveBankAmount).toLocaleString('en-IN')}.
                                    Zero share for some students so shares total equals bank credit. Students stay mapped (no transaction for ₹0 share).
                                </div>
                            )}

                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mapped Students & Shares ({approveStudents.length})</div>
                                    <div className="text-xs font-bold text-slate-600">
                                        Shares ₹{approveSharesTotal.toLocaleString('en-IN')}
                                        {approveBankAmount > 0 && (
                                            <span className={`ml-2 ${approveSharesMatchBank ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                · vs Bank ₹{approveBankAmount.toLocaleString('en-IN')}
                                                {!approveSharesMatchBank && ` (diff ₹${Math.abs(approveShareBankDiff).toLocaleString('en-IN')})`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 max-h-[280px] overflow-y-auto border border-slate-100">
                                    {approveStudents.length === 0 ? (
                                        <div className="text-xs text-slate-400 italic text-center py-4">Loading students...</div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="sticky top-0 bg-slate-50">
                                                <tr>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase">Student</th>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase">PIN</th>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase">Proc. Yr</th>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase text-right">Share</th>
                                                    <th className="pb-2 text-[10px] font-bold text-slate-500 uppercase text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {approveStudents.map((s) => {
                                                    const procYear = Number(s.proceedingYear) > 0
                                                        ? Number(s.proceedingYear)
                                                        : computeProceedingYear(s.batch, approvingProc.academicYear);
                                                    const isZeroed = !(Number(s.shareAmount) > 0);
                                                    return (
                                                    <tr key={s.studentId} className={isZeroed ? 'bg-red-50/60 opacity-80' : ''}>
                                                        <td className="py-1.5 text-xs font-medium text-slate-700">{s.studentName}</td>
                                                        <td className="py-1.5 text-xs font-mono text-slate-500">{s.admissionNumber}</td>
                                                        <td className="py-1.5 text-xs font-mono text-slate-500">{s.pinNo || '-'}</td>
                                                        <td className="py-1.5 text-xs font-bold text-indigo-700">{formatYearLabel(procYear)}</td>
                                                        <td className={`py-1.5 text-xs font-bold text-right font-mono ${isZeroed ? 'text-red-600' : 'text-indigo-700'}`}>
                                                            ₹{Number(s.shareAmount || 0).toLocaleString('en-IN')}
                                                            {isZeroed && Number(s.originalShareAmount) > 0 && (
                                                                <div className="text-[9px] font-semibold text-slate-400">was ₹{Number(s.originalShareAmount).toLocaleString('en-IN')}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-1.5 text-right">
                                                            {isZeroed ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => restoreApproveStudentShare(s.studentId)}
                                                                    className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg"
                                                                >
                                                                    Restore
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => zeroApproveStudentShare(s.studentId)}
                                                                    disabled={!(approveBankAmount > 0 && approveShareBankDiff > 0.009)}
                                                                    title="Zero this share (student stays mapped)"
                                                                    className="text-[10px] font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                                                >
                                                                    Zero Share
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs font-bold text-slate-600 text-center">
                                {approveTxnCount} student(s) will get transactions · {approveStudents.length - approveTxnCount} mapped with ₹0 share
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleApproveSubmit(true)}
                                    disabled={!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead || !approveSharesMatchBank || approveBankAmount > Number(approvingProc.amount || 0) + 0.009}
                                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    <CheckCircle size={18} /> Approve & Create Transactions Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApproveSubmit(false)}
                                    disabled={!approveData.bankAccount || !approveData.bankCreditedAmount || !approveData.bankCreditedDate || !approveData.feeHead || !approveSharesMatchBank || approveBankAmount > Number(approvingProc.amount || 0) + 0.009}
                                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
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
