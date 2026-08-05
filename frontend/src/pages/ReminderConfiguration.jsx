import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Mail, MessageSquare, Bell, Plus, Trash2, Save, Edit, Edit2, Send, Users, CheckSquare, Square, X, Loader2, Calendar, Clock, Activity, Search, BookOpen, Layers, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

const SMS_RECIPIENT_OPTIONS = [
    { value: 'student', label: 'Student Mobile' },
    { value: 'parent', label: 'Parent Mobile' },
    { value: 'guardian', label: 'Guardian Mobile' }
];

const EMPTY_CONFIG_FORM = {
    academicYear: '',
    dueSourceType: 'ACADEMIC',
    triggerType: 'BEFORE',
    offsets: [],
    currentOffsetInput: '',
    smsTemplateId: '',
    emailTemplateId: '',
    enableSMS: true,
    enableEmail: false,
    smsRecipients: ['student'],
    quotas: [],
    colleges: [],
    courses: []
};

const EMPTY_TEMPLATE_FORM = {
    name: '',
    subject: '',
    templateId: '',
    senderId: '',
    body: '',
    variableMap: []
};

/** Sync dropdown rows from {#var#} (positional) and {{named}} placeholders. */
const syncVariableMapFromBody = (body, existingMap = []) => {
    const text = String(body || '');
    const keys = [];
    const dltCount = (text.match(/\{#var#\}/gi) || []).length;
    for (let i = 1; i <= dltCount; i += 1) keys.push(`var_${i}`);
    for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
        if (!keys.includes(m[1])) keys.push(m[1]);
    }
    return keys.map((key, idx) => {
        const existing = (existingMap || []).find(m => m.key === key);
        return {
            key,
            index: key.startsWith('var_') ? Number(key.replace('var_', '')) || (idx + 1) : undefined,
            source: existing?.source || ''
        };
    });
};

const variableRowLabel = (row) => {
    if (row.key?.startsWith('var_')) {
        const n = row.index || Number(row.key.replace('var_', '')) || 1;
        return `Variable ${n}  ({#var#} #${n})`;
    }
    return `{{${row.key}}}`;
};

const formatPreviewDate = (d) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dd}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
};

/** Summarize Fee Collection dues for reminder placeholders. */
const summarizeStudentFeeContext = (feeDetails = []) => {
    const active = (feeDetails || []).filter(f => f && f.isActive !== false);
    let dueAmount = 0;
    let lateFeeAmount = 0;
    const headNames = [];
    const dueDates = [];

    active.forEach((f) => {
        const due = Number(f.dueAmount) || 0;
        const name = String(f.feeHeadName || '');
        const code = String(f.feeHeadCode || '');
        const remarks = String(f.remarks || '');
        const isLate = /late\s*fee/i.test(name) || /late\s*fee/i.test(code) || /late\s*fee/i.test(remarks);

        // Pending fee = main dues; late fee stays in its own placeholder (matches Fee Collection split)
        if (isLate) {
            lateFeeAmount += due;
        } else {
            dueAmount += due;
            if (due > 0 && name) headNames.push(name);
        }

        const remarkDue = remarks.match(/\|\s*Due:\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4})/i);
        if (remarkDue) dueDates.push(remarkDue[1]);

        (f.terms || []).forEach((t) => {
            if (t?.fixedDueDate) {
                const formatted = formatPreviewDate(t.fixedDueDate);
                if (formatted) dueDates.push(formatted);
            }
        });
    });

    // Prefer earliest parsed fixed due date string; fallback empty for caller
    let dueDate = '';
    if (dueDates.length) {
        dueDate = dueDates[0];
    }

    return {
        due_amount: dueAmount > 0 ? dueAmount.toLocaleString('en-IN') : '0',
        late_fee_amount: lateFeeAmount > 0 ? lateFeeAmount.toLocaleString('en-IN') : '0',
        due_date: dueDate || (dueAmount > 0 || lateFeeAmount > 0 ? 'at the earliest' : 'N/A'),
        fee_head_name: headNames.slice(0, 3).join(', ') || '',
        academic_year: active.find(f => f.academicYear)?.academicYear || active[0]?.academicYear || '',
        term_number: '',
        offset_days: '',
        // raw numbers for summary line
        _due_amount_raw: dueAmount,
        _late_fee_amount_raw: lateFeeAmount
    };
};

const fetchStudentFeeContext = async (student, { academicYear = '', dueSourceType = '' } = {}) => {
    if (!student?.admission_number) {
        return {
            due_amount: 0,
            late_fee_amount: 0,
            due_date: 'N/A',
            fee_head_name: '',
            academic_year: academicYear || '',
            term_number: '',
            offset_days: ''
        };
    }
    const res = await api.get(`/fee-structures/student/${student.admission_number}`, {
        params: {
            college: student.college,
            course: student.course,
            branch: student.branch,
            studentYear: student.current_year,
            academicYear: academicYear || undefined,
            dueSourceType: dueSourceType || undefined
        }
    });
    const ctx = summarizeStudentFeeContext(res.data || []);
    if (academicYear && !ctx.academic_year) ctx.academic_year = academicYear;
    return ctx;
};

