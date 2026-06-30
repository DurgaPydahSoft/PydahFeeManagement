import React, { useState } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';

const UserProfile = () => {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const role = user.role;
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        try {
            await api.put(`/users/${user._id}`, { password });
            setMessage("Password updated successfully!");
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordModal(false);
                setMessage('');
            }, 1500);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to update password");
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8 overflow-y-auto max-h-screen">
                <header className="mb-8 max-w-6xl mx-auto">
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">My Profile</h1>
                    <p className="text-gray-500 mt-2">Manage your account details and security settings.</p>
                </header>

                {/* Main Profile Card - Large & Centered */}
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-800"></div>
                    <div className="px-8 pb-8 relative">
                        <div className="absolute -top-16 left-8">
                            <div className="w-32 h-32 bg-white rounded-full p-1 shadow-lg">
                                <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-5xl font-bold">
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            </div>
                        </div>

                        <div className="pt-16 sm:pt-4 sm:pl-44 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 text-center sm:text-left">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900">{user.name}</h2>
                                <p className="text-lg text-gray-500 font-medium">@{user.username}</p>
                                <div className="mt-4 flex gap-3">
                                    <span className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold uppercase tracking-wide border border-blue-100 shadow-sm">
                                        {user.role}
                                    </span>
                                    {user.college && (
                                        <span className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
                                            {user.college}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Update Password Button */}
                            {!user.employeeId ? (
                                <button
                                    onClick={() => setShowPasswordModal(true)}
                                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Update Password
                                </button>
                            ) : (
                                <div className="text-right">
                                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                                        Linked Account
                                    </span>
                                </div>
                            )}
                        </div>

                        {user.employeeId && (
                            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex items-start gap-3">
                                <svg className="w-6 h-6 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-sm text-yellow-800 leading-relaxed">
                                    Your account is securely linked to your Employee Profile (ID: <span className="font-mono font-bold">{user.employeeId}</span>).
                                    To update your password, please contact the HR department or System Administrator to update your main Employee Database record.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Permissions & Scopes Card */}
                <div className="max-w-6xl mx-auto mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Access & Permissions Summary
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left: Scopes */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Permitted Colleges</h4>
                                {user.role === 'superadmin' ? (
                                    <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                                        All Colleges (Super Admin)
                                    </span>
                                ) : user.colleges && user.colleges.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.colleges.map((col, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200">
                                                {col}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-400 text-xs">No specific colleges assigned</span>
                                )}
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Permitted Courses</h4>
                                {user.role === 'superadmin' ? (
                                    <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                                        All Courses (Super Admin)
                                    </span>
                                ) : user.courses && user.courses.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.courses.map((course, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200">
                                                {course.includes('|') ? course.split('|')[1] : course}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-400 text-xs">No specific courses assigned (Full Access)</span>
                                )}
                            </div>
                        </div>

                        {/* Right: Modules */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Authorized Modules / Pages</h4>
                            {user.role === 'superadmin' || user.role === 'admin' ? (
                                <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-100 leading-relaxed font-semibold">
                                    Full Administrator Privilege – access to all features and modules is enabled.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        { name: 'Dashboard', path: '/dashboard' },
                                        { name: 'Students', path: '/students' },
                                        { name: 'Fee Collection', path: '/fee-collection' },
                                        { name: 'Concessions', path: '/overall-concessions' },
                                        { name: 'Concessions Approval', path: '/concessions' },
                                        { name: 'Bulk Fee Upload', path: '/bulk-fee-upload' },
                                        { name: 'Proceedings', path: '/proceedings' },
                                        { name: 'Reports & Analytics', path: '/reports' },
                                        { name: 'Due Reports', path: '/due-reports' },
                                        { name: 'Fee Configuration', path: '/fee-config' },
                                        { name: 'Payment Config', path: '/payment-config' },
                                        { name: 'Settings', path: '/settings' },
                                        { name: 'Reminder Config', path: '/reminders' },
                                        { name: 'Academic Calendar', path: '/academic-calendar' },
                                        { name: 'Transport Config', path: '/transport-config' },
                                        { name: 'Hostel Config', path: '/hostel-config' },
                                        { name: 'User Management', path: '/user-management' },
                                        { name: 'Permissions', path: '/permissions' }
                                    ].map((page, idx) => {
                                        const hasPermission = (user.permissions || []).includes(page.path);
                                        return (
                                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-semibold ${hasPermission ? 'bg-emerald-50/50 text-emerald-800 border-emerald-100' : 'bg-gray-50/50 text-gray-400 border-gray-100 opacity-60'}`}>
                                                {hasPermission ? (
                                                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                )}
                                                {page.name}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Password Change Modal */}
                {showPasswordModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 transform transition-all scale-100 relative">
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">Update Password</h2>
                                <p className="text-gray-500 text-sm mt-1">Ensure your account stays secure.</p>
                            </div>

                            {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-center text-sm font-bold border border-green-100 animate-fadeIn">{message}</div>}
                            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-center text-sm font-bold border border-red-100 animate-shake">{error}</div>}

                            <form onSubmit={handlePasswordChange} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="Min. 6 characters"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="Re-enter password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transform transition active:scale-95"
                                >
                                    Reset Password
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;
