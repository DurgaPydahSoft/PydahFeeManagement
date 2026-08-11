import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { 
    Search, 
    Filter, 
    Calendar, 
    CheckCircle, 
    XCircle, 
    Eye, 
    Clock, 
    BarChart2, 
    ChevronLeft, 
    ChevronRight,
    Loader2,
    Users,
    MessageSquare,
    Mail,
    Phone,
    FileText
} from 'lucide-react';

const ReminderReports = ({ colleges = [] }) => {
    // Sub-tabs: 'logs' or 'upcoming'
    const [subTab, setSubTab] = useState('logs');
    
    // Stats state
    const [stats, setStats] = useState({
        totalSent: 0,
        totalSuccess: 0,
        totalFailed: 0,
        successRate: 100,
        activeRulesCount: 0
    });
    
    // Logs list state
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1
    });

    // Upcoming list state
    const [upcoming, setUpcoming] = useState([]);
    const [upcomingLoading, setUpcomingLoading] = useState(false);

    // Filters state for Logs
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [college, setCollege] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Selected log for View Modal
    const [selectedLog, setSelectedLog] = useState(null);

    // Fetch stats and lists on mount/filter change
    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (subTab === 'logs') {
            fetchLogs();
        } else {
            fetchUpcoming();
        }
    }, [subTab, status, type, college, startDate, endDate, currentPage]);

    // Handle search input debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (subTab === 'logs') {
                setCurrentPage(1);
                fetchLogs();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchStats = async () => {
        try {
            const res = await api.get('/reminders/reports/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const params = {
                search,
                status,
                type,
                college,
                startDate,
                endDate,
                page: currentPage,
                limit: pagination.limit
            };
            const res = await api.get('/reminders/reports/logs', { params });
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    const fetchUpcoming = async () => {
        setUpcomingLoading(true);
        try {
            const res = await api.get('/reminders/reports/upcoming');
            setUpcoming(res.data || []);
        } catch (error) {
            console.error('Error fetching upcoming forecast:', error);
        } finally {
            setUpcomingLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearch('');
        setStatus('');
        setType('');
        setCollege('');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm font-sans">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-100 shrink-0 bg-gray-50/50">
                
                {/* Stat 1: Total Sent */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-800">{stats.totalSent.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 font-medium">Total Messages Sent</div>
                    </div>
                </div>

                {/* Stat 2: Success Rate */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800">{stats.successRate}%</div>
                            <div className="text-xs text-gray-500 font-medium">Delivery Success Rate</div>
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${stats.successRate}%` }}></div>
                    </div>
                </div>

                {/* Stat 3: Active Rules */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-800">{stats.activeRulesCount}</div>
                        <div className="text-xs text-gray-500 font-medium">Active Reminder Rules</div>
                    </div>
                </div>

                {/* Stat 4: Upcoming Forecast */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <BarChart2 size={20} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-800">{upcoming.length}</div>
                        <div className="text-xs text-gray-500 font-medium">Upcoming triggers (30d)</div>
                    </div>
                </div>

            </div>

            {/* Sub Tabs Switcher */}
            <div className="px-6 pt-4 flex border-b border-gray-100 bg-white shrink-0 items-center justify-between">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setSubTab('logs')}
                        className={`pb-3 font-semibold text-sm border-b-2 transition ${subTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Sent History Logs
                    </button>
                    <button 
                        onClick={() => setSubTab('upcoming')}
                        className={`pb-3 font-semibold text-sm border-b-2 transition ${subTab === 'upcoming' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Upcoming Reminders Forecast
                    </button>
                </div>
                {subTab === 'logs' && (
                    <button 
                        onClick={handleClearFilters}
                        className="text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 transition mb-3"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Filter Bar (Only for Logs tab) */}
            {subTab === 'logs' && (
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3 shrink-0">
                    
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Search PIN, Student, Phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* College Filter */}
                    <select 
                        value={college} 
                        onChange={(e) => { setCollege(e.target.value); setCurrentPage(1); }}
                        className="p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">All Colleges</option>
                        {colleges.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select 
                        value={status} 
                        onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
                        className="p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                    </select>

                    {/* Type Filter */}
                    <select 
                        value={type} 
                        onChange={(e) => { setType(e.target.value); setCurrentPage(1); }}
                        className="p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">All Types</option>
                        <option value="SMS">SMS Only</option>
                        <option value="EMAIL">Email Only</option>
                    </select>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <input 
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                            className="p-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Start Date"
                        />
                        <span className="text-gray-400 text-xs">-</span>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                            className="p-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="End Date"
                        />
                    </div>

                </div>
            )}

            {/* List Data View Area */}
            <div className="flex-1 overflow-auto min-h-0">
                {subTab === 'logs' ? (
                    logsLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 italic gap-2">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p>Loading sent history logs...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-24 text-gray-400">
                            <FileText size={48} className="mx-auto text-gray-200 mb-3" />
                            <p className="font-bold text-gray-500">No Sent Reminder Logs Found</p>
                            <p className="text-xs mt-1">Try adjusting your filters or send some reminders.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-gray-600 font-semibold">
                                <tr>
                                    <th className="p-3 w-12 text-center">#</th>
                                    <th className="p-3 w-28">PIN / Adm</th>
                                    <th className="p-3 w-40">Student Name</th>
                                    <th className="p-3 w-28">College</th>
                                    <th className="p-3 w-36">Recipient</th>
                                    <th className="p-3 w-20 text-center">Type</th>
                                    <th className="p-3">Template</th>
                                    <th className="p-3 w-32">Sent Time</th>
                                    <th className="p-3 w-24 text-center">Status</th>
                                    <th className="p-3 w-16 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log, idx) => {
                                    const index = (currentPage - 1) * pagination.limit + idx + 1;
                                    const dateObj = new Date(log.sentAt);
                                    const formattedTime = !isNaN(dateObj.getTime())
                                        ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                        : '-';
                                    return (
                                        <tr key={log._id} className="hover:bg-blue-50/20 transition">
                                            <td className="p-3 text-center text-gray-400">{index}</td>
                                            <td className="p-3">
                                                <div className="font-mono font-medium text-gray-700">{log.pinNo || '-'}</div>
                                                <div className="text-[10px] text-gray-400">{log.studentId}</div>
                                            </td>
                                            <td className="p-3 font-semibold text-gray-800">{log.studentName}</td>
                                            <td className="p-3 text-gray-500 font-medium">{log.college}</td>
                                            <td className="p-3 text-gray-600 font-mono">{log.recipient}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1 ${log.type === 'SMS' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {log.type === 'SMS' ? <Phone size={8} /> : <Mail size={8} />}
                                                    {log.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-600 max-w-xs truncate font-medium" title={log.templateName}>
                                                {log.templateName || 'Direct Message'}
                                            </td>
                                            <td className="p-3 text-gray-500 font-medium">{formattedTime}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                    {log.status === 'success' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                    {log.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => setSelectedLog(log)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                                    title="View Message Content"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                ) : (
                    // Upcoming forecast tab
                    upcomingLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 italic gap-2">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p>Calculating upcoming reminder forecast (30 days)...</p>
                        </div>
                    ) : upcoming.length === 0 ? (
                        <div className="text-center py-24 text-gray-400">
                            <Clock size={48} className="mx-auto text-gray-200 mb-3" />
                            <p className="font-bold text-gray-500">No Upcoming Reminders Scheduled</p>
                            <p className="text-xs mt-1">There are no active rules matching calendar due dates in the next 30 days.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-gray-600 font-semibold">
                                <tr>
                                    <th className="p-3 w-12 text-center">#</th>
                                    <th className="p-3 w-32">Scheduled Date</th>
                                    <th className="p-3 w-28">Source</th>
                                    <th className="p-3">Target Cohort</th>
                                    <th className="p-3 w-36">Template Name</th>
                                    <th className="p-3 w-28">Offset</th>
                                    <th className="p-3 w-32">Ref Due Date</th>
                                    <th className="p-3 w-32 text-right">Est. Recipients</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {upcoming.map((item, idx) => {
                                    const triggerDate = new Date(item.triggerDate);
                                    const formattedTrigger = !isNaN(triggerDate.getTime())
                                        ? triggerDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '-';
                                        
                                    const dueDate = new Date(item.dueDate);
                                    const formattedDue = !isNaN(dueDate.getTime())
                                        ? dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '-';

                                    return (
                                        <tr key={idx} className="hover:bg-blue-50/20 transition">
                                            <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-3 font-semibold text-blue-700">{formattedTrigger}</td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.dueSource === 'ACADEMIC' ? 'bg-purple-100 text-purple-800' :
                                                    item.dueSource === 'HOSTEL' ? 'bg-pink-100 text-pink-800' :
                                                    'bg-cyan-100 text-cyan-800'
                                                }`}>
                                                    {item.dueSource}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-800 font-medium">{item.cohort}</td>
                                            <td className="p-3 text-gray-500 font-medium">{item.templateName}</td>
                                            <td className="p-3 text-gray-600 font-medium">
                                                {item.offset} days {item.triggerType.toLowerCase()}
                                            </td>
                                            <td className="p-3 text-gray-500 font-medium">{formattedDue}</td>
                                            <td className="p-3 text-right text-gray-900 font-bold inline-flex items-center gap-1 justify-end w-full">
                                                <Users size={12} className="text-gray-400" />
                                                {item.estimatedRecipients.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                )}
            </div>

            {/* Pagination Controls (Only for logs tab) */}
            {subTab === 'logs' && !logsLoading && logs.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between text-xs text-gray-500">
                    <div>
                        Showing <b>{(currentPage - 1) * pagination.limit + 1}</b> to <b>{Math.min(currentPage * pagination.limit, pagination.total)}</b> of <b>{pagination.total}</b> logs
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="p-1.5 border border-gray-200 rounded-lg hover:bg-white transition disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="font-semibold text-gray-800">Page {currentPage} of {pagination.totalPages}</span>
                        <button 
                            disabled={currentPage === pagination.totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
                            className="p-1.5 border border-gray-200 rounded-lg hover:bg-white transition disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* View Message Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[85vh] transition-transform scale-100">
                        
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-800">Sent Notification Content</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Recipient: <span className="font-mono text-gray-700 font-semibold">{selectedLog.recipient}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition text-lg font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-auto space-y-4">
                            
                            {/* Student details header */}
                            <div className="grid grid-cols-2 gap-4 bg-blue-50/20 p-4 rounded-xl border border-blue-50 text-xs">
                                <div>
                                    <span className="text-gray-400 block font-medium">Student Name</span>
                                    <span className="font-bold text-gray-800 text-sm">{selectedLog.studentName}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Admission No / PIN</span>
                                    <span className="font-semibold text-gray-700 font-mono text-sm">{selectedLog.pinNo || selectedLog.studentId}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">College & Course</span>
                                    <span className="font-medium text-gray-700">{selectedLog.college} - {selectedLog.course || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Type & Template</span>
                                    <span className="font-medium text-gray-700">{selectedLog.type} ({selectedLog.templateName || 'Direct'})</span>
                                </div>
                            </div>

                            {/* Email subject block */}
                            {selectedLog.type === 'EMAIL' && selectedLog.subject && (
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Subject</span>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800">
                                        {selectedLog.subject}
                                    </div>
                                </div>
                            )}

                            {/* Message body block */}
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Message Content</span>
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-auto">
                                    {selectedLog.body}
                                </div>
                            </div>

                            {/* Delivery Status log */}
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Log Outcome</span>
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 font-medium ${selectedLog.status === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                    {selectedLog.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    <span>Outcome: {selectedLog.message || 'Processed.'}</span>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 font-semibold text-xs text-gray-700 rounded-lg transition"
                            >
                                Close View
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default ReminderReports;
