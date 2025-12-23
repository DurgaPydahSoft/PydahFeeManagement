import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Bus, MapPin, X } from 'lucide-react';
import Sidebar from './Sidebar';

const TransportConfiguration = () => {
    const [routes, setRoutes] = useState([]);
    const [stages, setStages] = useState([]);
    const [selectedRouteId, setSelectedRouteId] = useState('');

    // Modal & Form States
    const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [currentRoute, setCurrentRoute] = useState(null); // For Edit
    const [currentStage, setCurrentStage] = useState(null); // For Edit

    // Tab State
    const [activeTab, setActiveTab] = useState('routes');

    // Route Form Data
    const [routeForm, setRouteForm] = useState({ name: '', code: '', description: '', status: 'Active' });

    // Stage Form Data
    const [stageForm, setStageForm] = useState({ stageName: '', stopOrder: '', amount: '' });

    const API_URL = import.meta.env.VITE_API_URL;

    // --- Data Fetching ---
    const fetchRoutes = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/transport/routes`);
            setRoutes(res.data);
        } catch (error) {
            console.error(error);
            alert('Failed to fetch routes');
        }
    };

    const fetchStages = async (routeId) => {
        if (!routeId) return;
        try {
            const res = await axios.get(`${API_URL}/api/transport/stages/${routeId}`);
            setStages(res.data);
        } catch (error) {
            console.error(error);
            alert('Failed to fetch stages');
        }
    };

    useEffect(() => {
        fetchRoutes();
    }, []);

    useEffect(() => {
        if (selectedRouteId) {
            fetchStages(selectedRouteId);
        } else {
            setStages([]);
        }
    }, [selectedRouteId]);

    // --- Route Operations ---
    const handleRouteSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentRoute) {
                await axios.put(`${API_URL}/api/transport/routes/${currentRoute._id}`, routeForm);
            } else {
                await axios.post(`${API_URL}/api/transport/routes`, routeForm);
            }
            fetchRoutes();
            closeRouteModal();
        } catch (error) {
            alert(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleDeleteRoute = async (id) => {
        if (!window.confirm('Delete this route? This will also delete all associated stages.')) return;
        try {
            await axios.delete(`${API_URL}/api/transport/routes/${id}`);
            fetchRoutes();
            if (selectedRouteId === id) {
                setSelectedRouteId('');
                setStages([]);
            }
        } catch (error) {
            alert('Failed to delete route');
        }
    };

    // --- Stage Operations ---
    const handleStageSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...stageForm, routeId: selectedRouteId };
            if (currentStage) {
                await axios.put(`${API_URL}/api/transport/stages/${currentStage._id}`, stageForm);
            } else {
                await axios.post(`${API_URL}/api/transport/stages`, payload);
            }
            fetchStages(selectedRouteId);
            closeStageModal();
        } catch (error) {
            alert(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleDeleteStage = async (id) => {
        if (!window.confirm('Delete this stage?')) return;
        try {
            await axios.delete(`${API_URL}/api/transport/stages/${id}`);
            fetchStages(selectedRouteId);
        } catch (error) {
            alert('Failed to delete stage');
        }
    };

    // --- Helper Functions ---
    const openRouteModal = (route = null) => {
        setCurrentRoute(route);
        setRouteForm(route ? { name: route.name, code: route.code, description: route.description, status: route.status } : { name: '', code: '', description: '', status: 'Active' });
        setIsRouteModalOpen(true);
    };

    const closeRouteModal = () => {
        setCurrentRoute(null);
        setIsRouteModalOpen(false);
    };

    const openStageModal = (stage = null) => {
        setCurrentStage(stage);
        setStageForm(stage ? { stageName: stage.stageName, stopOrder: stage.stopOrder, amount: stage.amount } : { stageName: '', stopOrder: '', amount: '' });
        setIsStageModalOpen(true);
    };

    const closeStageModal = () => {
        setCurrentStage(null);
        setIsStageModalOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
                        <Bus className="w-8 h-8 text-blue-600" />
                        Transport Configuration
                    </h1>
                    <p className="text-gray-500 mt-2">Manage transport routes, stops, and fee structures.</p>
                </header>

                {/* Tabs */}
                <div className="flex space-x-4 border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('routes')}
                        className={`pb-2 px-4 font-semibold transition ${activeTab === 'routes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Routes Management
                    </button>
                    <button
                        onClick={() => setActiveTab('stages')}
                        className={`pb-2 px-4 font-semibold transition ${activeTab === 'stages' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Route Stages & Fees
                    </button>
                </div>

                {/* --- ROUTES TAB --- */}
                {activeTab === 'routes' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => openRouteModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition">
                                <Plus size={18} /> Add New Route
                            </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="p-4">Route Name</th>
                                        <th className="p-4">Code</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {routes.length === 0 ? (
                                        <tr><td colSpan="5" className="p-6 text-center text-gray-500">No routes defined.</td></tr>
                                    ) : (
                                        routes.map(r => (
                                            <tr key={r._id} className="hover:bg-gray-50">
                                                <td className="p-4 font-medium text-gray-800">{r.name}</td>
                                                <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono font-bold">{r.code}</span></td>
                                                <td className="p-4 text-gray-500 text-sm">{r.description || '-'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openRouteModal(r)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDeleteRoute(r._id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- STAGES TAB --- */}
                {activeTab === 'stages' && (
                    <div className="flex gap-6">
                        {/* Sidebar Selection */}
                        <div className="w-1/4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Select Route</label>
                            <div className="space-y-2">
                                {routes.map(r => (
                                    <div
                                        key={r._id}
                                        onClick={() => setSelectedRouteId(r._id)}
                                        className={`p-3 rounded-lg cursor-pointer border transition flex justify-between items-center ${selectedRouteId === r._id ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                    >
                                        <span className="font-medium">{r.name}</span>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">{r.code}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1">
                            {!selectedRouteId ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-gray-300">
                                    <MapPin className="text-gray-300 w-12 h-12 mb-3" />
                                    <p className="text-gray-500">Select a route to manage its stages.</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-gray-800">Stages for {routes.find(r => r._id === selectedRouteId)?.name}</h2>
                                        <button onClick={() => openStageModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition text-sm">
                                            <Plus size={16} /> Add Stage
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs font-semibold">
                                                <tr>
                                                    <th className="p-4 w-16">Order</th>
                                                    <th className="p-4">Stage Name</th>
                                                    <th className="p-4 text-right">Fee Amount (₹)</th>
                                                    <th className="p-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {stages.length === 0 ? (
                                                    <tr><td colSpan="4" className="p-6 text-center text-gray-500">No stages defined for this route.</td></tr>
                                                ) : (
                                                    stages.map((s) => (
                                                        <tr key={s._id} className="hover:bg-gray-50 relative group">
                                                            <td className="p-4 font-mono text-gray-500">{s.stopOrder}</td>
                                                            <td className="p-4 font-medium text-gray-800">{s.stageName}</td>
                                                            <td className="p-4 text-right font-bold text-gray-700">₹{s.amount.toLocaleString()}</td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => openStageModal(s)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit2 size={16} /></button>
                                                                    <button onClick={() => handleDeleteStage(s._id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MODALS --- */}
                {/* Route Modal */}
                {isRouteModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">{currentRoute ? 'Edit Route' : 'New Route'}</h3>
                                <button onClick={closeRouteModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleRouteSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Route Name</label>
                                    <input type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={routeForm.name} onChange={e => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="e.g. Route A - Uptown" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Route Code</label>
                                    <input type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase" value={routeForm.code} onChange={e => setRouteForm({ ...routeForm, code: e.target.value.toUpperCase() })} placeholder="RT-A" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                    <textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={routeForm.description} onChange={e => setRouteForm({ ...routeForm, description: e.target.value })} rows="2" placeholder="Optional details..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                    <select className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={routeForm.status} onChange={e => setRouteForm({ ...routeForm, status: e.target.value })}>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 mt-2">Save Route</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Stage Modal */}
                {isStageModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">{currentStage ? 'Edit Stage' : 'New Stage'}</h3>
                                <button onClick={closeStageModal} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleStageSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Stage Name</label>
                                    <input type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={stageForm.stageName} onChange={e => setStageForm({ ...stageForm, stageName: e.target.value })} placeholder="e.g. Main Market Stop" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Stop Order</label>
                                        <input type="number" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={stageForm.stopOrder} onChange={e => setStageForm({ ...stageForm, stopOrder: e.target.value })} placeholder="1" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Fee Amount (₹)</label>
                                        <input type="number" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={stageForm.amount} onChange={e => setStageForm({ ...stageForm, amount: e.target.value })} placeholder="5000" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 mt-2">Save Stage</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransportConfiguration;
