import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Calendar, Loader2, Activity, Plus, Pencil, Trash2, X, AlertCircle } from 'lucide-react';

/** Format MySQL DATE without UTC shift (avoids off-by-one in IST). */
const toDateParts = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
        // mysql2 DATE values are typically midnight UTC for the calendar day
        return { y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() };
    }
    const asString = String(value);
    const match = asString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
    return null;
};

const formatSqlDate = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
    const parts = toDateParts(value);
    if (!parts) return '—';
    return new Date(parts.y, parts.m - 1, parts.d).toLocaleDateString(undefined, options);
};

/** Keep YYYY-MM-DD for <input type="date"> without timezone conversion. */
const toDateInputValue = (value) => {
    const parts = toDateParts(value);
    if (!parts) return '';
    return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
};

/** Derive current academic year string, e.g. "2025-2026" */
const getCurrentAcademicYear = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-based
    const year = now.getFullYear();
    // Academic year starts in June (month 6)
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
};

/** Calculate batch dynamically from academic year label and year of study */
const calculateBatch = (academicYearLabel, yearOfStudy) => {
    if (!academicYearLabel || !yearOfStudy) return null;
    const match = academicYearLabel.match(/^(\d{4})/);
    if (!match) return null;
    const startYear = parseInt(match[1], 10);
    return String(startYear - (parseInt(yearOfStudy, 10) - 1));
};

/** Helper to find college name for a given course name using studentsMetadata hierarchy */
const findCollegeForCourse = (courseName, studentsMetadata) => {
    if (!studentsMetadata) return null;
    for (const [colName, coursesObj] of Object.entries(studentsMetadata)) {
        if (coursesObj && coursesObj[courseName]) {
            return colName;
        }
    }
    return null;
};

/** Calculate Academic Year label dynamically from batch and year of study */
const calculateAcademicYearLabel = (batch, yearOfStudy) => {
    if (!batch || !yearOfStudy) return null;
    const batchYear = parseInt(batch, 10);
    const startYear = batchYear + (parseInt(yearOfStudy, 10) - 1);
    return `${startYear}-${startYear + 1}`;
};

