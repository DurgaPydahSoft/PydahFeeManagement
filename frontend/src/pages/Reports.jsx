import React from 'react';
import Sidebar from './Sidebar';

const Reports = () => {
    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
                    <p className="text-sm text-gray-500 mt-1">Analytics and Financial Statements.</p>
                </header>

                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Reports Dashboard Coming Soon</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        This module will include Daily Collection Reports, Due Lists, Fee Head-wise Collections, and Reconciliation Statements.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Reports;
