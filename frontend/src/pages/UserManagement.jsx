import React, { useState, useEffect } from 'react';
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

    const handleEmployeeSearch = async (e) => {
        const query = e.target.value;
        if (query.length > 2) {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/employees/search?name=${query}`);
                setSearchResults(res.data);
            } catch (error) {
                console.error("Search failed", error);
            }
        } else {
            setSearchResults([]);
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
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
            if (path === '/fee-collection') {
                if (!currentPermissions.includes('fee_collection_pay')) currentPermissions.push('fee_collection_pay');
                if (!currentPermissions.includes('fee_collection_concession')) currentPermissions.push('fee_collection_concession');
            }
        }
        setFormData({ ...formData, permissions: currentPermissions });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
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
                                            placeholder="Search employee by name..."
                                            onChange={handleEmployeeSearch}
                                        />
                                        {/* Search Results Dropdown */}
                                        {searchResults.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                                                {searchResults.map(emp => (
                                                    <div
                                                        key={emp._id}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                                        onClick={() => selectEmployee(emp)}
                                                    >
                                                        <p className="font-bold text-sm text-gray-800">{emp.employee_name}</p>
                                                        <p className="text-xs text-gray-500">ID: {emp.emp_no} | {emp.designation_id}</p>
                                                    </div>
                                                ))}
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

                            <button className={`w-full text-white font-bold py-2 rounded transition ${editingUserId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                {editingUserId ? 'Update User' : 'Create User'}
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
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-gray-500">{user.college || '-'}</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded mr-2">Edit</button>
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
        </div>
    );
};

export default UserManagement;