import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';
import { Coins, Loader2, Info, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const CautionDeposit = () => {
    // Filter states
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    
    // Data states
    const [cautionConfig, setCautionConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [error, setError] = useState('');

    // Fetch academic years on load
    useEffect(() => {
        const fetchFilters = async () => {
            setLoadingFilters(true);
            try {
                // Fetch academic calendar metadata (SQL)
                const calendarRes = await api.get('/academic-calendar/metadata');
                const yearsList = (calendarRes.data?.years || []).map(y => y.year_label);
                setAcademicYears(yearsList);

                // Determine current academic year based on calendar date (e.g., July 2026 -> 2026-2027)
                const currentDate = new Date();
                const currentYearVal = currentDate.getFullYear();
                const currentMonthVal = currentDate.getMonth(); // 0-11 (June is 5)
                const calculatedAY = currentMonthVal >= 5 // June or later
                    ? `${currentYearVal}-${currentYearVal + 1}`
                    : `${currentYearVal - 1}-${currentYearVal}`;

                if (yearsList.includes(calculatedAY)) {
                    setSelectedYear(calculatedAY);
                } else if (yearsList.length > 0) {
                    // Fallback to the first year in the list (newest) if the current calculated year is not found
                    setSelectedYear(yearsList[0]);
                } else {
                    // Fallback local academic year calculation if database is empty
                    setAcademicYears([calculatedAY]);
                    setSelectedYear(calculatedAY);
                }
            } catch (err) {
                console.error('Failed to load initial configurations', err);
                setError('Failed to fetch initial filters. Please check API services.');
            } finally {
                setLoadingFilters(false);
            }
        };

        fetchFilters();
    }, []);

    // Fetch caution deposit details for all hostels when academic year changes
    useEffect(() => {
        if (!selectedYear) return;

        const fetchCautionDeposit = async () => {
            setLoading(true);
            setError('');
            setCautionConfig(null);
            try {
                const res = await api.get('/hostels/caution-deposit', {
                    params: {
                        academicYear: selectedYear
                    }
                });
                setCautionConfig(res.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Error fetching caution deposit configurations.');
            } finally {
                setLoading(false);
            }
        };

        fetchCautionDeposit();
    }, [selectedYear]);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />
            
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="p-6 pb-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Coins className="text-gray-800" size={24} /> Caution Deposit Setup
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            View additional fees configurations fetched directly from the Hostel management database.
                        </p>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-hidden p-6 pt-2">
                    <div className="w-full h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        
                        {/* Filters Bar */}
                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50/50 text-xs">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Info className="text-blue-600" size={18} /> Additional Fee Details
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-4">
                                {loadingFilters ? (
                                    <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                                        <Loader2 size={12} className="animate-spin text-blue-600" /> Loading filters...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Academic Year:
                                        </label>
                                        <select
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                        >
                                            {academicYears.map((ay) => (
                                                <option key={ay} value={ay}>{ay}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Config Panel */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-450">
                                    <Loader2 size={32} className="animate-spin mb-2 text-blue-605" />
                                    <p className="text-sm font-medium">Querying caution deposit settings...</p>
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 border border-red-150 rounded-xl p-4 flex gap-3 text-red-705 max-w-2xl">
                                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <h4 className="font-bold">Error</h4>
                                        <p className="text-xs mt-0.5">{error}</p>
                                    </div>
                                </div>
                            ) : cautionConfig && cautionConfig.length > 0 ? (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                                    {cautionConfig.map(({ hostel, cautionDeposit }) => (
                                        <div key={hostel._id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
                                            
                                            {/* Header Accent Banner */}
                                            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white flex justify-between items-center shrink-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                                        <ShieldCheck className={cautionDeposit?.isActive ? "text-emerald-300" : "text-gray-300"} size={24} />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-lg font-bold tracking-tight">{hostel.name}</h2>
                                                        <p className="text-blue-100 text-[9px] uppercase font-bold tracking-wider mt-0.5">
                                                            Caution Deposit Setup
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    {cautionDeposit?.isActive ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                                                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 text-[10px] font-bold border border-gray-400/30">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex-1">
                                                <h4 className="text-[9px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                                                    Description / Notes
                                                </h4>
                                                <p className="text-gray-600 text-xs leading-relaxed font-medium">
                                                    {cautionDeposit?.description || 'No description or special instructions configured for this caution deposit.'}
                                                </p>
                                            </div>

                                            {/* Category Amounts Grid */}
                                            <div className="p-5 bg-white shrink-0 border-t border-gray-50">
                                                <h4 className="text-[9px] font-bold text-gray-450 uppercase tracking-wider mb-3">
                                                    Category-Wise Fees
                                                </h4>
                                                
                                                {cautionDeposit?.categoryAmounts && Object.keys(cautionDeposit.categoryAmounts).length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {Object.entries(cautionDeposit.categoryAmounts).map(([category, amount]) => (
                                                            <div 
                                                                key={category} 
                                                                className="bg-slate-50/50 border border-gray-150 rounded-xl p-3 flex items-center justify-between shadow-sm hover:shadow hover:border-blue-200 transition-all duration-200"
                                                            >
                                                                <div>
                                                                    <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-100 mb-0.5">
                                                                        {category}
                                                                    </span>
                                                                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                                                                        Hostel Category
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-sm font-black text-gray-800">
                                                                        ₹ {Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-400 text-xs italic py-2">
                                                        No category-wise amounts found.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Empty / Not Found Config state */
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400 max-w-xl mx-auto text-center space-y-3 animate-fade-in">
                                    <HelpCircle size={48} className="opacity-20" />
                                    <div>
                                        <h3 className="font-bold text-gray-700 text-base">No Configurations Found</h3>
                                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                            No active caution deposit settings exist for the selected academic year across all hostels.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CautionDeposit;
