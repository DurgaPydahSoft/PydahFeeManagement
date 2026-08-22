import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Calendar, Loader2, Activity, Plus, Pencil, Trash2, X, AlertCircle, Printer, Save } from 'lucide-react';
import { printHtmlDocument } from '../utils/printService';

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
    const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'term-dates'
    const [academicYears, setAcademicYears] = useState([]);
    const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
    const [termDates, setTermDates] = useState([]);
    const [isFetchingTermDates, setIsFetchingTermDates] = useState(false);
    const [calendarFilters, setCalendarFilters] = useState({
        college: '',
        academicYear: getCurrentAcademicYear(),
        course: '',
        quota: ''
    });
    const [quotas, setQuotas] = useState([]);
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

    // Term Dates Modal States
    const [isTermModalOpen, setIsTermModalOpen] = useState(false);
    const [editingTermCohort, setEditingTermCohort] = useState(null);
    const [termFormDates, setTermFormDates] = useState([]);
    const [isSavingTerms, setIsSavingTerms] = useState(false);

    const handleOpenTermEditModal = (group, yearObj, cat) => {
        setEditingTermCohort({
            college: group.college_name,
            course: group.course_name,
            batch: group.batch,
            year_of_study: yearObj.year_of_study,
            year_label: yearObj.year_label,
            categoryName: cat.categoryName
        });

        // Prefer raw fee-structure term numbers for edits (display uses semester-mapped columns)
        const initialFormDates = (cat.terms || []).map(t => ({
            termNumber: Number(t.rawTermNumber != null ? t.rawTermNumber : t.termNumber),
            rawDate: t.rawDate || ''
        }));
        setTermFormDates(initialFormDates);
        setIsTermModalOpen(true);
    };

    const handleTermDatesSave = async () => {
        setIsSavingTerms(true);
        try {
            const payload = {
                ...editingTermCohort,
                terms: termFormDates
            };

            await api.put('/academic-calendar/term-dates', payload);
            alert('Term dates updated successfully!');
            setIsTermModalOpen(false);
            fetchTermDates();
        } catch (error) {
            console.error('Failed to update term dates', error);
            alert(error?.response?.data?.message || 'Failed to update term dates');
        } finally {
            setIsSavingTerms(false);
        }
    };
    
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

    useEffect(() => {
        if (hasPermission && activeTab === 'term-dates') {
            fetchTermDates(calendarFilters);
        }
    }, [calendarFilters, activeTab, hasPermission]);

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

    const fetchTermDates = async (filters = calendarFilters) => {
        setIsFetchingTermDates(true);
        try {
            const params = new URLSearchParams();
            if (filters.college) params.append('college', filters.college);
            if (filters.academicYear) params.append('academicYear', filters.academicYear);
            if (filters.course) params.append('course', filters.course);
            if (filters.quota) params.append('quota', filters.quota);
            const res = await api.get(`/academic-calendar/term-dates?${params.toString()}`);
            setTermDates(res.data);
        } catch (error) {
            console.error('Error fetching term dates:', error);
        } finally {
            setIsFetchingTermDates(false);
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
            if (res.data.quotas || res.data.categories) {
                setQuotas(res.data.quotas || res.data.categories);
            }
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
                    college_code: item.college_code,
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

    const groupedTermDates = React.useMemo(() => {
        const groups = {};

        termDates.forEach(cohort => {
            const collegeKey = cohort.college_code || cohort.college_name || 'No college';
            const courseKey = cohort.course_name || 'No course';
            const batchKey = cohort.batch || 'No batch';
            const groupKey = `${collegeKey}||${courseKey}||${batchKey}`;

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    college_name: cohort.college_name,
                    college_code: cohort.college_code,
                    course_name: cohort.course_name,
                    batch: cohort.batch,
                    years: []
                };
            }

            groups[groupKey].years.push({
                year_of_study: cohort.year_of_study,
                year_label: cohort.year_label,
                categories: cohort.categories
            });
        });

        return Object.values(groups).map(group => {
            group.years.sort((a, b) => a.year_of_study - b.year_of_study);
            const totalRowsCount = group.years.length * 3;

            return {
                ...group,
                totalRowsCount
            };
        }).sort((a, b) => {
            if (a.college_code !== b.college_code) {
                return (a.college_code || '').localeCompare(b.college_code || '');
            }
            if (a.course_name !== b.course_name) {
                return (a.course_name || '').localeCompare(b.course_name || '');
            }
            return (b.batch || '').localeCompare(a.batch || '');
        });
    }, [termDates]);

    // ── Print handler ────────────────────────────────────────────────────
    const handlePrint = () => {
        const filterLabel = [
            calendarFilters.college,
            calendarFilters.course,
            calendarFilters.academicYear ? `AY: ${calendarFilters.academicYear}` : ''
        ].filter(Boolean).join(' · ') || 'All';

        let rowsHtml = '';
        groupedCalendarData.forEach(group => {
            group.years.forEach((yearObj, yearIdx) => {
                yearObj.semesters.forEach((sem, semIdx) => {
                    const isFirstGroup = yearIdx === 0 && semIdx === 0;
                    const isFirstYear  = semIdx === 0;
                    const placeholder  = sem._isPlaceholder;

                    let collegeTd   = '';
                    let courseTd    = '';
                    let batchTd     = '';
                    let yearLabelTd = '';
                    let yearNumTd   = '';

                    if (isFirstGroup) {
                        collegeTd = `<td rowspan="${group.totalSemestersCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;font-weight:600">${group.college_code || '—'}</td>`;
                        courseTd  = `<td rowspan="${group.totalSemestersCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;font-weight:800;color:#000">${group.course_name || '—'}</td>`;
                        batchTd   = `<td rowspan="${group.totalSemestersCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;font-weight:900">${group.batch || '—'}</td>`;
                    }
                    if (isFirstYear) {
                        yearLabelTd = `<td rowspan="${yearObj.semesters.length}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;font-size:10px">${yearObj.year_label || '—'}</td>`;
                        yearNumTd   = `<td rowspan="${yearObj.semesters.length}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;font-weight:700">${yearObj.year_of_study ?? '—'}</td>`;
                    }

                    rowsHtml += `
                        <tr style="${placeholder ? 'opacity:0.55;background:#f9f9f9' : ''}">
                            ${collegeTd}${courseTd}${batchTd}${yearLabelTd}${yearNumTd}
                            <td style="border:1.5px solid #000;padding:5px 8px;text-align:center;font-weight:700">Sem ${sem.semester_number ?? '—'}</td>
                            <td style="border:1.5px solid #000;padding:5px 8px;font-family:monospace;font-size:10px">${placeholder ? '—' : formatSqlDate(sem.start_date)}</td>
                            <td style="border:1.5px solid #000;padding:5px 8px;font-family:monospace;font-size:10px">${placeholder ? '—' : formatSqlDate(sem.end_date)}</td>
                        </tr>`;
                });
            });
        });

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Academic Calendar</title>
<style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 17px; font-weight: 900; text-transform: uppercase; text-align: center; margin: 0; letter-spacing: 1px; }
    h2 { font-size: 12px; font-weight: 700; text-align: center; margin: 3px 0 0; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin: 10px 0 14px; border-top: 2px solid #000; padding-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; }
    th { background: #f0f0f0 !important; border: 1.5px solid #000; padding: 6px 8px; font-weight: 900; text-transform: uppercase; font-size: 10px; text-align: left; }
    td { border: 1.5px solid #000; padding: 5px 8px; font-size: 11px; }
</style>
</head><body>
<h1>Pydah Group of Colleges</h1>
<h2>Academic Calendar</h2>
<div class="meta">
    <span>Filter: <strong>${filterLabel}</strong></span>
    <span>Total Entries: <strong>${groupedCalendarData.reduce((s, g) => s + g.totalSemestersCount, 0)}</strong></span>
</div>
<table>
    <thead><tr>
        <th>College</th><th>Course</th>
        <th style="text-align:center">Batch</th>
        <th style="text-align:center">Academic Year</th>
        <th style="text-align:center">Year</th>
        <th style="text-align:center">Semester</th>
        <th>Start Date</th><th>End Date</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
</table>
</body></html>`;

        printHtmlDocument(html);
    };

    const handlePrintTermDates = () => {
        const filterLabel = [
            calendarFilters.college,
            calendarFilters.course,
            calendarFilters.academicYear ? `AY: ${calendarFilters.academicYear}` : ''
        ].filter(Boolean).join(' · ') || 'All';

        let rowsHtml = '';
        groupedTermDates.forEach(group => {
            group.years.forEach((yearObj, yearIdx) => {
                yearObj.categories.forEach((cat, catIdx) => {
                    const isFirstGroup = yearIdx === 0 && catIdx === 0;
                    const isFirstYear  = catIdx === 0;

                    let collegeTd   = '';
                    let courseTd    = '';
                    let batchTd     = '';
                    let yearNumTd   = '';

                    if (isFirstGroup) {
                        collegeTd = `<td rowspan="${group.totalRowsCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;font-weight:600">${group.college_code || '—'}</td>`;
                        courseTd  = `<td rowspan="${group.totalRowsCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;font-weight:800;color:#000">${group.course_name || '—'}</td>`;
                        batchTd   = `<td rowspan="${group.totalRowsCount}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;font-weight:900">${group.batch || '—'}</td>`;
                    }
                    if (isFirstYear) {
                        yearNumTd   = `<td rowspan="${yearObj.categories.length}" style="border:1.5px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;font-weight:700">${yearObj.year_of_study ?? '—'}</td>`;
                    }

                    const getTermText = (termNum) => {
                        const tObj = cat.terms.find(t => Number(t.termNumber) === termNum);
                        if (!tObj) return '—';
                        return tObj.dateText || '—';
                    };

                    rowsHtml += `
                        <tr>
                            ${collegeTd}${courseTd}${batchTd}${yearNumTd}
                            <td style="border:1.5px solid #000;padding:5px 8px;font-size:10px;font-weight:600">${cat.categoryName || '—'}</td>
                            <td style="border:1.5px solid #000;padding:5px 8px;font-family:monospace;font-size:10px;text-align:center">${getTermText(1)}</td>
                            <td style="border:1.5px solid #000;padding:5px 8px;font-family:monospace;font-size:10px;text-align:center">${getTermText(2)}</td>
                            <td style="border:1.5px solid #000;padding:5px 8px;font-family:monospace;font-size:10px;text-align:center">${getTermText(3)}</td>
                        </tr>`;
                });
            });
        });

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Term Dues Calendar</title>
<style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 17px; font-weight: 900; text-transform: uppercase; text-align: center; margin: 0; letter-spacing: 1px; }
    h2 { font-size: 12px; font-weight: 700; text-align: center; margin: 3px 0 0; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin: 10px 0 14px; border-top: 2px solid #000; padding-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; }
    th { background: #f0f0f0 !important; border: 1.5px solid #000; padding: 6px 8px; font-weight: 900; text-transform: uppercase; font-size: 10px; text-align: left; }
    td { border: 1.5px solid #000; padding: 5px 8px; font-size: 11px; }
</style>
</head><body>
<h1>Pydah Group of Colleges</h1>
<h2>Term Dues Calendar</h2>
<div class="meta">
    <span>Filter: <strong>${filterLabel}</strong></span>
    <span>Total Entries: <strong>${groupedTermDates.length > 0 ? groupedTermDates.reduce((s, g) => s + g.totalRowsCount, 0) : 0}</strong></span>
</div>
<table>
    <thead><tr>
        <th>College Code</th><th>Course</th>
        <th style="text-align:center">Batch</th>
        <th style="text-align:center">Year</th>
        <th>Category</th>
        <th style="text-align:center">Term 1</th>
        <th style="text-align:center">Term 2</th>
        <th style="text-align:center">Term 3</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
</table>
</body></html>`;

        printHtmlDocument(html);
    };

    // ════════════════════════════════════════════════════════════════════
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
                    <div className="flex items-center gap-3 shrink-0">
                        {activeTab === 'calendar' && (
                            <>
                                <button
                                    onClick={handlePrint}
                                    disabled={groupedCalendarData.length === 0}
                                    className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-slate-200 transition-all text-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <Printer size={16} /> Print
                                </button>
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 transition-all text-sm cursor-pointer"
                                >
                                    <Plus size={18} /> Add New Entry
                                </button>
                            </>
                        )}
                        {activeTab === 'term-dates' && (
                            <button
                                onClick={handlePrintTermDates}
                                disabled={groupedTermDates.length === 0}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-slate-200 transition-all text-sm disabled:opacity-50 cursor-pointer"
                            >
                                <Printer size={16} /> Print
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-6 pt-2 flex flex-col">
                    {/* Tabs bar */}
                    <div className="flex border-b border-gray-200 mb-4 shrink-0 bg-white rounded-lg p-1 shadow-xs gap-2">
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`px-4 py-2 text-xs font-bold transition-all rounded-lg cursor-pointer ${
                                activeTab === 'calendar'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            Semester Calendars
                        </button>
                        <button
                            onClick={() => setActiveTab('term-dates')}
                            className={`px-4 py-2 text-xs font-bold transition-all rounded-lg cursor-pointer ${
                                activeTab === 'term-dates'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            Term Dues Calendar
                        </button>
                    </div>

                    {/* Table Filters Bar matching Fee Structures page */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-[1.2fr_1.1fr_1.1fr_1.1fr_auto_auto] gap-3 items-end shadow-xs shrink-0">
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

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Quota</label>
                            <select 
                                className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                value={calendarFilters.quota} 
                                onChange={e => setCalendarFilters({ ...calendarFilters, quota: e.target.value })}
                            >
                                <option value="">All Quotas</option>
                                {quotas.map(q => <option key={q} value={q}>{q}</option>)}
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
                            {(calendarFilters.college || calendarFilters.academicYear !== getCurrentAcademicYear() || calendarFilters.course || calendarFilters.quota) ? (
                                <button
                                    type="button"
                                    onClick={() => setCalendarFilters({ college: '', academicYear: getCurrentAcademicYear(), course: '', quota: '' })}
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
                                {activeTab === 'calendar' ? (
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
                                                                                    ? <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold text-[11px]">{yearObj.year_of_study}</span>
                                                                                    : <span className="text-gray-300 italic text-[11px]">—</span>
                                                                                }
                                                                            </td>
                                                                        </>
                                                                    )}

                                                                    <td className="px-4 py-3 text-center border-r border-gray-100 font-bold bg-blue-50/5 text-blue-900">
                                                                        Sem {semItem.semester_number || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-bold text-gray-800 border-r border-gray-100">
                                                                        {semItem.start_date ? formatSqlDate(semItem.start_date) : <span className="text-gray-300 font-normal italic">Not set</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-medium text-gray-600 border-r border-gray-100">
                                                                        {semItem.end_date ? formatSqlDate(semItem.end_date) : <span className="text-gray-300 font-normal italic">Not set</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        {semItem._isPlaceholder ? (
                                                                            <div className="flex justify-end">
                                                                                <button 
                                                                                    onClick={() => handleOpenModal(semItem)}
                                                                                    className="p-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all flex items-center gap-1 font-bold text-[10px]"
                                                                                    title="Initialize semester dates"
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
                                ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-20 shadow-xs">
                                            <tr>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">College Code</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Course</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Batch</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Year</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider">Category</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Term 1</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Term 2</th>
                                                <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-center">Term 3</th>
                                                {/* <th className="px-4 py-3.5 font-bold uppercase text-gray-600 tracking-wider text-right">Actions</th> */}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {isFetchingTermDates ? (
                                                Array.from({ length: 5 }).map((_, idx) => (
                                                    <tr key={idx} className="animate-pulse">
                                                        <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                                        <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                                        <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                                        <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                                                        <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                                                        <td className="px-4 py-4 text-center"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                                        <td className="px-4 py-4 text-center"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                                        <td className="px-4 py-4 text-center"><div className="h-4 bg-slate-100 rounded w-16 mx-auto"></div></td>
                                                    </tr>
                                                ))
                                            ) : groupedTermDates.length > 0 ? (
                                                groupedTermDates.map((group, groupIdx) => {
                                                    return group.years.map((yearObj, yearIdx) => {
                                                        return yearObj.categories.map((cat, catIdx) => {
                                                            const isFirstInGroup = yearIdx === 0 && catIdx === 0;
                                                            const isFirstInYear = catIdx === 0;

                                                            const getTermText = (termNum) => {
                                                                const tObj = cat.terms.find(t => Number(t.termNumber) === termNum);
                                                                if (!tObj) return '—';
                                                                return tObj.dateText || '—';
                                                            };

                                                            return (
                                                                <tr 
                                                                    key={`${group.college_name}-${group.course_name}-${group.batch}-${yearObj.year_of_study}-${cat.categoryName}`}
                                                                    className="hover:bg-gray-50/80 transition-colors text-xs border-b border-gray-100"
                                                                >
                                                                    {isFirstInGroup && (
                                                                        <>
                                                                            <td 
                                                                                rowSpan={group.totalRowsCount} 
                                                                                className="px-4 py-3 text-gray-700 font-bold align-middle border-r border-gray-100 bg-white"
                                                                            >
                                                                                {group.college_code || <span className="text-gray-400 italic">No college</span>}
                                                                            </td>
                                                                            <td 
                                                                                rowSpan={group.totalRowsCount} 
                                                                                className="px-4 py-3 font-semibold text-blue-800 align-middle border-r border-gray-100 bg-white"
                                                                            >
                                                                                {group.course_name}
                                                                            </td>
                                                                            <td 
                                                                                rowSpan={group.totalRowsCount} 
                                                                                className="px-4 py-3 font-bold text-gray-900 align-middle border-r border-gray-100 bg-white text-center"
                                                                            >
                                                                                {group.batch || '—'}
                                                                            </td>
                                                                        </>
                                                                    )}

                                                                    {isFirstInYear && (
                                                                        <td 
                                                                            rowSpan={3} 
                                                                            className="px-4 py-3 align-middle border-r border-gray-100 bg-white text-center"
                                                                        >
                                                                            {yearObj.year_of_study != null
                                                                                ? <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold text-[11px]">{yearObj.year_of_study}</span>
                                                                                : <span className="text-gray-300 italic text-[11px]">—</span>
                                                                            }
                                                                        </td>
                                                                    )}

                                                                    <td className="px-4 py-3 text-gray-700 font-semibold border-r border-gray-100">
                                                                        {cat.categoryName || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-600 font-medium bg-blue-50/5">
                                                                        {getTermText(1)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-600 font-medium bg-blue-50/5">
                                                                        {getTermText(2)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-gray-600 font-medium bg-blue-50/5">
                                                                        {getTermText(3)}
                                                                    </td>
                                                                    {/* <td className="px-4 py-3 text-right">
                                                                        <button 
                                                                            onClick={() => handleOpenTermEditModal(group, yearObj, cat)}
                                                                            className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                                                            title="Edit Term Dates"
                                                                        >
                                                                            <Pencil size={15} />
                                                                        </button>
                                                                    </td> */}
                                                                </tr>
                                                            );
                                                        });
                                                    });
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="8" className="px-6 py-16 text-center text-gray-400 italic">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <Calendar size={36} className="text-gray-300" />
                                                            <span>No term dates found. Make sure academic calendar semesters are configured.</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
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

                {/* Term Dates Edit Modal */}
                {isTermModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">
                                        Edit Term Due Dates
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                                        {editingTermCohort?.course} ({editingTermCohort?.batch}) - Year {editingTermCohort?.year_of_study}
                                    </p>
                                    <p className="text-[10px] text-indigo-600 font-semibold uppercase mt-0.5">
                                        {editingTermCohort?.categoryName}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsTermModalOpen(false)}
                                    className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm border border-transparent hover:border-slate-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-1 gap-5">
                                    {termFormDates.map((tf, index) => (
                                        <div key={tf.termNumber} className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">
                                                Term {tf.termNumber} Due Date
                                            </label>
                                            <input 
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                value={tf.rawDate}
                                                onChange={(e) => {
                                                    const updated = [...termFormDates];
                                                    updated[index].rawDate = e.target.value;
                                                    setTermFormDates(updated);
                                                }}
                                            />
                                        </div>
                                    ))}
                                    {termFormDates.length === 0 && (
                                        <p className="text-xs text-slate-400 italic text-center py-4">
                                            No terms configured for this category.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                                <button 
                                    onClick={() => setIsTermModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white transition-all text-sm cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleTermDatesSave}
                                    disabled={isSavingTerms}
                                    className="flex-[2] py-3 px-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:shadow-none cursor-pointer"
                                >
                                    {isSavingTerms ? (
                                        <><Loader2 size={18} className="animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save size={18} /> Save Dates</>
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