const AcademicCalendar = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
    const [calendarFilters, setCalendarFilters] = useState({
        college: '',
        academicYear: getCurrentAcademicYear(),
        course: ''
    });
    const [hideEmptyDates, setHideEmptyDates] = useState(false);

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
            if (filters.college) params.append('college', filters.college);
            if (filters.academicYear) params.append('batch', filters.academicYear);
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
            const isPlaceholder = !!entry._isPlaceholder;
            const yearMeta = metadata.years.find(y => y.year_label === entry.year_label);
            const courseMeta = metadata.courses.find(c => c.name === entry.course_name);

            setEditingId(isPlaceholder ? null : entry.id);
            setFormData({
                academic_year_id: entry.academic_year_id || yearMeta?.id || '',
                course_id: entry.course_id || courseMeta?.id || '',
                year_of_study: entry.year_of_study != null ? entry.year_of_study.toString() : '1',
                semester_number: entry.semester_number != null ? entry.semester_number.toString() : '1',
                start_date: toDateInputValue(entry.start_date),
                end_date: toDateInputValue(entry.end_date),
                batch: entry.batch || '',
                college_id: entry.college_id || courseMeta?.college_id || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                academic_year_id: '',
                course_id: '',
                year_of_study: '1',
                semester_number: '1',
                start_date: '',
                end_date: '',
                batch: '',
                college_id: ''
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
            const selectedCourse = metadata.courses.find(c => String(c.id) === String(formData.course_id));
            const selectedYear = metadata.years.find(y => String(y.id) === String(formData.academic_year_id));
            
            const collegeId = formData.college_id || selectedCourse?.college_id || null;
            const calculatedBatchVal = formData.batch || calculateBatch(selectedYear?.year_label, formData.year_of_study);

            const payload = {
                ...formData,
                college_id: collegeId,
                batch: calculatedBatchVal
            };

            const url = editingId 
                ? `/academic-calendar/academic-years/${editingId}`
                : `/academic-calendar/academic-years`;
            const method = editingId ? 'put' : 'post';

            await api[method](url, payload);

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

    const academicYearOptions = React.useMemo(() => {
        // Primary source: metadata.years from the calendar DB (academic_years table)
        const fromMeta = metadata.years.map(y => y.year_label).filter(Boolean);
        // Secondary: any year_labels already present in fetched data
        const fromData = academicYears.map(item => item.year_label).filter(Boolean);
        const combined = Array.from(new Set([...fromMeta, ...fromData])).sort().reverse();
        return combined;
    }, [metadata.years, academicYears]);

    const courseOptions = React.useMemo(() => {
        if (calendarFilters.college && studentsMetadata[calendarFilters.college]) {
            return Object.keys(studentsMetadata[calendarFilters.college]);
        }
        const fromData = [...new Set(academicYears.map(item => item.course_name).filter(Boolean))];
        const fromMeta = metadata.courses ? metadata.courses.map(c => c.name) : [];
        return Array.from(new Set([...fromData, ...fromMeta])).sort();
    }, [calendarFilters.college, studentsMetadata, academicYears, metadata.courses]);



    const filteredCalendarData = React.useMemo(() => {
        const collegeCourses = calendarFilters.college && studentsMetadata[calendarFilters.college]
            ? Object.keys(studentsMetadata[calendarFilters.college])
            : null;

        // Filter actual DB rows
        const dbRows = academicYears.filter(item => {
            if (calendarFilters.academicYear) {
                if (item.year_label !== calendarFilters.academicYear) return false;
            }
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

        // Always synthesize placeholder rows for missing courses AND missing semesters
        const allCourses = calendarFilters.college && studentsMetadata[calendarFilters.college]
            ? Object.keys(studentsMetadata[calendarFilters.college])
            : Object.values(studentsMetadata).flatMap(c => Object.keys(c));
        const uniqueCourses = [...new Set(allCourses)];

        const filteredForCourse = calendarFilters.course ? [calendarFilters.course] : uniqueCourses;

        // Parse academic year start year if filter is selected
        let filterStartYear = null;
        if (calendarFilters.academicYear) {
            const match = calendarFilters.academicYear.match(/^(\d{4})/);
            if (match) {
                filterStartYear = parseInt(match[1], 10);
            }
        }

        filteredForCourse.forEach(courseName => {
            const courseMeta = metadata.courses?.find(c => c.name === courseName);
            const totalYears = courseMeta?.total_years || 4;
            const semestersPerYear = courseMeta?.semesters_per_year || 2;

            const courseEntries = dbRows.filter(r => r.course_name === courseName);

            // Determine target batches for this course
            let targetBatches = [];
            if (filterStartYear !== null) {
                // If filtering by academic year, show only batches active in this academic year
                for (let yearNum = 1; yearNum <= totalYears; yearNum++) {
                    const batchYear = filterStartYear - (yearNum - 1);
                    targetBatches.push(String(batchYear));
                }
            } else {
                // Show all distinct batches in the student registry
                targetBatches = batches.length > 0 ? batches : [...new Set(dbRows.map(r => r.batch).filter(Boolean))];
            }

            const resolvedCollegeName = calendarFilters.college || findCollegeForCourse(courseName, studentsMetadata);

            targetBatches.forEach(batchVal => {
                // For this batch, determine what years to show
                let targetYears = [];
                if (filterStartYear !== null) {
                    // Only show the year of study active in the filtered academic year
                    const batchYear = parseInt(batchVal, 10);
                    const yearNum = filterStartYear - batchYear + 1;
                    if (yearNum >= 1 && yearNum <= totalYears) {
                        targetYears.push(yearNum);
                    }
                } else {
                    // Show all years
                    for (let yearNum = 1; yearNum <= totalYears; yearNum++) {
                        targetYears.push(yearNum);
                    }
                }

                targetYears.forEach(yearNum => {
                    const acadYearLabel = calculateAcademicYearLabel(batchVal, yearNum);
                    const yearMeta = metadata.years?.find(y => y.year_label === acadYearLabel);

                    for (let semIndex = 0; semIndex < semestersPerYear; semIndex++) {
                        const semNum = semIndex + 1;

                        const exists = courseEntries.some(r => 
                            r.batch === batchVal &&
                            r.year_of_study === yearNum && 
                            r.semester_number === semNum
                        );

                        if (!exists) {
                            const placeholderId = `placeholder-${courseName}-${batchVal}-${yearNum}-${semNum}`;
                            const alreadyExists = dbRows.some(r => r.id === placeholderId);

                            if (!alreadyExists) {
                                dbRows.push({
                                    id: placeholderId,
                                    college_name: resolvedCollegeName,
                                    course_name: courseName,
                                    course_id: courseMeta?.id || null,
                                    college_id: courseMeta?.college_id || null,
                                    batch: batchVal,
                                    year_label: acadYearLabel,
                                    academic_year_id: yearMeta?.id || null,
                                    year_of_study: yearNum,
                                    semester_number: semNum,
                                    start_date: null,
                                    end_date: null,
                                    _isPlaceholder: true
                                });
                            }
                        }
                    }
                });
            });
        });

        return dbRows;
    }, [academicYears, calendarFilters, studentsMetadata, metadata, batches]);

    const groupedCalendarData = React.useMemo(() => {
        const groups = {};

        filteredCalendarData.forEach(item => {
            if (hideEmptyDates && item._isPlaceholder) {
                return;
            }

            const collegeKey = item.college_name || 'No college';
            const courseKey = item.course_name || 'No course';
            const batchKey = item.batch || 'No batch';
            const groupKey = `${collegeKey}||${courseKey}||${batchKey}`;

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    college_name: item.college_name,
                    course_name: item.course_name,
                    batch: item.batch,
                    yearsMap: {}
                };
            }

            const yearKey = item.year_of_study != null ? item.year_of_study : 'No Year';
            if (!groups[groupKey].yearsMap[yearKey]) {
                groups[groupKey].yearsMap[yearKey] = {
                    year_of_study: item.year_of_study,
                    year_label: item.year_label, // Academic year label for this year of study
                    semesters: []
                };
            }

            // If some entry has a year_label, prefer it over null
            if (item.year_label && !groups[groupKey].yearsMap[yearKey].year_label) {
                groups[groupKey].yearsMap[yearKey].year_label = item.year_label;
            }

            groups[groupKey].yearsMap[yearKey].semesters.push(item);
        });

        return Object.values(groups).map(group => {
            // Sort years in ascending order (e.g. Yr 1, Yr 2, Yr 3, Yr 4)
            const years = Object.values(group.yearsMap).sort((a, b) => {
                if (a.year_of_study == null) return 1;
                if (b.year_of_study == null) return -1;
                return a.year_of_study - b.year_of_study;
            });

            years.forEach(yr => {
                // Semesters can stay ascending (Sem 1 then Sem 2) within each year
                yr.semesters.sort((a, b) => {
                    if (a.semester_number == null) return 1;
                    if (b.semester_number == null) return -1;
                    return a.semester_number - b.semester_number;
                });
            });

            const totalSemestersCount = years.reduce((sum, yr) => sum + yr.semesters.length, 0);

            return {
                ...group,
                years,
                totalSemestersCount
            };
        }).sort((a, b) => {
            // Sort batch groups: College ascending, Course ascending, Batch descending
            if (a.college_name !== b.college_name) {
                return (a.college_name || '').localeCompare(b.college_name || '');
            }
            if (a.course_name !== b.course_name) {
                return (a.course_name || '').localeCompare(b.course_name || '');
            }
            return (b.batch || '').localeCompare(a.batch || '');
        });
    }, [filteredCalendarData, hideEmptyDates]);

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
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.6fr_1.2fr_1.2fr_auto_auto] gap-3 items-end shadow-xs shrink-0">
                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">College</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={calendarFilters.college} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, college: e.target.value, course: '' })}
                            >
                                <option value="">All Colleges</option>
                                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Academic Year</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={calendarFilters.academicYear} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, academicYear: e.target.value })}
                            >
                                <option value="">All Academic Years</option>
                                {academicYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Course</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400" 
                                value={calendarFilters.course} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, course: e.target.value })}
                                disabled={!calendarFilters.college && courseOptions.length === 0}
                            >
                                <option value="">All Courses</option>
                                {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <label className="flex items-center gap-2 text-[11px] font-bold text-gray-600 cursor-pointer pb-2 whitespace-nowrap">
                            <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={hideEmptyDates}
                                onChange={e => setHideEmptyDates(e.target.checked)}
                            />
                            Hide empty dates
                        </label>

                        <div className="shrink-0">
                            {(calendarFilters.college || calendarFilters.academicYear !== getCurrentAcademicYear() || calendarFilters.course) ? (
                                <button
                                    type="button"
                                    onClick={() => setCalendarFilters({ college: '', academicYear: getCurrentAcademicYear(), course: '' })}
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
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">College</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Course</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Batch</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Academic Year</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Year</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Semester</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Start Date</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">End Date</th>
                                            <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {isFetchingCalendar ? (
                                            Array.from({ length: 5 }).map((_, idx) => (
                                                <tr key={idx} className="animate-pulse">
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                                                    <td className="px-4 py-4 text-center"><div className="h-6 bg-slate-200 rounded-md w-12 mx-auto"></div></td>
                                                    <td className="px-4 py-4 text-center"><div className="h-6 bg-slate-200 rounded-md w-12 mx-auto"></div></td>
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                    <td className="px-4 py-4 text-right"><div className="h-7 bg-slate-200 rounded-lg w-16 ml-auto"></div></td>
                                                </tr>
                                            ))
                                                                                ) : groupedCalendarData.length > 0 ? (
                                            groupedCalendarData.map((group, groupIdx) => {
                                                return group.years.map((yearObj, yearIdx) => {
                                                    return yearObj.semesters.map((semItem, semIdx) => {
                                                        const isFirstInGroup = yearIdx === 0 && semIdx === 0;
                                                        const isFirstInYear = semIdx === 0;

                                                        return (
                                                            <tr 
                                                                key={semItem.id} 
                                                                className={`hover:bg-gray-50/80 transition-colors group text-xs border-b border-gray-100 ${
                                                                    semItem._isPlaceholder ? 'opacity-65 bg-gray-50/30' : ''
                                                                }`}
                                                            >
                                                                {isFirstInGroup && (
                                                                    <>
                                                                        <td 
                                                                            rowSpan={group.totalSemestersCount} 
                                                                            className="px-4 py-3 text-gray-700 font-medium align-middle border-r border-gray-100 bg-white"
                                                                        >
                                                                            {group.college_name || <span className="text-gray-400 italic">No college</span>}
                                                                        </td>
                                                                        <td 
                                                                            rowSpan={group.totalSemestersCount} 
                                                                            className="px-4 py-3 font-semibold text-blue-800 align-middle border-r border-gray-100 bg-white"
                                                                        >
                                                                            {group.course_name}
                                                                        </td>
                                                                        <td 
                                                                            rowSpan={group.totalSemestersCount} 
                                                                            className="px-4 py-3 font-bold text-gray-900 align-middle border-r border-gray-100 bg-white text-center"
                                                                        >
                                                                            {group.batch || '—'}
                                                                        </td>
                                                                    </>
                                                                )}

                                                                {isFirstInYear && (
                                                                    <>
                                                                        <td 
                                                                            rowSpan={yearObj.semesters.length} 
                                                                            className="px-4 py-3 text-gray-600 font-medium align-middle border-r border-gray-100 bg-white text-center"
                                                                        >
                                                                            {yearObj.year_label || '—'}
                                                                        </td>
                                                                        <td 
                                                                            rowSpan={yearObj.semesters.length} 
                                                                            className="px-4 py-3 align-middle border-r border-gray-100 bg-white text-center"
                                                                        >
                                                                            {yearObj.year_of_study != null
                                                                                ? <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold text-[11px]">Yr {yearObj.year_of_study}</span>
                                                                                : <span className="text-gray-300 italic text-[11px]">—</span>
                                                                            }
                                                                        </td>
                                                                    </>
                                                                )}

                                                                <td className="px-4 py-3 text-center border-r border-gray-100">
                                                                    {semItem.semester_number != null
                                                                        ? <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md font-bold text-[11px]">Sem {semItem.semester_number}</span>
                                                                        : <span className="text-gray-300 italic text-[11px]">—</span>
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-700 font-medium font-mono border-r border-gray-100">
                                                                    {semItem._isPlaceholder
                                                                        ? <span className="text-gray-400 font-bold">-</span>
                                                                        : formatSqlDate(semItem.start_date)
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-700 font-medium font-mono border-r border-gray-100">
                                                                    {semItem._isPlaceholder
                                                                        ? <span className="text-gray-400 font-bold">-</span>
                                                                        : formatSqlDate(semItem.end_date)
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {semItem._isPlaceholder ? (
                                                                        <div className="flex justify-end">
                                                                            <button 
                                                                                onClick={() => handleOpenModal(semItem)}
                                                                                className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                                                                                title="Configure dates"
                                                                            >
                                                                                <Plus size={15} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex justify-end gap-2">
                                                                            <button 
                                                                                onClick={() => handleOpenModal(semItem)}
                                                                                className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                                                                title="Edit"
                                                                            >
                                                                                <Pencil size={15} />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDelete(semItem.id)}
                                                                                className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                });
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="9" className="px-6 py-16 text-center text-gray-400 italic">
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
                                                    college_id: selectedCourse?.college_id || '',
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
                                                    setFormData({
                                                        ...formData, 
                                                        year_of_study: newYear,
                                                        semester_number: '1'
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
                                                    return Array.from({ length: semestersPerYear }, (_, i) => {
                                                        const s = i + 1;
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
