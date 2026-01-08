import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';

const Permissions = () => {
    const [permissions, setPermissions] = useState([]);
    const [form, setForm] = useState({ studentId: '', grantedBy: 'Principal', remarks: '', validUpto: '' });
    const [fetchedName, setFetchedName] = useState('');
    const [loading, setLoading] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 3) {
                setIsSearching(true);
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/search?q=${searchTerm}`);
                    setSearchResults(res.data);
                } catch (error) { console.error(error); }
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const selectStudent = (s) => {
        setForm({ ...form, studentId: s.admission_number });
        setSearchTerm(`${s.student_name} (${s.admission_number})`);
        setSearchResults([]);
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/permissions`);
            setPermissions(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchStudentName = async () => {
        if (!form.studentId) return;
        try {
            // Re-using student metadata endpoint or fetch single student? 
            // Ideally we should have a quick search endpoint, but let's use the full list since it's client-side cached often 
            // OR use the recently added API logic if available.
            // Actually, we should just let the backend handle name fetching on save, OR fetch it here for UX.
            // Let's rely on backend validation for now, but for UX let's try to fetch simple name.
            // Since we don't have a direct 'get student by ID' endpoint openly exposed without auth sometimes being tricky or large payloads,
            // we will just proceed with submission which looks up the name.
            // User asked for "select the student", implying a dropdown or search.
            // For now, simple ID input + auto-name on save is fastest.
            // Enhancing UX: We can implement a search if needed later.
        } catch (e) { }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.studentId || !form.grantedBy) return alert('Student ID and Granted By required');

        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/permissions`, form);
            alert('Permission Granted Successfully');
            setForm({ studentId: '', grantedBy: 'Principal', remarks: '', validUpto: '' });
            setFetchedName('');
            fetchPermissions();
        } catch (error) {
            alert(error.response?.data?.message || 'Error granting permission');
        }
        setLoading(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Student Permissions</h1>
                    <p className="text-sm text-gray-500">Grant and track special permissions (Gate pass, Leave, etc.)</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form Section */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-fit">
                        <h2 className="font-semibold text-gray-800 mb-4">Grant New Permission</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Student (Name, ID, Pin)</label>
                                <div className="relative">
                                    <input
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setForm({ ...form, studentId: '' }); }}
                                        placeholder="Search by Name, ID or Pin (min 3 chars)"
                                        required={!form.studentId}
                                    />
                                    {isSearching && <div className="absolute right-3 top-3 text-xs text-gray-400">Searching...</div>}

                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                                            {searchResults.map(s => (
                                                <div
                                                    key={s.admission_number}
                                                    onClick={() => selectStudent(s)}
                                                    className="p-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                                                >
                                                    <div className="font-bold text-gray-800">{s.student_name}</div>
                                                    <div className="text-xs text-gray-500">{s.admission_number} | {s.pin_no || '-'}</div>
                                                    <div className="text-[10px] text-gray-400">{s.course} - {s.branch}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {form.studentId && <div className="text-xs text-green-600 mt-1">Selected: {form.studentId}</div>}
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Granted By</label>
                                <input
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.grantedBy}
                                    onChange={e => setForm({ ...form, grantedBy: e.target.value })}
                                    placeholder="e.g. Principal, HOD"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Valid Upto</label>
                                <input
                                    type="date"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.validUpto}
                                    onChange={e => setForm({ ...form, validUpto: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Remarks</label>
                                <textarea
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                    value={form.remarks}
                                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                                    placeholder="Describe the permission..."
                                />
                            </div>

                            <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition">
                                {loading ? 'Saving...' : 'Save Permission'}
                            </button>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <h2 className="font-semibold text-gray-800 mb-4">Recent Permissions</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3 font-semibold text-gray-600">Date</th>
                                        <th className="p-3 font-semibold text-gray-600">Student</th>
                                        <th className="p-3 font-semibold text-gray-600">Granted By</th>
                                        <th className="p-3 font-semibold text-gray-600">Valid Upto</th>
                                        <th className="p-3 font-semibold text-gray-600">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {permissions.length === 0 ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-400">No records found</td></tr>
                                    ) : (
                                        permissions.map(p => (
                                            <tr key={p._id} className="hover:bg-gray-50">
                                                <td className="p-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800">{p.studentName}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{p.studentId}</div>
                                                </td>
                                                <td className="p-3 text-gray-700">{p.grantedBy}</td>
                                                <td className="p-3 text-gray-700">
                                                    {p.validUpto ? new Date(p.validUpto).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="p-3 text-gray-600 italic">{p.remarks}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Permissions;
