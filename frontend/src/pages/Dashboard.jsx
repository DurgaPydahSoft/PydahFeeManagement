
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);



    if (!user) return <div>Loading...</div>;

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            {/* Sidebar Integration */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
                </header>

                <main className="flex-1 p-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome Back</h2>
                        <p className="text-gray-500 mb-6">Role: <span className="uppercase tracking-wide text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{user.role}</span></p>

                        <div className="bg-gray-50 rounded-lg p-8 border-2 border-dashed border-gray-200 text-center">
                            <p className="text-gray-500">
                                Select an option from the sidebar to manage fees.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;

