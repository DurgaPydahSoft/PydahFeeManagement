import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';

const Settings = () => {
    const [settings, setSettings] = useState({
        showCollegeHeader: true,
        enableCashPayment: true,
        enableBankPayment: true,
        enableSplitPayment: true,
        maskedFeeHeads: [],
        maskName: 'Processing Fee',
        enableCustomReceiptSequence: false,
        receiptSequenceSeparator: '/',
        receiptSequencePadding: 5
    });
    const [feeHeads, setFeeHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingSection, setSavingSection] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, feeHeadsRes] = await Promise.all([
                api.get(`/settings`),
                api.get(`/fee-heads`)
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

    const handleTogglePayment = (paymentMethod) => {
        setSettings({ ...settings, [paymentMethod]: !settings[paymentMethod] });
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

    const handleSaveSection = async (section) => {
        setSavingSection(section);
        setMessage('');
        try {
            await api.put(`/settings`, settings);
            setMessage(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Error saving settings');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setSavingSection(null);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Global Settings</h1>
                    <p className="text-gray-500 mt-2">Configure fee receipts and global system features.</p>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800">Receipt Appearance</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-700">College Header</h3>
                                        <p className="text-sm text-gray-500">Show college name and address at the top of the receipt.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.showCollegeHeader !== false} onChange={handleToggleHeader} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Paper Size</h3>
                                        <p className="text-sm text-gray-500 mb-3">Select the physical paper size used for printing.</p>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="paperSize"
                                                    value="A4"
                                                    checked={!settings.paperSize || settings.paperSize === 'A4'}
                                                    onChange={() => setSettings({ ...settings, paperSize: 'A4' })}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">A4 Size</span>
                                            </label>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="paperSize"
                                                    value="A5"
                                                    checked={settings.paperSize === 'A5'}
                                                    onChange={() => setSettings({ ...settings, paperSize: 'A5' })}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">A5 Size</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Copies Per Page</h3>
                                        <p className="text-sm text-gray-500 mb-3">Number of receipts printed per sheet.</p>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="copiesPerPage"
                                                    value="1"
                                                    checked={settings.copiesPerPage === 1}
                                                    onChange={() => setSettings({ ...settings, copiesPerPage: 1 })}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">1 Copy</span>
                                            </label>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="copiesPerPage"
                                                    value="2"
                                                    checked={!settings.copiesPerPage || settings.copiesPerPage === 2}
                                                    onChange={() => setSettings({ ...settings, copiesPerPage: 2 })}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">2 Copies</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => handleSaveSection('appearance')}
                                    disabled={savingSection === 'appearance'}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                >
                                    {savingSection === 'appearance' && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
                                    {savingSection === 'appearance' ? 'Saving...' : 'Save Appearance'}
                                </button>
                            </div>
                        </div>

                        {/* Fee Collection Features */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800">Fee Collection Features</h2>
                                <p className="text-sm text-gray-500 mt-1">Enable or disable specific payment methods globally.</p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-700">Cash Payments</h3>
                                        <p className="text-sm text-gray-500">Allow collection of fees via physical cash.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.enableCashPayment !== false} onChange={() => handleTogglePayment('enableCashPayment')} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                                    <div>
                                        <h3 className="font-semibold text-gray-700">Bank Payments</h3>
                                        <p className="text-sm text-gray-500">Allow collection of fees via bank transfers, DD, or cheques.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.enableBankPayment !== false} onChange={() => handleTogglePayment('enableBankPayment')} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                                    <div>
                                        <h3 className="font-semibold text-gray-700">Split Payments</h3>
                                        <p className="text-sm text-gray-500">Allow splitting a single payment across multiple methods.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.enableSplitPayment !== false} onChange={() => handleTogglePayment('enableSplitPayment')} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => handleSaveSection('features')}
                                    disabled={savingSection === 'features'}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                >
                                    {savingSection === 'features' && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
                                    {savingSection === 'features' ? 'Saving...' : 'Save Features'}
                                </button>
                            </div>
                        </div>

                        {/* Custom Receipt Sequence Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
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
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={settings.enableCustomReceiptSequence === true} 
                                            onChange={() => setSettings({ ...settings, enableCustomReceiptSequence: !settings.enableCustomReceiptSequence })} 
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {settings.enableCustomReceiptSequence && (
                                    <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Sequence Separator</label>
                                            <select
                                                value={settings.receiptSequenceSeparator || '/'}
                                                onChange={e => setSettings({ ...settings, receiptSequenceSeparator: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                                            >
                                                <option value="/">Slash ( / )</option>
                                                <option value="-">Hyphen ( - )</option>
                                                <option value="_">Underscore ( _ )</option>
                                                <option value=".">Dot ( . )</option>
                                            </select>
                                            <p className="text-xs text-gray-400 mt-1">Character separating receipt number parts.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Sequence Padding</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={settings.receiptSequencePadding ?? 5}
                                                onChange={e => setSettings({ ...settings, receiptSequencePadding: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Digits for the sequence counter (e.g. 5 pads to 00001).</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">FY Reset Month</label>
                                            <select
                                                value={settings.receiptSequenceResetMonth ?? 4}
                                                onChange={e => setSettings({ ...settings, receiptSequenceResetMonth: parseInt(e.target.value) })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                                            >
                                                <option value={1}>January</option>
                                                <option value={2}>February</option>
                                                <option value={3}>March</option>
                                                <option value={4}>April</option>
                                                <option value={5}>May</option>
                                                <option value={6}>June</option>
                                                <option value={7}>July</option>
                                                <option value={8}>August</option>
                                                <option value={9}>September</option>
                                                <option value={10}>October</option>
                                                <option value={11}>November</option>
                                                <option value={12}>December</option>
                                            </select>
                                            <p className="text-xs text-gray-400 mt-1">Month to restart sequence from 1.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">FY Reset Day</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={31}
                                                value={settings.receiptSequenceResetDay ?? 1}
                                                onChange={e => setSettings({ ...settings, receiptSequenceResetDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Day of month to restart sequence.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => handleSaveSection('sequence')}
                                    disabled={savingSection === 'sequence'}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                >
                                    {savingSection === 'sequence' && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
                                    {savingSection === 'sequence' ? 'Saving...' : 'Save Sequence'}
                                </button>
                            </div>
                        </div>

                        {/* Masking Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
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
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => handleSaveSection('masking')}
                                    disabled={savingSection === 'masking'}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                >
                                    {savingSection === 'masking' && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>}
                                    {savingSection === 'masking' ? 'Saving...' : 'Save Masking'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
