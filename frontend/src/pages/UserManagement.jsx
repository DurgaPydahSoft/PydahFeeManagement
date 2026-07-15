import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';
import { Edit2, Trash2, Key } from 'lucide-react';
import { useCampuses, getCollegeNamesForCampuses } from '../hooks/useCampuses';


const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [colleges, setColleges] = useState([]);
    const [hierarchy, setHierarchy] = useState({});
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const isSuperAdminUser = currentUser.role === 'superadmin';

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'office_staff',
        campuses: [],
        colleges: [],
        courses: [],
        permissions: [],
        employeeId: null
    });

    const { campuses: campusList } = useCampuses();

    const visibleColleges = useMemo(() => {
        if (!formData.campuses?.length) return [];
        const campusCollegeNames = getCollegeNamesForCampuses(campusList, formData.campuses);
        return colleges.filter((c) => campusCollegeNames.includes(c));
    }, [formData.campuses, campusList, colleges]);

    const availablePages = [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Students', path: '/students' },
        { name: 'Fee Collection', path: '/fee-collection' },
        { name: 'Concessions (Declaration)', path: '/overall-concessions' },
        { name: 'Concessions (Application)', path: '/concessions' },
        { name: 'Bulk Fee Upload', path: '/bulk-fee-upload' },
        { name: 'Proceedings', path: '/proceedings' },
        { name: 'Reports & Analytics', path: '/reports' },
        { name: 'Due Reports', path: '/due-reports' },
        { name: 'Fee Configuration', path: '/fee-config' },
        { name: 'Payment Config', path: '/payment-config' },
        { name: 'Settings', path: '/settings' },
        { name: 'Reminder Config', path: '/reminders' },
        { name: 'Academic Calendar', path: '/academic-calendar' },
        { name: 'User Management', path: '/user-management' },
        { name: 'Permissions', path: '/permissions' }
    ];

    const handleEmployeeSearch = async (e) => {
        const query = e.target.value;
        if (query.trim().length >= 2) {
            setSearchLoading(true);
            try {
                const res = await api.get(`/employees/search?name=${query}`);
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
            const response = await api.get(`/students/metadata`);
            if (response.data && response.data.hierarchy) {
                setColleges(Object.keys(response.data.hierarchy));
                setHierarchy(response.data.hierarchy);
            }
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get(`/users`);
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

    const handleCampusToggle = (campusId) => {
        const numericId = Number(campusId);
        const currentCampuses = (formData.campuses || []).map(Number);
        const campus = campusList.find((c) => Number(c.id) === numericId);
        const campusCollegeNames = campus?.colleges?.map((c) => c.name) || [];

        let updatedCampuses;
        let updatedColleges = [...(formData.colleges || [])];
        let updatedCourses = [...(formData.courses || [])];

        if (currentCampuses.includes(numericId)) {
            updatedCampuses = currentCampuses.filter((id) => id !== numericId);
            updatedColleges = updatedColleges.filter((c) => !campusCollegeNames.includes(c));
            updatedCourses = updatedCourses.filter((c) => !campusCollegeNames.some((name) => c.startsWith(`${name}|`)));
        } else {
            updatedCampuses = [...currentCampuses, numericId];
        }

        setFormData({
            ...formData,
            campuses: updatedCampuses,
            colleges: updatedColleges,
            courses: updatedCourses,
        });
    };

    const handleCollegeToggle = (collegeName) => {
        const currentColleges = formData.colleges || [];
        const currentCourses = formData.courses || [];
        let updatedColleges;
        let updatedCourses = [...currentCourses];

        if (currentColleges.includes(collegeName)) {
            updatedColleges = currentColleges.filter(c => c !== collegeName);
            updatedCourses = currentCourses.filter(c => !c.startsWith(`${collegeName}|`));
        } else {
            updatedColleges = [...currentColleges, collegeName];
        }

        setFormData({
            ...formData,
            colleges: updatedColleges,
            courses: updatedCourses
        });
    };

    const handleCourseToggle = (collegeName, courseName) => {
        const courseKey = `${collegeName}|${courseName}`;
        const currentCourses = formData.courses || [];
        let updatedCourses;

        if (currentCourses.includes(courseKey)) {
            updatedCourses = currentCourses.filter(c => c !== courseKey);
        } else {
            updatedCourses = [...currentCourses, courseKey];
        }

        setFormData({
            ...formData,
            courses: updatedCourses
        });
    };

    const handleSelectAllCourses = (collegeName) => {
        const coursesOfCollege = Object.keys(hierarchy[collegeName] || {});
        const currentCourses = formData.courses || [];
        const otherCourses = currentCourses.filter(c => !c.startsWith(`${collegeName}|`));
        const newCourses = coursesOfCollege.map(c => `${collegeName}|${c}`);
        setFormData({
            ...formData,
            courses: [...otherCourses, ...newCourses]
        });
    };

    const handleClearAllCourses = (collegeName) => {
        const currentCourses = formData.courses || [];
        const updatedCourses = currentCourses.filter(c => !c.startsWith(`${collegeName}|`));
        setFormData({
            ...formData,
            courses: updatedCourses
        });
    };

    const prevRoleRef = useRef(formData.role);

    // Effect to handle default permissions based on role
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSubmitting(true);
        try {
            if (editingUserId) {
                const res = await api.put(`/users/${editingUserId}`, formData);
                setUsers(users.map(u => u._id === editingUserId ? res.data : u));
                setMessage('User updated successfully!');
                setEditingUserId(null);
            } else {
                const res = await api.post(`/users`, formData);
                setUsers([res.data, ...users]);
                setMessage('User created successfully!');
            }
            setFormData({ name: '', username: '', password: '', role: 'office_staff', campuses: [], colleges: [], courses: [], permissions: [], employeeId: null });
            setShowCreateEditModal(false);
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
            password: '',
            role: user.role,
            college: user.college || '',
            campuses: user.campuses || [],
            colleges: user.colleges || [],
            courses: user.courses || [],
            employeeId: user.employeeId || null,
            permissions: user.permissions || []
        });
        setEditingUserId(user._id);
        setShowCreateEditModal(true);
    };

    const handleCancelEdit = () => {
        setFormData({ name: '', username: '', password: '', role: 'office_staff', campuses: [], colleges: [], courses: [], employeeId: null, permissions: [] });
        setEditingUserId(null);
        setShowCreateEditModal(false);
    };

    const openCreateModal = () => {
        setFormData({ name: '', username: '', password: '', role: 'office_staff', campuses: [], colleges: [], courses: [], permissions: [], employeeId: null });
        setEditingUserId(null);
        setShowCreateEditModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u._id !== id));
            if (editingUserId === id) handleCancelEdit();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    // Password Reset Modal State
    const [resetModal, setResetModal] = useState({ show: false, user: null, newPassword: '' });
    // Create/Edit User Modal State
    const [showCreateEditModal, setShowCreateEditModal] = useState(false);

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
            await api.put(`/users/${resetModal.user._id}`, { password: resetModal.newPassword });
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
                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            placeholder="Search users (name, username)..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-black"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </header>

                <div className="space-y-4">
                    {/* User List */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-500 ease-in-out">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                            <h2 className="font-bold text-gray-800">Existing Users</h2>
                            {isSuperAdminUser && (
                                <button
                                    onClick={openCreateModal}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
                                >
                                    Create New User
                                </button>
                            )}
                        </div>
                        {loading ? <p>Loading...</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="p-3 font-semibold text-gray-600">Name</th>
                                            <th className="p-3 font-semibold text-gray-600">Username</th>
                                            <th className="p-3 font-semibold text-gray-600">Role</th>
                                            <th className="p-3 font-semibold text-gray-600">College Scope</th>
                                            {isSuperAdminUser && <th className="p-3 font-semibold text-right">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {users
                                            .filter(user => {
                                                if (!searchTerm.trim()) return true;
                                                const term = searchTerm.toLowerCase().trim();
                                                const nameMatch = (user.name || '').toLowerCase().includes(term);
                                                const usernameMatch = (user.username || '').toLowerCase().includes(term);
                                                return nameMatch || usernameMatch;
                                            })
                                            .map(user => (
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
                                                <td className="p-3 text-gray-500">
                                                    {user.campuses && user.campuses.length > 0 && (
                                                        <div className="text-[10px] text-indigo-600 font-bold mb-1">
                                                            Campuses: {user.campuses.map((id) => campusList.find((c) => c.id === id)?.code || id).join(', ')}
                                                        </div>
                                                    )}
                                                    {user.colleges && user.colleges.length > 0 ? (
                                                        <div className="space-y-1">
                                                            <div className="font-semibold text-xs text-gray-700">
                                                                {user.colleges.join(', ')}
                                                            </div>
                                                            {user.courses && user.courses.length > 0 && (
                                                                <div className="text-[10px] text-gray-400 max-w-xs truncate" title={user.courses.map(c => c.split('|')[1]).join(', ')}>
                                                                    Courses: {user.courses.map(c => c.split('|')[1]).join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        user.college || 'All Colleges'
                                                    )}
                                                </td>
                                                {isSuperAdminUser && (
                                                    <td className="p-3 text-right whitespace-nowrap">
                                                        <button
                                                            onClick={() => handleEdit(user)}
                                                            className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded mr-1.5 transition shadow-sm"
                                                            title="Edit User"
                                                        >
                                                            <Edit2 size={14} className="stroke-[2.5]" />
                                                        </button>
                                                        {(!user.employeeId || currentUser?.role === 'superadmin') && (
                                                            <button
                                                                onClick={() => openResetModal(user)}
                                                                className="inline-flex items-center justify-center text-yellow-600 hover:text-yellow-800 bg-yellow-50 hover:bg-yellow-100 p-1.5 rounded mr-1.5 transition shadow-sm"
                                                                title="Reset Password"
                                                            >
                                                                <Key size={14} className="stroke-[2.5]" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(user._id)}
                                                            className="inline-flex items-center justify-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition shadow-sm"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={14} className="stroke-[2.5]" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.filter(user => {
                                    if (!searchTerm.trim()) return true;
                                    const term = searchTerm.toLowerCase().trim();
                                    const nameMatch = (user.name || '').toLowerCase().includes(term);
                                    const usernameMatch = (user.username || '').toLowerCase().includes(term);
                                    return nameMatch || usernameMatch;
                                }).length === 0 && (
                                    <p className="text-center py-6 text-gray-400 italic">No matching users found.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create/Edit User Modal */}
            {showCreateEditModal && isSuperAdminUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h2 className="font-bold text-gray-800 text-xl">{editingUserId ? 'Edit User' : 'Create New User'}</h2>
                            <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                                ×
                            </button>
                        </div>
                        {message && <div className={`p-2 mb-4 text-sm rounded ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{message}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column */}
                                <div className="space-y-4">
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

                                    {/* Campus Selection */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Campus Selection</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border p-3 rounded bg-gray-50">
                                            {campusList.length === 0 ? (
                                                <p className="text-xs text-gray-500 col-span-full">No campuses loaded.</p>
                                            ) : (
                                                campusList.map((campus) => {
                                                    const isChecked = (formData.campuses || []).some((id) => Number(id) === Number(campus.id));
                                                    return (
                                                        <label key={campus.id} className="flex items-start gap-2 cursor-pointer p-2 rounded border bg-white hover:bg-blue-50/40">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleCampusToggle(campus.id)}
                                                                className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                                                            />
                                                            <div>
                                                                <span className="text-sm font-bold text-gray-800 block">{campus.name}</span>
                                                                <span className="text-[10px] font-mono text-blue-600 uppercase">{campus.code}</span>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">{campus.colleges?.length || 0} colleges</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Select campus(es) first, then choose colleges within them.</p>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-4">
                                    {/* College & Course Scope */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">College & Course Scope</label>
                                        <div className="space-y-4 border p-3 rounded bg-gray-50 max-h-[40vh] overflow-y-auto">
                                            {formData.campuses?.length === 0 ? (
                                                <p className="text-xs text-gray-500 italic">Select at least one campus to assign colleges.</p>
                                            ) : visibleColleges.length === 0 ? (
                                                <p className="text-xs text-gray-500">No colleges available for selected campus(es).</p>
                                            ) : (
                                                visibleColleges.map(collegeName => {
                                                    const isChecked = (formData.colleges || []).includes(collegeName);
                                                    const collegeCourses = hierarchy[collegeName] ? Object.keys(hierarchy[collegeName]) : [];
                                                    return (
                                                        <div key={collegeName} className="border-b last:border-b-0 pb-3 last:pb-0">
                                                            <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleCollegeToggle(collegeName)}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-sm font-bold text-gray-800">{collegeName}</span>
                                                            </label>

                                                            {isChecked && collegeCourses.length > 0 && (
                                                                <div className="ml-6 mt-2 p-2 bg-white rounded border border-gray-200 space-y-2">
                                                                    <div className="flex items-center justify-between border-b pb-1 mb-1">
                                                                        <span className="text-xs font-semibold text-gray-500">Courses:</span>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSelectAllCourses(collegeName)}
                                                                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-bold"
                                                                            >
                                                                                Select All
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleClearAllCourses(collegeName)}
                                                                                className="text-[10px] text-red-600 hover:text-red-800 hover:underline font-bold"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-1.5">
                                                                        {collegeCourses.map(courseName => {
                                                                            const courseKey = `${collegeName}|${courseName}`;
                                                                            const isCourseChecked = (formData.courses || []).includes(courseKey);
                                                                            return (
                                                                                <label key={courseName} className="flex items-center space-x-1.5 cursor-pointer p-0.5 rounded hover:bg-gray-50">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isCourseChecked}
                                                                                        onChange={() => handleCourseToggle(collegeName, courseName)}
                                                                                        className="rounded text-blue-500 focus:ring-blue-400 w-3.5 h-3.5"
                                                                                    />
                                                                                    <span className="text-xs text-gray-600 font-medium">{courseName}</span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Leave empty (no colleges selected) to allow access to all colleges (e.g. Super Admin).</p>
                                    </div>

                                    {/* Permission Checkboxes - split into two columns */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Permissions</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border p-3 rounded bg-gray-50 max-h-[50vh] overflow-y-auto">
                                            {availablePages.map(page => (
                                                <div key={page.path} className="flex flex-col">
                                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={(formData.permissions || []).includes(page.path)}
                                                            onChange={(() => {
                                                                const handlePermissionToggle = (path) => {
                                                                    let currentPermissions = formData.permissions || [];
                                                                    if (currentPermissions.includes(path)) {
                                                                        currentPermissions = currentPermissions.filter(p => p !== path);
                                                                        if (path === '/fee-collection') {
                                                                            currentPermissions = currentPermissions.filter(p => p !== 'fee_collection_pay' && p !== 'fee_collection_concession' && p !== 'fee_collection_edit');
                                                                        }
                                                                        if (path === '/reports') {
                                                                            currentPermissions = currentPermissions.filter(p => p !== 'reports_daily_collection' && p !== 'reports_cashier_summary' && p !== 'reports_fee_head_summary' && p !== 'reports_account_wise');
                                                                        }
                                                                    } else {
                                                                        currentPermissions = [...currentPermissions, path];
                                                                        if (path === '/fee-collection') {
                                                                            if (!currentPermissions.includes('fee_collection_pay')) currentPermissions.push('fee_collection_pay');
                                                                            if (formData.role !== 'cashier' && !currentPermissions.includes('fee_collection_concession')) {
                                                                                currentPermissions.push('fee_collection_concession');
                                                                            }
                                                                        }
                                                                        if (path === '/reports') {
                                                                            if (!currentPermissions.includes('reports_daily_collection')) currentPermissions.push('reports_daily_collection');
                                                                            if (!currentPermissions.includes('reports_cashier_summary')) currentPermissions.push('reports_cashier_summary');
                                                                            if (!currentPermissions.includes('reports_fee_head_summary')) currentPermissions.push('reports_fee_head_summary');
                                                                            if (!currentPermissions.includes('reports_account_wise')) currentPermissions.push('reports_account_wise');
                                                                        }
                                                                        if (path === '/concessions') {
                                                                            if (!currentPermissions.includes('concession_approvals')) currentPermissions.push('concession_approvals');
                                                                            if (formData.role !== 'cashier' && !currentPermissions.includes('concession_approvers')) {
                                                                                currentPermissions.push('concession_approvers');
                                                                            }
                                                                        }
                                                                    }
                                                                    setFormData({ ...formData, permissions: currentPermissions });
                                                                };
                                                                return () => handlePermissionToggle(page.path);
                                                            })()}
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
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('fee_collection_pay')) p = p.filter(x => x !== 'fee_collection_pay');
                                                                            else p = [...p, 'fee_collection_pay'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Enable Fee Collection</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('fee_collection_concession')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('fee_collection_concession')) p = p.filter(x => x !== 'fee_collection_concession');
                                                                            else p = [...p, 'fee_collection_concession'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Enable Fee Concession</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('fee_collection_edit')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('fee_collection_edit')) p = p.filter(x => x !== 'fee_collection_edit');
                                                                            else p = [...p, 'fee_collection_edit'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Enable Edit Transaction</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('fee_collection_delete')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('fee_collection_delete')) p = p.filter(x => x !== 'fee_collection_delete');
                                                                            else p = [...p, 'fee_collection_delete'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-red-600 focus:ring-red-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Enable Delete Transaction</span>
                                                            </label>
                                                        </div>
                                                    )}

                                                    {/* Sub-Permissions for Concessions */}
                                                    {page.path === '/concessions' && (formData.permissions || []).includes('/concessions') && (
                                                        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('concession_approvals')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('concession_approvals')) p = p.filter(x => x !== 'concession_approvals');
                                                                            else p = [...p, 'concession_approvals'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Enable Approvals</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('concession_approvers')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('concession_approvers')) p = p.filter(x => x !== 'concession_approvers');
                                                                            else p = [...p, 'concession_approvers'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Manage Approvers</span>
                                                            </label>
                                                        </div>
                                                    )}

                                                    {/* Sub-Permissions for Reports */}
                                                    {page.path === '/reports' && (formData.permissions || []).includes('/reports') && (
                                                        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('reports_daily_collection')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('reports_daily_collection')) p = p.filter(x => x !== 'reports_daily_collection');
                                                                            else p = [...p, 'reports_daily_collection'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Daily Collection</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('reports_cashier_summary')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('reports_cashier_summary')) p = p.filter(x => x !== 'reports_cashier_summary');
                                                                            else p = [...p, 'reports_cashier_summary'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Cashier Summary</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('reports_fee_head_summary')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('reports_fee_head_summary')) p = p.filter(x => x !== 'reports_fee_head_summary');
                                                                            else p = [...p, 'reports_fee_head_summary'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">College-wise Summary</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData.permissions || []).includes('reports_account_wise')}
                                                                    onChange={(() => {
                                                                        const toggle = () => {
                                                                            let p = formData.permissions || [];
                                                                            if (p.includes('reports_account_wise')) p = p.filter(x => x !== 'reports_account_wise');
                                                                            else p = [...p, 'reports_account_wise'];
                                                                            setFormData({ ...formData, permissions: p });
                                                                        };
                                                                        return toggle;
                                                                    })()}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-600">Account-wise Summary</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex-1 text-white font-bold py-2 rounded transition flex justify-center items-center gap-2 ${editingUserId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting && (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    )}
                                    {isSubmitting ? 'Saving...' : (editingUserId ? 'Update User' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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