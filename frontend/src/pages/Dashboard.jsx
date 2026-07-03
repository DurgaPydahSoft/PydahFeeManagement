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
    Shield,
    CreditCard,
    UserCheck,
    Briefcase,
    LayoutDashboard
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#3b82f6', // Blue
    '#ef4444'  // Red
];

// Custom tooltip for Amount-based charts
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 backdrop-blur-md text-xs font-bold">
                <p className="text-slate-300 mb-0.5">{label}</p>
                <p className="text-indigo-400 font-extrabold text-sm">₹{payload[0].value.toLocaleString()}</p>
            </div>
        );
    }
    return null;
};

// Custom tooltip for Pie charts (showing percentage)
const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const { name, value, percent } = payload[0].payload;
        return (
            <div className="bg-slate-900/90 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 backdrop-blur-md text-xs font-bold">
                <p className="text-slate-300 mb-0.5">{name}</p>
                <p className="text-indigo-400 font-extrabold text-sm">₹{value.toLocaleString()}</p>
                <p className="text-emerald-400 text-[10px] font-bold mt-0.5">
                    ({(percent * 100).toFixed(1)}% of total)
                </p>
            </div>
        );
    }
    return null;
};

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Set default range to today only by default
    const [startDate, setStartDate] = useState(() => {
        const local = new Date();
        const offset = local.getTimezoneOffset();
        const localDate = new Date(local.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const local = new Date();
        const offset = local.getTimezoneOffset();
        const localDate = new Date(local.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
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

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    const kpis = [
        {
            label: "Overall Collection",
            value: `₹${(stats?.collections?.total || 0).toLocaleString()}`,
            icon: DollarSign,
            bgClass: "bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500 hover:shadow-indigo-500/20 text-white",
            iconBg: "bg-indigo-500/30 text-white border border-indigo-400/40",
            labelClass: "text-indigo-100/90",
            valClass: "text-white font-black"
        },
        {
            label: "Cash Collection",
            value: `₹${(stats?.collections?.cash || 0).toLocaleString()}`,
            icon: Calendar,
            bgClass: "bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 hover:shadow-emerald-500/20 text-white",
            iconBg: "bg-emerald-500/30 text-white border border-emerald-400/40",
            labelClass: "text-emerald-100/90",
            valClass: "text-white font-black"
        },
        {
            label: "Online Collection",
            value: `₹${(stats?.collections?.online || 0).toLocaleString()}`,
            icon: TrendingUp,
            bgClass: "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 hover:shadow-blue-500/20 text-white",
            iconBg: "bg-blue-500/30 text-white border border-blue-400/40",
            labelClass: "text-blue-100/90",
            valClass: "text-white font-black"
        },
        {
            label: "Active Students",
            value: (stats?.totalStudents || 0).toLocaleString(),
            icon: Users,
            bgClass: "bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400 hover:shadow-amber-500/20 text-white",
            iconBg: "bg-amber-400/30 text-white border border-amber-300/40",
            labelClass: "text-amber-100/90",
            valClass: "text-white font-black"
        }
    ];

    // Format collection trend data
    const trendChartData = stats?.trendData?.map(item => ({
        date: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Amount: item.amount
    })) || [];

    // Format college-wise data
    const collegeChartData = stats?.collegeWise?.map(item => ({
        name: item.name || 'Unknown',
        Amount: item.amount
    })) || [];

    // Format course-wise data
    const courseChartData = stats?.courseWise?.map(item => ({
        name: item.name || 'Unknown',
        value: item.amount
    })) || [];

    // Format fee head-wise data
    const feeHeadChartData = stats?.feeHeadWise?.map(item => ({
        name: item.name || 'Unknown',
        Amount: item.amount
    })) || [];

    // Format user-wise data
    const userChartData = stats?.userWise?.map(item => ({
        name: item.name || item.username || 'Unknown',
        Amount: item.amount
    })) || [];

    const cashCollected = stats?.collections?.cash || 0;
    const onlineCollected = stats?.collections?.online || 0;
    const totalCollected = cashCollected + onlineCollected;
    const cashPercentage = totalCollected > 0 ? Math.round((cashCollected / totalCollected) * 100) : 0;
    const onlinePercentage = totalCollected > 0 ? Math.round((onlineCollected / totalCollected) * 100) : 0;

    const renderEmptyState = (message = "No data recorded for selected period") => (
        <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-slate-400 border border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50">
            <Activity size={28} className="stroke-[1.5] text-slate-300 animate-pulse mb-2" />
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{message}</span>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                                <LayoutDashboard size={20} className="stroke-[2.5]" />
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Admin Dashboard</h1>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-1">Real-time Financial Analytics</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                            {/* Current Date Display */}
                            <div className="text-[11px] font-bold text-slate-500 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-2">
                                <Calendar size={14} className="text-indigo-500" />
                                <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>

                            {/* Date Range Picker */}
                            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">From:</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none p-0 text-xs font-extrabold text-slate-700 focus:ring-0 cursor-pointer w-28"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <span className="text-slate-300 mx-1 font-bold">to</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">To:</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none p-0 text-xs font-extrabold text-slate-700 focus:ring-0 cursor-pointer w-28"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 shadow-sm"></div>
                                ))}
                            </div>
                            <div className="h-80 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="h-72 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse"></div>
                                <div className="h-72 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-12">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {kpis.map((kpi, idx) => (
                                    <div key={idx} className={`p-5 rounded-2xl border ${kpi.bgClass} flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default`}>
                                        <div className={`p-3 rounded-xl border ${kpi.iconBg}`}>
                                            <kpi.icon size={20} className="stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-extrabold uppercase tracking-wider ${kpi.labelClass}`}>{kpi.label}</p>
                                            <p className={`text-xl font-black tracking-tight leading-tight mt-0.5 ${kpi.valClass}`}>{kpi.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Collection Trend (Full Width) */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={16} className="text-indigo-500 stroke-[2.5]" />
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                            Collection Trend
                                        </h3>
                                    </div>
                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                        Daily Intake
                                    </span>
                                </div>
                                <div className="w-full h-[280px]">
                                    {trendChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                                    tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000) + 'k' : v}`}
                                                />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="Amount" 
                                                    stroke="#6366f1" 
                                                    strokeWidth={3}
                                                    fillOpacity={1} 
                                                    fill="url(#colorTrend)" 
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : renderEmptyState("No collections within this period")}
                                </div>
                            </div>

                            {/* Core Breakdowns Grid (2x2) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* College-wise Intake */}
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Database size={16} className="text-indigo-500 stroke-[2.5]" />
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                College-wise Collection
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="w-full h-[260px]">
                                        {collegeChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={collegeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                                        tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000) + 'L' : v >= 1000 ? (v / 1000) + 'k' : v}`}
                                                    />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar 
                                                        dataKey="Amount" 
                                                        fill="#4f46e5" 
                                                        radius={[6, 6, 0, 0]}
                                                        maxBarSize={45}
                                                    >
                                                        {collegeChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : renderEmptyState("No college transactions available")}
                                    </div>
                                </div>

                                {/* Course Breakdown (Pie / Doughnut Chart) */}
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-emerald-500 stroke-[2.5]" />
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                Course Distribution
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="w-full h-[260px] flex items-center justify-center">
                                        {courseChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={courseChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={85}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {courseChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<CustomPieTooltip />} />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        height={36} 
                                                        iconType="circle"
                                                        iconSize={8}
                                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }} 
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : renderEmptyState("No course breakdown data")}
                                    </div>
                                </div>

                                {/* Fee Head-wise Collections */}
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <CreditCard size={16} className="text-indigo-500 stroke-[2.5]" />
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                Fee Head-wise Collection
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="w-full h-[260px]">
                                        {feeHeadChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    layout="vertical"
                                                    data={feeHeadChartData} 
                                                    margin={{ top: 10, right: 10, left: 30, bottom: 0 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        type="number"
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                                                        tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000) + 'L' : v >= 1000 ? (v / 1000) + 'k' : v}`}
                                                    />
                                                    <YAxis 
                                                        type="category"
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                                                        width={90}
                                                    />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar 
                                                        dataKey="Amount" 
                                                        fill="#6366f1" 
                                                        radius={[0, 6, 6, 0]}
                                                        maxBarSize={20}
                                                    >
                                                        {feeHeadChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : renderEmptyState("No fee head allocations recorded")}
                                    </div>
                                </div>

                                {/* User / Cashier collections */}
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <UserCheck size={16} className="text-indigo-500 stroke-[2.5]" />
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                User-wise Collection
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="w-full h-[260px]">
                                        {userChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={userChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                                        tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000) + 'L' : v >= 1000 ? (v / 1000) + 'k' : v}`}
                                                    />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar 
                                                        dataKey="Amount" 
                                                        fill="#f59e0b" 
                                                        radius={[6, 6, 0, 0]}
                                                        maxBarSize={45}
                                                    >
                                                        {userChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : renderEmptyState("No user transaction records")}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row - Payment Mode Split & Recent Activity */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Cash vs Online Split Widget */}
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-[300px]">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                            Payment Mode Split
                                        </h3>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                            Cash vs UPI/Online
                                        </span>
                                    </div>

                                    {totalCollected > 0 ? (
                                        <>
                                            <div className="flex-1 flex items-center justify-center relative my-4">
                                                {/* Mini radial breakdown using custom circle gauge */}
                                                <div className="relative w-36 h-36 flex items-center justify-center">
                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                        {/* Cash circle */}
                                                        <circle
                                                            cx="18"
                                                            cy="18"
                                                            r="15.915"
                                                            fill="transparent"
                                                            stroke="#f1f5f9"
                                                            strokeWidth="3.2"
                                                        />
                                                        <circle
                                                            cx="18"
                                                            cy="18"
                                                            r="15.915"
                                                            fill="transparent"
                                                            stroke="#10b981"
                                                            strokeWidth="3.2"
                                                            strokeDasharray={`${cashPercentage} ${100 - cashPercentage}`}
                                                            strokeDashoffset="0"
                                                        />
                                                        {/* Online circle */}
                                                        <circle
                                                            cx="18"
                                                            cy="18"
                                                            r="12.5"
                                                            fill="transparent"
                                                            stroke="#f1f5f9"
                                                            strokeWidth="2.8"
                                                        />
                                                        <circle
                                                            cx="18"
                                                            cy="18"
                                                            r="12.5"
                                                            fill="transparent"
                                                            stroke="#3b82f6"
                                                            strokeWidth="2.8"
                                                            strokeDasharray={`${onlinePercentage} ${100 - onlinePercentage}`}
                                                            strokeDashoffset="0"
                                                        />
                                                    </svg>
                                                    <div className="absolute flex flex-col items-center justify-center text-center">
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wide">Ratio</span>
                                                        <span className="text-lg font-black text-slate-800">{cashPercentage}:{onlinePercentage}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-center border-t border-slate-50 pt-3">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                        <span className="text-xs font-bold text-slate-700">Cash</span>
                                                    </div>
                                                    <span className="text-xs font-black text-emerald-600 mt-1">₹{cashCollected.toLocaleString()}</span>
                                                    <span className="text-[9px] font-black text-slate-400 mt-0.5">{cashPercentage}%</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                                        <span className="text-xs font-bold text-slate-700">Online</span>
                                                    </div>
                                                    <span className="text-xs font-black text-blue-600 mt-1">₹{onlineCollected.toLocaleString()}</span>
                                                    <span className="text-[9px] font-black text-slate-400 mt-0.5">{onlinePercentage}%</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            {renderEmptyState("No mode distributions")}
                                        </div>
                                    )}
                                </div>

                                {/* Recent Activity Ledger */}
                                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[300px]">
                                    <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-200/60 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={14} className="text-amber-500 stroke-[2.5]" /> Recent Transactions
                                        </h3>
                                        <button 
                                            onClick={() => navigate('/reports')} 
                                            className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 group transition-colors"
                                        >
                                            View Reports Ledger 
                                            <ArrowUpRight size={12} strokeWidth={3} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                                    <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-400 font-bold">
                                                        <th className="px-5 py-3 font-extrabold uppercase tracking-wider text-[10px]">Student Details</th>
                                                        <th className="px-5 py-3 font-extrabold uppercase tracking-wider text-[10px]">Payment Mode</th>
                                                        <th className="px-5 py-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {stats.recentTransactions.map((tx, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                            <td className="px-5 py-3">
                                                                <div className="font-extrabold text-slate-700">{tx.studentName}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-tight uppercase">
                                                                    {tx.feeHead?.name || 'Academic Fee'}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${tx.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                                    {tx.paymentMode}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3 text-right font-black text-slate-800 text-sm">₹{tx.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="h-full flex items-center justify-center p-6">
                                                {renderEmptyState("No recent ledger activity")}
                                            </div>
                                        )}
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
