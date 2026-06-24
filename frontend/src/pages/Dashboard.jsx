import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { getStoredUser, isAuthenticated } from '../lib/auth';
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
    const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated()) {
            setUser(getStoredUser());
        } else {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/reports/dashboard-stats`, {
                    params: { startDate, endDate }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Error fetching dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user, startDate, endDate]);

    if (!user) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    const kpis = [
        {
            label: "Overall Collection",
            value: `₹${(stats?.collections?.total || 0).toLocaleString()}`,
            icon: DollarSign,
            bgClass: "bg-blue-600 border-blue-600 hover:shadow-blue-500/30 text-white",
            iconBg: "bg-blue-700/60 text-white border border-blue-500",
            labelClass: "text-white/80",
            valClass: "text-white font-extrabold"
        },
        {
            label: "Cash Collection",
            value: `₹${(stats?.collections?.cash || 0).toLocaleString()}`,
            icon: Calendar,
            bgClass: "bg-emerald-600 border-emerald-600 hover:shadow-emerald-500/30 text-white",
            iconBg: "bg-emerald-700/60 text-white border border-emerald-500",
            labelClass: "text-white/80",
            valClass: "text-white font-extrabold"
        },
        {
            label: "Online Collection",
            value: `₹${(stats?.collections?.online || 0).toLocaleString()}`,
            icon: TrendingUp,
            bgClass: "bg-indigo-600 border-indigo-600 hover:shadow-indigo-500/30 text-white",
            iconBg: "bg-indigo-700/60 text-white border border-indigo-500",
            labelClass: "text-white/80",
            valClass: "text-white font-extrabold"
        },
        {
            label: "Active Students",
            value: stats?.totalStudents || 0,
            icon: Users,
            bgClass: "bg-amber-500 border-amber-500 hover:shadow-amber-500/30 text-white",
            iconBg: "bg-amber-600/60 text-white border border-amber-400",
            labelClass: "text-white/80",
            valClass: "text-white font-extrabold"
        }
    ];

    const cashCollected = stats?.collections?.cash || 0;
    const onlineCollected = stats?.collections?.online || 0;
    const totalCollected = cashCollected + onlineCollected;
    const cashPercentage = totalCollected > 0 ? Math.round((cashCollected / totalCollected) * 100) : 0;
    const onlinePercentage = totalCollected > 0 ? Math.round((onlineCollected / totalCollected) * 100) : 0;
    const maxVal = Math.max(cashCollected, onlineCollected);
    const cashHeight = maxVal > 0 ? (cashCollected / maxVal) * 80 : 0;
    const onlineHeight = maxVal > 0 ? (onlineCollected / maxVal) * 80 : 0;

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {/* Header - More Compact */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Admin Dashboard</h1>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Real-time Operation Metrics</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                            {/* Current Date Display */}
                            <div className="text-[11px] font-bold text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                                <Calendar size={14} className="text-blue-600" />
                                <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>

                            {/* Date Range Picker */}
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">From:</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none p-0 text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer w-28"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <span className="text-slate-300 mx-1">to</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">To:</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none p-0 text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer w-28"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
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
                                    <div key={idx} className={`p-4 rounded-xl border ${kpi.bgClass} flex items-center gap-4 hover:shadow-md transition-shadow cursor-default`}>
                                        <div className={`p-2 rounded-lg border ${kpi.iconBg}`}>
                                            <kpi.icon size={18} />
                                        </div>
                                        <div>
                                            <p className={`text-[9px] font-bold uppercase tracking-[0.1em] ${kpi.labelClass}`}>{kpi.label}</p>
                                            <p className={`text-lg font-black tracking-tight leading-tight ${kpi.valClass}`}>{kpi.value}</p>
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
                                                                <td className="px-4 py-2 text-right font-black text-slate-800">{c.amount.toLocaleString()}</td>
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
                                                                <td className="px-4 py-2 text-right font-black text-slate-800">{c.amount.toLocaleString()}</td>
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
                                                            <td className="px-4 py-2 text-right font-black text-slate-900 text-xs">{tx.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Operator & Insights Column */}
                                <div className="space-y-6">
                                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col h-[280px]">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Collection Analysis
                                            </h3>
                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.1em] bg-indigo-50 px-2 py-0.5 rounded-full">
                                                Cash vs Online
                                            </span>
                                        </div>

                                        {/* Chart Area */}
                                        <div className="flex-1 flex items-end justify-around gap-6 relative px-4 pb-2 pt-6 border-b border-slate-100">
                                            {/* Grid Lines */}
                                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2 pt-6">
                                                <div className="w-full border-t border-slate-100/70"></div>
                                                <div className="w-full border-t border-slate-100/70"></div>
                                                <div className="w-full border-t border-slate-100/70"></div>
                                                <div className="w-full border-t border-slate-100/70 text-right"></div>
                                            </div>

                                            {/* Cash Bar */}
                                            <div className="flex flex-col items-center group w-16 z-10 h-full justify-end">
                                                <span className="text-[10px] font-black text-slate-700 mb-2 opacity-100 transition-opacity">
                                                    {cashPercentage}%
                                                </span>
                                                <div 
                                                    style={{ height: `${Math.max(cashHeight, 2)}%` }}
                                                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg shadow-sm transition-all duration-500 ease-out group-hover:brightness-105"
                                                    title={`Cash: ₹${cashCollected.toLocaleString()}`}
                                                ></div>
                                            </div>

                                            {/* Online Bar */}
                                            <div className="flex flex-col items-center group w-16 z-10 h-full justify-end">
                                                <span className="text-[10px] font-black text-slate-700 mb-2 opacity-100 transition-opacity">
                                                    {onlinePercentage}%
                                                </span>
                                                <div 
                                                    style={{ height: `${Math.max(onlineHeight, 2)}%` }}
                                                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg shadow-sm transition-all duration-500 ease-out group-hover:brightness-105"
                                                    title={`Online: ₹${onlineCollected.toLocaleString()}`}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* X-Axis labels & info */}
                                        <div className="flex justify-around text-center mt-2">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    <span className="text-xs font-bold text-slate-800">Cash</span>
                                                </div>
                                                <span className="text-[11px] font-black text-emerald-600 mt-0.5">₹{cashCollected.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                    <span className="text-xs font-bold text-slate-800">Online</span>
                                                </div>
                                                <span className="text-[11px] font-black text-indigo-600 mt-0.5">₹{onlineCollected.toLocaleString()}</span>
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
