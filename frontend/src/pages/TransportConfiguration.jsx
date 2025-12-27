import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, MapPin, X, User, Bus } from 'lucide-react';
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

    // --- Student Allocation Logic ---
    const [allocationSearch, setAllocationSearch] = useState('');
    const [foundStudents, setFoundStudents] = useState([]);
    const [allocationStudent, setAllocationStudent] = useState(null);
    const [allocationLoading, setAllocationLoading] = useState(false);

    // Assignment Form
    const [assignRouteId, setAssignRouteId] = useState('');
    const [assignStageId, setAssignStageId] = useState('');
    const [assignAmount, setAssignAmount] = useState(''); // New state for editable amount
    const [assignStagesList, setAssignStagesList] = useState([]);
    const [existingAllocations, setExistingAllocations] = useState([]);
    const [assignAcademicYear, setAssignAcademicYear] = useState('');

    // Generate Academic Years
    const currentYear = new Date().getFullYear();
    const academicYears = Array.from({ length: 5 }, (_, i) => `${currentYear - 2 + i}-${currentYear - 1 + i}`);

    const handleAllocationSearch = async (e) => {
        e.preventDefault();
        if (!allocationSearch.trim()) return;

        setAllocationLoading(true);
        setAllocationStudent(null);
        setFoundStudents([]);

        try {
            const res = await axios.get(`${API_URL}/api/students`);
            // Client-side filter for now
            const matches = res.data.filter(s =>
                s.admission_number === allocationSearch ||
                s.student_mobile === allocationSearch ||
                s.pin_no === allocationSearch ||
                (s.student_name && s.student_name.toLowerCase().includes(allocationSearch.toLowerCase()))
            );

            if (matches.length === 0) {
                alert('No student found');
            } else if (matches.length === 1) {
                selectAllocationStudent(matches[0]);
            } else {
                setFoundStudents(matches);
            }
        } catch (error) {
            console.error(error);
            alert('Error searching student');
        } finally {
            setAllocationLoading(false);
        }
    };

    const selectAllocationStudent = async (student) => {
        setAllocationStudent(student);
        setFoundStudents([]);
        setAllocationLoading(true);
        // Fetch existing allocations
        try {
            const res = await axios.get(`${API_URL}/api/transport/allocation/${student.admission_number}`);
            setExistingAllocations(res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setAllocationLoading(false);
        }
    };

    // Fetch stages when route is selected in assignment form
    useEffect(() => {
        if (assignRouteId) {
            // Re-use fetchStages logic but locally or new call? 
            // We can just call the API directly to avoid messing with the main tab state
            const loadStages = async () => {
                try {
                    const res = await axios.get(`${API_URL}/api/transport/stages/${assignRouteId}`);
                    setAssignStagesList(res.data);
                } catch (e) { console.error(e); }
            };
            loadStages();
        } else {
            setAssignStagesList([]);
        }
    }, [assignRouteId]);

    const handleAssignTransport = async () => {
        if (!allocationStudent || !assignRouteId || !assignStageId || !assignAcademicYear) {
            alert('Please select Student, Academic Year, Route and Stage');
            return;
        }

        try {
            await axios.post(`${API_URL}/api/transport/allocation`, {
                studentId: allocationStudent.admission_number,
                routeId: assignRouteId,
                stageId: assignStageId,
                academicYear: assignAcademicYear,
                amount: assignAmount // Send custom amount
            });
            alert('Transport Fee Assigned Successfully!');
            // Refresh allocations
            selectAllocationStudent(allocationStudent);
            // Reset form
            setAssignRouteId('');
            setAssignStageId('');
            setAssignAmount(''); // Reset amount
        } catch (error) {
            console.error(error);
            alert('Failed to assign transport fee');
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6">
                <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Bus className="text-gray-800" size={28} />
                            Transport Configuration
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Manage transport routes, stops, and fee structures.</p>
                    </div>
                    {/* Tabs */}
                    <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                        {['routes', 'stages', 'allocation', 'list'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {tab === 'list' ? 'Assigned List' : tab}
                            </button>
                        ))}
                    </div>
                </header>



                {/* --- ROUTES TAB --- */}
                {activeTab === 'routes' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => openRouteModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition text-sm">
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

                {/* --- ALLOCATION TAB --- */}
                {activeTab === 'allocation' && (
                    <div className="max-w-4xl mx-auto">
                        {/* Search Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User className="text-blue-600" size={20} />
                                Search Student
                            </h2>
                            <form onSubmit={handleAllocationSearch} className="flex gap-4">
                                <input
                                    type="text"
                                    className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Enter Admission No, Mobile, or Name"
                                    value={allocationSearch}
                                    onChange={e => setAllocationSearch(e.target.value)}
                                // ...
                                />
                                <button type="submit" disabled={allocationLoading} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                                    {allocationLoading ? 'Searching...' : 'Search'}
                                </button>
                            </form>
                            {/* ... (Existing search results) ... */}
                            {foundStudents.length > 0 && (
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {foundStudents.map(s => (
                                        <div key={s.admission_number} onClick={() => selectAllocationStudent(s)} className="p-3 border rounded cursor-pointer hover:bg-blue-50 hover:border-blue-300">
                                            <div className="font-bold">{s.student_name}</div>
                                            <div className="text-xs text-gray-500">{s.course} - {s.branch} ({s.current_year})</div>
                                            <div className="text-xs text-blue-600">ID: {s.admission_number}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Assignment Section */}
                        {allocationStudent && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Student & Allocation Form */}
                                <div className="space-y-6">
                                    {/* Student Card */}
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🎓</div>
                                            <div>
                                                <h3 className="font-bold text-lg text-blue-900">{allocationStudent.student_name}</h3>
                                                <p className="text-sm text-blue-700">{allocationStudent.course} | {allocationStudent.branch}</p>
                                                <p className="text-xs text-blue-500">Admn: {allocationStudent.admission_number}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-800 mb-4">Assign Transport Route</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">Academic Year</label>
                                                <select
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={assignAcademicYear}
                                                    onChange={e => setAssignAcademicYear(e.target.value)}
                                                >
                                                    <option value="">-- Select Year --</option>
                                                    {academicYears.map(y => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">Select Route</label>
                                                <select
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={assignRouteId}
                                                    onChange={e => setAssignRouteId(e.target.value)}
                                                >
                                                    <option value="">-- Choose Route --</option>
                                                    {routes.map(r => (
                                                        <option key={r._id} value={r._id}>{r.name} ({r.code})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">Select Stage</label>
                                                <select
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={assignStageId}
                                                    onChange={e => {
                                                        const sId = e.target.value;
                                                        setAssignStageId(sId);
                                                        // Auto-fill amount
                                                        const s = assignStagesList.find(st => st._id === sId);
                                                        if (s) setAssignAmount(s.amount);
                                                        else setAssignAmount('');
                                                    }}
                                                    disabled={!assignRouteId}
                                                >
                                                    <option value="">-- Choose Stage --</option>
                                                    {assignStagesList.map(s => (
                                                        <option key={s._id} value={s._id}>{s.stageName} - ₹{s.amount}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-1">Fee Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700"
                                                    value={assignAmount}
                                                    onChange={e => setAssignAmount(e.target.value)}
                                                    placeholder="Enter Amount"
                                                />
                                            </div>

                                            <div className="pt-2">
                                                <button
                                                    onClick={handleAssignTransport}
                                                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-md"
                                                >
                                                    Confirm Assignment
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: History */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                                        <h3 className="font-bold text-gray-800">Assigned Transport Fees</h3>
                                    </div>
                                    <div className="p-0">
                                        {existingAllocations.length === 0 ? (
                                            <p className="p-6 text-center text-gray-500 text-sm">No transport fees assigned yet.</p>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2">Year</th>
                                                        <th className="px-4 py-2">Remarks</th>
                                                        <th className="px-4 py-2 text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y text-sm">
                                                    {existingAllocations.map((a, i) => (
                                                        <tr key={i}>
                                                            <td className="px-4 py-3 text-gray-600">{a.academicYear}</td>
                                                            <td className="px-4 py-3 font-medium text-gray-800">{a.remarks}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-green-600">₹{a.amount}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- ASSIGNED LIST TAB --- */}
                {activeTab === 'list' && (
                    <TransportListTab API_URL={API_URL} />
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

// Sub-component for List
const TransportListTab = ({ API_URL }) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterYear, setFilterYear] = useState('');

    useEffect(() => {
        fetchList();
    }, []);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/transport/allocations`);
            setList(res.data);
        } catch (error) {
            console.error(error);
            alert("Failed to fetch data");
        } finally { setLoading(false); }
    };

    const textMatch = (txt, term) => (txt || '').toLowerCase().includes(term.toLowerCase());

    // Simple filter
    const displayedList = list.filter(item => {
        if (filterYear && item.academicYear !== filterYear) return false;
        return true;
    });

    const uniqueYears = [...new Set(list.map(i => i.academicYear))];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <div className="font-bold text-gray-700">Total Assignments: {displayedList.length}</div>
                <div className="flex gap-2">
                    <select className="border p-1 rounded text-sm" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                        <option value="">All Years</option>
                        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={fetchList} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm">Refresh</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="p-3">Student Name</th>
                            <th className="p-3">Admission No</th>
                            <th className="p-3">Course / Branch</th>
                            <th className="p-3">Academic Year</th>
                            <th className="p-3">Assigned Route & Stage</th>
                            <th className="p-3 text-right">Fee Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? <tr><td colSpan="6" className="p-6 text-center">Loading...</td></tr> :
                            displayedList.length === 0 ? <tr><td colSpan="6" className="p-6 text-center text-gray-400">No records found.</td></tr> :
                                displayedList.map(item => (
                                    <tr key={item._id} className="hover:bg-blue-50/50">
                                        <td className="p-3 font-medium text-gray-800">{item.studentName}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs">{item.studentId}</td>
                                        <td className="p-3 text-gray-600 text-xs">{item.course} - {item.branch}</td>
                                        <td className="p-3 text-gray-600">{item.academicYear}</td>
                                        <td className="p-3 text-gray-700">{item.remarks}</td>
                                        <td className="p-3 text-right font-bold text-green-700">₹{item.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransportConfiguration;
