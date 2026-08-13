import React, { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { Clock, Plus, Trash2, Save, Edit, Loader2, Activity } from 'lucide-react';

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
    courses: [],
    isActive: true
};

const VALID_SMS_RECIPIENTS = ['student', 'parent', 'guardian'];

const ReminderRules = ({ templates, colleges, metadata, academicYears, quotaOptions }) => {
    const [configs, setConfigs] = useState([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [configForm, setConfigForm] = useState({ ...EMPTY_CONFIG_FORM });
    const [ruleFilters, setRuleFilters] = useState({
        dueSourceType: '',
        academicYear: ''
    });
    const [editingConfigId, setEditingConfigId] = useState(null);
    const [ruleScope, setRuleScope] = useState('COLLEGE'); // 'COLLEGE' | 'COURSE'

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const res = await api.get(`/reminders/config`);
            setConfigs(res.data);
        } catch (error) {
            console.error('Failed to fetch configs', error);
        }
    };

    const handleConfigSubmit = async () => {
        const { academicYear, dueSourceType, offsets, enableSMS, enableEmail, smsTemplateId, emailTemplateId, triggerType, smsRecipients, quotas, colleges: selectedColleges, courses: selectedCourses, isActive } = configForm;

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
                courses: ruleScope === 'COURSE' ? (selectedCourses || []) : [],
                isActive: isActive !== undefined ? isActive : true
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
            courses: cfg.courses || [],
            isActive: cfg.isActive !== undefined ? cfg.isActive : true
        });
    };

    const handleToggleRuleActive = async (cfg) => {
        try {
            const nextActiveState = cfg.isActive === false ? true : false;
            setConfigs(prev => prev.map(c => c._id === cfg._id ? { ...c, isActive: nextActiveState } : c));
            
            const payload = {
                academicYear: cfg.academicYear,
                dueSourceType: cfg.dueSourceType,
                triggerType: cfg.triggerType,
                offsets: cfg.offsets,
                smsTemplateId: cfg.smsTemplateId?._id || cfg.smsTemplateId || null,
                emailTemplateId: cfg.emailTemplateId?._id || cfg.emailTemplateId || null,
                smsRecipients: cfg.smsRecipients || [],
                quotas: cfg.quotas || [],
                colleges: cfg.colleges || [],
                courses: cfg.courses || [],
                isActive: nextActiveState
            };
            
            await api.put(`/reminders/config/${cfg._id}`, payload);
            fetchConfigs();
        } catch (error) {
            console.error("Failed to toggle rule active state", error);
            alert("Failed to change active status");
            fetchConfigs();
        }
    };

    const cancelEdit = () => {
        setEditingConfigId(null);
        setConfigForm({ ...EMPTY_CONFIG_FORM });
        setRuleScope('COLLEGE');
    };

    const allCoursesList = useMemo(() => {
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

    const uniqueAcademicYears = useMemo(() => {
        return [...new Set((academicYears || []).map(ay => ay.year_label))];
    }, [academicYears]);

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

    const smsTemplates = templates.filter(t => t.type === 'SMS');
    const emailTemplates = templates.filter(t => t.type === 'EMAIL');

    return (
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
                        {quotaOptions && quotaOptions.length > 0 && (
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
                    
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <h4 className="text-xs font-black uppercase text-gray-400">Rule Status</h4>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 bg-white" 
                                checked={configForm.isActive !== false} 
                                onChange={e => setConfigForm({ ...configForm, isActive: e.target.checked })} 
                            />
                            <span className="text-xs font-bold text-gray-700">Active (sends automatic reminders)</span>
                        </label>
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
                                             <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${cfg.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                 {cfg.isActive !== false ? 'Active' : 'Inactive'}
                                             </span>
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
                                     <div className="flex flex-col gap-1 ml-4 items-center">
                                         <button 
                                             type="button" 
                                             onClick={() => handleToggleRuleActive(cfg)} 
                                             className={`p-2 rounded transition ${cfg.isActive !== false ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`} 
                                             title={cfg.isActive !== false ? "Deactivate Rule" : "Activate Rule"}
                                         >
                                             {cfg.isActive !== false ? <Activity size={16} /> : <Activity size={16} className="opacity-40" />}
                                         </button>
                                         <button type="button" onClick={() => handleEditConfig(cfg)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Edit Rule"><Edit size={16} /></button>
                                         <button type="button" onClick={() => handleDeleteConfig(cfg._id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete Rule"><Trash2 size={16} /></button>
                                     </div>
                                 </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReminderRules;
