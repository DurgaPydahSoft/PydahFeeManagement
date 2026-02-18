import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';

const ReceiptSettings = () => {
    const [settings, setSettings] = useState({
        showCollegeHeader: true,
        maskedFeeHeads: [],
        maskName: 'Processing Fee'
    });
    const [feeHeads, setFeeHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, feeHeadsRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/receipt-settings`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/fee-heads`)
            ]);
            setSettings(settingsRes.data);
            setFeeHeads(feeHeadsRes.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setMessage('Error fetching data');
            setLoading(false);
        }
    };

    const handleToggleHeader = () => {
        setSettings({ ...settings, showCollegeHeader: !settings.showCollegeHeader });
    };

    const handleMaskNameChange = (e) => {
        setSettings({ ...settings, maskName: e.target.value });
    };

    const handleFeeHeadToggle = (id) => {
        const currentMasked = settings.maskedFeeHeads || [];
        if (currentMasked.includes(id)) {
            setSettings({
                ...settings,
                maskedFeeHeads: currentMasked.filter(fid => fid !== id)
            });
        } else {
            setSettings({
                ...settings,
                maskedFeeHeads: [...currentMasked, id]
            });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/receipt-settings`, settings);
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Error saving settings');
        }
        setSaving(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6 md:p-10">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Receipt Settings</h1>
                    <p className="text-gray-500 mt-2">Configure appearance and content of fee receipts.</p>
                </header>

                {loading ? (
                    <div className="text-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
                ) : (
                    <div className="max-w-4xl space-y-6">
                        {/* Status Message */}
                        {message && (
                            <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                {message}
                            </div>
                        )}

                        {/* General Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800">General Appearance</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-700">College Header</h3>
                                        <p className="text-sm text-gray-500">Show college name and address at the top of the receipt.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.showCollegeHeader} onChange={handleToggleHeader} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Masking Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800">Mask Fee Heads</h2>
                                <p className="text-sm text-gray-500 mt-1">Select Fee Heads to hide/rename on the receipt. They will be displayed as the name below.</p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mask Name (Display Name)</label>
                                    <input
                                        type="text"
                                        value={settings.maskName}
                                        onChange={handleMaskNameChange}
                                        className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. Processing Fee"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">This name will replace the actual fee head name on the receipt.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Select Fee Heads to Mask:</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
                                        {feeHeads.map(head => (
                                            <label key={head._id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${settings.maskedFeeHeads?.includes(head._id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-blue-100'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.maskedFeeHeads?.includes(head._id)}
                                                    onChange={() => handleFeeHeadToggle(head._id)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <span className={`ml-3 text-sm ${settings.maskedFeeHeads?.includes(head._id) ? 'font-bold text-blue-800' : 'text-gray-600'}`}>
                                                    {head.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {saving ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceiptSettings;
