import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/api';
import Sidebar from './Sidebar';

const SECTION_LABELS = {
    appearance:    'Receipt Appearance',
    features:      'Fee Collection Features',
    'user-access': 'User Payment Access',
    sequence:      'Receipt Sequence',
    masking:       'Mask Fee Heads',
    'email-reports': 'Email Reports',
};

// ─── reusable Toggle ────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled = false }) => (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <input type="checkbox" className="sr-only peer" checked={!!checked} onChange={onChange} disabled={disabled} />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
);

const Settings = () => {
    const location = useLocation();
    const activeSection = SECTION_LABELS[location.hash.replace('#', '')] ? location.hash.replace('#', '') : 'appearance';
    const [settings, setSettings] = useState({
        showCollegeHeader: true,
        enableCashPayment: true,
        enableBankPayment: true,
        enableSplitPayment: true,
        maskedFeeHeads: [],
        maskName: 'Processing Fee',
        enableCustomReceiptSequence: false,
        receiptSequenceSeparator: '/',
        receiptSequencePadding: 5,
        receiptSequenceResetMonth: 4,
        receiptSequenceResetDay: 1,
        paymentAccessAutoReset: true,
        paymentAccessResetHour: 9,
        paymentAccessResetMinute: 0,
        emailReportEnabled: false,
        emailReportHour: 18,
        emailReportMinute: 0,
        emailReportRecipients: '',
    });
    const [feeHeads, setFeeHeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingSection, setSavingSection] = useState(null);
    const [savingUserId, setSavingUserId] = useState(null);
    const [toast, setToast] = useState(null);

    // local per-user override state: { [userId]: { enableCashPayment, enableBankPayment, enableSplitPayment } }
    const [userAccess, setUserAccess] = useState({});

    // Email Reports list and manual sending states
    const [emailList, setEmailList] = useState(['']);
    const [sendingReport, setSendingReport] = useState(false);


    const showMsg = (text, type = 'success') => {
        setToast({ message: text, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [settingsRes, feeHeadsRes, usersRes] = await Promise.all([
                    api.get('/settings'),
                    api.get('/fee-heads'),
                    api.get('/users'),
                ]);
                setSettings(settingsRes.data);
                setFeeHeads(feeHeadsRes.data);

                // Parse email list from settings
                if (settingsRes.data?.emailReportRecipients) {
                    const list = settingsRes.data.emailReportRecipients.split(',').map(e => e.trim()).filter(Boolean);
                    setEmailList(list.length > 0 ? list : ['']);
                } else {
                    setEmailList(['']);
                }


                // Only non-superadmin users are relevant for per-user access
                const relevantUsers = usersRes.data.filter(u => u.role !== 'superadmin');
                setUsers(relevantUsers);

                // Seed local override state from each user's stored paymentAccess
                const initial = {};
                relevantUsers.forEach(u => {
                    initial[u._id] = {
                        feeCollectionDisabled: u.paymentAccess?.feeCollectionDisabled ?? false,
                        enableCashPayment: u.paymentAccess?.enableCashPayment ?? null,
                        enableBankPayment: u.paymentAccess?.enableBankPayment ?? null,
                        enableSplitPayment: u.paymentAccess?.enableSplitPayment ?? null,
                    };
                });
                setUserAccess(initial);
            } catch (error) {
                console.error(error);
                showMsg('Error fetching data', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSaveSection = async (section) => {
        setSavingSection(section);
        try {
            const payload = { ...settings };
            if (section === 'email-reports') {
                payload.emailReportRecipients = emailList.map(e => e.trim()).filter(Boolean).join(',');
            }
            await api.put('/settings', payload);
            setSettings(payload);
            showMsg('Settings saved successfully!');
        } catch (error) {
            showMsg('Error saving settings', 'error');
        } finally {
            setSavingSection(null);
        }
    };

    const handleSendManualReport = async () => {
        const recipientsStr = emailList.map(e => e.trim()).filter(Boolean).join(',');
        if (!recipientsStr) {
            showMsg('Please add at least one recipient email address.', 'error');
            return;
        }
        setSendingReport(true);
        try {
            const res = await api.post('/settings/send-test-report', { recipients: recipientsStr });
            showMsg(res.data?.message || 'Report generated and emailed successfully!');
        } catch (error) {
            console.error('[ManualReport] Error:', error);
            showMsg(error.response?.data?.message || 'Failed to trigger report email', 'error');
        } finally {
            setSendingReport(false);
        }
    };

    const handleSaveUserAccess = async (userId) => {
        setSavingUserId(userId);
        try {
            await api.put(`/users/${userId}/payment-access`, userAccess[userId]);
            showMsg('User payment access updated.');
        } catch (error) {
            showMsg('Error updating user access', 'error');
        } finally {
            setSavingUserId(null);
        }
    };

    const setUserAccessField = (userId, field, value) => {
        setUserAccess(prev => ({
            ...prev,
            [userId]: { ...prev[userId], [field]: value }
        }));
    };

    // Tri-state: null → follow global, true → allow, false → deny
    const cycleAccess = (userId, field) => {
        const cur = userAccess[userId]?.[field];
        // null → true → false → null
        const next = cur === null ? true : cur === true ? false : null;
        setUserAccessField(userId, field, next);
    };

    const accessBadge = (val, globalVal) => {
        if (val === null) return { label: 'Global', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
        if (val === true) return { label: 'Allowed', cls: 'bg-green-50 text-green-700 border-green-200' };
        return { label: 'Denied', cls: 'bg-red-50 text-red-600 border-red-200' };
    };

    // ── Section renderers ─────────────────────────────────────────────────────

    const renderAppearance = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Receipt Appearance</h2>
                <p className="text-sm text-gray-500 mt-1">Configure how receipts look when printed.</p>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-700">College Header</h3>
                        <p className="text-sm text-gray-500">Show college name and address at the top of the receipt.</p>
                    </div>
                    <Toggle checked={settings.showCollegeHeader !== false} onChange={() => setSettings(s => ({ ...s, showCollegeHeader: !s.showCollegeHeader }))} />
                </div>
                <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Paper Size</h3>
                        <div className="flex space-x-4">
                            {['A4', 'A5'].map(v => (
                                <label key={v} className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="paperSize" value={v} checked={(!settings.paperSize && v === 'A4') || settings.paperSize === v} onChange={() => setSettings(s => ({ ...s, paperSize: v }))} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-700">{v} Size</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Copies Per Page</h3>
                        <div className="flex space-x-4">
                            {[1, 2].map(v => (
                                <label key={v} className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="copiesPerPage" value={v} checked={(!settings.copiesPerPage && v === 2) || settings.copiesPerPage === v} onChange={() => setSettings(s => ({ ...s, copiesPerPage: v }))} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-700">{v} {v === 1 ? 'Copy' : 'Copies'}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <SectionFooter section="appearance" savingSection={savingSection} onSave={handleSaveSection} label="Save Appearance" />
        </div>
    );

    const renderFeatures = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Fee Collection Features</h2>
                <p className="text-sm text-gray-500 mt-1">Enable or disable specific payment methods globally. These act as the master switch — per-user overrides apply on top.</p>
            </div>
            <div className="p-6 space-y-0 divide-y divide-gray-100">
                {[
                    { key: 'enableCashPayment',  label: 'Cash Payments',  desc: 'Allow collection of fees via physical cash.' },
                    { key: 'enableBankPayment',  label: 'Bank Payments',  desc: 'Allow collection of fees via bank transfers, DD, or cheques.' },
                    { key: 'enableSplitPayment', label: 'Split Payments', desc: 'Allow splitting a single payment across multiple methods.' },
                ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-5">
                        <div>
                            <h3 className="font-semibold text-gray-700">{label}</h3>
                            <p className="text-sm text-gray-500">{desc}</p>
                        </div>
                        <Toggle checked={settings[key] !== false} onChange={() => setSettings(s => ({ ...s, [key]: !s[key] }))} />
                    </div>
                ))}
            </div>
            <SectionFooter section="features" savingSection={savingSection} onSave={handleSaveSection} label="Save Features" />
        </div>
    );

    const renderUserAccess = () => (
        <div className="space-y-6">
            {/* Auto-reset config card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Auto-Reset Schedule</h2>
                    <p className="text-sm text-gray-500 mt-1">User payment access overrides are automatically cleared each day at the configured time, returning each user to the global setting.</p>
                </div>
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-gray-700">Enable Daily Auto-Reset</h3>
                            <p className="text-sm text-gray-500">Automatically revoke all user-level payment access grants at the scheduled time.</p>
                        </div>
                        <Toggle checked={settings.paymentAccessAutoReset !== false} onChange={() => setSettings(s => ({ ...s, paymentAccessAutoReset: !s.paymentAccessAutoReset }))} />
                    </div>
                    {settings.paymentAccessAutoReset !== false && (
                        <div className="border-t border-gray-100 pt-5 flex items-end gap-4 flex-wrap">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Reset Hour (24h)</label>
                                <input
                                    type="number" min={0} max={23}
                                    value={settings.paymentAccessResetHour ?? 9}
                                    onChange={e => setSettings(s => ({ ...s, paymentAccessResetHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                    className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Reset Minute</label>
                                <input
                                    type="number" min={0} max={59}
                                    value={settings.paymentAccessResetMinute ?? 0}
                                    onChange={e => setSettings(s => ({ ...s, paymentAccessResetMinute: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                    className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                />
                            </div>
                            <div className="pb-2">
                                <span className="text-sm text-gray-500">
                                    Resets daily at <strong className="text-blue-700">{String(settings.paymentAccessResetHour ?? 9).padStart(2, '0')}:{String(settings.paymentAccessResetMinute ?? 0).padStart(2, '0')}</strong>
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <SectionFooter section="user-access-schedule" savingSection={savingSection} onSave={handleSaveSection} label="Save Schedule" />
            </div>

            {/* Per-user access table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Per-User Payment Access</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Override payment methods for individual users. <span className="font-medium text-gray-700">Global</span> = follow the master switch above.
                        Overrides marked <span className="font-medium text-blue-600">Allowed</span> will auto-reset daily.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    {users.length === 0 ? (
                        <p className="text-center py-10 text-gray-400 text-sm">No users found.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="py-3 px-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Fee Collection
                                        <div className="text-[9px] font-normal text-gray-400 normal-case tracking-normal mt-0.5">master switch</div>
                                    </th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Cash</th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Bank</th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Split</th>
                                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.map(u => {
                                    const ua = userAccess[u._id] || {};
                                    const saving = savingUserId === u._id;
                                    const isBlocked = ua.feeCollectionDisabled === true;
                                    return (
                                        <tr key={u._id} className={`transition-colors ${isBlocked ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                                            <td className="py-3 px-5">
                                                <div className="font-semibold text-gray-800">{u.name}</div>
                                                <div className="text-xs text-gray-400">{u.username}</div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200 uppercase">{u.role}</span>
                                            </td>
                                            {/* Master fee collection toggle */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Toggle
                                                        checked={!isBlocked}
                                                        onChange={() => {
                                                            const nowBlocking = !isBlocked;
                                                            setUserAccess(prev => ({
                                                                ...prev,
                                                                [u._id]: {
                                                                    ...prev[u._id],
                                                                    feeCollectionDisabled: nowBlocking,
                                                                    // when blocking, force all methods to denied; when unblocking reset to global
                                                                    enableCashPayment:  nowBlocking ? false : null,
                                                                    enableBankPayment:  nowBlocking ? false : null,
                                                                    enableSplitPayment: nowBlocking ? false : null,
                                                                }
                                                            }));
                                                        }}
                                                    />
                                                    <span className={`text-[9px] font-bold ${isBlocked ? 'text-red-500' : 'text-green-600'}`}>
                                                        {isBlocked ? 'Blocked' : 'Active'}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Per-method badges — greyed out when master is blocked */}
                                            {['enableCashPayment', 'enableBankPayment', 'enableSplitPayment'].map(field => {
                                                const val = ua[field];
                                                const badge = accessBadge(val);
                                                return (
                                                    <td key={field} className="py-3 px-4 text-center">
                                                        <button
                                                            onClick={() => !isBlocked && cycleAccess(u._id, field)}
                                                            disabled={isBlocked}
                                                            title={isBlocked ? 'Enable fee collection access first' : 'Click to cycle: Global → Allowed → Denied → Global'}
                                                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${isBlocked ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' : `cursor-pointer hover:opacity-80 active:scale-95 ${badge.cls}`}`}
                                                        >
                                                            {badge.label}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleSaveUserAccess(u._id)}
                                                    disabled={saving}
                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 mx-auto transition"
                                                >
                                                    {saving && <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent inline-block"></span>}
                                                    {saving ? 'Saving…' : 'Save'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSequence = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Custom Receipt Sequence</h2>
                <p className="text-sm text-gray-500 mt-1">Configure automated structured receipt numbers by college, course, and fee group.</p>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-700">Enable Custom Receipt Sequences</h3>
                        <p className="text-sm text-gray-500">Generate receipt numbers like COLLEGE/COURSE/GROUP/00001.</p>
                    </div>
                    <Toggle checked={settings.enableCustomReceiptSequence === true} onChange={() => setSettings(s => ({ ...s, enableCustomReceiptSequence: !s.enableCustomReceiptSequence }))} />
                </div>
                {settings.enableCustomReceiptSequence && (
                    <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Sequence Separator</label>
                            <select value={settings.receiptSequenceSeparator || '/'} onChange={e => setSettings(s => ({ ...s, receiptSequenceSeparator: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold">
                                <option value="/">Slash ( / )</option>
                                <option value="-">Hyphen ( - )</option>
                                <option value="_">Underscore ( _ )</option>
                                <option value=".">Dot ( . )</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Character separating receipt parts.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Sequence Padding</label>
                            <input type="number" min={1} max={10} value={settings.receiptSequencePadding ?? 5} onChange={e => setSettings(s => ({ ...s, receiptSequencePadding: Math.max(1, parseInt(e.target.value) || 1) }))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold" />
                            <p className="text-xs text-gray-400 mt-1">Digits for counter (e.g. 5 → 00001).</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">FY Reset Month</label>
                            <select value={settings.receiptSequenceResetMonth ?? 4} onChange={e => setSettings(s => ({ ...s, receiptSequenceResetMonth: parseInt(e.target.value) }))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold">
                                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Month to restart sequence from 1.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">FY Reset Day</label>
                            <input type="number" min={1} max={31} value={settings.receiptSequenceResetDay ?? 1} onChange={e => setSettings(s => ({ ...s, receiptSequenceResetDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) }))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold" />
                            <p className="text-xs text-gray-400 mt-1">Day of month to restart sequence.</p>
                        </div>
                    </div>
                )}
            </div>
            <SectionFooter section="sequence" savingSection={savingSection} onSave={handleSaveSection} label="Save Sequence" />
        </div>
    );

    const renderMasking = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Mask Fee Heads</h2>
                <p className="text-sm text-gray-500 mt-1">Select Fee Heads to hide/rename on the receipt. They will be displayed as the name below.</p>
            </div>
            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Mask Name (Display Name)</label>
                    <input type="text" value={settings.maskName || ''} onChange={e => setSettings(s => ({ ...s, maskName: e.target.value }))} className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Processing Fee" />
                    <p className="text-xs text-gray-400 mt-1">This name replaces the actual fee head name on the receipt.</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Select Fee Heads to Mask:</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                        {feeHeads.map(head => (
                            <label key={head._id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${settings.maskedFeeHeads?.includes(head._id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-blue-100'}`}>
                                <input type="checkbox" checked={settings.maskedFeeHeads?.includes(head._id)} onChange={() => {
                                    const cur = settings.maskedFeeHeads || [];
                                    setSettings(s => ({ ...s, maskedFeeHeads: cur.includes(head._id) ? cur.filter(id => id !== head._id) : [...cur, head._id] }));
                                }} className="w-4 h-4 text-blue-600 rounded" />
                                <span className={`ml-3 text-sm ${settings.maskedFeeHeads?.includes(head._id) ? 'font-bold text-blue-800' : 'text-gray-600'}`}>{head.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <SectionFooter section="masking" savingSection={savingSection} onSave={handleSaveSection} label="Save Masking" />
        </div>
    );

    const renderEmailReports = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Email Reports Configuration</h2>
                <p className="text-sm text-gray-500 mt-1">Configure automated sending of the All Colleges Collection Summary report PDF.</p>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-700">Enable Automated Daily Report</h3>
                        <p className="text-sm text-gray-500">Automatically generate and email the collections report every day.</p>
                    </div>
                    <Toggle checked={settings.emailReportEnabled === true} onChange={() => setSettings(s => ({ ...s, emailReportEnabled: !s.emailReportEnabled }))} />
                </div>
                
                {settings.emailReportEnabled && (
                    <>
                        <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Schedule Hour (24h format)</label>
                                <input 
                                    type="number" min={0} max={23} 
                                    value={settings.emailReportHour ?? 18} 
                                    onChange={e => setSettings(s => ({ ...s, emailReportHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) }))} 
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold" 
                                />
                                <p className="text-xs text-gray-400 mt-1">Hour of day to run the report (0 to 23).</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Schedule Minute</label>
                                <input 
                                    type="number" min={0} max={59} 
                                    value={settings.emailReportMinute ?? 0} 
                                    onChange={e => setSettings(s => ({ ...s, emailReportMinute: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))} 
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold" 
                                />
                                <p className="text-xs text-gray-400 mt-1">Minute of the hour (0 to 59).</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6 space-y-3">
                            <label className="block text-sm font-bold text-gray-700">Recipient Email Addresses</label>
                            
                            <div className="space-y-2">
                                {emailList.map((email, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input 
                                            type="email"
                                            value={email}
                                            onChange={e => {
                                                const list = [...emailList];
                                                list[idx] = e.target.value;
                                                setEmailList(list);
                                            }}
                                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                            placeholder="e.g. director@pydah.edu"
                                            required
                                        />
                                        {emailList.length > 1 && (
                                            <button 
                                                onClick={() => {
                                                    setEmailList(emailList.filter((_, i) => i !== idx));
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Remove email"
                                                type="button"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => setEmailList([...emailList, ''])}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                                type="button"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                Add Email Recipient
                            </button>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs font-semibold text-blue-800 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>
                                Scheduled to send daily at <strong className="text-blue-900">{String(settings.emailReportHour ?? 18).padStart(2, '0')}:{String(settings.emailReportMinute ?? 0).padStart(2, '0')}</strong> to: <span className="underline">{emailList.filter(Boolean).join(', ') || '(no recipients)'}</span>
                            </span>
                        </div>

                        {/* Send Manually Action Card */}
                        <div className="border-t border-gray-100 pt-6">
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">Send Collection Report Manually</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">Generate the summary PDF and email it immediately to the configured recipients.</p>
                                </div>
                                <button
                                    onClick={handleSendManualReport}
                                    disabled={sendingReport}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0"
                                    type="button"
                                >
                                    {sendingReport && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
                                    {sendingReport ? 'Sending Report...' : 'Send Report Now'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <SectionFooter section="email-reports" savingSection={savingSection} onSave={handleSaveSection} label="Save Email Reports Config" />
        </div>
    );

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
                <header className="mb-2">
                    <h1 className="text-3xl font-bold text-gray-800">{SECTION_LABELS[activeSection]}</h1>
                    <p className="text-gray-500 mt-2">Global Settings › {SECTION_LABELS[activeSection]}</p>
                </header>


                {loading ? (
                    <div className="text-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
                ) : (
                    <div className="max-w-4xl space-y-6">
                        {activeSection === 'appearance'   && renderAppearance()}
                        {activeSection === 'features'     && renderFeatures()}
                        {activeSection === 'user-access'  && renderUserAccess()}
                        {activeSection === 'sequence'     && renderSequence()}
                        {activeSection === 'masking'      && renderMasking()}
                        {activeSection === 'email-reports' && renderEmailReports()}
                    </div>
                )}
            </div>

            {/* Floating Toast — same style as FeeCollection */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 ${
                    toast.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold">{toast.type === 'success' ? 'Success' : 'Error'}</p>
                        <p className="text-xs font-semibold text-gray-600 mt-0.5">{toast.message}</p>
                    </div>
                    <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Shared Save Footer ──────────────────────────────────────────────────────
const SectionFooter = ({ section, savingSection, onSave, label }) => (
    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
        <button
            onClick={() => onSave(section)}
            disabled={savingSection === section}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
        >
            {savingSection === section && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
            {savingSection === section ? 'Saving...' : label}
        </button>
    </div>
);

export default Settings;
