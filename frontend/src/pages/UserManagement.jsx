import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [colleges, setColleges] = useState([]);

    const availablePages = [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Fee Configuration', path: '/fee-config' },
        { name: 'Students', path: '/students' },
        { name: 'Fee Collection', path: '/fee-collection' },
        { name: 'Reports', path: '/reports' },
        { name: 'Due Reports', path: '/due-reports' },
        { name: 'Concession Management', path: '/concessions' },
        { name: 'Hostel Config', path: '/hostel-config' },
    ];

    // Form State
    const [editingUserId, setEditingUserId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // [NEW] Loading State
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'office_staff',
        college: '',
        employeeId: null, // [NEW] Link to employee
        permissions: []
    });

    // Employee Search State
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false); // [NEW] Search Loading State

    const handleEmployeeSearch = async (e) => {
        const query = e.target.value;
        if (query.length > 0) { // Changed from > 2 to > 0 to search on every char
            setSearchLoading(true);
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/employees/search?name=${query}`);
                setSearchResults(res.data);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setSearchLoading(false);
            }
        } else {
            setSearchResults([]);
            setSearchLoading(false);
        }
    };

    const selectEmployee = (emp) => {
        setFormData({
            ...formData,
            name: emp.employee_name,
            username: emp.emp_no,
            employeeId: emp._id, // Store ID for backend linking
            password: '' // Clear password as it's not needed
        });
        setSearchResults([]);
    };

    const clearSelectedEmployee = () => {
        setFormData({
            ...formData,
            name: '',
            username: '',
            employeeId: null,
            password: ''
        });
    };

    useEffect(() => {
        fetchUsers();
        fetchMetadata(); // [NEW]
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            // response.data = { hierarchy: { 'College': ... }, batches: [...] }
            if (response.data && response.data.hierarchy) {
                setColleges(Object.keys(response.data.hierarchy));
            }
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`);
            setUsers(res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const prevRoleRef = useRef(formData.role);

    // [NEW] Effect to handle default permissions based on role
    useEffect(() => {
        const cashierPermissions = ['/fee-collection', 'fee_collection_pay'];

        if (formData.role === 'cashier') {
            let currentPermissions = [...(formData.permissions || [])];
            let changed = false;

            cashierPermissions.forEach(p => {
                if (!currentPermissions.includes(p)) {
                    currentPermissions.push(p);
                    changed = true;
                }
            });

            if (changed) {
                setFormData(prev => ({ ...prev, permissions: currentPermissions }));
            }
        } else if (prevRoleRef.current === 'cashier' && formData.role !== 'cashier') {
            // Transitioning away from cashier - clean up auto-added permissions
            let currentPermissions = [...(formData.permissions || [])];
            const updatedPermissions = currentPermissions.filter(p => !cashierPermissions.includes(p));

            if (updatedPermissions.length !== currentPermissions.length) {
                setFormData(prev => ({ ...prev, permissions: updatedPermissions }));
            }
        }
        prevRoleRef.current = formData.role;
    }, [formData.role]);

    const handlePermissionToggle = (path) => {
        let currentPermissions = formData.permissions || [];

        if (currentPermissions.includes(path)) {
            // Unchecking
            currentPermissions = currentPermissions.filter(p => p !== path);

            // If unchecking Fee Collection, also remove sub-permissions
            if (path === '/fee-collection') {
                currentPermissions = currentPermissions.filter(p => p !== 'fee_collection_pay' && p !== 'fee_collection_concession');
            }
        } else {
            // Checking
            currentPermissions = [...currentPermissions, path];

            // If checking Fee Collection, auto-select both sub-permissions by default
            // If checking Fee Collection, auto-select both sub-permissions by default (unless cashier)
            if (path === '/fee-collection') {
                if (!currentPermissions.includes('fee_collection_pay')) currentPermissions.push('fee_collection_pay');
                if (formData.role !== 'cashier' && !currentPermissions.includes('fee_collection_concession')) {
                    currentPermissions.push('fee_collection_concession');
                }
            }
        }
        setFormData({ ...formData, permissions: currentPermissions });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSubmitting(true);
        try {
            if (editingUserId) {
                const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${editingUserId}`, formData);
                setUsers(users.map(u => u._id === editingUserId ? res.data : u));
                setMessage('User updated successfully!');
                setEditingUserId(null);
            } else {
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/users`, formData);
                setUsers([res.data, ...users]);
                setMessage('User created successfully!');
            }
            setFormData({ name: '', username: '', password: '', role: 'office_staff', college: '', permissions: [] });
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Error saving user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (user) => {
        setFormData({
            name: user.name,
            username: user.username,
            password: '', // Don't prefill password
            role: user.role,
            college: user.college || '',
            employeeId: user.employeeId || null,
            permissions: user.permissions || []
        });
        setEditingUserId(user._id);
        window.scrollTo(0, 0);
    };

    const handleCancelEdit = () => {
        setFormData({ name: '', username: '', password: '', role: 'office_staff', college: '', employeeId: null, permissions: [] });
        setEditingUserId(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/${id}`);
            setUsers(users.filter(u => u._id !== id));
            if (editingUserId === id) handleCancelEdit();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    // [NEW] Password Reset Modal State
    const [resetModal, setResetModal] = useState({ show: false, user: null, newPassword: '' });

    const openResetModal = (user) => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (user.employeeId && currentUser?.role !== 'superadmin') {
            alert("Cannot reset password for Employee-linked users. They must use their Employee DB credentials.");
            return;
        }
        setResetModal({ show: true, user: user, newPassword: '' });
    };

    const closeResetModal = () => {
        setResetModal({ show: false, user: null, newPassword: '' });
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${resetModal.user._id}`, { password: resetModal.newPassword });
            alert('Password updated successfully!');
            closeResetModal();
        } catch (error) {
            console.error(error);
            alert('Failed to reset password.');
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6">
                <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                        <p className="text-sm text-gray-500 mt-1">Create and manage access for system users.</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create/Edit User Form */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 h-fit">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h2 className="font-bold text-gray-800">{editingUserId ? 'Edit User' : 'Create New User'}</h2>
                            {editingUserId && (
                                <button onClick={handleCancelEdit} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition">
                                    Cancel
                                </button>
                            )}
                        </div>
                        {message && <div className={`p-2 mb-4 text-sm rounded ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{message}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Employee Search / Name Input */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Employee Name</label>

                                {!formData.employeeId ? (
                                    <>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded mt-1"
                                            placeholder="Search employee by Name or ID..."
                                            onChange={handleEmployeeSearch}
                                        />
                                        {/* Search Results Dropdown */}
                                        {(searchResults.length > 0 || searchLoading) && (
                                            <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                                                {searchLoading && (
                                                    <div className="p-3 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                                                        <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        Searching...
                                                    </div>
                                                )}
                                                {!searchLoading && searchResults.map(emp => (
                                                    <div
                                                        key={emp._id}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                                        onClick={() => selectEmployee(emp)}
                                                    >
                                                        <p className="font-bold text-sm text-gray-800">
                                                            {emp.employee_name} <span className="text-gray-500 font-normal">({emp.emp_no})</span>
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {emp.designation_id?.designation_name || emp.designation_id?.name || 'N/A'} |
                                                            {emp.division_id?.division_name || emp.division_id?.name || 'N/A'} |
                                                            {emp.department_id?.department_name || emp.department_id?.name || 'N/A'}
                                                        </p>
                                                    </div>
                                                ))}
                                                {!searchLoading && searchResults.length === 0 && (
                                                    <div className="p-3 text-center text-gray-500 text-sm">No results found</div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded mt-1">
                                        <div>
                                            <p className="font-bold text-sm text-blue-900">{formData.name}</p>
                                            <p className="text-xs text-blue-700">Emp No: {formData.username}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearSelectedEmployee}
                                            className="text-red-500 hover:text-red-700 text-xs font-bold px-2"
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}

                                {!formData.employeeId && editingUserId && (
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded mt-1"
                                        placeholder="Or enter name manually (Legacy)"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Username (Login ID)</label>
                                <input
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full border p-2 rounded mt-1 bg-gray-50"
                                    readOnly={!!formData.employeeId} // Read-only if linked
                                    required
                                />
                            </div>

                            {/* Password field - Hidden if Employee Linked */}
                            {!formData.employeeId && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded mt-1"
                                        required={!editingUserId && !formData.employeeId}
                                        placeholder={editingUserId ? "Leave blank to keep unchanged" : "Set password"}
                                    />
                                </div>
                            )}

                            {formData.employeeId && (
                                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                    <span className="font-bold">Note:</span> user will login using their Employee DB password.
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Role</label>
                                <select name="role" value={formData.role} onChange={handleChange} className="w-full border p-2 rounded mt-1 bg-white">
                                    <option value="office_staff">Office Staff</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="admin">Admin</option>
                                    <option value="superadmin">Super Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">College (Optional)</label>
                                <select name="college" value={formData.college} onChange={handleChange} className="w-full border p-2 rounded mt-1 bg-white">
                                    <option value="">-- Select College --</option>
                                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Leave empty for Super Admin</p>
                            </div>
                            {/* Permission Checkboxes */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Permissions</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 border p-2 rounded bg-gray-50 max-h-60 overflow-y-auto">
                                    {availablePages.map(page => (
                                        <div key={page.path} className="flex flex-col">
                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData.permissions || []).includes(page.path)}
                                                    onChange={() => handlePermissionToggle(page.path)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700 font-medium">{page.name}</span>
                                            </label>

                                            {/* Sub-Permissions for Fee Collection */}
                                            {page.path === '/fee-collection' && (formData.permissions || []).includes('/fee-collection') && (
                                                <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={(formData.permissions || []).includes('fee_collection_pay')}
                                                            onChange={() => handlePermissionToggle('fee_collection_pay')}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-600">Enable Fee Collection</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={(formData.permissions || []).includes('fee_collection_concession')}
                                                            onChange={() => handlePermissionToggle('fee_collection_concession')}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-600">Enable Fee Concession</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                disabled={isSubmitting}
                                className={`w-full text-white font-bold py-2 rounded transition flex justify-center items-center gap-2 ${editingUserId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting && (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                )}
                                {isSubmitting ? 'Saving...' : (editingUserId ? 'Update User' : 'Create User')}
                            </button>
                        </form>
                    </div>

                    {/* User List */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="font-bold text-gray-800 mb-3">Existing Users</h2>
                        {loading ? <p>Loading...</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-600">Name</th>
                                            <th className="p-3 font-semibold text-gray-600">Username</th>
                                            <th className="p-3 font-semibold text-gray-600">Role</th>
                                            <th className="p-3 font-semibold text-gray-600">College</th>
                                            <th className="p-3 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {users.map(user => (
                                            <tr key={user._id} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-900">{user.name}</td>
                                                <td className="p-3 text-gray-500 font-mono">{user.username}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                                                        user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                                            user.role === 'cashier' ? 'bg-green-100 text-green-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-gray-500">{user.college || '-'}</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded mr-2">Edit</button>
                                                    {(!user.employeeId || JSON.parse(localStorage.getItem('user'))?.role === 'superadmin') && (
                                                        <button onClick={() => openResetModal(user)} className="text-yellow-600 hover:text-yellow-800 font-bold text-xs bg-yellow-50 hover:bg-yellow-100 px-2 py-1 rounded mr-2">Reset Pwd</button>
                                                    )}
                                                    <button onClick={() => handleDelete(user._id)} className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded">Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.length === 0 && <p className="text-center py-4 text-gray-500">No users found.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Password Reset Modal */}
            {resetModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Reset Password
                        </h2>
                        <p className="text-sm text-gray-500 mb-6 border-b border-gray-100 pb-4">
                            Enter a new password for <span className="font-bold text-gray-800 px-1 bg-yellow-50 rounded text-yellow-700">{resetModal.user?.name}</span>.
                        </p>

                        <form onSubmit={handleSavePassword}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resetModal.newPassword}
                                    onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value })}
                                    required
                                    autoFocus
                                    placeholder="Enter new password..."
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeResetModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition"
                                >
                                    Save Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;