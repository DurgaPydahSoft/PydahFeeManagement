import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const icons = {
        Dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        Config: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        Students: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        Collection: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        Reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        Users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        Transport: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> // Bus icon placeholder
    };

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const role = user.role;
    const permissions = user.permissions || [];

    // Define all available menu items
    const allMenuItems = [
        { name: 'Dashboard', path: '/dashboard', icon: icons.Dashboard },
        { name: 'Fee Configuration', path: '/fee-config', icon: icons.Config },
        { name: 'Students', path: '/students', icon: icons.Students },
        { name: 'Fee Collection', path: '/fee-collection', icon: icons.Collection },
        { name: 'Reports', path: '/reports', icon: icons.Reports },
        { name: 'Transport Config', path: '/transport-config', icon: icons.Transport },
        { name: 'User Management', path: '/user-management', icon: icons.Users },
    ];

    // Filter Logic:
    // 1. Super Admin sees everything.
    // 2. Others see only what's in their permissions array.
    const menuItems = role === 'superadmin'
        ? allMenuItems
        : allMenuItems.filter(item => permissions.includes(item.path));

    return (
        <div className={`bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col shadow-sm transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-56'}`}>
            <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                <div
                    className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full cursor-pointer' : ''}`}
                    onClick={() => isCollapsed && setIsCollapsed(false)}
                    title={isCollapsed ? "Click to Expand" : ""}
                >
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm transition-transform hover:scale-105">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    {!isCollapsed && <h2 className="text-lg font-bold text-gray-800 tracking-tight">Pydah Fees</h2>}
                </div>

                {!isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                )}
            </div>
            <nav className="flex-1 p-2 space-y-1">
                {menuItems.map((item, index) => (
                    <Link
                        key={index}
                        to={item.path}
                        className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${location.pathname === item.path
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            } ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? item.name : ''}
                    >
                        <span className="text-xl">{item.icon}</span>
                        {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.name}</span>}
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200 mt-auto">
                <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center gap-4' : 'justify-between'}`}>

                    {/* User Info */}
                    <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold shadow-md shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold text-gray-800 leading-tight break-words">{user.name || 'User'}</p>
                                <p className="text-[10px] text-gray-500 capitalize leading-tight break-words mt-1">{role === 'superadmin' ? 'Super Admin' : (user.college || role)}</p>
                            </div>
                        )}
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to logout?')) {
                                localStorage.removeItem('user');
                                window.location.href = '/login';
                            }
                        }}
                        className={`text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 ${isCollapsed ? '' : ''}`}
                        title="Logout"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
