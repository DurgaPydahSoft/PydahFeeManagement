import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pencil, Trash2, Plus, CreditCard, Building2, Eye, EyeOff } from 'lucide-react';
import Sidebar from './Sidebar';

const PaymentConfiguration = () => {
    const [configs, setConfigs] = useState([]);
    const [form, setForm] = useState({
        college: '',
        account_name: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        upi_id: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [metadata, setMetadata] = useState({});

    useEffect(() => {
        fetchConfigs();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            setMetadata(response.data);
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchConfigs = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/payment-config`);
            setConfigs(response.data);
        } catch (error) { console.error('Error fetching configs', error); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!form.college || !form.account_name || !form.bank_name || !form.account_number || !form.ifsc_code) {
            alert('Please fill all required fields');
            return;
        }

        try {
            if (editingId) {
                // Update
                const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/payment-config/${editingId}`, form);
                setConfigs(configs.map(c => c._id === editingId ? response.data : c));
                setMessage('Account updated successfully!');
            } else {
                // Create
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/payment-config`, form);
                setConfigs([response.data, ...configs]);
                setMessage('Account added successfully!');
            }
            setForm({ college: '', account_name: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '' });
            setEditingId(null);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Error saving account configuration.');
        }
    };

    const handleEdit = (config) => {
        setForm({
            college: config.college,
            account_name: config.account_name,
            bank_name: config.bank_name,
            account_number: config.account_number,
            ifsc_code: config.ifsc_code,
            upi_id: config.upi_id || ''
        });
        setEditingId(config._id);
        window.scrollTo(0, 0);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure needed to de-activate this account?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/payment-config/${id}`);
            // Optimistic update: set is_active to false locally
            setConfigs(configs.map(c => c._id === id ? { ...c, is_active: false } : c));
        } catch (error) {
            console.error(error);
            alert('Failed to deactivate');
        }
    };

    const handleToggle = async (id) => {
        try {
            const response = await axios.patch(`${import.meta.env.VITE_API_URL}/api/payment-config/${id}/toggle`);
            setConfigs(configs.map(c => c._id === id ? response.data : c));
        } catch (error) {
            console.error(error);
            alert('Failed to toggle status');
        }
    };

    const colleges = Object.keys(metadata);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-8">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="w-8 h-8 text-blue-600" />
                        Payment Configuration
                    </h1>
                    <p className="text-gray-500 mt-1">Configure Bank Accounts and UPI details for online fee collection.</p>
                </header>

                {message && (
                    <div className="mb-4 p-4 rounded-lg bg-green-50 text-green-700 border border-green-200 flex items-center gap-2 animate-fadeIn">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: FORM */}
                    <div className="xl:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                {editingId ? <Pencil className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
                                {editingId ? 'Edit Account' : 'Add New Account'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">College</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        value={form.college}
                                        onChange={e => setForm({ ...form, college: e.target.value })}
                                        required
                                    >
                                        <option value="">Select College...</option>
                                        {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account Friendly Name</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. College Fees HDFC"
                                        value={form.account_name}
                                        onChange={e => setForm({ ...form, account_name: e.target.value })}
                                        required
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Internal name to identify this account.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. HDFC"
                                            value={form.bank_name}
                                            onChange={e => setForm({ ...form, bank_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase"
                                            placeholder="HDFC000..."
                                            value={form.ifsc_code}
                                            onChange={e => setForm({ ...form, ifsc_code: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Account Number</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-mono tracking-wider"
                                        placeholder="0000 0000 0000"
                                        value={form.account_number}
                                        onChange={e => setForm({ ...form, account_number: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UPI ID (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="college@okaxis"
                                        value={form.upi_id}
                                        onChange={e => setForm({ ...form, upi_id: e.target.value })}
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transform active:scale-95 transition-all ${editingId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
                                    >
                                        {editingId ? 'Update Account' : 'Add Account'}
                                    </button>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditingId(null); setForm({ college: '', account_name: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '' }); }}
                                            className="w-full mt-2 py-2 text-gray-500 font-semibold hover:text-gray-700"
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
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-bold text-gray-700">Active Accounts</h2>
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{configs.length} Configured</span>
                            </div>

                            {configs.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No Payment Accounts Configured.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500 border-b">
                                            <tr>
                                                <th className="p-4 font-semibold">Account Info</th>
                                                <th className="p-4 font-semibold">Bank Details</th>
                                                <th className="p-4 font-semibold">Status</th>
                                                <th className="p-4 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {configs.map(config => (
                                                <tr key={config._id} className={`group hover:bg-blue-50/50 transition-colors ${!config.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                                    <td className="p-4">
                                                        <div className="font-bold text-gray-800">{config.account_name}</div>
                                                        <div className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-1.5 py-0.5 rounded mt-1 border border-blue-100">{config.college}</div>
                                                        {config.upi_id && (
                                                            <div className="text-xs text-gray-500 mt-1 font-mono">UPI: {config.upi_id}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-semibold text-gray-700">{config.bank_name}</div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{config.account_number}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono uppercase">IFSC: {config.ifsc_code}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => handleToggle(config._id)}
                                                            className={`text-xs font-bold px-2 py-1 rounded-full border flex items-center gap-1 transition-all ${config.is_active ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'}`}
                                                        >
                                                            {config.is_active ? <><Eye size={12} /> Active</> : <><EyeOff size={12} /> Inactive</>}
                                                        </button>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(config)}
                                                                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                                                                title="Edit"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            {config.is_active && (
                                                                <button
                                                                    onClick={() => handleDelete(config._id)}
                                                                    className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                                                                    title="Deactivate"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
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
        </div>
    );
};

export default PaymentConfiguration;
