import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import axios from 'axios';
import { Mail, MessageSquare, Bell, Plus, Trash2, Save, Edit2, Send, Users, CheckSquare, Square, X, Loader2 } from 'lucide-react';

const ReminderConfiguration = () => {
    // Top Level Mode: 'CONFIG' or 'SEND'
    const [mode, setMode] = useState('CONFIG');

    // --- CONFIG MODE STATE ---
    const [activeTab, setActiveTab] = useState('SMS');
    const [templates, setTemplates] = useState([]);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        templateId: '', // For SMS
        senderId: '',   // For Email
        body: ''
    });

    // --- SEND MODE STATE ---
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [batches, setBatches] = useState([]);
    const [filters, setFilters] = useState({ college: '', course: '', branch: '', batch: '' });
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [sendTemplateId, setSendTemplateId] = useState('');
    const [sendType, setSendType] = useState('SMS'); // SMS or EMAIL
    const [missingEmailStudent, setMissingEmailStudent] = useState(null); // { student, email: '' } for modal
    const [newEmail, setNewEmail] = useState('');

    // --- SHARED EFFECTS ---
    useEffect(() => {
        fetchTemplates();
        fetchMetadata();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/reminders/templates`);
            setTemplates(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            const meta = response.data.hierarchy || response.data;
            const batchList = response.data.batches || [];
            setMetadata(meta);
            setBatches(batchList);
            setColleges(Object.keys(meta));
        } catch (error) {
            console.error('Error fetching metadata', error);
        }
    };

    // --- CONFIG HANDLERS ---
    const handleSave = async () => {
        if (!formData.name || !formData.body) return alert("Name and Body are required");
        if (activeTab === 'EMAIL' && (!formData.subject || !formData.senderId)) return alert("Subject and Sender ID are required for Email");

        setIsSaving(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/reminders/templates`, {
                _id: editingTemplate?._id,
                type: activeTab,
                ...formData
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
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/reminders/templates/${id}`);
            fetchTemplates();
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        }
    };

    const resetForm = () => {
        setEditingTemplate(null);
        setFormData({ name: '', subject: '', templateId: '', senderId: '', body: '' });
    };

    const startEdit = (tpl) => {
        setEditingTemplate(tpl);
        setFormData({
            name: tpl.name,
            subject: tpl.subject || '',
            templateId: tpl.templateId || '',
            senderId: tpl.senderId || '',
            body: tpl.body
        });
        setActiveTab(tpl.type);
    };

    const insertVariable = (variable) => {
        setFormData(prev => ({ ...prev, body: prev.body + variable }));
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
        if (!filters.college) return alert("Please select a college at least.");
        setIsFetching(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students`, { params: filters });
            setStudents(res.data);
            setSelectedStudents([]); // Reset selection
        } catch (error) {
            console.error(error);
            alert('Failed to fetch students');
        } finally {
            setIsFetching(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedStudents.length === students.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(students.map(s => s.admission_number));
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
        if (selectedStudents.length === 0) return alert("No students selected.");
        if (!sendTemplateId) return alert("Please select a template.");

        // Check for missing contact info
        const recipients = students.filter(s => selectedStudents.includes(s.admission_number));

        if (sendType === 'EMAIL') {
            const missing = recipients.find(r => !r.student_email || r.student_email.trim() === '');
            if (missing) {
                setMissingEmailStudent(missing);
                setNewEmail('');
                return;
            }
        }

        // If all good, send
        performSend(recipients);
    };

    const handleMissingEmailSave = () => {
        if (!newEmail || !newEmail.includes('@')) return alert("Invalid Email");

        // Ideally, update student in DB here. For now, update local state
        const updatedStudents = students.map(s =>
            s.admission_number === missingEmailStudent.admission_number
                ? { ...s, student_email: newEmail }
                : s
        );
        setStudents(updatedStudents);
        setMissingEmailStudent(null);

        // Immediately try sending again if no other missing emails
        // Or user can click sending again
    };

    const performSend = async (recipients) => {
        if (!window.confirm(`Send ${sendType} to ${recipients.length} students?`)) return;

        setIsSending(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/reminders/send`, {
                templateId: sendTemplateId,
                recipients: recipients.map(r => ({
                    admission_number: r.admission_number,
                    email: r.student_email,
                    phone: r.student_mobile
                }))
            });
            alert('Reminders Sent Successfully!');
            setSelectedStudents([]);
        } catch (error) {
            console.error(error);
            alert('Failed to send reminders.');
        } finally {
            setIsSending(false);
        }
    };

    // Filtered templates for dropdown
    const sendTemplates = templates.filter(t => t.type === sendType);
    const currentTemplates = templates.filter(t => t.type === activeTab);

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
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-6 pt-2">

                    {/* --- CONFIGURATION MODE --- */}
                    {mode === 'CONFIG' && (
                        <div className="w-full h-full flex gap-6">
                            {/* Left: Template List */}
                            <div className="w-1/3 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full">
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
                            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col h-full">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    {editingTemplate ? <Edit2 size={18} className="text-blue-500" /> : <Plus size={18} className="text-green-500" />}
                                    {editingTemplate ? 'Edit Template' : `New ${activeTab} Template`}
                                </h2>
                                <div className="space-y-4 flex-1">
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
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Message Body</label>
                                            <div className="flex gap-1">
                                                {['{{student_name}}', '{{due_amount}}', '{{due_date}}', '{{pay_link}}'].map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => insertVariable(v)}
                                                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-200 transition"
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            className="w-full h-full min-h-[200px] flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none font-mono"
                                            placeholder="Type your message here..."
                                            value={formData.body}
                                            onChange={e => setFormData({ ...formData, body: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
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

                    {/* --- SEND MODE --- */}
                    {mode === 'SEND' && (
                        <div className="w-full h-full flex flex-col gap-4">
                            {/* Control Panel */}
                            <div className="w-full">
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
                            <div className="flex gap-6 flex-1 h-full min-h-0">
                                {/* Students Table */}
                                <div className="w-full flex-[2] bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Users size={16} /> Students ({students.length})
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
                                                            {selectedStudents.length === students.length && students.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
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
                                                ) : (
                                                    students.map(s => (
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
                                                                    <Mail size={10} /> {s.student_email || <span className="text-red-400 italic">No Email</span>}
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
                                <div className="flex-1 w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 h-fit sticky top-6">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Send size={20} className="text-blue-600" /> Action
                                    </h3>

                                    <div className="space-y-4">
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

                                        <div className="pt-4 border-t border-gray-100">
                                            <button
                                                onClick={initiateSend}
                                                disabled={selectedStudents.length === 0 || !sendTemplateId || isSending}
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
            </div>
        </div>
    );
};

export default ReminderConfiguration;
