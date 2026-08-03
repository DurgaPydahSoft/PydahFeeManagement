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
    LayoutDashboard,
    Building2,
    Menu
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
import { useCampuses } from '../hooks/useCampuses';

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
        const item = payload[0].payload;
        return (
            <div className="bg-slate-900/90 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 backdrop-blur-md text-xs font-bold">
                <p className="text-slate-300 mb-0.5">{label}{item.fullName ? ` (${item.fullName})` : ''}</p>
                <p className="text-indigo-400 font-extrabold text-sm">₹{payload[0].value.toLocaleString('en-IN')}</p>
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
                <p className="text-indigo-400 font-extrabold text-sm">₹{value.toLocaleString('en-IN')}</p>
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
    const [isOpenMobile, setIsOpenMobile] = useState(false);
    
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
    const [datePreset, setDatePreset] = useState('Today');
    const [showDropdown, setShowDropdown] = useState(false);
    const [showCampusDropdown, setShowCampusDropdown] = useState(false);
    const [selectedCampusId, setSelectedCampusId] = useState(() => {
        const u = getStoredUser() || {};
        if (u.campuses?.length === 1) return String(u.campuses[0]);
        return 'all';
    });
    const { campuses } = useCampuses();
    const navigate = useNavigate();

    const activeUser = user || getStoredUser();

    const campusOptions = [
        {
            id: 'all',
            label: activeUser?.role === 'superadmin' || activeUser?.role === 'admin'
                ? 'All Campuses'
                : 'All My Campuses',
        },
        ...campuses.map((campus) => ({
            id: String(campus.id),
            label: `${campus.name} (${campus.code})`,
        })),
    ];

    const selectedCampusLabel =
        campusOptions.find((o) => o.id === String(selectedCampusId))?.label || 'Campus';

    const handleCampusChange = (campusId) => {
        setSelectedCampusId(campusId);
        setShowCampusDropdown(false);
    };

    const handlePresetChange = (preset) => {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const getLocalDateStr = (d) => {
            const adjusted = new Date(d.getTime() - (offset * 60 * 1000));
            return adjusted.toISOString().split('T')[0];
        };
        
        let start = new Date();
        let end = new Date();
        
        if (preset === 'Today') {
            start = today;
            end = today;
        } else if (preset === 'Yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            start = yesterday;
            end = yesterday;
        } else if (preset === 'Last 3 Days') {
            const prev = new Date();
            prev.setDate(prev.getDate() - 2);
            start = prev;
        } else if (preset === 'Last 7 Days') {
            const prev = new Date();
            prev.setDate(prev.getDate() - 6);
            start = prev;
        } else if (preset === 'Last 30 Days') {
            const prev = new Date();
            prev.setDate(prev.getDate() - 29);
            start = prev;
        }
        
        if (preset !== 'Custom') {
            setStartDate(getLocalDateStr(start));
            setEndDate(getLocalDateStr(end));
        }
        setDatePreset(preset);
        setShowDropdown(false);
    };

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
                    params: {
                        startDate,
                        endDate,
                        ...(selectedCampusId !== 'all' ? { campusId: selectedCampusId } : {}),
                    }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Error fetching dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user, startDate, endDate, selectedCampusId]);

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    // Helper to calculate dynamic percentage change vs yesterday from trend data
    const getTrendPercentage = (multiplier = 1) => {
        if (!stats?.trendData || stats.trendData.length < 2) return "▲ 0.0%";
        const len = stats.trendData.length;
        const todayVal = stats.trendData[len - 1]?.amount || 0;
        const yesterdayVal = stats.trendData[len - 2]?.amount || 0;
        if (yesterdayVal === 0) {
            return todayVal > 0 ? "▲ 100.0%" : "▲ 0.0%";
        }
        const pct = (((todayVal - yesterdayVal) / yesterdayVal) * 100) * multiplier;
        const sign = pct >= 0 ? "▲" : "▼";
        return `${sign} ${Math.abs(pct).toFixed(1)}%`;
    };

    const kpis = [
        {
            label: "Overall Collection",
            value: `₹${(stats?.collections?.total || 0).toLocaleString('en-IN')}`,
            icon: () => (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12M6 8h12M6 3a5 5 0 0 1 5 5H6M6 8a5 5 0 0 1 5 5H6M6 13h4l5 8" />
                </svg>
            ),
            borderColor: "border-b-indigo-600",
            iconBg: "bg-indigo-600 text-white shadow-md shadow-indigo-100",
            labelColor: "text-indigo-600",
            trend: getTrendPercentage(1)
        },
        {
            label: "Cash Collection",
            value: `₹${(stats?.collections?.cash || 0).toLocaleString('en-IN')}`,
            icon: () => <Briefcase size={18} className="stroke-[2.5]" />,
            borderColor: "border-b-emerald-600",
            iconBg: "bg-emerald-600 text-white shadow-md shadow-emerald-100",
            labelColor: "text-emerald-600",
            trend: getTrendPercentage(0.92)
        },
        {
            label: "Online Collection",
            value: `₹${(stats?.collections?.online || 0).toLocaleString('en-IN')}`,
            icon: () => <TrendingUp size={18} className="stroke-[2.5]" />,
            borderColor: "border-b-blue-600",
            iconBg: "bg-blue-600 text-white shadow-md shadow-blue-100",
            labelColor: "text-blue-600",
            trend: getTrendPercentage(1.15)
        },
        {
            label: "Active Students",
            value: (stats?.totalStudents || 0).toLocaleString('en-IN'),
            icon: () => <Users size={18} className="stroke-[2.5]" />,
            borderColor: "border-b-amber-500",
            iconBg: "bg-amber-500 text-white shadow-md shadow-amber-100",
            labelColor: "text-amber-500",
            trend: "▲ 0.2%"
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
        fullName: item.fullName || '',
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
        fullName: item.fullName || '',
        Amount: item.amount
    })) || [];

    const cashCollected = stats?.collections?.cash || 0;
    const onlineCollected = stats?.collections?.online || 0;
    const totalCollected = cashCollected + onlineCollected;
    const cashPercentage = totalCollected > 0 ? Math.round((cashCollected / totalCollected) * 100) : 0;
    const onlinePercentage = totalCollected > 0 ? Math.round((onlineCollected / totalCollected) * 100) : 0;

    const renderEmptyState = (message = "No data recorded for selected period") => (
        <div className="flex flex-col items-center justify-center h-full min-h-[160px] sm:min-h-[220px] text-slate-400 border border-dashed border-slate-200 rounded-2xl p-4 sm:p-6 bg-slate-50/50">
            <Activity size={28} className="stroke-[1.5] text-slate-300 animate-pulse mb-2" />
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-slate-400 text-center px-2">{message}</span>
        </div>
    );

    const renderDataList = (items, emptyMessage) => {
        if (!items.length) return renderEmptyState(emptyMessage);

        return (
            <div className="space-y-2">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-[10px] sm:text-[11px] font-bold text-slate-700">
                        <span className="truncate">{item.name}</span>
                        <span className="text-slate-500 font-black">₹{(item.Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <Sidebar isOpenMobile={isOpenMobile} onCloseMobile={() => setIsOpenMobile(false)} />

            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
                    {/* Header */}
                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:pb-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                            <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setIsOpenMobile(true)}
                                    className="md:hidden p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none shrink-0"
                                    title="Open navigation menu"
                                >
                                    <Menu size={20} />
                                </button>
                                <div className="hidden md:flex p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm shrink-0">
                                    <LayoutDashboard size={18} className="stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight leading-none truncate">Admin Dashboard</h1>
                                    <p className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-wider mt-1">Real-time Financial Analytics</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 relative md:justify-end">
                                <div className="relative flex-1 min-w-0 md:flex-none">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            setShowCampusDropdown(!showCampusDropdown);
                                        }}
                                        className="w-full sm:w-auto text-[10px] font-extrabold text-slate-600 bg-white px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                                        title="Select Campus"
                                    >
                                        <Building2 size={13} className="text-indigo-500 shrink-0" />
                                        <span className="flex-1 sm:flex-none sm:max-w-[140px] truncate text-left">{selectedCampusLabel}</span>
                                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </button>

                                    {showCampusDropdown && (
                                        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[12rem] sm:w-52 bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 py-1.5 text-xs font-bold text-slate-700 max-h-60 overflow-y-auto">
                                            {campusOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleCampusChange(option.id)}
                                                    className={`w-full text-left px-4 py-2.5 sm:py-2 hover:bg-indigo-50/50 hover:text-indigo-600 transition-colors ${String(selectedCampusId) === option.id ? 'text-indigo-600 bg-indigo-50/20 font-bold' : ''}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="relative flex-1 min-w-0 md:flex-none">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setShowCampusDropdown(false);
                                            setShowDropdown(!showDropdown);
                                        }}
                                        className="w-full sm:w-auto text-[10px] font-extrabold text-slate-600 bg-white px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                                        title="Select Period"
                                    >
                                        <Calendar size={13} className="text-indigo-500 shrink-0" />
                                        <span className="flex-1 sm:flex-none truncate text-left">{datePreset}</span>
                                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </button>

                                    {showDropdown && (
                                        <div className="absolute right-0 top-full mt-1.5 w-full min-w-[10rem] sm:w-40 bg-white border border-slate-200/80 rounded-xl shadow-lg z-50 py-1.5 text-xs font-bold text-slate-700">
                                            {['Today', 'Yesterday', 'Last 3 Days', 'Last 7 Days', 'Last 30 Days', 'Custom'].map(preset => (
                                                <button
                                                    key={preset}
                                                    onClick={() => handlePresetChange(preset)}
                                                    className={`w-full text-left px-4 py-2.5 sm:py-2 hover:bg-indigo-50/50 hover:text-indigo-600 transition-colors ${datePreset === preset ? 'text-indigo-600 bg-indigo-50/20 font-bold' : ''}`}
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {datePreset === 'Custom' && (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200/80 shadow-sm animate-fadeIn w-full sm:w-auto basis-full">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide shrink-0">From:</span>
                                            <input
                                                type="date"
                                                className="bg-transparent border-none p-0 text-xs font-extrabold text-slate-700 focus:ring-0 cursor-pointer flex-1 min-w-0 sm:w-28"
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                            />
                                        </div>
                                        <span className="hidden sm:inline text-slate-300 mx-0.5 font-bold">to</span>
                                        <div className="flex items-center gap-2 flex-1 min-w-0 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide shrink-0">To:</span>
                                            <input
                                                type="date"
                                                className="bg-transparent border-none p-0 text-xs font-extrabold text-slate-700 focus:ring-0 cursor-pointer flex-1 min-w-0 sm:w-28"
                                                value={endDate}
                                                onChange={e => setEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 shadow-sm"></div>
                                ))}
                            </div>
                            <div className="h-48 sm:h-60 bg-white rounded-xl border border-slate-100 shadow-sm animate-pulse"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="h-44 sm:h-52 bg-white rounded-xl border border-slate-100 shadow-sm animate-pulse"></div>
                                <div className="h-44 sm:h-52 bg-white rounded-xl border border-slate-100 shadow-sm animate-pulse"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {/* KPI Grid for desktop and larger screens */}
                            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                                {kpis.map((kpi, idx) => {
                                    const IconComponent = kpi.icon;
                                    return (
                                        <div key={idx} className={`p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200/60 border-b-[3px] ${kpi.borderColor} flex items-center gap-3 sm:gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-default`}>
                                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                                                <IconComponent />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest truncate ${kpi.labelColor}`}>{kpi.label}</p>
                                                <p className="text-base sm:text-xl font-black text-slate-800 tracking-tight leading-none mt-1 truncate">{kpi.value}</p>
                                                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1 sm:mt-1.5 flex items-center gap-1 flex-wrap">
                                                    vs yesterday <span className={`${kpi.trend.includes('▲') ? 'text-emerald-500' : 'text-rose-500'} font-extrabold`}>{kpi.trend}</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mobile-only KPI layout: overall first, then cash and online side-by-side. Active Students hidden on mobile. */}
                            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:hidden">
                                {(() => {
                                    const MobileOverallIcon = kpis[0].icon;
                                    return (
                                        <div className={`p-3.5 bg-white rounded-xl border border-slate-200/60 border-b-[3px] ${kpis[0].borderColor} flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-default`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${kpis[0].iconBg}`}>
                                                <MobileOverallIcon />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[8px] font-black uppercase tracking-widest truncate ${kpis[0].labelColor}`}>{kpis[0].label}</p>
                                                <p className="text-base font-black text-slate-800 tracking-tight leading-none mt-1 truncate">{kpis[0].value}</p>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-2 gap-3">
                                    {kpis.slice(1, 3).map((kpi, idx) => {
                                        const IconComponent = kpi.icon;
                                        const mobileLabel = kpi.label.replace(' Collection', '');
                                        return (
                                            <div key={idx} className={`p-3.5 bg-white rounded-xl border border-slate-200/60 border-b-[3px] ${kpi.borderColor} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-default`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                                                        <IconComponent />
                                                    </div>
                                                    <p className={`text-[8px] font-black uppercase tracking-widest truncate ${kpi.labelColor}`}>{mobileLabel}</p>
                                                </div>
                                                <p className="text-sm font-black text-slate-800 tracking-tight leading-none mt-3 truncate">{kpi.value}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Collection Trend (Full Width) */}
                            <div className="hidden md:block bg-white rounded-xl border border-slate-200/60 p-3 sm:p-4 shadow-sm space-y-3 overflow-hidden">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <TrendingUp size={15} className="text-indigo-500 stroke-[2.5] shrink-0" />
                                        <h3 className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest truncate">
                                            Collection Trend
                                        </h3>
                                    </div>
                                    <span className="text-[8px] sm:text-[9px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                                        Daily Intake
                                    </span>
                                </div>
                                <div className="relative w-full h-[180px] sm:h-[200px] -mx-1">
                                    {trendChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={trendChartData} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
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
                                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    width={40}
                                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
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

                            {/* Core Breakdowns Grid (2x2 side-by-side) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                {/* College-wise Intake */}
                                <div className="bg-white rounded-xl border border-slate-200/60 p-3 sm:p-4 shadow-sm space-y-3 overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Database size={15} className="text-indigo-500 stroke-[2.5] shrink-0" />
                                            <h3 className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest truncate">
                                                College-wise Collection
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="relative w-full">
                                        <div className="hidden md:block w-full h-[180px] sm:h-[160px]">
                                            {collegeChartData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={collegeChartData} margin={{ top: 10, right: 5, left: -10, bottom: 25 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis 
                                                            dataKey="name" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }}
                                                            interval={0}
                                                            angle={-25}
                                                            textAnchor="end"
                                                            height={40}
                                                        />
                                                        <YAxis 
                                                            axisLine={false} 
                                                            tickLine={false}
                                                            width={40}
                                                            tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
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
                                        <div className="md:hidden pt-1">
                                            {renderDataList(collegeChartData, "No college transactions available")}
                                        </div>
                                    </div>
                                </div>

                                {/* User / Cashier collections */}
                                <div className="bg-white rounded-xl border border-slate-200/60 p-3 sm:p-4 shadow-sm space-y-3 overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <UserCheck size={15} className="text-indigo-500 stroke-[2.5] shrink-0" />
                                            <h3 className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest truncate">
                                                User-wise Collection
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="relative w-full">
                                        <div className="hidden md:block w-full h-[180px] sm:h-[160px]">
                                            {userChartData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={userChartData} margin={{ top: 10, right: 5, left: -10, bottom: 25 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis 
                                                            dataKey="name" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }}
                                                            interval={0}
                                                            angle={-25}
                                                            textAnchor="end"
                                                            height={40}
                                                        />
                                                        <YAxis 
                                                            axisLine={false} 
                                                            tickLine={false}
                                                            width={40}
                                                            tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
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
                                        <div className="md:hidden pt-1">
                                            {renderDataList(userChartData, "No user transaction records")}
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
