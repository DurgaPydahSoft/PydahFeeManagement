import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getStoredUser } from '../lib/auth';

const Sidebar = () => {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });

    const toggleCollapsed = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    };

    const expandSidebar = () => {
        setIsCollapsed(false);
        localStorage.setItem('sidebar-collapsed', 'false');
    };

    const navRef = React.useRef();

    React.useEffect(() => {
        const storedScroll = sessionStorage.getItem('sidebar-scroll');
        if (storedScroll && navRef.current) {
            navRef.current.scrollTop = Number(storedScroll);
        }
    }, []);

    const handleScroll = (e) => {
        sessionStorage.setItem('sidebar-scroll', e.target.scrollTop);
    };

    const icons = {
        Dashboard: <svg className="w-5 h-5 icon-dashboard transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        Config: <svg className="w-5 h-5 icon-config transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        Students: <svg className="w-5 h-5 icon-students transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        Collection: <svg className="w-5 h-5 icon-collection transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        Reports: <svg className="w-5 h-5 icon-reports transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
        DueReports: <svg className="w-5 h-5 icon-duereports transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        Users: <svg className="w-5 h-5 icon-users transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        PaymentConfig: <svg className="w-5 h-5 icon-paymentconfig transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        Reminders: <svg className="w-5 h-5 icon-reminders transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
        BulkUpload: <svg className="w-5 h-5 icon-bulkupload transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
        Concession: <svg className="w-5 h-5 icon-concession transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l4.317-4.317a1.5 1.5 0 000-2.122L11.159 3.659A1.5 1.5 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>,
        ConcessionApproval: <svg className="w-5 h-5 icon-concessionapproval transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        Calendar: <svg className="w-5 h-5 icon-calendar transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    };

    const user = getStoredUser() || {};
    const role = user.role;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    // Define all available menu items grouped by section
    const allMenuItems = [
        // Overview
        { section: 'Overview', name: 'Dashboard', path: '/dashboard', icon: icons.Dashboard },
        { section: 'Overview', name: 'Students', path: '/students', icon: icons.Students },

        // Fee Operations
        { section: 'Fee Operations', name: 'Fee Collection', path: '/fee-collection', icon: icons.Collection },
        { section: 'Fee Operations', name: 'Concessions (Declaration)', path: '/overall-concessions', icon: icons.Concession },
        { section: 'Fee Operations', name: 'Concessions (Application)', path: '/concessions', icon: icons.ConcessionApproval },
        { section: 'Fee Operations', name: 'Bulk Fee Upload', path: '/bulk-fee-upload', icon: icons.BulkUpload },
        { section: 'Fee Operations', name: 'Proceedings', path: '/proceedings', icon: <svg className="w-5 h-5 icon-proceedings transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l5 5v9a2 2 0 01-2 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v5h5" /></svg> },

        // Reports
        { section: 'Reports', name: 'Reports & Analytics', path: '/reports', icon: icons.Reports },
        { section: 'Reports', name: 'Due Reports', path: '/due-reports', icon: icons.DueReports },

        // Configuration
        { section: 'Configuration', name: 'Fee Configuration', path: '/fee-config', icon: icons.Config },
        { section: 'Configuration', name: 'Payment Config', path: '/payment-config', icon: icons.PaymentConfig },
        { section: 'Configuration', name: 'Settings', path: '/settings', icon: <svg className="w-5 h-5 icon-settings transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        { section: 'Configuration', name: 'Reminder Config', path: '/reminders', icon: icons.Reminders },
        { section: 'Configuration', name: 'Academic Calendar', path: '/academic-calendar', icon: icons.Calendar },

        // Administration
        { section: 'Administration', name: 'User Management', path: '/user-management', icon: icons.Users },
        { section: 'Administration', name: 'Permissions', path: '/permissions', icon: <svg className="w-5 h-5 icon-permissions transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
        { section: 'Administration', name: 'User Profile', path: '/user-profile', icon: <svg className="w-5 h-5 icon-userprofile transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    ];

    // Filter Logic:
    // 1. Super Admin sees everything.
    // 2. Others see only what's in their permissions array.
    const visibleMenuItems = role === 'superadmin' || role === 'admin'
        ? allMenuItems
        : allMenuItems.filter(item =>
            permissions.includes(item.path) ||
            item.path === '/user-profile'
        );

    // Group items by section (must pass {} — without it, reduce uses the first menu item as acc)
    const groupedItems = visibleMenuItems.reduce((acc, item) => {
        const section = item?.section || 'Other';
        if (!Array.isArray(acc[section])) acc[section] = [];
        acc[section].push(item);
        return acc;
    }, {});

    return (
        <div className={`bg-white border-r border-gray-200 h-screen max-h-screen sticky top-0 flex flex-col shadow-sm transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`p-4 border-b border-gray-200 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                <div
                    className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full cursor-pointer' : 'justify-center flex-1'}`}
                    onClick={() => isCollapsed && expandSidebar()}
                    title={isCollapsed ? "Click to Expand" : ""}
                >
                    <div className={`${isCollapsed ? 'w-12 h-12 rounded-xl' : 'w-48 h-14 rounded-2xl'} flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 bg-white border border-gray-100`}>
                        <img src="/PYDAH_LOGO_PHOTO.jpg" alt="Logo" className="w-full h-full object-contain p-1" />
                    </div>
                </div>

                {!isCollapsed && (
                    <button
                        onClick={toggleCollapsed}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-black hover:text-black transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                )}
            </div>
            
            <nav ref={navRef} onScroll={handleScroll} className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
                {Object.entries(groupedItems).map(([section, items], sGroupIdx) => (
                    <div key={section} className="space-y-1">
                        {!isCollapsed && section !== 'Overview' && (
                            <div className="mb-2 text-center">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 pt-2">
                                    {section}
                                </div>
                                <div className="border-b-2 border-gray-300 mt-1 mx-3"></div>
                            </div>
                        )}
                        {isCollapsed && sGroupIdx > 0 && (
                            <div className="h-0 border-b border-gray-100 my-2 mx-4"></div>
                        )}
                        <div className="space-y-1">
                            {(Array.isArray(items) ? items : []).map((item, index) => (
                                <Link
                                    key={index}
                                    to={item.path}
                                    className={`sidebar-link flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 ${location.pathname === item.path
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-black hover:bg-gray-50 hover:text-black'
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                    title={isCollapsed ? item.name : ''}
                                >
                                    <span className={`text-xl shrink-0 ${location.pathname === item.path ? 'text-blue-600' : 'text-black'}`}>{item.icon}</span>
                                    {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.name}</span>}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200 shrink-0">
                <div className={`flex items-center ${isCollapsed ? 'flex-col justify-center gap-4' : 'justify-between'}`}>

                    {/* User Info */}
                    <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold text-black leading-tight break-words">{user.name || 'User'}</p>
                                <p className="text-[10px] text-black capitalize leading-tight break-words mt-1">
                                    {role === 'superadmin' 
                                        ? 'Super Admin' 
                                        : (user.colleges && user.colleges.length > 1 
                                            ? `${user.college} (+${user.colleges.length - 1})` 
                                            : (user.college || role)
                                          )
                                    }
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={() => {
                            Swal.fire({
                                title: 'Logout?',
                                text: "You will be returned to the login screen.",
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#3085d6',
                                confirmButtonText: 'Yes, logout!'
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    const isSSO = localStorage.getItem('isSSO') === 'true';
                                    localStorage.removeItem('user');
                                    localStorage.removeItem('token');
                                    localStorage.removeItem('isSSO');

                                    if (isSSO) {
                                        window.location.href = import.meta.env.VITE_CRM_FRONTEND_URL || 'http://localhost:5173';
                                    } else {
                                        window.location.href = '/';
                                    }
                                }
                            })
                        }}
                        className={`text-black hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 ${isCollapsed ? '' : ''}`}
                        title="Logout"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>
            {/* Sidebar Micro-Animations */}
            <style>{`
                .sidebar-link:hover .icon-dashboard {
                    animation: dashboard-pulse 1s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-config,
                .sidebar-link:hover .icon-settings {
                    animation: cog-spin 2.5s infinite linear;
                }
                .sidebar-link:hover .icon-students,
                .sidebar-link:hover .icon-users,
                .sidebar-link:hover .icon-userprofile {
                    transform: scale(1.2);
                }
                .sidebar-link:hover .icon-collection {
                    animation: money-bounce 0.8s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-reports,
                .sidebar-link:hover .icon-duereports {
                    transform: translateY(-3px) scale(1.1);
                }
                .sidebar-link:hover .icon-reminders {
                    animation: bell-ring 0.6s ease-in-out;
                    transform-origin: top center;
                }
                .sidebar-link:hover .icon-bulkupload {
                    animation: upload-bounce 1s infinite ease-in-out;
                }
                .sidebar-link:hover .icon-concession,
                .sidebar-link:hover .icon-concessionapproval {
                    animation: tag-swing 0.8s ease-in-out;
                }
                .sidebar-link:hover .icon-calendar {
                    animation: calendar-pulse 0.8s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-permissions {
                    transform: rotate(15deg) scale(1.15);
                }
                .sidebar-link:hover .icon-proceedings {
                    transform: translateX(2px) scale(1.1);
                }

                @keyframes cog-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes dashboard-pulse {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
                @keyframes money-bounce {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-3px) rotate(5deg); }
                }
                @keyframes bell-ring {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(15deg); }
                    40% { transform: rotate(-15deg); }
                    60% { transform: rotate(10deg); }
                    80% { transform: rotate(-10deg); }
                }
                @keyframes upload-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes tag-swing {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(-15deg); }
                }
                @keyframes calendar-pulse {
                    0% { transform: scale(1) translateY(0); }
                    100% { transform: scale(1.1) translateY(-2px); }
                }
            `}</style>
        </div>
    );
};

export default Sidebar;
