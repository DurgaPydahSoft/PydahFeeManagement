import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Pencil, Trash2, Plus, CreditCard, Building2, Eye, EyeOff } from 'lucide-react';
import Sidebar from './Sidebar';

const PaymentConfiguration = () => {
    const [configs, setConfigs] = useState([]);
    const [form, setForm] = useState({
        is_global: false,
        college: '',
        course: '',
        account_name: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        upi_id: '',
        razorpay_key_id: '',
        razorpay_key_secret: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [metadata, setMetadata] = useState({});
    const [toast, setToast] = useState(null);
    const [showRazorpay, setShowRazorpay] = useState(false);

    const showToastMessage = (message, type = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useEffect(() => {
        fetchConfigs();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await api.get(`/students/metadata`);
            setMetadata(response.data);
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchConfigs = async () => {
        try {
            const response = await api.get(`/payment-config`);
            setConfigs(response.data);
        } catch (error) { console.error('Error fetching configs', error); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
 
        const isRequiredFieldsMissing = form.is_global 
            ? (!form.account_name || !form.bank_name || !form.account_number)
            : (!form.college || !form.course || !form.account_name || !form.bank_name || !form.account_number);

        if (isRequiredFieldsMissing) {
            showToastMessage(form.is_global 
                ? 'Please fill all required bank detail fields' 
                : 'Please fill all required fields (College and Course are mandatory)', 'error');
            return;
        }
 
        try {
            if (editingId) {
                // Update
                const response = await api.put(`/payment-config/${editingId}`, form);
                setConfigs(configs.map(c => c._id === editingId ? response.data : c));
                showToastMessage('Account updated successfully!', 'success');
            } else {
                // Create
                const response = await api.post(`/payment-config`, form);
                setConfigs([response.data, ...configs]);
                showToastMessage('Account added successfully!', 'success');
            }
            setForm({ is_global: false, college: '', course: '', account_name: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '', razorpay_key_id: '', razorpay_key_secret: '' });
            setEditingId(null);
            setShowRazorpay(false);
        } catch (error) {
            console.error(error);
            showToastMessage(error.response?.data?.message || 'Error saving account configuration.', 'error');
        }
    };

    const handleEdit = (config) => {
        setForm({
            is_global: config.is_global || false,
            college: config.college || '',
            course: config.course || '',
            account_name: config.account_name,
            bank_name: config.bank_name,
            account_number: config.account_number,
            ifsc_code: config.ifsc_code,
            upi_id: config.upi_id || '',
            razorpay_key_id: config.razorpay_key_id || '',
            razorpay_key_secret: config.razorpay_key_secret || ''
        });
        setEditingId(config._id);
        setShowRazorpay(!!(config.razorpay_key_id || config.razorpay_key_secret));
        window.scrollTo(0, 0);
    };

    const handleDelete = async (config) => {
        const isAlreadyInactive = !config.is_active;
        const confirmMessage = isAlreadyInactive 
            ? 'Are you sure you want to PERMANENTLY delete this account configuration? This action cannot be undone.'
            : 'Are you sure you want to deactivate this account?';

        if (!window.confirm(confirmMessage)) return;

        try {
            await api.delete(`/payment-config/${config._id}`);
            if (isAlreadyInactive) {
                // Permanently deleted - remove from list state
                setConfigs(configs.filter(c => c._id !== config._id));
                showToastMessage('Account permanently deleted!', 'success');
            } else {
                // Deactivated - update is_active to false in state
                setConfigs(configs.map(c => c._id === config._id ? { ...c, is_active: false } : c));
                showToastMessage('Account deactivated successfully!', 'success');
            }
        } catch (error) {
            console.error(error);
            showToastMessage(error.response?.data?.message || 'Failed to delete account.', 'error');
        }
    };

    const handleToggle = async (id) => {
        try {
            const response = await api.patch(`/payment-config/${id}/toggle`);
            setConfigs(configs.map(c => c._id === id ? response.data : c));
            showToastMessage(`Account status updated to ${response.data.is_active ? 'Active' : 'Inactive'}!`, 'success');
        } catch (error) {
            console.error(error);
            showToastMessage(error.response?.data?.message || 'Failed to toggle status.', 'error');
        }
    };

    const colleges = Object.keys(metadata.hierarchy || {});

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-8">
                {/* Header */}
                <header className="mb-4">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="w-8 h-8 text-blue-600" />
                        Payment Configuration
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Configure Bank Accounts and UPI details for online fee collection.</p>
                </header>



                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                     {/* LEFT COLUMN: FORM */}
                    <div className="xl:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                                    {editingId ? <Pencil className="w-4.5 h-4.5 text-blue-500" /> : <Plus className="w-4.5 h-4.5 text-green-500" />}
                                    {editingId ? 'Edit Account' : 'Add New Account'}
                                </h2>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="checkbox"
                                        id="is_global"
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        checked={form.is_global}
                                        onChange={e => setForm({ 
                                            ...form, 
                                            is_global: e.target.checked,
                                            college: e.target.checked ? '' : form.college,
                                            course: e.target.checked ? '' : form.course
                                        })}
                                    />
                                    <label htmlFor="is_global" className="text-[11px] font-bold text-gray-600 uppercase cursor-pointer select-none">Global</label>
                                </div>
                            </div>
 
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {!form.is_global && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">College</label>
                                            <select
                                                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                value={form.college}
                                                onChange={e => setForm({ ...form, college: e.target.value })}
                                                required={!form.is_global}
                                            >
                                                <option value="">Select...</option>
                                                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
 
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Course</label>
                                            <select
                                                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                value={form.course}
                                                onChange={e => setForm({ ...form, course: e.target.value })}
                                                required={!form.is_global}
                                                disabled={!form.college}
                                            >
                                                <option value="">Select...</option>
                                                {form.college && metadata.hierarchy && metadata.hierarchy[form.college] && Object.keys(metadata.hierarchy[form.college]).map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
 
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Friendly Name</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. College HDFC"
                                            value={form.account_name}
                                            onChange={e => setForm({ ...form, account_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">UPI ID (Optional)</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                            placeholder="college@okaxis"
                                            value={form.upi_id}
                                            onChange={e => setForm({ ...form, upi_id: e.target.value })}
                                        />
                                    </div>
                                </div>
 
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Bank Name</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. HDFC"
                                            value={form.bank_name}
                                            onChange={e => setForm({ ...form, bank_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">IFSC Code (Opt)</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase"
                                            placeholder="HDFC000..."
                                            value={form.ifsc_code}
                                            onChange={e => setForm({ ...form, ifsc_code: e.target.value })}
                                        />
                                    </div>
                                </div>
 
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Account Number</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono tracking-wider"
                                        placeholder="0000 0000 0000"
                                        value={form.account_number}
                                        onChange={e => setForm({ ...form, account_number: e.target.value })}
                                        required
                                    />
                                </div>
 
                                <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowRazorpay(!showRazorpay)}
                                        className="w-full flex justify-between items-center text-xs font-bold text-blue-800 focus:outline-none"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <CreditCard size={14} />
                                            Razorpay Integration
                                        </span>
                                        <span className="text-[10px] text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded">
                                            {showRazorpay ? 'Collapse' : 'Expand'}
                                        </span>
                                    </button>
                                    
                                    {showRazorpay && (
                                        <div className="mt-2 space-y-2 pt-1 border-t border-blue-100/50 animate-fadeIn">
                                            <div>
                                                <label className="block text-[9px] font-bold text-blue-600 uppercase mb-0.5">Razorpay Key ID</label>
                                                <input
                                                    type="text"
                                                    className="w-full border border-blue-200 rounded-lg p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                                                    placeholder="rzp_live_..."
                                                    value={form.razorpay_key_id}
                                                    onChange={e => setForm({ ...form, razorpay_key_id: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-blue-600 uppercase mb-0.5">Razorpay Secret</label>
                                                <input
                                                    type="password"
                                                    className="w-full border border-blue-200 rounded-lg p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                                                    placeholder="••••••••••••"
                                                    value={form.razorpay_key_secret}
                                                    onChange={e => setForm({ ...form, razorpay_key_secret: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
 
                                <div className="pt-1.5">
                                    <button
                                        type="submit"
                                        className={`w-full py-2.5 rounded-lg font-bold text-xs text-white shadow-md transform active:scale-95 transition-all ${editingId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
                                    >
                                        {editingId ? 'Update Account' : 'Add Account'}
                                    </button>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditingId(null); setForm({ is_global: false, college: '', course: '', account_name: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '', razorpay_key_id: '', razorpay_key_secret: '' }); setShowRazorpay(false); }}
                                            className="w-full mt-2 py-2 text-gray-500 font-semibold hover:text-gray-700 text-xs"
                                        >
                                            Cancel Editing
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: LIST */}
                    <div className="xl:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 text-sm">Active Accounts</h2>
                                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 border border-blue-100 rounded-full">{configs.length} Configured</span>
                            </div>

                            {configs.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No Payment Accounts Configured.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px] border-b">
                                            <tr>
                                                <th className="px-4 py-2.5 font-bold">Account Info</th>
                                                <th className="px-4 py-2.5 font-bold">Scope</th>
                                                <th className="px-4 py-2.5 font-bold">Bank Details</th>
                                                <th className="px-4 py-2.5 font-bold">Status</th>
                                                <th className="px-4 py-2.5 font-bold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {configs.map(config => (
                                                <tr key={config._id} className={`group hover:bg-blue-50/50 transition-colors ${!config.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-800 text-xs">{config.account_name}</div>
                                                        {config.razorpay_key_id && (
                                                            <div className="text-[9px] text-green-600 font-bold flex items-center gap-1 mt-0.5">
                                                                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                                                                Razorpay Integrated
                                                            </div>
                                                        )}
                                                        {config.upi_id && (
                                                            <div className="text-[10px] text-gray-500 mt-0.5 font-mono">UPI: {config.upi_id}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {config.is_global ? (
                                                            <span className="text-green-700 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-wider text-[9px]">Global</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-0.5 items-start">
                                                                <span className="text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[9px] truncate max-w-[120px]" title={config.college}>{config.college}</span>
                                                                <span className="text-purple-600 font-bold bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded text-[9px] truncate max-w-[120px]" title={config.course}>{config.course}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-700 text-xs">{config.bank_name}</div>
                                                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">{config.account_number}</div>
                                                        {config.ifsc_code && <div className="text-[9px] text-gray-400 font-mono uppercase mt-0.5">IFSC: {config.ifsc_code}</div>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => handleToggle(config._id)}
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 transition-all ${config.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                                                        >
                                                            {config.is_active ? <><Eye size={10} /> Active</> : <><EyeOff size={10} /> Inactive</>}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(config)}
                                                                className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                                                                title="Edit"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(config)}
                                                                className={`p-1.5 rounded-lg transition-colors border ${
                                                                    config.is_active 
                                                                        ? 'text-red-500 bg-red-50 hover:bg-red-100 border-red-100' 
                                                                        : 'text-red-700 bg-red-100 hover:bg-red-200 border-red-200'
                                                                }`}
                                                                title={config.is_active ? 'Deactivate Account' : 'Permanently Delete Account'}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Toast Alert */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 transform translate-y-0 ${
                    toast.type === 'success' 
                        ? 'bg-green-55 border-green-200 text-green-800 bg-green-50' 
                        : 'bg-red-55 border-red-200 text-red-800 bg-red-50'
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

export default PaymentConfiguration;
