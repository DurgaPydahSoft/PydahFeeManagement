import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
    // Placeholder menu items based on the project requirements
    const menuItems = [
        { name: 'Dashboard', path: '/dashboard' },
        // Future items:
        // { name: 'Fee Configuration', path: '/fee-config' },
        // { name: 'Student Management', path: '/students' },
        // { name: 'Fee Collection', path: '/fee-collection' },
        // { name: 'Reports', path: '/reports' },
    ];

    return (
        <div className="bg-gray-800 text-white w-64 min-h-screen flex flex-col transition-all duration-300">
            <div className="h-16 flex items-center justify-center border-b border-gray-700">
                <h2 className="text-xl font-bold tracking-wider">Fee Manager</h2>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1">
                    {menuItems.map((item) => (
                        <li key={item.name}>
                            <Link 
                                to={item.path} 
                                className="block px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200"
                            >
                                {item.name}
                            </Link>
                        </li>
                    ))}
                    <li className="px-6 py-3 text-gray-500 text-sm italic">
                        More items coming soon...
                    </li>
                </ul>
            </nav>
            <div className="p-4 border-t border-gray-700">
                <div className="text-xs text-gray-400 text-center">
                    &copy; 2024 School Sys
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
