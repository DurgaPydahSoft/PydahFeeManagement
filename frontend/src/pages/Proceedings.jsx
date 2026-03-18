import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import Sidebar from './Sidebar';
import { FileText, Plus, Search, Trash2, Edit2, Calendar, DollarSign, University, GraduationCap, Users, ChevronDown, ChevronRight, User } from 'lucide-react';

const Proceedings = () => {
    const [proceedings, setProceedings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState({ hierarchy: {}, batches: [], categories: [], castes: [] });
    const [paymentConfigs, setPaymentConfigs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState({}); // { id: { data: [], loading: false } }

    const [formData, setFormData] = useState({
        proceedingNumber: '',
        proceedingDate: '',
        amount: '',
        bankAccount: '',
        bankCreditedDate: '',
        college: '',
        course: '',
        caste: '',
        batch: '',
        academicYear: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [procRes, metaRes, configRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/proceedings`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/payment-config`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
            ]);
            setProceedings(procRes.data);
            setMetadata(metaRes.data);
            setPaymentConfigs(configRes.data.filter(c => c.is_active));
        } catch (error) {
            console.error('Error fetching data:', error);
            Swal.fire('Error', 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/proceedings/${formData._id}`, formData, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                Swal.fire('Success', 'Proceeding updated successfully', 'success');
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/proceedings`, formData, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                Swal.fire('Success', 'Proceeding created successfully', 'success');
            }
            setShowModal(false);
            resetForm();
            fetchInitialData();
        } catch (error) {
            console.error('Error saving proceeding:', error);
            Swal.fire('Error', error.response?.data?.message || 'Failed to save proceeding', 'error');
        }
    };

    const handleEdit = (proc) => {
        setFormData({
            ...proc,
            proceedingDate: proc.proceedingDate ? proc.proceedingDate.split('T')[0] : '',
            bankCreditedDate: proc.bankCreditedDate ? proc.bankCreditedDate.split('T')[0] : ''
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/proceedings/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                Swal.fire('Deleted!', 'Proceeding has been deleted.', 'success');
                fetchInitialData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete proceeding', 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            proceedingNumber: '',
            proceedingDate: '',
            amount: '',
            bankAccount: '',
            bankCreditedDate: '',
            college: '',
            course: '',
            caste: '',
            batch: '',
            academicYear: ''
        });
        setIsEditing(false);
    };

    const filteredProceedings = proceedings.filter(p => 
        p.proceedingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.college.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.course.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleRow = async (id) => {
        if (expandedRows[id]) {
            const newExpanded = { ...expandedRows };
            delete newExpanded[id];
            setExpandedRows(newExpanded);
            return;
        }

        setExpandedRows(prev => ({ ...prev, [id]: { loading: true, data: [], totalUsed: 0 } }));
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/proceedings/${id}/summary`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setExpandedRows(prev => ({
                ...prev,
                [id]: { loading: false, data: res.data.transactions, totalUsed: res.data.totalUsed }
            }));
        } catch (e) {
            console.error("Failed to fetch summary", e);
            setExpandedRows(prev => ({ ...prev, [id]: { loading: false, data: [], totalUsed: 0 } }));
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8 flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Proceedings Management</h1>
                            <p className="text-slate-500 mt-1">Create and manage financial proceedings</p>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                        >
                            <Plus size={20} /> Create Proceeding
                        </button>
                    </div>

                    {/* Filters & Search */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by proceeding number, college, or course..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-4 font-semibold text-slate-600 text-sm w-10"></th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Proceeding No</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Date</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-right">Total / Used</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">College / Course / Caste</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Bank / Credited Date</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                    {filteredProceedings.map(proc => (
                                        <React.Fragment key={proc._id}>
                                            <tr className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => toggleRow(proc._id)}>
                                                <td className="p-4">
                                                    {expandedRows[proc._id] ? <ChevronDown size={18} className="text-blue-600" /> : <ChevronRight size={18} className="text-slate-400" />}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{proc.proceedingNumber}</div>
                                                    <div className="text-[10px] uppercase font-bold text-slate-400">{proc.status}</div>
                                                </td>
                                                <td className="p-4 text-slate-600 font-medium">{new Date(proc.proceedingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="p-4 text-right">
                                                    <div className="font-bold text-slate-800">₹{proc.amount?.toLocaleString()}</div>
                                                    {expandedRows[proc._id] && (
                                                        <div className="text-[10px] font-bold text-blue-600">USED: ₹{expandedRows[proc._id].totalUsed.toLocaleString()}</div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 text-xs">{proc.college}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium uppercase">{proc.course} {proc.batch ? `(${proc.batch})` : ''} - {proc.caste || 'ALL'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 text-xs">{proc.bankAccount}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold">{proc.bankCreditedDate ? new Date(proc.bankCreditedDate).toLocaleDateString() : 'PENDING'}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(proc); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(proc._id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedRows[proc._id] && (
                                                <tr className="bg-slate-50/30">
                                                    <td colSpan="7" className="p-0">
                                                        <div className="p-6 border-l-4 border-blue-500 bg-white shadow-inner animate-fadeIn">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest">
                                                                    <User size={14} className="text-blue-600" />
                                                                    Students Covered in this Proceeding
                                                                </h4>
                                                                <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                                                                    Total Residents: {expandedRows[proc._id].data.length}
                                                                </div>
                                                            </div>

                                                            {expandedRows[proc._id].loading ? (
                                                                <div className="py-10 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>
                                                            ) : expandedRows[proc._id].data.length === 0 ? (
                                                                <div className="py-10 text-center text-slate-400 italic text-sm">No transactions linked to this proceeding yet.</div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                    {expandedRows[proc._id].data.map((txn, tidx) => (
                                                                        <div key={tidx} className="bg-white border rounded-xl p-3 shadow-sm hover:border-blue-200 transition-colors flex justify-between items-center group">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">
                                                                                    {txn.studentName?.charAt(0)}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-xs font-bold text-slate-800">{txn.studentName}</div>
                                                                                    <div className="text-[10px] text-slate-400 font-mono">{txn.studentId}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xs font-black text-blue-700">₹{txn.amount.toLocaleString()}</div>
                                                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{new Date(txn.paymentDate).toLocaleDateString()}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Proceeding Limit</div>
                                                                        <div className="text-sm font-bold text-slate-600">₹{proc.amount?.toLocaleString()}</div>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-slate-200"></div>
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-blue-400 uppercase">Utilized Amount</div>
                                                                        <div className="text-sm font-black text-blue-700">₹{expandedRows[proc._id].totalUsed.toLocaleString()}</div>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-slate-200"></div>
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] font-bold text-emerald-400 uppercase">Remaining</div>
                                                                        <div className="text-sm font-black text-emerald-600">₹{(proc.amount - expandedRows[proc._id].totalUsed).toLocaleString()}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                            <h2 className="text-xl font-bold">{isEditing ? 'Edit Proceeding' : 'New Proceeding'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Proceeding Number *</label>
                                    <div className="relative group">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            name="proceedingNumber"
                                            value={formData.proceedingNumber}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                            placeholder="PR-2024-001"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Proceeding Date *</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="date"
                                            name="proceedingDate"
                                            value={formData.proceedingDate}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Amount *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Bank Info */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Bank Account *</label>
                                    <div className="relative">
                                        <University className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="bankAccount"
                                            value={formData.bankAccount}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Account</option>
                                            {paymentConfigs.map(c => (
                                                <option key={c._id} value={c.account_name}>{c.account_name} ({c.bank_name})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Bank Credited Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="date"
                                            name="bankCreditedDate"
                                            value={formData.bankCreditedDate}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Academic Year</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            name="academicYear"
                                            value={formData.academicYear}
                                            onChange={handleInputChange}
                                            placeholder="2024-2025"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Hierarchy */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">College *</label>
                                    <div className="relative">
                                        <University className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="college"
                                            value={formData.college}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select College</option>
                                            {Object.keys(metadata.hierarchy).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Course *</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="course"
                                            value={formData.course}
                                            onChange={handleInputChange}
                                            required
                                            disabled={!formData.college}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none disabled:opacity-50"
                                        >
                                            <option value="">Select Course</option>
                                            {formData.college && metadata.hierarchy[formData.college] && Object.keys(metadata.hierarchy[formData.college]).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Caste</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="caste"
                                            value={formData.caste || ''}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Caste</option>
                                            {metadata.castes?.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Batch</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <select
                                            name="batch"
                                            value={formData.batch}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                        >
                                            <option value="">Select Batch</option>
                                            {metadata.batches.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Status</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700 appearance-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-10 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all"
                                >
                                    {isEditing ? 'Update Proceeding' : 'Create Proceeding'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proceedings;