const ReminderConfiguration = () => {
    // Top Level Mode: 'CONFIG' | 'SEND' | 'TIMELY' | 'SETUP'
    const [mode, setMode] = useState('CONFIG');

    // --- CONFIG MODE STATE ---
    const [activeTab, setActiveTab] = useState('SMS');
    const [templates, setTemplates] = useState([]);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_TEMPLATE_FORM });
    const [variableSources, setVariableSources] = useState([]);

    // --- SEND MODE STATE ---
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [batches, setBatches] = useState([]);
    const [filters, setFilters] = useState({ college: '', course: '', branch: '', batch: '' });
    const [sendDueSourceType, setSendDueSourceType] = useState('ACADEMIC');
    const [sendAcademicYear, setSendAcademicYear] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [sendTemplateId, setSendTemplateId] = useState('');
    const [sendType, setSendType] = useState('SMS'); // SMS or EMAIL
    const [missingEmailStudent, setMissingEmailStudent] = useState(null); // { student, email: '' } for modal
    const [newEmail, setNewEmail] = useState('');
    const [previewFeeContext, setPreviewFeeContext] = useState(null);
    const [isLoadingPreviewFees, setIsLoadingPreviewFees] = useState(false);
    const [pendingSendRecipients, setPendingSendRecipients] = useState(null); // confirm modal
    const [sendResultModal, setSendResultModal] = useState(null); // { type: 'success'|'error'|'info', title, message }

    const [academicYears, setAcademicYears] = useState([]);
    const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
    const [calendarFilters, setCalendarFilters] = useState({ course: '' });

    // --- TIMELY MODE STATE ---
    const [configs, setConfigs] = useState([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [configForm, setConfigForm] = useState({ ...EMPTY_CONFIG_FORM });
    const [quotaOptions, setQuotaOptions] = useState([]); // from student_quotas table

    // Filters for Active Rules List
    const [ruleFilters, setRuleFilters] = useState({
        dueSourceType: '',
        academicYear: ''
    });

    const [editingConfigId, setEditingConfigId] = useState(null); // Track which rule is being edited
    const [ruleScope, setRuleScope] = useState('COLLEGE'); // 'COLLEGE' | 'COURSE' | 'QUOTA'

    const filteredCalendarData = React.useMemo(() => {
        return academicYears.filter(item =>
            !calendarFilters.course || item.course_name === calendarFilters.course
        );
    }, [academicYears, calendarFilters]);

    const uniqueCalendarCourses = React.useMemo(() => {
        return [...new Set(academicYears.map(item => item.course_name))].sort();
    }, [academicYears]);

    const groupedCalendar = React.useMemo(() => {
        const groups = {};
        academicYears.forEach(item => {
            if (!groups[item.year_label]) groups[item.year_label] = {};
            if (!groups[item.year_label][item.course_name]) groups[item.year_label][item.course_name] = [];
            groups[item.year_label][item.course_name].push(item);
        });
        return groups;
    }, [academicYears]);

    // --- SHARED EFFECTS ---
    useEffect(() => {
        fetchTemplates();
        fetchMetadata();
        fetchAcademicYears();
        fetchVariableSources();
    }, []);

    useEffect(() => {
        if (mode === 'TIMELY') {
            fetchConfigs();
        }
    }, [mode]);

    const fetchVariableSources = async () => {
        try {
            const res = await api.get(`/reminders/variable-sources`);
            setVariableSources(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };
    const fetchAcademicYears = async () => {
        setIsFetchingCalendar(true);
        try {
            const res = await api.get(`/academic-calendar/academic-years`);
            setAcademicYears(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsFetchingCalendar(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get(`/reminders/templates`);
            setTemplates(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const response = await api.get(`/students/metadata`);
            const meta = response.data.hierarchy || response.data;
            const batchList = response.data.batches || [];
            setMetadata(meta);
            setBatches(batchList);
            setColleges(Object.keys(meta));
            setQuotaOptions(response.data.categories || []);
        } catch (error) {
            console.error('Error fetching metadata', error);
        }
    };

    // --- CONFIG HANDLERS ---
    const handleSave = async () => {
        if (!formData.name || !formData.body) return alert("Name and Body are required");
        if (activeTab === 'EMAIL' && (!formData.subject || !formData.senderId)) return alert("Subject and Sender ID are required for Email");

        const map = syncVariableMapFromBody(formData.body, formData.variableMap);
        const unmapped = map.filter(m => !m.source);
        if (map.length && unmapped.length) {
            return alert(`Map a source for every variable: ${unmapped.map(variableRowLabel).join(', ')}`);
        }

        setIsSaving(true);
        try {
            await api.post(`/reminders/templates`, {
                _id: editingTemplate?._id,
                type: activeTab,
                ...formData,
                variableMap: map
            });
            fetchTemplates();
            resetForm();
        } catch (error) {
            console.error(error);
            alert('Failed to save template');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await api.delete(`/reminders/templates/${id}`);
            fetchTemplates();
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        }
    };

    const resetForm = () => {
        setEditingTemplate(null);
        setFormData({ ...EMPTY_TEMPLATE_FORM });
    };

    const startEdit = (tpl) => {
        setEditingTemplate(tpl);
        setFormData({
            name: tpl.name,
            subject: tpl.subject || '',
            templateId: tpl.templateId || '',
            senderId: tpl.senderId || '',
            body: tpl.body,
            variableMap: syncVariableMapFromBody(tpl.body, tpl.variableMap || [])
        });
        setActiveTab(tpl.type);
    };

    const insertVariable = (variable) => {
        setFormData(prev => {
            const body = prev.body + variable;
            return {
                ...prev,
                body,
                variableMap: syncVariableMapFromBody(body, prev.variableMap)
            };
        });
    };

    const updateBody = (body) => {
        setFormData(prev => ({
            ...prev,
            body,
            variableMap: syncVariableMapFromBody(body, prev.variableMap)
        }));
    };

    const updateVariableSource = (key, source) => {
        setFormData(prev => ({
            ...prev,
            variableMap: (prev.variableMap || []).map(m => m.key === key ? { ...m, source } : m)
        }));
    };
    // --- SEND MODE HANDLERS ---
    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFilters({ ...filters, college, course: '', branch: '' });
        setCourses(college ? Object.keys(metadata[college] || {}) : []);
        setBranches([]);
    };

    const handleCourseChange = (e) => {
        const course = e.target.value;
        const newFilters = { ...filters, course, branch: '' };
        if (course && filters.college) {
            setBranches(metadata[filters.college][course]?.branches || []);
        }
        setFilters(newFilters);
    };

    const fetchStudents = async () => {
        if (!filters.college) {
            setSendResultModal({
                type: 'info',
                title: 'College Required',
                message: 'Please select a college before fetching students.'
            });
            return;
        }
        setIsFetching(true);
        try {
            const res = await api.get(`/students`, {
                params: {
                    college: filters.college,
                    course: filters.course || undefined,
                    branch: filters.branch || undefined,
                    batch: filters.batch || undefined
                }
            });
            setStudents(res.data);
            setSelectedStudents([]); // Reset selection
            setSearchTerm('');
        } catch (error) {
            console.error(error);
            setSendResultModal({
                type: 'error',
                title: 'Fetch Failed',
                message: 'Failed to fetch students. Please try again.'
            });
        } finally {
            setIsFetching(false);
        }
    };

    const filteredStudents = React.useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return students;
        return students.filter(s =>
            (s.student_name || '').toLowerCase().includes(term) ||
            (s.admission_number || '').toLowerCase().includes(term) ||
            (s.pin_no || '').toLowerCase().includes(term) ||
            String(s.student_mobile || '').toLowerCase().includes(term)
        );
    }, [students, searchTerm]);

    const toggleSelectAll = () => {
        const visibleIds = filteredStudents.map(s => s.admission_number);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedStudents.includes(id));
        if (allVisibleSelected) {
            setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const toggleStudent = (id) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(prev => prev.filter(sid => sid !== id));
        } else {
            setSelectedStudents(prev => [...prev, id]);
        }
    };

    const initiateSend = () => {
        if (selectedStudents.length === 0) {
            setSendResultModal({
                type: 'info',
                title: 'No Students Selected',
                message: 'Please select at least one student before sending reminders.'
            });
            return;
        }
        if (!sendTemplateId) {
            setSendResultModal({
                type: 'info',
                title: 'Template Required',
                message: 'Please select an SMS or Email template to continue.'
            });
            return;
        }

                const recipients = students.filter(s => selectedStudents.includes(s.admission_number));

        if (!sendDueSourceType || !sendAcademicYear) {
            setSendResultModal({
                type: 'info',
                title: 'Due Scope Required',
                message: 'Please select Due Source and Academic Year in the Action panel so the message uses the correct dues.'
            });
            return;
        }

        if (sendType === 'EMAIL') {
            const missing = recipients.find(r => !(r.student_email || r.email)?.trim());
            if (missing) {
                setMissingEmailStudent(missing);
                setNewEmail('');
                return;
            }
        }

        setPendingSendRecipients(recipients);
    };

    const handleMissingEmailSave = () => {
        if (!newEmail || !newEmail.includes('@')) {
            setSendResultModal({
                type: 'info',
                title: 'Invalid Email',
                message: 'Please enter a valid email address to continue.'
            });
            return;
        }

        const updatedStudents = students.map(s =>
            s.admission_number === missingEmailStudent.admission_number
                ? { ...s, student_email: newEmail }
                : s
        );
        setStudents(updatedStudents);
        setMissingEmailStudent(null);
    };

    const confirmAndSend = async () => {
        const recipients = pendingSendRecipients;
        if (!recipients?.length) return;

        setIsSending(true);
        try {
            const enriched = await Promise.all(recipients.map(async (r) => {
                let computed = {
                    due_amount: 0,
                    late_fee_amount: 0,
                    due_date: 'N/A',
                    fee_head_name: '',
                    academic_year: '',
                    term_number: '',
                    offset_days: ''
                };
                try {
                    computed = await fetchStudentFeeContext(r, {
                        academicYear: sendAcademicYear,
                        dueSourceType: sendDueSourceType
                    });
                } catch (err) {
                    console.error('Fee context failed for', r.admission_number, err);
                }
                return {
                    admission_number: r.admission_number,
                    student_name: r.student_name,
                    email: r.student_email || r.email,
                    phone: r.student_mobile,
                    student: {
                        admission_number: r.admission_number,
                        student_name: r.student_name,
                        pin_no: r.pin_no,
                        college: r.college,
                        course: r.course,
                        branch: r.branch,
                        batch: r.batch,
                        student_mobile: r.student_mobile,
                        parent_mobile1: r.parent_mobile1 || null,
                        parent_mobile2: r.parent_mobile2 || null,
                        email: r.student_email || r.email,
                        stud_type: r.stud_type
                    },
                    computed,
                    due_amount: computed.due_amount,
                    due_date: computed.due_date,
                    late_fee_amount: computed.late_fee_amount
                };
            }));

            const res = await api.post(`/reminders/send`, {
                templateId: sendTemplateId,
                recipients: enriched,
                smsRecipients: ['student']
            });

            const results = res.data?.results || [];
            const ok = results.filter(r => r.status === 'success').length;
            const failed = results.filter(r => r.status === 'failed').length;
            const tplName = templates.find(t => t._id === sendTemplateId)?.name || sendType;

            setPendingSendRecipients(null);
            setSelectedStudents([]);
            setSendTemplateId('');
            setSendResultModal({
                type: failed > 0 && ok === 0 ? 'error' : (failed > 0 ? 'info' : 'success'),
                title: failed > 0 && ok === 0 ? 'Send Failed' : (failed > 0 ? 'Partially Sent' : 'Reminders Sent'),
                message: failed > 0
                    ? `${sendType} via “${tplName}”: ${ok} succeeded, ${failed} failed out of ${recipients.length}.`
                    : `${sendType} reminder “${tplName}” was sent to ${ok || recipients.length} student(s) successfully.`
            });
        } catch (error) {
            console.error(error);
            setPendingSendRecipients(null);
            setSendResultModal({
                type: 'error',
                title: 'Send Failed',
                message: error?.response?.data?.message || 'Failed to send reminders. Please try again.'
            });
        } finally {
            setIsSending(false);
        }
    };

    // --- TIMELY HANDLERS ---
    const fetchConfigs = async () => {
        try {
            const res = await api.get(`/reminders/config`);
            setConfigs(res.data);
        } catch (error) {
            console.error('Failed to fetch configs', error);
        }
    };

    const handleConfigSubmit = async () => {
        const { academicYear, dueSourceType, offsets, enableSMS, enableEmail, smsTemplateId, emailTemplateId, triggerType, smsRecipients, quotas, colleges: selectedColleges, courses: selectedCourses } = configForm;

        if (!academicYear || !dueSourceType || offsets.length === 0) {
            return alert("Academic Year, Due Source Type, and at least ONE Offset are required.");
        }

        // Scope validations
        if (ruleScope === 'COLLEGE') {
            if (!selectedColleges || selectedColleges.length === 0) {
                return alert("Please select at least one College.");
            }
        } else if (ruleScope === 'COURSE') {
            if (!selectedColleges || selectedColleges.length === 0) {
                return alert("Please select at least one College.");
            }
        }

        if (!enableSMS && !enableEmail) {
            return alert("Please select at least one channel (SMS or Email).");
        }
        if (enableSMS && !smsTemplateId) return alert("Please select an SMS Template.");
        if (enableEmail && !emailTemplateId) return alert("Please select an Email Template.");
        if (enableSMS && (!smsRecipients || smsRecipients.length === 0)) {
            return alert("Please select at least one SMS recipient (Student, Parent, or Guardian).");
        }

        setIsScheduling(true);
        try {
            const payload = {
                academicYear,
                dueSourceType,
                triggerType,
                offsets,
                smsTemplateId: enableSMS ? smsTemplateId : null,
                emailTemplateId: enableEmail ? emailTemplateId : null,
                smsRecipients: enableSMS ? smsRecipients : [],
                quotas: quotas || [], 
                colleges: selectedColleges || [],
                courses: ruleScope === 'COURSE' ? (selectedCourses || []) : []
            };

            if (editingConfigId) {
                await api.put(`/reminders/config/${editingConfigId}`, payload);
                alert('Rule Updated Successfully!');
                setEditingConfigId(null);
            } else {
                await api.post(`/reminders/config`, payload);
                alert('Rule Saved Successfully!');
            }

            setConfigForm({ ...EMPTY_CONFIG_FORM });
            setRuleScope('COLLEGE');
            fetchConfigs();
        } catch (error) {
            console.error(error);
            alert(error?.response?.data?.message || 'Failed to save rule.');
        } finally {
            setIsScheduling(false);
        }
    };

    const handleDeleteConfig = async (id) => {
        if (!window.confirm("Delete this rule?")) return;
        try {
            await api.delete(`/reminders/config/${id}`);
            fetchConfigs();
        } catch (error) {
            console.error("Failed to delete", error);
            alert("Failed to delete");
        }
    };

    const handleEditConfig = (cfg) => {
        setEditingConfigId(cfg._id);
        const scope = cfg.courses?.length > 0 ? 'COURSE' : 'COLLEGE';
        setRuleScope(scope);
        setConfigForm({
            academicYear: cfg.academicYear || '',
            dueSourceType: cfg.dueSourceType || 'ACADEMIC',
            triggerType: cfg.triggerType || 'BEFORE',
            offsets: cfg.offsets || [],
            currentOffsetInput: '',
            smsTemplateId: cfg.smsTemplateId?._id || cfg.smsTemplateId || '',
            emailTemplateId: cfg.emailTemplateId?._id || cfg.emailTemplateId || '',
            enableSMS: !!cfg.smsTemplateId,
            enableEmail: !!cfg.emailTemplateId,
            smsRecipients: cfg.smsRecipients?.length ? cfg.smsRecipients : ['student'],
            quotas: cfg.quotas || [],
            colleges: cfg.colleges || [],
            courses: cfg.courses || []
        });
    };

    const cancelEdit = () => {
        setEditingConfigId(null);
        setConfigForm({ ...EMPTY_CONFIG_FORM });
        setRuleScope('COLLEGE');
    };

    const allCoursesList = React.useMemo(() => {
        if (!metadata) return [];
        const unique = new Set();
        const selectedColleges = configForm.colleges || [];
        const targetColleges = selectedColleges.length > 0 ? selectedColleges : Object.keys(metadata);

        targetColleges.forEach(coll => {
            if (metadata[coll]) {
                Object.keys(metadata[coll]).forEach(course => {
                    unique.add(course);
                });
            }
        });
        return [...unique].sort();
    }, [metadata, configForm.colleges]);

    useEffect(() => {
        if (!metadata) return;
        const unique = new Set();
        const selectedColleges = configForm.colleges || [];
        const targetColleges = selectedColleges.length > 0 ? selectedColleges : Object.keys(metadata);

        targetColleges.forEach(coll => {
            if (metadata[coll]) {
                Object.keys(metadata[coll]).forEach(course => {
                    unique.add(course);
                });
            }
        });

        const filtered = (configForm.courses || []).filter(c => unique.has(c));
        if (JSON.stringify(filtered) !== JSON.stringify(configForm.courses)) {
            setConfigForm(prev => ({ ...prev, courses: filtered }));
        }
    }, [configForm.colleges, metadata]);

    // Extract Unique Academic Years for Dropdown
    const uniqueAcademicYears = [...new Set(academicYears.map(ay => ay.year_label))];

    const addOffset = () => {
        if (configForm.currentOffsetInput !== '' && !configForm.offsets.includes(Number(configForm.currentOffsetInput))) {
            setConfigForm(prev => ({
                ...prev,
                offsets: [...prev.offsets, Number(prev.currentOffsetInput)].sort((a, b) => a - b),
                currentOffsetInput: ''
            }));
        }
    };

    const removeOffset = (val) => {
        setConfigForm(prev => ({
            ...prev,
            offsets: prev.offsets.filter(o => o !== val)
        }));
    };
    // Filtered templates for dropdown
    const smsTemplates = templates.filter(t => t.type === 'SMS');
    const emailTemplates = templates.filter(t => t.type === 'EMAIL');
    const sendTemplates = templates.filter(t => t.type === sendType);
    const currentTemplates = templates.filter(t => t.type === activeTab);

    const selectedSendTemplate = sendTemplates.find(t => t._id === sendTemplateId) || null;
    const previewStudent = React.useMemo(() => {
        if (!selectedStudents.length) return students[0] || null;
        return students.find(s => s.admission_number === selectedStudents[0]) || null;
    }, [students, selectedStudents]);

    // Load real pending/late fee totals for preview (same API as Fee Collection)
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!previewStudent?.admission_number || !sendTemplateId || mode !== 'SEND') {
                setPreviewFeeContext(null);
                return;
            }
            setIsLoadingPreviewFees(true);
            try {
                const ctx = await fetchStudentFeeContext(previewStudent, {
                    academicYear: sendAcademicYear,
                    dueSourceType: sendDueSourceType
                });
                if (!cancelled) setPreviewFeeContext(ctx);
            } catch (err) {
                console.error('Preview fee load failed', err);
                if (!cancelled) {
                    setPreviewFeeContext({
                        due_amount: 0,
                        late_fee_amount: 0,
                        due_date: 'N/A',
                        fee_head_name: '',
                        academic_year: sendAcademicYear || '',
                        term_number: '',
                        offset_days: ''
                    });
                }
            } finally {
                if (!cancelled) setIsLoadingPreviewFees(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [previewStudent?.admission_number, sendTemplateId, mode, sendAcademicYear, sendDueSourceType]);

    const previewMessage = React.useMemo(() => {
        if (!selectedSendTemplate || !previewStudent) return null;

        const getByPath = (obj, path) => {
            if (!path) return undefined;
            return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
        };

        const feeCtx = previewFeeContext || {};
        const recipient = {
            admission_number: previewStudent.admission_number,
            student_name: previewStudent.student_name,
            student: {
                admission_number: previewStudent.admission_number,
                student_name: previewStudent.student_name,
                father_name: previewStudent.father_name,
                pin_no: previewStudent.pin_no,
                college: previewStudent.college,
                course: previewStudent.course,
                branch: previewStudent.branch,
                batch: previewStudent.batch,
                student_mobile: previewStudent.student_mobile,
                email: previewStudent.student_email || previewStudent.email,
                current_year: previewStudent.current_year,
                current_semester: previewStudent.current_semester,
                stud_type: previewStudent.stud_type
            },
            computed: {
                due_date: feeCtx.due_date || 'N/A',
                due_amount: feeCtx.due_amount != null ? feeCtx.due_amount : '',
                late_fee_amount: feeCtx.late_fee_amount != null ? feeCtx.late_fee_amount : '',
                term_number: feeCtx.term_number || '',
                fee_head_name: feeCtx.fee_head_name || '',
                academic_year: feeCtx.academic_year || '',
                offset_days: feeCtx.offset_days || ''
            }
        };

        const mapByKey = {};
        (selectedSendTemplate.variableMap || []).forEach((m) => {
            if (m?.key && m?.source) mapByKey[m.key] = m.source;
        });

        const resolveKey = (key) => {
            const source = mapByKey[key];
            if (source) {
                const fromPath = getByPath(recipient, source);
                if (fromPath !== undefined && fromPath !== null && fromPath !== '') return String(fromPath);
                const flat = source.includes('.') ? source.split('.').pop() : source;
                if (recipient[flat] != null && recipient[flat] !== '') return String(recipient[flat]);
            }
            if (recipient[key] != null && recipient[key] !== '') return String(recipient[key]);
            if (recipient.student?.[key] != null) return String(recipient.student[key]);
            if (recipient.computed?.[key] != null && recipient.computed[key] !== '') return String(recipient.computed[key]);
            return `[${key}]`;
        };

        let out = String(selectedSendTemplate.body || '');
        out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => resolveKey(key));
        let dltIndex = 0;
        out = out.replace(/\{#var#\}/gi, () => {
            dltIndex += 1;
            return resolveKey(`var_${dltIndex}`);
        });

        return {
            subject: selectedSendTemplate.subject
                ? String(selectedSendTemplate.subject).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => resolveKey(key))
                : '',
            body: out,
            studentLabel: `${previewStudent.student_name || 'Student'} (${previewStudent.admission_number})`,
            dueAmount: feeCtx.due_amount
        };
    }, [selectedSendTemplate, previewStudent, previewFeeContext]);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="p-6 pb-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Bell className="text-gray-800" size={24} /> Reminder System
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Configure templates and send automated notifications.</p>
                    </div>
                    {/* Mode Switcher */}
                    <div className="bg-gray-200 p-1 rounded-lg flex gap-1 w-fit">
                        <button
                            onClick={() => setMode('CONFIG')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition ${mode === 'CONFIG' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Configuration
                        </button>
                        <button
                            onClick={() => setMode('SEND')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition ${mode === 'SEND' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Send Reminders
                        </button>
                        <button
                            onClick={() => setMode('TIMELY')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition ${mode === 'TIMELY' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Reminder Rules
                        </button>
                        <button
                            onClick={() => setMode('SETUP')}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition ${mode === 'SETUP' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Setup Guide
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-6 pt-2 min-h-0">

                    {/* --- CONFIGURATION MODE --- */}
                    {mode === 'CONFIG' && (
                        <div className="w-full h-full flex gap-6 min-h-0">
                            {/* Left: Template List */}
                            <div className="w-1/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full min-h-0">
                                {/* Tabs */}
                                <div className="flex border-b border-gray-100 shrink-0">
                                    {['SMS', 'EMAIL', 'PUSH'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => { setActiveTab(type); resetForm(); }}
                                            className={`flex-1 py-3 text-xs font-bold flex justify-center items-center gap-2 ${activeTab === type ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            {type === 'SMS' && <MessageSquare size={14} />}
                                            {type === 'EMAIL' && <Mail size={14} />}
                                            {type === 'PUSH' && <Bell size={14} />}
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                {/* List */}
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                                    <button
                                        onClick={resetForm}
                                        className={`w-full p-2.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-xs font-bold mb-1 ${!editingTemplate ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
                                    >
                                        <Plus size={14} /> Create New Template
                                    </button>
                                    {currentTemplates.map(tpl => (
                                        <div
                                            key={tpl._id}
                                            onClick={() => startEdit(tpl)}
                                            className={`p-2.5 rounded-lg border cursor-pointer transition group relative
                                                ${editingTemplate?._id === tpl._id
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                    : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-xs truncate pr-6">{tpl.name}</h4>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(tpl._id); }}
                                                    className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition ${editingTemplate?._id === tpl._id ? 'text-white' : 'text-red-500 hover:bg-red-50'}`}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <p className={`text-[10px] mt-0.5 truncate ${editingTemplate?._id === tpl._id ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {tpl.body}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Right: Editor */}
                            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
                                <h2 className="text-lg font-bold text-gray-800 px-6 pt-6 pb-4 flex items-center gap-2 shrink-0">
                                    {editingTemplate ? <Edit2 size={18} className="text-blue-500" /> : <Plus size={18} className="text-green-500" />}
                                    {editingTemplate ? 'Edit Template' : `New ${activeTab} Template`}
                                </h2>
                                <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-6 pb-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Template Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                            placeholder="e.g. Fee Due Reminder"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    {activeTab === 'SMS' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DLT Template ID</label>
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                                placeholder="DLT Template ID"
                                                value={formData.templateId}
                                                onChange={e => setFormData({ ...formData, templateId: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    {activeTab === 'EMAIL' && (
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sender Email / ID</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                                    placeholder="e.g. accounts@college.edu"
                                                    value={formData.senderId}
                                                    onChange={e => setFormData({ ...formData, senderId: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                                    placeholder="Email Subject Line"
                                                    value={formData.subject}
                                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-1 gap-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Message Body</label>
                                            <div className="flex gap-1 flex-wrap justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => insertVariable('{#var#}')}
                                                    className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 transition font-bold"
                                                >
                                                    {'{#var#}'}
                                                </button>
                                                {['{{student_name}}', '{{due_amount}}', '{{due_date}}'].map(v => (
                                                    <button
                                                        key={v}
                                                        type="button"
                                                        onClick={() => insertVariable(v)}
                                                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-200 transition"
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            className="w-full h-full min-h-[140px] flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none font-mono"
                                            placeholder={'Paste DLT text, e.g.\nDear {#var#}, Pending fee: {#var#}. Late fee: {#var#}. - Pydah Group'}
                                            value={formData.body}
                                            onChange={e => updateBody(e.target.value)}
                                        ></textarea>
                                    </div>
                                    {(formData.variableMap || []).length > 0 && (
                                        <div className="border border-indigo-100 rounded-xl p-3 bg-indigo-50/40 space-y-2">
                                            <h4 className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1">
                                                <Info size={12} /> Map Variables (by order)
                                            </h4>
                                            <p className="text-[10px] text-gray-500">
                                                Each {'{#var#}'} in the message is Variable 1, 2, 3… in left-to-right order. Pick what fills each slot.
                                            </p>
                                            {(formData.variableMap || []).map(row => (
                                                <div key={row.key} className="flex items-center gap-2">
                                                    <div className="w-40 shrink-0">
                                                        <code className="text-[11px] font-bold text-indigo-800 bg-white px-2 py-1 rounded border border-indigo-100 block truncate">
                                                            {variableRowLabel(row)}
                                                        </code>
                                                    </div>
                                                    <select
                                                        className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                        value={row.source || ''}
                                                        onChange={e => updateVariableSource(row.key, e.target.value)}
                                                    >
                                                        <option value="">Select source…</option>
                                                        <optgroup label="Student table">
                                                            {variableSources.filter(s => s.group === 'Student').map(s => (
                                                                <option key={s.value} value={s.value}>{s.label}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="Computed at send time">
                                                            {variableSources.filter(s => s.group === 'Computed').map(s => (
                                                                <option key={s.value} value={s.value}>{s.label}</option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
                                    {editingTemplate && (
                                        <button
                                            onClick={resetForm}
                                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className={`px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        {editingTemplate ? 'Update Template' : 'Save Template'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TIMELY MODE --- */}
                    {mode === 'TIMELY' && (
                        <div className="w-full h-full flex gap-6 min-h-0">
                            <div className="w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
                                <h2 className="text-lg font-bold text-gray-800 px-6 pt-6 pb-4 flex items-center gap-2 shrink-0">
                                    <Clock className="text-blue-600" size={20} /> Reminder Rule
                                </h2>
                                <div className="space-y-5 flex-1 min-h-0 overflow-y-auto px-6 pb-2">
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Academic Year</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                    value={configForm.academicYear}
                                                    onChange={e => setConfigForm({ ...configForm, academicYear: e.target.value })}
                                                >
                                                    <option value="">Select AY</option>
                                                    {uniqueAcademicYears.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Due Source Type</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs"
                                                    value={configForm.dueSourceType}
                                                    onChange={e => setConfigForm({ ...configForm, dueSourceType: e.target.value })}
                                                >
                                                    <option value="ACADEMIC">Academic Fees</option>
                                                    <option value="HOSTEL">Hostel Fees</option>
                                                    <option value="TRANSPORT">Transport Fees</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Rule Scope Tab Selector */}
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Rule Scoping</label>
                                            <div className="bg-white p-0.5 rounded-lg border border-gray-200 flex gap-1 w-full">
                                                {['COLLEGE', 'COURSE'].map(sc => (
                                                    <button
                                                        key={sc}
                                                        type="button"
                                                        onClick={() => {
                                                            setRuleScope(sc);
                                                            if (sc === 'COLLEGE') {
                                                                setConfigForm(prev => ({ ...prev, courses: [] }));
                                                            }
                                                        }}
                                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition text-center
                                                            ${ruleScope === sc
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {sc === 'COLLEGE' ? 'College Wise' : 'Course Wise'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 1. Colleges Checklist (always visible) */}
                                        {colleges.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase">
                                                        Colleges
                                                    </label>
                                                    <span className="text-[10px] text-gray-400">
                                                        {(!configForm.colleges || configForm.colleges.length === 0) ? 'All colleges' : `${configForm.colleges.length} selected`}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {colleges.map(c => {
                                                        const checked = configForm.colleges?.includes(c) || false;
                                                        return (
                                                            <label
                                                                key={c}
                                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer text-[11px] font-bold transition select-none
                                                                    ${checked
                                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={checked}
                                                                    onChange={e => {
                                                                        const next = e.target.checked
                                                                            ? [...(configForm.colleges || []), c]
                                                                            : (configForm.colleges || []).filter(x => x !== c);
                                                                        setConfigForm({ ...configForm, colleges: next });
                                                                    }}
                                                                />
                                                                {c}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {(!configForm.colleges || configForm.colleges.length === 0) && (
                                                    <p className="text-[10px] text-gray-400 mt-1 italic">No college selected — rule applies to all colleges.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* 2. Courses Checklist (visible for COURSE) */}
                                        {ruleScope === 'COURSE' && allCoursesList.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase">
                                                        Courses
                                                    </label>
                                                    <span className="text-[10px] text-gray-400">
                                                        {(!configForm.courses || configForm.courses.length === 0) ? 'All courses' : `${configForm.courses.length} selected`}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {allCoursesList.map(c => {
                                                        const checked = configForm.courses?.includes(c) || false;
                                                        return (
                                                            <label
                                                                key={c}
                                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer text-[11px] font-bold transition select-none
                                                                    ${checked
                                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={checked}
                                                                    onChange={e => {
                                                                        const next = e.target.checked
                                                                            ? [...(configForm.courses || []), c]
                                                                            : (configForm.courses || []).filter(x => x !== c);
                                                                        setConfigForm({ ...configForm, courses: next });
                                                                    }}
                                                                />
                                                                {c}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {(!configForm.courses || configForm.courses.length === 0) && (
                                                    <p className="text-[10px] text-gray-400 mt-1 italic">No course selected — rule applies to all courses.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* 3. Quotas Checklist (always visible) */}
                                        {quotaOptions.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase">
                                                        Quotas
                                                    </label>
                                                    <span className="text-[10px] text-gray-400">
                                                        {configForm.quotas.length === 0 ? 'All quotas' : `${configForm.quotas.length} selected`}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {quotaOptions.map(q => {
                                                        const checked = configForm.quotas.includes(q);
                                                        return (
                                                            <label
                                                                key={q}
                                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer text-[11px] font-bold transition select-none
                                                                    ${checked
                                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={checked}
                                                                    onChange={e => {
                                                                        const next = e.target.checked
                                                                            ? [...configForm.quotas, q]
                                                                            : configForm.quotas.filter(x => x !== q);
                                                                        setConfigForm({ ...configForm, quotas: next });
                                                                    }}
                                                                />
                                                                {q}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {configForm.quotas.length === 0 && (
                                                    <p className="text-[10px] text-gray-400 mt-1 italic">No quota selected — rule applies to all quotas.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black uppercase text-gray-400">When to Send</h4>
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Add Offset (Days)</label>
                                                <div className="flex gap-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm font-bold"
                                                        placeholder="e.g. 3"
                                                        value={configForm.currentOffsetInput}
                                                        onChange={e => setConfigForm({ ...configForm, currentOffsetInput: e.target.value })}
                                                        onKeyDown={e => e.key === 'Enter' && addOffset()}
                                                    />
                                                    <button type="button" onClick={addOffset} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-3 font-bold">+</button>
                                                </div>
                                            </div>
                                            <div className="w-28 shrink-0">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Relative to Due</label>
                                                <select
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold"
                                                    value={configForm.triggerType}
                                                    onChange={e => setConfigForm({ ...configForm, triggerType: e.target.value })}
                                                >
                                                    <option value="BEFORE">BEFORE</option>
                                                    <option value="AFTER">AFTER</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {configForm.offsets.map(offset => (
                                                <span key={offset} className="px-3 py-1 bg-gray-800 text-white rounded-full text-xs font-bold flex items-center gap-1.5">
                                                    {offset} Days {configForm.triggerType}
                                                    <button type="button" onClick={() => removeOffset(offset)} className="bg-gray-600 rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-500 text-[9px] transition">×</button>
                                                </span>
                                            ))}
                                            {configForm.offsets.length === 0 && <span className="text-xs text-gray-400 italic">No offsets added.</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500 leading-tight bg-blue-50 p-2 rounded border border-blue-100 italic">
                                            Example: "3 Days BEFORE" sends to unpaid students 3 days before their fee due date (from late-fee timing). Offset 0 BEFORE = on due date.
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <h4 className="text-xs font-black uppercase text-gray-400">Message Channels</h4>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={configForm.enableSMS} onChange={e => setConfigForm({ ...configForm, enableSMS: e.target.checked })} />
                                                <span className="text-xs font-bold text-gray-700">Send SMS</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={configForm.enableEmail} onChange={e => setConfigForm({ ...configForm, enableEmail: e.target.checked })} />
                                                <span className="text-xs font-bold text-gray-700">Send Email</span>
                                            </label>
                                        </div>
                                        {configForm.enableSMS && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SMS Template</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs" value={configForm.smsTemplateId} onChange={e => setConfigForm({ ...configForm, smsTemplateId: e.target.value })}>
                                                    <option value="">Select SMS Template</option>
                                                    {smsTemplates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                </select>
                                                <div className="mt-2">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Send SMS To</label>
                                                    <div className="flex flex-col gap-1.5">
                                                        {SMS_RECIPIENT_OPTIONS.map(opt => (
                                                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                                    checked={configForm.smsRecipients.includes(opt.value)}
                                                                    onChange={e => {
                                                                        const next = e.target.checked
                                                                            ? [...configForm.smsRecipients, opt.value]
                                                                            : configForm.smsRecipients.filter(r => r !== opt.value);
                                                                        setConfigForm({ ...configForm, smsRecipients: next });
                                                                    }}
                                                                />
                                                                <span className="text-xs text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {configForm.smsRecipients.length === 0 && (
                                                        <p className="text-[10px] text-red-500 mt-1">Select at least one recipient.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {configForm.enableEmail && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email Template</label>
                                                <select className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs" value={configForm.emailTemplateId} onChange={e => setConfigForm({ ...configForm, emailTemplateId: e.target.value })}>
                                                    <option value="">Select Email Template</option>
                                                    {emailTemplates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0 bg-white">
                                    {editingConfigId && (
                                        <button type="button" onClick={cancelEdit} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-600 font-bold hover:bg-gray-300 transition">Cancel</button>
                                    )}
                                    <button type="button" onClick={handleConfigSubmit} disabled={isScheduling} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex justify-center items-center gap-2">
                                        {isScheduling ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {editingConfigId ? 'Update Rule' : 'Save Rule'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <Activity className="text-blue-600" size={18} /> Active Rules
                                    </h3>
                                    <div className="flex gap-2">
                                        <select className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[10px]" value={ruleFilters.dueSourceType} onChange={e => setRuleFilters({ ...ruleFilters, dueSourceType: e.target.value })}>
                                            <option value="">All Types</option>
                                            <option value="ACADEMIC">Academic</option>
                                            <option value="HOSTEL">Hostel</option>
                                            <option value="TRANSPORT">Transport</option>
                                        </select>
                                        <select className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[10px]" value={ruleFilters.academicYear} onChange={e => setRuleFilters({ ...ruleFilters, academicYear: e.target.value })}>
                                            <option value="">All AY</option>
                                            {uniqueAcademicYears.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {configs
                                        .filter(cfg => !ruleFilters.dueSourceType || cfg.dueSourceType === ruleFilters.dueSourceType)
                                        .filter(cfg => !ruleFilters.academicYear || cfg.academicYear === ruleFilters.academicYear)
                                        .length === 0 ? (
                                        <div className="text-center text-gray-400 mt-20">
                                            <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="text-sm">No rules yet. Create one for an academic year + fee type.</p>
                                        </div>
                                    ) : (
                                        configs
                                            .filter(cfg => !ruleFilters.dueSourceType || cfg.dueSourceType === ruleFilters.dueSourceType)
                                            .filter(cfg => !ruleFilters.academicYear || cfg.academicYear === ruleFilters.academicYear)
                                            .map(cfg => (
                                                <div key={cfg._id} className={`p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition group relative flex justify-between items-center ${editingConfigId === cfg._id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                                                                {cfg.dueSourceType || 'LEGACY'}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                                                                {(cfg.offsets || []).join(', ')} DAYS {cfg.triggerType}
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                DUE DATE
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
                                                            <div><span className="font-bold text-gray-400">AY:</span> {cfg.academicYear}</div>
                                                            <div><span className="font-bold text-gray-400">Audience:</span> Unpaid only</div>
                                                            {cfg.quotas?.length > 0 && (
                                                                <div className="col-span-2">
                                                                    <span className="font-bold text-gray-400">Quotas: </span>
                                                                    <span className="flex flex-wrap gap-1 mt-0.5">
                                                                        {cfg.quotas.map(q => (
                                                                            <span key={q} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold">{q}</span>
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {cfg.colleges?.length > 0 && (
                                                                <div className="col-span-2">
                                                                    <span className="font-bold text-gray-400">Colleges: </span>
                                                                    <span className="flex flex-wrap gap-1 mt-0.5">
                                                                        {cfg.colleges.map(c => (
                                                                            <span key={c} className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded text-[10px] font-bold">{c}</span>
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {cfg.courses?.length > 0 && (
                                                                <div className="col-span-2">
                                                                    <span className="font-bold text-gray-400">Courses: </span>
                                                                    <span className="flex flex-wrap gap-1 mt-0.5">
                                                                        {cfg.courses.map(c => (
                                                                            <span key={c} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">{c}</span>
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5 border-t border-gray-50 pt-1">
                                                            {cfg.smsTemplateId && (
                                                                <div>
                                                                    SMS: <span className="font-medium text-gray-700">{cfg.smsTemplateId?.name || 'Template'}</span>
                                                                    {cfg.smsRecipients?.length > 0 && (
                                                                        <span className="ml-1.5 text-gray-400">
                                                                            → {cfg.smsRecipients.map(r => ({ student: 'Student', parent: 'Parent', guardian: 'Guardian' }[r] || r)).join(', ')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {cfg.emailTemplateId && <div>Email: <span className="font-medium text-gray-700">{cfg.emailTemplateId?.name || 'Template'}</span></div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1 ml-4">
                                                        <button type="button" onClick={() => handleEditConfig(cfg)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Edit Rule"><Edit size={16} /></button>
                                                        <button type="button" onClick={() => handleDeleteConfig(cfg._id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete Rule"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SETUP GUIDE --- */}
                    {mode === 'SETUP' && (
                        <div className="w-full h-full overflow-y-auto space-y-6 pb-8">
                            <div className="bg-white border border-gray-200 p-6 rounded-xl">
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg mb-2">
                                    <BookOpen size={14} /> Reminder System Guide
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">How Reminder Rules Work</h2>
                                <p className="text-xs text-gray-500 mt-1 max-w-3xl">
                                    Templates hold the message and variable mapping. Global rules pick academic year, fee type (Academic / Hostel / Transport), and when to send relative to due dates from Late Fee configuration. The nightly job (3 AM IST) sends only to students with unpaid balance through that term.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-7 bg-white border border-gray-200 p-6 rounded-xl space-y-6">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
                                        <Layers size={14} /> Setup Steps
                                    </h3>
                                    <div className="relative pl-6 border-l-2 border-gray-100 space-y-6 ml-3">
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</div>
                                            <h4 className="text-xs font-bold text-gray-800">Configure Late Fee due dates</h4>
                                            <p className="text-xs text-gray-500 mt-1">In Fee Configuration → Late Fees, set Academic / Hostel / Transport due timing (Default Rules + structure or service configs). Reminders reuse those same due dates.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</div>
                                            <h4 className="text-xs font-bold text-gray-800">Create SMS / Email templates</h4>
                                            <p className="text-xs text-gray-500 mt-1">Under Configuration, write the DLT-approved body with placeholders like {'{{student_name}}'}. Map each placeholder to a student column or computed field (due date, unpaid amount).</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</div>
                                            <h4 className="text-xs font-bold text-gray-800">Save a global Reminder rule</h4>
                                            <p className="text-xs text-gray-500 mt-1">Pick Academic Year + type (Academic / Hostel / Transport), add offsets (e.g. 3 days BEFORE due), and attach templates. Filter by quotas, colleges, or courses as needed.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">4</div>
                                            <h4 className="text-xs font-bold text-gray-800">Nightly send (automatic)</h4>
                                            <p className="text-xs text-gray-500 mt-1">Scheduler resolves due dates, finds unpaid students through that term, fills template variables from the map, and sends SMS/Email via BulkSMS / Brevo. Manual blast remains available under Send Reminders.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-5 space-y-4">
                                    <div className="bg-white border border-gray-200 p-5 rounded-xl">
                                        <h3 className="font-bold text-gray-800 text-sm mb-3">Audience rule</h3>
                                        <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                                            <li>Only <strong>regular</strong> students with unpaid balance through the due term (same underpaid logic as late fees).</li>
                                            <li>Paid / fully conceded students are skipped.</li>
                                            <li>Separate rules for Academic, Hostel, and Transport.</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white border border-gray-200 p-5 rounded-xl">
                                        <h3 className="font-bold text-gray-800 text-sm mb-3">Example</h3>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            AY <strong>2025-2026</strong>, type <strong>ACADEMIC</strong>, offsets <strong>3, 0 BEFORE</strong>, SMS template linked.
                                            If Term 1 due is 30 Jul, unpaid students get SMS on 27 Jul and again on 30 Jul. Hostel and Transport need their own rules for the same AY.
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl">
                                        <h3 className="font-bold text-amber-900 text-sm mb-2">Note on old rules</h3>
                                        <p className="text-xs text-amber-800">College-scoped legacy rules are skipped by the new scheduler. Delete them and recreate as global AY + type rules.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SEND MODE --- */}
                    {mode === 'SEND' && (
                        <div className="w-full h-full flex flex-col gap-4 min-h-0">
                            {/* Control Panel */}
                            <div className="w-full shrink-0">
                                <div className="flex flex-wrap gap-4 items-end">
                                    <div className="w-48">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">College</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs" value={filters.college} onChange={handleCollegeChange}>
                                            <option value="">Select College</option>
                                            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-48">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Course</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs" value={filters.course} onChange={handleCourseChange} disabled={!filters.college}>
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-48">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Branch</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs" value={filters.branch} onChange={e => setFilters({ ...filters, branch: e.target.value })} disabled={!filters.course}>
                                            <option value="">Select Branch</option>
                                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Batch</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs" value={filters.batch} onChange={e => setFilters({ ...filters, batch: e.target.value })}>
                                            <option value="">All Batches</option>
                                            {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-56">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Search</label>
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-8 pr-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                placeholder="Name, Adm No, Pin, Mobile..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchStudents}
                                        disabled={isFetching}
                                        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isFetching && <Loader2 size={14} className="animate-spin" />}
                                        {isFetching ? 'Fetching...' : 'Fetch Students'}
                                    </button>
                                </div>
                            </div>

                            {/* Main Content: Table & Actions */}
                            <div className="flex gap-6 flex-1 min-h-0">
                                {/* Students Table */}
                                <div className="w-full flex-[2] bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
                                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Users size={16} /> Students ({filteredStudents.length}{searchTerm.trim() ? ` / ${students.length}` : ''})
                                        </h3>
                                        <div className="text-xs text-blue-600 font-semibold bg-blue-100 px-3 py-1 rounded-full">
                                            {selectedStudents.length} Selected
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm text-gray-500">
                                                <tr>
                                                    <th className="p-3 w-10 text-center">
                                                        <button onClick={toggleSelectAll}>
                                                            {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s.admission_number)) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                                        </button>
                                                    </th>
                                                    <th className="p-3 font-semibold">Admission No</th>
                                                    <th className="p-3 font-semibold">Name</th>
                                                    <th className="p-3 font-semibold">Contact Info</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {students.length === 0 ? (
                                                    <tr><td colSpan="4" className="p-10 text-center text-gray-400">No students fetched.</td></tr>
                                                ) : filteredStudents.length === 0 ? (
                                                    <tr><td colSpan="4" className="p-10 text-center text-gray-400">No students match your search.</td></tr>
                                                ) : (
                                                    filteredStudents.map(s => (
                                                        <tr key={s.admission_number} className={`hover:bg-blue-50 transition ${selectedStudents.includes(s.admission_number) ? 'bg-blue-50/50' : ''}`}>
                                                            <td className="p-3 text-center">
                                                                <button onClick={() => toggleStudent(s.admission_number)}>
                                                                    {selectedStudents.includes(s.admission_number) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                                                                </button>
                                                            </td>
                                                            <td className="p-3 font-mono text-gray-600">{s.admission_number}</td>
                                                            <td className="p-3 font-medium text-gray-800">{s.student_name}</td>
                                                            <td className="p-3 space-y-0.5">
                                                                <div className="flex items-center gap-1.5 text-gray-500">
                                                                    <MessageSquare size={10} /> {s.student_mobile || <span className="text-red-400 italic">No Mobile</span>}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-gray-500">
                                                                    <Mail size={10} /> {s.student_email || s.email || <span className="text-red-400 italic">No Email</span>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Send Actions */}
                                <div className="flex-1 w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
                                    <h3 className="text-lg font-bold text-gray-800 px-5 pt-5 pb-3 flex items-center gap-2 shrink-0">
                                        <Send size={20} className="text-blue-600" /> Action
                                    </h3>

                                    <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-5 pb-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Due Source</label>
                                            <select
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                                                value={sendDueSourceType}
                                                onChange={e => setSendDueSourceType(e.target.value)}
                                            >
                                                <option value="ACADEMIC">Academic Fees</option>
                                                <option value="HOSTEL">Hostel Fees</option>
                                                <option value="TRANSPORT">Transport Fees</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Academic Year</label>
                                            <select
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                                                value={sendAcademicYear}
                                                onChange={e => setSendAcademicYear(e.target.value)}
                                            >
                                                <option value="">Select Academic Year</option>
                                                {uniqueAcademicYears.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Message Type</label>
                                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                                {['SMS', 'EMAIL'].map(t => (
                                                    <button
                                                        key={t}
                                                        onClick={() => setSendType(t)}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${sendType === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Template</label>
                                            <select
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm"
                                                value={sendTemplateId}
                                                onChange={e => setSendTemplateId(e.target.value)}
                                            >
                                                <option value="">-- Choose Template --</option>
                                                {sendTemplates.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                            {sendTemplates.length === 0 && <p className="text-[10px] text-red-500 mt-1">No templates found for {sendType}. Configure one first.</p>}
                                        </div>

                                        {sendTemplateId && (
                                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="text-[11px] font-black uppercase text-blue-700 tracking-wide">Message Preview</h4>
                                                    {previewMessage && (
                                                        <span className="text-[10px] text-blue-600 font-semibold truncate max-w-[55%]" title={previewMessage.studentLabel}>
                                                            Sample: {previewMessage.studentLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                {!previewStudent ? (
                                                    <p className="text-xs text-gray-500 italic">Fetch students to preview filled values.</p>
                                                ) : isLoadingPreviewFees ? (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center">
                                                        <Loader2 size={14} className="animate-spin" /> Loading fee dues…
                                                    </div>
                                                ) : !previewMessage ? (
                                                    <p className="text-xs text-gray-500 italic">Select a template to preview.</p>
                                                ) : (
                                                    <>
                                                        {sendType === 'EMAIL' && previewMessage.subject && (
                                                            <div className="text-[11px] text-gray-600">
                                                                <span className="font-bold text-gray-500">Subject: </span>
                                                                {previewMessage.subject}
                                                            </div>
                                                        )}
                                                        <div className="bg-white border border-blue-100 rounded-lg p-3 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-mono max-h-48 overflow-y-auto">
                                                            {previewMessage.body}
                                                        </div>
                                                        <p className="text-[10px] text-gray-500">
                                                            Pending fee from Fee Collection: <span className="font-bold text-gray-700">₹{Number((previewFeeContext?._due_amount_raw ?? previewFeeContext?.due_amount) || 0).toLocaleString('en-IN')}</span>
                                                            {Number(previewFeeContext?._late_fee_amount_raw || 0) > 0 && (
                                                                <> · Late fee: <span className="font-bold text-gray-700">₹{Number(previewFeeContext._late_fee_amount_raw).toLocaleString('en-IN')}</span></>
                                                            )}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            Preview uses the first selected student for {sendDueSourceType} · {sendAcademicYear || 'AY'}. Values update when you change selection, template, due source, or year.
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white">
                                        <button
                                            onClick={initiateSend}
                                            disabled={selectedStudents.length === 0 || !sendTemplateId || !sendDueSourceType || !sendAcademicYear || isSending}
                                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                                        >
                                            {isSending ? 'Sending...' : 'Send Reminders'} {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        </button>
                                        <p className="text-center text-[10px] text-gray-400 mt-2">
                                            Will send to {selectedStudents.length} selected students.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Missing Email Modal */}
                {missingEmailStudent && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800">Missing Email Address</h3>
                                <button onClick={() => setMissingEmailStudent(null)}><X size={20} className="text-gray-400 hover:text-red-500" /></button>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                The student <span className="font-bold text-gray-900">{missingEmailStudent.student_name}</span> ({missingEmailStudent.admission_number}) does not have an email address linked.
                            </p>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Enter Email to Continue</label>
                                <input
                                    type="email"
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="student@example.com"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setMissingEmailStudent(null)}
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    Skip Student
                                </button>
                                <button
                                    onClick={handleMissingEmailSave}
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md"
                                >
                                    Save & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Send Modal */}
                {pendingSendRecipients && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 rounded-full bg-blue-50 text-blue-600 shrink-0">
                                    <Send size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Confirm Send</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Send <span className="font-bold text-gray-900">{sendType}</span> using{' '}
                                        <span className="font-bold text-gray-900">
                                            {templates.find(t => t._id === sendTemplateId)?.name || 'selected template'}
                                        </span>{' '}
                                        to <span className="font-bold text-gray-900">{pendingSendRecipients.length}</span> student{pendingSendRecipients.length === 1 ? '' : 's'}
                                        {' '}for <span className="font-bold text-gray-900">{sendDueSourceType}</span> dues in{' '}
                                        <span className="font-bold text-gray-900">{sendAcademicYear}</span>?
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setPendingSendRecipients(null)}
                                    disabled={isSending}
                                    className="px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmAndSend}
                                    disabled={isSending}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center gap-2 disabled:opacity-70"
                                >
                                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {isSending ? 'Sending…' : 'Confirm & Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success / Failure / Info Modal */}
                {sendResultModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                            <div className="flex flex-col items-center text-center gap-3 mb-6">
                                <div className={`p-3 rounded-full ${
                                    sendResultModal.type === 'success' ? 'bg-emerald-50 text-emerald-600'
                                        : sendResultModal.type === 'error' ? 'bg-red-50 text-red-600'
                                            : 'bg-amber-50 text-amber-600'
                                }`}>
                                    {sendResultModal.type === 'success' ? <CheckCircle2 size={28} />
                                        : sendResultModal.type === 'error' ? <AlertTriangle size={28} />
                                            : <Info size={28} />}
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{sendResultModal.title}</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{sendResultModal.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSendResultModal(null)}
                                className={`w-full py-2.5 text-sm font-bold text-white rounded-xl shadow-md ${
                                    sendResultModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : sendResultModal.type === 'error' ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReminderConfiguration;
