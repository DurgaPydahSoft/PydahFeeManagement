import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Calendar, Loader2, Activity, Plus, Pencil, Trash2, X, AlertCircle } from 'lucide-react';

const AcademicCalendar = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
    const [calendarFilters, setCalendarFilters] = useState({
        college: '',
        batch: '',
        course: '',
        branch: ''
    });

    // Student & Academic Metadata for Filters
    const [studentsMetadata, setStudentsMetadata] = useState({});
    const [batches, setBatches] = useState([]);

    // CRUD States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [metadata, setMetadata] = useState({ years: [], courses: [] });
    const [formData, setFormData] = useState({
        academic_year_id: '',
        course_id: '',
        year_of_study: '1',
        semester_number: '1',
        start_date: '',
        end_date: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    
    // Permission Check
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const permissions = user.permissions || [];
    const role = user.role;
    const hasPermission = role === 'superadmin' || permissions.includes('/academic-calendar');

    useEffect(() => {
        if (hasPermission) {
            fetchAcademicYears();
            fetchMetadata();
            fetchStudentsMetadata();
        }
    }, [hasPermission]);

    if (!hasPermission) {
        return (
            <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={40} className="text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            You don't have the required permissions to view or manage the Academic Calendar. Please contact your administrator.
                        </p>
                        <button 
                            onClick={() => window.history.back()}
                            className="mt-8 w-full py-3 px-6 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    useEffect(() => {
        if (hasPermission) {
            fetchAcademicYears(calendarFilters);
        }
    }, [calendarFilters, hasPermission]);

    const fetchAcademicYears = async (filters = calendarFilters) => {
        setIsFetchingCalendar(true);
        try {
            const params = new URLSearchParams();
            if (filters.batch) params.append('batch', filters.batch);
            if (filters.course) params.append('course', filters.course);
            const res = await api.get(`/academic-calendar/academic-years?${params.toString()}`);
            setAcademicYears(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsFetchingCalendar(false);
        }
    };

    const fetchMetadata = async () => {
        try {
            const res = await api.get(`/academic-calendar/metadata`);
            setMetadata(res.data);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    const handleOpenModal = (entry = null) => {
        if (entry) {
            setEditingId(entry.id);
            setFormData({
                academic_year_id: entry.academic_year_id || '',
                course_id: entry.course_id || '',
                year_of_study: entry.year_of_study.toString(),
                semester_number: entry.semester_number.toString(),
                start_date: new Date(entry.start_date).toISOString().split('T')[0],
                end_date: new Date(entry.end_date).toISOString().split('T')[0]
            });
        } else {
            setEditingId(null);
            setFormData({
                academic_year_id: '',
                course_id: '',
                year_of_study: '1',
                semester_number: '1',
                start_date: '',
                end_date: ''
            });
        }
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.academic_year_id || !formData.course_id || !formData.start_date || !formData.end_date) {
            setError('Please fill in all required fields.');
            return;
        }

        if (new Date(formData.start_date) >= new Date(formData.end_date)) {
            setError('Start date must be before end date.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const url = editingId 
                ? `/academic-calendar/academic-years/${editingId}`
                : `/academic-calendar/academic-years`;
            const method = editingId ? 'put' : 'post';

            await api[method](url, formData);

            setIsModalOpen(false);
            fetchAcademicYears();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving calendar entry.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;

        try {
            await api.delete(`/academic-calendar/academic-years/${id}`);
            fetchAcademicYears();
        } catch (err) {
            alert('Error deleting entry.');
        }
    };

    const fetchStudentsMetadata = async () => {
        try {
            const res = await api.get(`/students/metadata`);
            setStudentsMetadata(res.data.hierarchy || res.data);
            if (res.data.batches) setBatches(res.data.batches);
        } catch (error) {
            console.error('Error fetching student metadata:', error);
        }
    };

    const colleges = React.useMemo(() => {
        return Object.keys(studentsMetadata);
    }, [studentsMetadata]);

    const batchOptions = React.useMemo(() => {
        const fromYears = academicYears.map(item => item.batch || item.year_label).filter(Boolean);
        const combined = Array.from(new Set([...batches, ...fromYears]));
        return combined.sort().reverse();
    }, [batches, academicYears]);

    const courseOptions = React.useMemo(() => {
        if (calendarFilters.college && studentsMetadata[calendarFilters.college]) {
            return Object.keys(studentsMetadata[calendarFilters.college]);
        }
        const fromData = [...new Set(academicYears.map(item => item.course_name).filter(Boolean))];
        const fromMeta = metadata.courses ? metadata.courses.map(c => c.name) : [];
        return Array.from(new Set([...fromData, ...fromMeta])).sort();
    }, [calendarFilters.college, studentsMetadata, academicYears, metadata.courses]);

    const branchOptions = React.useMemo(() => {
        if (calendarFilters.college && calendarFilters.course) {
            return studentsMetadata[calendarFilters.college]?.[calendarFilters.course]?.branches || [];
        }
        return [];
    }, [calendarFilters.college, calendarFilters.course, studentsMetadata]);

    const filteredCalendarData = React.useMemo(() => {
        const collegeCourses = calendarFilters.college && studentsMetadata[calendarFilters.college] 
            ? Object.keys(studentsMetadata[calendarFilters.college]) 
            : null;

        return academicYears.filter(item => {
            const itemBatch = item.batch || item.year_label;
            if (calendarFilters.batch && String(itemBatch) !== String(calendarFilters.batch)) return false;
            if (calendarFilters.course) {
                if (item.course_name !== calendarFilters.course) return false;
            } else if (collegeCourses) {
                if (item.college_name) {
                    if (item.college_name !== calendarFilters.college && item.college_code !== calendarFilters.college) return false;
                } else if (!collegeCourses.includes(item.course_name)) {
                    return false;
                }
            }
            return true;
        });
    }, [academicYears, calendarFilters, studentsMetadata]);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="p-6 pb-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Calendar className="text-gray-800" size={24} /> Academic Calendar
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">View and manage important academic dates across sessions.</p>
                    </div>
                    <button 
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 transition-all text-sm"
                    >
                        <Plus size={18} /> Add New Entry
                    </button>
                </header>

                <main className="flex-1 overflow-hidden p-6 pt-2 flex flex-col">
                    {/* Table Filters Bar matching Fee Structures page */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-3 items-end shadow-xs shrink-0">
                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">College</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={calendarFilters.college} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, college: e.target.value, course: '', branch: '' })}
                            >
                                <option value="">All Colleges</option>
                                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Batch</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={calendarFilters.batch} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, batch: e.target.value })}
                            >
                                <option value="">All Batches</option>
                                {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Course</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400" 
                                value={calendarFilters.course} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, course: e.target.value, branch: '' })}
                                disabled={!calendarFilters.college && courseOptions.length === 0}
                            >
                                <option value="">All Courses</option>
                                {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Branch</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400" 
                                value={calendarFilters.branch} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, branch: e.target.value })}
                                disabled={!calendarFilters.course}
                            >
                                <option value="">All Branches</option>
                                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div className="shrink-0">
                            {(calendarFilters.college || calendarFilters.batch || calendarFilters.course || calendarFilters.branch) ? (
                                <button
                                    type="button"
                                    onClick={() => setCalendarFilters({ college: '', batch: '', course: '', branch: '' })}
                                    className="px-3.5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition text-center shrink-0 w-auto"
                                >
                                   Clear
                                </button>
                            ) : (
                                <div className="text-[11px] text-gray-400 font-medium py-2 px-1 text-center italic whitespace-nowrap">No filters active</div>
                            )}
                        </div>
                    </div>

                    <div className="w-full h-full flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex-1">
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden pb-10">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-20 shadow-xs">
                                        <tr>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Course</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Batch</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Year</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Semester</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Start Date</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider">End Date</th>
                                            <th className="px-6 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {isFetchingCalendar ? (
                                            Array.from({ length: 5 }).map((_, idx) => (
                                                <tr key={idx} className="animate-pulse">
                                                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                                    <td className="px-6 py-4 text-center"><div className="h-6 bg-slate-200 rounded-md w-12 mx-auto"></div></td>
                                                    <td className="px-6 py-4 text-center"><div className="h-6 bg-slate-200 rounded-md w-12 mx-auto"></div></td>
                                                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                    <td className="px-6 py-4 text-right"><div className="h-7 bg-slate-200 rounded-lg w-16 ml-auto"></div></td>
                                                </tr>
                                            ))
                                        ) : filteredCalendarData.length > 0 ? (
                                            filteredCalendarData.map((item) => {
                                                return (
                                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group text-xs">
                                                        <td className="px-6 py-3.5 font-semibold text-blue-800">
                                                            {item.course_name}
                                                        </td>
                                                        <td className="px-6 py-3.5 font-bold text-gray-900">
                                                            {item.batch || item.year_label}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-center">
                                                            <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold text-[11px]">Yr {item.year_of_study}</span>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-center">
                                                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md font-bold text-[11px]">Sem {item.semester_number}</span>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-gray-700 font-medium font-mono">
                                                            {new Date(item.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-gray-700 font-medium font-mono">
                                                            {new Date(item.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button 
                                                                    onClick={() => handleOpenModal(item)}
                                                                    className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-16 text-center text-gray-400 italic">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Calendar size={36} className="text-gray-300" />
                                                        <span>No academic calendar records found for selected filters.</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>

                {/* CRUD Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">
                                        {editingId ? 'Edit Calendar Entry' : 'Add New Entry'}
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5">Define academic cycle dates</p>
                                </div>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm border border-transparent hover:border-slate-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {error && (
                                    <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-shake">
                                        <AlertCircle size={16} /> {error}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Academic Year</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                                            value={formData.academic_year_id}
                                            onChange={(e) => setFormData({...formData, academic_year_id: e.target.value})}
                                            disabled={!!editingId} // Disable if editing to preserve sessions
                                        >
                                            <option value="">Select Session</option>
                                            {metadata.years.map(y => <option key={y.id} value={y.id}>{y.year_label}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Course</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                                            value={formData.course_id}
                                            onChange={(e) => {
                                                const newCourseId = e.target.value;
                                                const selectedCourse = metadata.courses.find(c => String(c.id) === String(newCourseId));
                                                const semestersPerYear = selectedCourse?.semesters_per_year || 2;
                                                setFormData({
                                                    ...formData, 
                                                    course_id: newCourseId,
                                                    year_of_study: '1',
                                                    semester_number: '1'
                                                });
                                            }}
                                            disabled={!!editingId}
                                        >
                                            <option value="">Select Course</option>
                                            {metadata.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Year</label>
                                            <select 
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                                                value={formData.year_of_study}
                                                onChange={(e) => {
                                                    const newYear = e.target.value;
                                                    const selectedCourse = metadata.courses.find(c => String(c.id) === String(formData.course_id));
                                                    const semestersPerYear = selectedCourse?.semesters_per_year || 2;
                                                    const startSem = (parseInt(newYear) - 1) * semestersPerYear + 1;
                                                    setFormData({
                                                        ...formData, 
                                                        year_of_study: newYear,
                                                        semester_number: String(startSem)
                                                    });
                                                }}
                                            >
                                                {(() => {
                                                    const selectedCourse = metadata.courses.find(c => String(c.id) === String(formData.course_id));
                                                    const totalYears = selectedCourse?.total_years || 4; // Default to 4 if course not selected or found
                                                    return Array.from({ length: totalYears }, (_, i) => (
                                                        <option key={i + 1} value={i + 1}>Year {i + 1}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Semester</label>
                                            <select 
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                                                value={formData.semester_number}
                                                onChange={(e) => setFormData({...formData, semester_number: e.target.value})}
                                            >
                                                {(() => {
                                                    const selectedCourse = metadata.courses.find(c => String(c.id) === String(formData.course_id));
                                                    const semestersPerYear = selectedCourse?.semesters_per_year || 2; 
                                                    const year = parseInt(formData.year_of_study);
                                                    
                                                    // This can be absolute sem number (1-8) or per-year (1-2)
                                                    // Given current system uses numbers like 1, 2, 3.. etc based on the previous implementation
                                                    // Let's assume standard behavior where Sem 1 and 2 exist for each year, 
                                                    // but the academic calendar entry might be for "Sem 1 of Year 1" which is Sem 1 absolute.
                                                    // If it's absolute, sem_number goes from (year-1)*2 + 1 to (year-1)*2 + semestersPerYear.
                                                    
                                                    // Let's check existing data format. 
                                                    // The current code has [1..8]. 
                                                    // I'll assume absolute sem number for now.
                                                    const startSem = (year - 1) * semestersPerYear + 1;
                                                    return Array.from({ length: semestersPerYear }, (_, i) => {
                                                        const s = startSem + i;
                                                        return <option key={s} value={s}>Sem {s}</option>;
                                                    });
                                                })()}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Start Date</label>
                                            <input 
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">End Date</label>
                                            <input 
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-[2] py-3 px-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:shadow-none"
                                >
                                    {isSaving ? (
                                        <><Loader2 size={18} className="animate-spin" /> Saving...</>
                                    ) : (
                                        <><Calendar size={18} /> {editingId ? 'Update Session' : 'Create Session'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcademicCalendar;
