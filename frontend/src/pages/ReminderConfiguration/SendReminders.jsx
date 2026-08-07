import React, { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { Mail, MessageSquare, Plus, Trash2, Send, Users, CheckSquare, Square, X, Loader2, Search, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const formatPreviewDate = (d) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dd}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
};

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

const SendReminders = ({ templates, metadata, colleges: propColleges, uniqueAcademicYears, batches }) => {
    const resolvedAcademicYears = useMemo(() => {
        if (!Array.isArray(uniqueAcademicYears)) return [];
        return [...new Set(uniqueAcademicYears.map(ay => (ay && typeof ay === 'object') ? ay.year_label : ay).filter(Boolean))];
    }, [uniqueAcademicYears]);

    const [colleges, setColleges] = useState(propColleges || []);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [filters, setFilters] = useState({ college: '', course: '', branch: '', batch: '' });
    const [sendDueSourceType, setSendDueSourceType] = useState('ACADEMIC');
    const [sendAcademicYear, setSendAcademicYear] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [sendTemplateId, setSendTemplateId] = useState('');
    const [sendType, setSendType] = useState('SMS'); // SMS or EMAIL
    const [isFetching, setIsFetching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [missingEmailStudent, setMissingEmailStudent] = useState(null); // { student, email: '' } for modal
    const [newEmail, setNewEmail] = useState('');
    const [previewFeeContext, setPreviewFeeContext] = useState(null);
    const [isLoadingPreviewFees, setIsLoadingPreviewFees] = useState(false);
    const [pendingSendRecipients, setPendingSendRecipients] = useState(null); // confirm modal
    const [sendResultModal, setSendResultModal] = useState(null); // { type: 'success'|'error'|'info', title, message }

    useEffect(() => {
        if (propColleges) setColleges(propColleges);
    }, [propColleges]);

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

    const filteredStudents = useMemo(() => {
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

    const sendTemplates = templates.filter(t => t.type === sendType);
    const selectedSendTemplate = sendTemplates.find(t => t._id === sendTemplateId) || null;
    const previewStudent = useMemo(() => {
        if (!selectedStudents.length) return students[0] || null;
        return students.find(s => s.admission_number === selectedStudents[0]) || null;
    }, [students, selectedStudents]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!previewStudent?.admission_number || !sendTemplateId) {
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
    }, [previewStudent?.admission_number, sendTemplateId, sendAcademicYear, sendDueSourceType]);

    const previewMessage = useMemo(() => {
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
                                {resolvedAcademicYears.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Message Type</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['SMS', 'EMAIL'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { setSendType(t); setSendTemplateId(''); }}
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
    );
};

export default SendReminders;
