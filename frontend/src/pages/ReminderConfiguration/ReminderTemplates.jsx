import React, { useState } from 'react';
import api from '../../lib/api';
import { Mail, MessageSquare, Bell, Plus, Trash2, Save, Edit2, Info, Loader2 } from 'lucide-react';

const EMPTY_TEMPLATE_FORM = {
    name: '',
    subject: '',
    templateId: '',
    senderId: '',
    body: '',
    isUnicode: false,
    variableMap: []
};

/** Detect non-English / non-ASCII content (Telugu, Hindi, etc.). */
const containsUnicode = (text) => /[^\u0000-\u007F]/.test(String(text || ''));

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

const ReminderTemplates = ({ templates, fetchTemplates, variableSources }) => {
    const [activeTab, setActiveTab] = useState('SMS');
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_TEMPLATE_FORM });

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
                isUnicode: activeTab === 'SMS' ? Boolean(formData.isUnicode) : false,
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
            isUnicode: Boolean(tpl.isUnicode) || containsUnicode(tpl.body),
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
                isUnicode: containsUnicode(body) ? true : prev.isUnicode,
                variableMap: syncVariableMapFromBody(body, prev.variableMap)
            };
        });
    };

    const updateBody = (body) => {
        setFormData(prev => ({
            ...prev,
            body,
            // Auto-enable when non-English text is pasted/typed; keep manual ON otherwise
            isUnicode: containsUnicode(body) ? true : prev.isUnicode,
            variableMap: syncVariableMapFromBody(body, prev.variableMap)
        }));
    };

    const updateVariableSource = (key, source) => {
        setFormData(prev => ({
            ...prev,
            variableMap: (prev.variableMap || []).map(m => m.key === key ? { ...m, source } : m)
        }));
    };

    const currentTemplates = templates.filter(t => t.type === activeTab);

    return (
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
                            {tpl.type === 'SMS' && tpl.isUnicode && (
                                <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${editingTemplate?._id === tpl._id ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                    Unicode
                                </span>
                            )}
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
                        <>
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
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-700">Unicode (Non-English) SMS</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                        Required for Telugu / other languages. Auto-detected when you paste non-English text. Sends with <code className="bg-white px-1 rounded border">coding=3</code>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.isUnicode}
                                    onClick={() => setFormData(prev => ({ ...prev, isUnicode: !prev.isUnicode }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${formData.isUnicode ? 'bg-amber-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${formData.isUnicode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            {formData.isUnicode && (
                                <div className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Unicode mode is ON — message will use BulkSMS Unicode API.
                                    {containsUnicode(formData.body) ? ' Non-English characters detected in body.' : ' No non-English characters detected yet (you can still force Unicode).'}
                                </div>
                            )}
                        </>
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
    );
};

export default ReminderTemplates;
