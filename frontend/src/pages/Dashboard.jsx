import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import axios from 'axios';
import {
    Users,
    TrendingUp,
    Calendar,
    DollarSign,
    ArrowUpRight,
    Clock,
    Activity,
    Database,
    Shield
} from 'lucide-react';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (loggedInUser) {
            setUser(JSON.parse(loggedInUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/reports/dashboard-stats`);
                setStats(res.data);
            } catch (error) {
                console.error("Error fetching dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user]);

    if (!user) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    const kpis = [
        {
            label: "Today's Collection",
            value: `₹${stats?.collections?.today.toLocaleString() || 0}`, 
            icon: Calendar,
            color: "border-blue-500",
            iconColor: "text-blue-500"
        },
        {
            label: "Monthly Collection",
            value: `₹${stats?.collections?.monthly.toLocaleString() || 0}`,
            icon: TrendingUp,
            color: "border-emerald-500",
            iconColor: "text-emerald-500"
        },
        {
            label: "Total Collection",
            value: `₹${stats?.collections?.total.toLocaleString() || 0}`,
            icon: DollarSign,
            color: "border-indigo-500",
            iconColor: "text-indigo-500"
        },
        {
            label: "Active Students",
            value: stats?.totalStudents || 0,
            icon: Users,
            color: "border-amber-500",
            iconColor: "text-amber-500"
        }
    ];

    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {/* Header - More Compact */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-extrabold text-[#1E293B] tracking-tight">Admin Terminal</h1>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Real-time Operation Metrics</p>
                        </div>
                        <div className="text-[10px] font-black text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-widest flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                            Live Portal
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-20 bg-white rounded-xl border border-slate-200"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6 pb-10">
                            {/* KPI Grid - Compact Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {kpis.map((kpi, idx) => (
                                    <div key={idx} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${kpi.color} flex items-center gap-4 hover:shadow-md transition-shadow cursor-default`}>
                                        <div className={`${kpi.iconColor} bg-slate-50 p-2 rounded-lg border border-slate-100`}>
                                            <kpi.icon size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">{kpi.label}</p>
                                            <p className="text-lg font-black text-slate-800 tracking-tight leading-tight">{kpi.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Body Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Analytics Tables - Side by Side Column */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* College breakdown */}
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[280px]">
                                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Database size={12} className="text-indigo-500" />
                                                    College Intake
                                                </h3>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-[11px] text-left">
                                                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-50">
                                                        <tr className="text-slate-400">
                                                            <th className="px-4 py-2 font-bold uppercase tracking-tighter">College Name</th>
                                                            <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter">Collection</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {stats?.collegeWise?.map((c, i) => (
                                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                                <td className="px-4 py-2 text-slate-600 font-bold max-w-[150px] truncate group-hover:text-indigo-600 text-xs">{c.name}</td>
                                                                <td className="px-4 py-2 text-right font-black text-slate-800">₹{c.amount.toLocaleString()}</td>
                                                            </tr>
                                                        )) || <tr><td colSpan="2" className="p-4 text-center text-slate-400">No data available</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Course breakdown */}
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[280px]">
                                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Activity size={12} className="text-emerald-500" />
                                                    Course Breakdown
                                                </h3>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-[11px] text-left">
                                                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-50">
                                                        <tr className="text-slate-400">
                                                            <th className="px-4 py-2 font-bold uppercase tracking-tighter">Course</th>
                                                            <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter">Collection</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {stats?.courseWise?.map((c, i) => (
                                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                                <td className="px-4 py-2 text-slate-600 font-bold truncate max-w-[150px] group-hover:text-emerald-600 text-xs">{c.name}</td>
                                                                <td className="px-4 py-2 text-right font-black text-slate-800">₹{c.amount.toLocaleString()}</td>
                                                            </tr>
                                                        )) || <tr><td colSpan="2" className="p-4 text-center text-slate-400">No data available</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recent Activity Ledger - More Compact */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Clock size={12} className="text-amber-500" /> Recent Transactions
                                            </h3>
                                            <button onClick={() => navigate('/reports')} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1 group">
                                                View All <ArrowUpRight size={10} strokeWidth={3} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto h-[250px] overflow-y-auto">
                                            <table className="w-full text-left text-[11px]">
                                                <thead className="sticky top-0 bg-white z-10">
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter">Student Name</th>
                                                        <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter">Payment Mode</th>
                                                        <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {stats?.recentTransactions?.map((tx, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                            <td className="px-4 py-2">
                                                                <div className="font-extrabold text-slate-700 text-xs">{tx.studentName}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold truncate max-w-[150px] uppercase tracking-tighter mt-0.5">{tx.feeHead?.name || 'Academic Fee'}</div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${tx.paymentMode === 'Cash' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                                    {tx.paymentMode}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-black text-slate-900 text-xs">₹{tx.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Operator & Insights Column */}
                                <div className="space-y-6">
                                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Active Operator</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xl border-2 border-slate-100 shadow-inner">
                                                {user?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800 leading-tight">{user?.name}</p>
                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.1em] bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">{user?.role} Access</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-50">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shield size={10} className="text-emerald-500" /> System Integrity</span>
                                                <span className="font-black text-emerald-500 uppercase tracking-widest">Optimal</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={10} className="text-blue-500" /> Active Roster</span>
                                                <span className="font-black text-slate-800 tracking-tighter">{stats?.totalStudents} students</span>
                                            </div>
                                        </div>
                                    </div>


                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
