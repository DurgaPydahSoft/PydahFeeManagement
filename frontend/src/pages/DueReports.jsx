import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Filter, Download, ArrowRight, DollarSign, Search, ChevronLeft, ChevronRight, FileText, Printer, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCampuses, getCollegeNamesForCampuses } from '../hooks/useCampuses';
import { printHtmlDocument } from '../utils/printService';

const DueReports = () => {
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [batches, setBatches] = useState([]);
    const [quotas, setQuotas] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');

    // Generate Academic Years (current year ± 6 years)
    const generateAcademicYears = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        
        // Start from 6 years before current year
        for (let i = currentYear - 6; i <= currentYear + 6; i++) {
            years.push(`${i}-${i + 1}`);
        }
        
        return years.sort((a, b) => {
            const yearA = parseInt(a.split('-')[0]);
            const yearB = parseInt(b.split('-')[0]);
            return yearB - yearA; // Descending order (latest first)
        });
    };

    // Get current academic year
    const getCurrentAcademicYear = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const month = now.getMonth(); // 0-11
        
        // If current month is June or later, the academic year started this year
        // If current month is May or earlier, the academic year started last year
        if (month >= 5) { // June onwards (month 5 onwards)
            return `${currentYear}-${currentYear + 1}`;
        } else {
            return `${currentYear - 1}-${currentYear}`;
        }
    };

    // Filters
    const [filters, setFilters] = useState({
        campusId: 'all',
        college: '',
        course: '',
        branch: '',
        batch: '',
        quota: '',
        year: ''
    });
    const [sortField, setSortField] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    
    const [courseYears, setCourseYears] = useState({});
    const [availableYears, setAvailableYears] = useState([]);

    // Top filters
    const [topFilters, setTopFilters] = useState({
        campusId: 'all',
        batch: ''
    });

    const { campuses } = useCampuses();

    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Search & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [expandedRow, setExpandedRow] = useState(null);

    const maxTerms = React.useMemo(() => {
        if (!reportData || reportData.length === 0) return 1;
        const counts = reportData.map(st => st.termDues?.length || 0);
        return Math.max(1, ...counts);
    }, [reportData]);

    // Print Options Modal State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [includePrintDetails, setIncludePrintDetails] = useState(false);

    const toggleRow = (admissionNumber) => {
        setExpandedRow(prev => prev === admissionNumber ? null : admissionNumber);
    };

    // Fetch Metadata on Load
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const response = await api.get(`/students/metadata`);
                const meta = response.data.hierarchy || response.data;
                const batchList = response.data.batches || [];
                const quotaList = response.data.quotas || response.data.categories || [];
                const courseYearsData = response.data.courseYears || {};
                
                setMetadata(meta);
                setBatches(batchList);
                setQuotas(quotaList || []);
                setCourseYears(courseYearsData);
                setColleges(Object.keys(meta));
                
                // Generate academic years on load
                const years = generateAcademicYears();
                setAcademicYears(years);
                
                // Set current academic year by default
                const currentYear = getCurrentAcademicYear();
                setCurrentAcademicYear(currentYear);
                setTopFilters(prev => ({ ...prev, batch: currentYear }));
                setFilters(prev => ({ ...prev, batch: currentYear }));
                
                console.log('Metadata loaded:', { batches: batchList, quotas: quotaList, courseYears: courseYearsData, currentAcademicYear: currentYear });
            } catch (error) {
                console.error('Error fetching metadata', error);
                // Generate academic years even if metadata fails
                const years = generateAcademicYears();
                setAcademicYears(years);
                const currentYear = getCurrentAcademicYear();
                setCurrentAcademicYear(currentYear);
                setTopFilters(prev => ({ ...prev, batch: currentYear }));
                setFilters(prev => ({ ...prev, batch: currentYear }));
            }
        };
        fetchMetadata();
    }, []);

    // Handle Dependable Dropdowns
    const handleTopCampusChange = (e) => {
        const campusId = e.target.value;
        setTopFilters({ campusId, batch: '' });
        setFilters({ campusId, college: '', course: '', branch: '', batch: '', quota: '', year: '' });
        if (campusId === 'all') {
            setColleges(Object.keys(metadata));
        } else {
            const campusCollegeNames = getCollegeNamesForCampuses(campuses, [Number(campusId)]);
            setColleges(campusCollegeNames.filter((c) => metadata[c]));
        }
        setCourses([]);
        setBranches([]);
        setAvailableYears([]);
    };

    const handleTopBatchChange = (e) => {
        const batch = e.target.value;
        setTopFilters({ ...topFilters, batch });
        setFilters({ ...filters, batch });
    };

    const handleCampusChange = (e) => {
        const campusId = e.target.value;
        setFilters({ campusId, college: '', course: '', branch: '', batch: topFilters.batch, quota: '', year: '' });
        if (campusId === 'all') {
            setColleges(Object.keys(metadata));
        } else {
            const campusCollegeNames = getCollegeNamesForCampuses(campuses, [Number(campusId)]);
            setColleges(campusCollegeNames.filter((c) => metadata[c]));
        }
        setCourses([]);
        setBranches([]);
        setAvailableYears([]);
    };

    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFilters({ ...filters, college, course: '', branch: '', quota: '', year: '' });
        setCourses(college ? Object.keys(metadata[college] || {}) : []);
        setBranches([]);
        setAvailableYears([]);
    };

    const handleCourseChange = (e) => {
        const course = e.target.value;
        const newFilters = { ...filters, course, branch: '', quota: '', year: '' };

        if (course && filters.college) {
            const courseData = metadata[filters.college][course];
            setBranches(courseData?.branches || []);
            
            // Populate available years from courseYears metadata
            if (courseYears[course]) {
                const duration = courseYears[course];
                // Convert number to array of years: e.g., 4 -> ['1st Year', '2nd Year', '3rd Year', '4th Year']
                const years = [];
                if (typeof duration === 'number') {
                    for (let i = 1; i <= duration; i++) {
                        const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
                        years.push(`${i}${suffix} Year`);
                    }
                }
                setAvailableYears(years);
            } else {
                setAvailableYears([]);
            }
        } else {
            setBranches([]);
            setAvailableYears([]);
        }
        setFilters(newFilters);
    };

    const fetchReport = async () => {
        // Validation: Must have core filters OR a search term
        // Required: college, course
        // Optional: branch, batch, year, quota
        const hasFilters = filters.college && filters.course;
        const hasSearch = searchTerm.trim().length > 0;

        if (!hasFilters && !hasSearch) {
            alert('Please select filters (College, Course) or enter a search term.');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setCurrentPage(1); // Reset page on new fetch
        try {
            const params = {
                college: filters.college,
                course: filters.course,
                branch: filters.branch,
                batch: filters.batch,
                year: filters.year,
                search: searchTerm,
                ...(filters.campusId !== 'all' ? { campusId: filters.campusId } : {}),
                // Only add quota if it's selected (not empty)
                ...(filters.quota ? { quota: filters.quota } : {})
            };
            
            const response = await api.get(`/reports/dues`, { params });
            setReportData(response.data);
        } catch (error) {
            console.error('Error fetching due report:', error);
            alert('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const handleOverallPrint = async (includeDetails = false) => {
        if (!reportData || reportData.length === 0) return;
        try {
            const response = await api.post('/print', {
                template: 'due-report',
                data: {
                    type: 'overall',
                    reportData,
                    includeDetails,
                    filters: {
                        college: filters.college,
                        course: filters.course,
                        branch: filters.branch,
                        year: filters.year,
                        quota: filters.quota,
                        batch: filters.batch || topFilters.batch,
                        campusId: filters.campusId !== 'all' ? filters.campusId : topFilters.campusId
                    },
                    summary: {
                        totalStudents: reportData.length,
                        totalFee: reportData.reduce((sum, s) => sum + Number(s.totalFee || 0), 0),
                        totalCollected: reportData.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0),
                        totalDue: reportData.reduce((sum, s) => sum + Number(s.dueAmount || 0), 0),
                    }
                }
            });
            printHtmlDocument(response.data);
            setShowPrintModal(false);
        } catch (err) {
            console.error('Failed to print overall due report:', err);
            alert('Failed to print report.');
        }
    };

    const handlePrintIndividual = async (student) => {
        try {
            const response = await api.post('/print', {
                template: 'due-report',
                data: {
                    type: 'individual',
                    student: {
                        ...student,
                        college: student.college || filters.college || '',
                        course: student.course || filters.course || '',
                        branch: student.branch || filters.branch || '',
                        year: student.year || filters.year || '',
                    }
                }
            });
            printHtmlDocument(response.data);
        } catch (err) {
            console.error('Failed to print individual due report:', err);
            alert('Failed to print statement.');
        }
    };

    const exportToExcel = () => {
        if (!reportData || reportData.length === 0) return;

        // 1. Identify all Unique Fee Heads dynamically
        const allFeeHeads = new Set();
        reportData.forEach(r => {
            if (r.feeDetailsArray) {
                r.feeDetailsArray.forEach(d => allFeeHeads.add(d.headName));
            }
        });
        const feeHeadsList = Array.from(allFeeHeads).sort();

        // 2. Define Static Columns
        const staticHeaders = [
            "Admission No", "Pin No", "Student Name", "Course", "Branch", "Year", "Phone",
            "Overall Total", "Overall Paid", "Overall Due"
        ];

        // 3. Build Header Rows (Row 1: Main Headers, Row 2: Sub Headers)
        const headerRow1 = [...staticHeaders];
        const headerRow2 = staticHeaders.map(() => ""); // Placeholders for static columns

        // Appending Fee Head Headers
        feeHeadsList.forEach(head => {
            headerRow1.push(head, "", ""); // Push head name and 2 empty slots for merge
            headerRow2.push("Total", "Paid", "Due");
        });

        // 4. Build Data Rows
        const dataRows = reportData.map(r => {
            const row = [
                r.admission_number,
                r.pin_no,
                r.student_name,
                r.course,
                r.branch,
                r.current_year,
                r.student_mobile,
                r.totalFee,
                r.paidAmount,
                r.dueAmount
            ];

            // Fill dynamic columns matching the sorted feeHeadsList
            feeHeadsList.forEach(head => {
                const detail = r.feeDetailsArray?.find(d => d.headName === head);
                if (detail) {
                    row.push(detail.total || 0, detail.paid || 0, detail.due || 0);
                } else {
                    row.push(0, 0, 0); // No record for this fee head
                }
            });
            return row;
        });

        // 5. Construct Worksheet Data
        const wsData = [headerRow1, headerRow2, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 6. Apply Cell Merges
        const merges = [];

        // Vertical merges for static columns (spanning Row 0 and Row 1)
        for (let i = 0; i < staticHeaders.length; i++) {
            merges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
        }

        // Horizontal merges for Fee Head groupings (Row 0)
        let colIdx = staticHeaders.length;
        feeHeadsList.forEach(() => {
            merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + 2 } });
            colIdx += 3;
        });

        ws['!merges'] = merges;

        // 7. Write File
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DueReport");
        XLSX.writeFile(wb, `DueReport_${filters.college || 'Search'}_${filters.batch || 'All'}.xlsx`);
    };

    // Sorting logic
    const sortedData = React.useMemo(() => {
        if (!sortField) return reportData;
        return [...reportData].sort((a, b) => {
            let valA = (sortField === 'dueAmount' || sortField === 'activeDue') ? (a[sortField] || 0) : (a[sortField] || '');
            let valB = (sortField === 'dueAmount' || sortField === 'activeDue') ? (b[sortField] || 0) : (b[sortField] || '');

            if (typeof valA === 'string') {
                return sortDir === 'asc'
                    ? String(valA).localeCompare(String(valB))
                    : String(valB).localeCompare(String(valA));
            }
            return sortDir === 'asc'
                ? (Number(valA) > Number(valB) ? 1 : -1)
                : (Number(valB) > Number(valA) ? 1 : -1);
        });
    }, [reportData, sortField, sortDir]);

    // Filter Logic - Now Server Side, so we just use reportData
    const filteredData = sortedData;

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalDue = filteredData.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);
    const totalCollected = filteredData.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const totalActiveDue = filteredData.reduce((acc, curr) => acc + (curr.activeDue || 0), 0);
    const totalFee = filteredData.reduce((acc, curr) => acc + (curr.totalFee || 0), 0);
    const totalStudents = filteredData.length;

    const termBalances = React.useMemo(() => {
        const totals = Array.from({ length: maxTerms }, () => 0);
        filteredData.forEach(student => {
            (student.termDues || []).forEach((due, idx) => {
                if (idx < maxTerms) {
                    totals[idx] += (due || 0);
                }
            });
        });
        return totals;
    }, [filteredData, maxTerms]);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="text-gray-800" size={24} /> Student Due Reports
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">View pending fees and generate reports.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                            {/* Top Right Filters */}
                            <select
                                className="bg-white border border-gray-200 text-gray-900 text-xs rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent block px-3 py-2 shadow-sm font-semibold"
                                value={topFilters.campusId}
                                onChange={handleTopCampusChange}
                            >
                                <option value="all">All Campuses</option>
                                {campuses.map((campus) => (
                                    <option key={campus.id} value={campus.id}>{campus.name}</option>
                                ))}
                            </select>
                            <select
                                className="bg-white border border-gray-200 text-gray-900 text-xs rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent block px-3 py-2 shadow-sm font-semibold"
                                value={topFilters.batch}
                                onChange={handleTopBatchChange}
                            >
                                <option value="">All Academic Years</option>
                                {academicYears.map(year => (
                                    <option key={year} value={year}>
                                        {year} {currentAcademicYear === year ? '(Current)' : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowPrintModal(true)}
                                disabled={reportData.length === 0 || loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-xs px-4 py-2 shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap h-full sm:h-9"
                                title="Print Overall Report"
                            >
                                <Printer size={14} /> Print Report
                            </button>
                        </div>
                    </header>
                    <div className="max-w-[1600px] mx-auto space-y-4">

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase font-semibold">Total Students</p>
                                        <p className="text-2xl font-bold text-gray-900 mt-1">{totalStudents}</p>
                                    </div>
                                    <div className="bg-blue-100 p-3 rounded-lg">
                                        <FileText className="text-blue-600" size={24} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase font-semibold">Total Fee</p>
                                        <p className="text-2xl font-bold text-gray-900 mt-1">₹{(totalFee / 100000).toFixed(1)}L</p>
                                        <p className="text-[10px] text-gray-500 mt-1">₹{totalFee.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-purple-100 p-3 rounded-lg">
                                        <DollarSign className="text-purple-600" size={24} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase font-semibold">Active Due</p>
                                        <p className="text-2xl font-bold text-amber-600 mt-1">₹{(totalActiveDue / 100000).toFixed(1)}L</p>
                                        <p className="text-[10px] text-gray-500 mt-1">₹{totalActiveDue.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-amber-100 p-3 rounded-lg">
                                        <DollarSign className="text-amber-600" size={24} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase font-semibold">Total Due</p>
                                        <p className="text-2xl font-bold text-red-600 mt-1">₹{(totalDue / 100000).toFixed(1)}L</p>
                                        <p className="text-[10px] text-gray-500 mt-1">₹{totalDue.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-red-100 p-3 rounded-lg">
                                        <DollarSign className="text-red-600" size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Term-wise Outstanding Balances Stats Bar */}
                        {maxTerms > 0 && (
                            <div className="bg-blue-50/20 border border-blue-100/50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {termBalances.map((bal, idx) => (
                                    <div key={idx} className="bg-white border border-gray-150 rounded p-2 text-center shadow-xs">
                                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">T{idx + 1} Balance</span>
                                        <span className="block text-sm font-bold text-gray-800 mt-0.5">₹{bal.toLocaleString('en-IN')}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Control Bar: Filters & Search */}
                        <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
                            <div className="flex flex-col xl:flex-row gap-3 items-end">
                                {/* Filters Group */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full xl:w-auto flex-1">
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-semibold"
                                        value={filters.college}
                                        onChange={handleCollegeChange}
                                    >
                                        <option value="">Select College</option>
                                        {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={filters.course}
                                        onChange={handleCourseChange}
                                        disabled={!filters.college}
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={filters.branch}
                                        onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                        disabled={!filters.course}
                                    >
                                        <option value="">Select Branch</option>
                                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={filters.year}
                                        onChange={e => setFilters({ ...filters, year: e.target.value })}
                                        disabled={!filters.course || availableYears.length === 0}
                                    >
                                        <option value="">Select Year/Semester</option>
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-semibold"
                                        value={filters.quota}
                                        onChange={e => setFilters({ ...filters, quota: e.target.value })}
                                    >
                                        <option value="">All Quotas</option>
                                        {Array.isArray(quotas) && quotas.length > 0 ? (
                                            quotas.map(q => <option key={q} value={q}>{q}</option>)
                                        ) : (
                                            <option disabled>No quotas available</option>
                                        )}
                                    </select>
                                </div>

                                {/* Actions Group */}
                                <div className="flex items-center gap-2 w-full xl:w-auto">
                                    <button
                                        onClick={fetchReport}
                                        disabled={loading}
                                        className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded text-xs px-4 py-2.5 transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                                    >
                                        {loading ? '...' : 'Get Data'}
                                    </button>

                                    <div className="w-px h-8 bg-gray-200 mx-1 hidden xl:block"></div>

                                    <div className="relative flex-1 xl:w-64 flex gap-2">
                                        {/* Items Per Page */}
                                        <select
                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-16 p-2"
                                            value={itemsPerPage}
                                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                            title="Rows per page"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>

                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                                <Search size={14} className="text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full pl-8 p-2"
                                                placeholder="Quick Search (Enter to fetch)..."
                                                value={searchTerm}
                                                onChange={e => { setSearchTerm(e.target.value); }}
                                                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={exportToExcel}
                                        disabled={reportData.length === 0}
                                        className="text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 font-medium rounded text-xs px-3 py-2 transition flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50"
                                        title="Export to Excel"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="p-2 w-10 text-center">#</th>
                                            <th 
                                                className="p-2 w-28 cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'pin_no' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('pin_no');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Pin No {sortField === 'pin_no' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            <th 
                                                className="p-2 w-36 cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'admission_number' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('admission_number');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Admission No {sortField === 'admission_number' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            <th 
                                                className="p-2 cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'student_name' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('student_name');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Name {sortField === 'student_name' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            <th 
                                                className="p-2 text-right cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'totalFee' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('totalFee');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Total Fee {sortField === 'totalFee' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            {/* Dynamic Term Headers */}
                                            {Array.from({ length: maxTerms }).map((_, i) => (
                                                <th key={i} className="p-2 text-right text-gray-500 font-semibold bg-blue-50/15 w-24">
                                                    T{i + 1} Due
                                                </th>
                                            ))}
                                            <th 
                                                className="p-2 text-right cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'activeDue' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('activeDue');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Active Due {sortField === 'activeDue' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            <th 
                                                className="p-2 text-right cursor-pointer select-none hover:bg-gray-100 transition"
                                                onClick={() => {
                                                    const dir = (sortField === 'dueAmount' && sortDir === 'asc') ? 'desc' : 'asc';
                                                    setSortField('dueAmount');
                                                    setSortDir(dir);
                                                }}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Due {sortField === 'dueAmount' && (sortDir === 'asc' ? '▲' : '▼')}
                                                </div>
                                            </th>
                                            <th className="p-2 text-center w-24">Status</th>
                                            <th className="p-2 text-center w-16">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr><td colSpan={9 + maxTerms} className="text-center py-20 text-gray-500 italic">Processing data...</td></tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan={9 + maxTerms} className="text-center py-32">
                                                    {hasSearched ? (
                                                        <div className="text-gray-500">No records match your search.</div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                                            <Filter size={48} className="text-gray-200 mb-3" />
                                                            <p className="text-lg font-bold text-gray-500">No Data to Display</p>
                                                            <p className="text-sm mt-1">Please select filters or search above to view the report.</p>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedData.map((student, idx) => {
                                                const due = student.dueAmount || 0;
                                                const status = due <= 0 ? 'CLEARED' : 'PENDING';
                                                const isExpanded = expandedRow === student.admission_number;

                                                return (
                                                    <React.Fragment key={student.admission_number}>
                                                        <tr
                                                            className={`hover:bg-blue-50 transition cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                                                            onClick={() => toggleRow(student.admission_number)}
                                                        >
                                                            <td className="p-2 text-center text-gray-400">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                            <td className="p-2 font-mono font-medium text-gray-600">{student.pin_no || '-'}</td>
                                                            <td className="p-2 font-mono text-gray-600">{student.admission_number || '-'}</td>
                                                            <td className="p-2 font-medium text-gray-900">{student.student_name}</td>
                                                            <td className="p-2 text-right text-gray-600">₹{(student.totalFee || 0).toLocaleString('en-IN')}</td>
                                                            {/* Dynamic Term Dues */}
                                                            {Array.from({ length: maxTerms }).map((_, i) => {
                                                                const dueVal = student.termDues?.[i] || 0;
                                                                return (
                                                                    <td key={i} className="p-2 text-right text-gray-700 font-medium bg-blue-50/5">
                                                                        <div className={dueVal > 0 ? "font-bold text-red-600" : "text-gray-400"}>
                                                                            ₹{dueVal.toLocaleString('en-IN')}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-2 text-right text-amber-600 font-bold">₹{(student.activeDue || 0).toLocaleString('en-IN')}</td>
                                                            <td className="p-2 text-right font-bold text-red-600">₹{due.toLocaleString('en-IN')}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status === 'CLEARED' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                                    {status}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handlePrintIndividual(student)}
                                                                    className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition"
                                                                    title="Print Dues Statement"
                                                                >
                                                                    <Printer size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan={9 + maxTerms} className="p-4 border-b border-gray-200">
                                                                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                                                        <table className="w-full text-xs text-left border-collapse">
                                                                            <thead>
                                                                                <tr className="text-gray-500 border-b border-gray-200 text-[10px] uppercase font-bold">
                                                                                    <th className="pb-2">Fee Category</th>
                                                                                    <th className="pb-2 text-right">Total</th>
                                                                                    {Array.from({ length: maxTerms }).map((_, i) => (
                                                                                        <th key={i} className="pb-2 text-right text-gray-500 bg-blue-50/15 w-24">T{i + 1} Due</th>
                                                                                    ))}
                                                                                    <th className="pb-2 text-right">Active Due</th>
                                                                                    <th className="pb-2 text-right">Concession</th>
                                                                                    <th className="pb-2 text-right">Due</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100">
                                                                                {(() => {
                                                                                    const categories = [
                                                                                        { key: 'academic', label: 'Academic Fees' },
                                                                                        { key: 'hostel', label: 'Hostel Fee' },
                                                                                        { key: 'transport', label: 'Transport Fee' }
                                                                                    ].filter(c => student.groupedFeeDetails?.[c.key]);

                                                                                    if (categories.length === 0) {
                                                                                        return <tr><td colSpan={6 + maxTerms} className="text-center py-4 text-gray-400 italic">No breakdown details found.</td></tr>;
                                                                                    }

                                                                                    return categories.map(cat => {
                                                                                        const catData = student.groupedFeeDetails[cat.key];
                                                                                        const catActiveDue = (catData.terms || []).reduce((acc, t) => acc + (t.isActiveTerm ? (t.balance || 0) : 0), 0);
                                                                                        return (
                                                                                            <tr key={cat.key} className="hover:bg-gray-50/50">
                                                                                                <td className="py-2.5 font-bold text-gray-700">{cat.label}</td>
                                                                                                <td className="py-2.5 text-right text-gray-600">₹{catData.total.toLocaleString('en-IN')}</td>
                                                                                                {Array.from({ length: maxTerms }).map((_, i) => {
                                                                                                    const termObj = (catData.terms || []).find(t => Number(t.termNumber) === (i + 1));
                                                                                                    const termBalance = termObj ? (termObj.balance || 0) : 0;
                                                                                                    const termTarget = termObj ? (termObj.termTarget || 0) : 0;
                                                                                                    const termConc = termObj ? (termObj.concessionShare || 0) : 0;
                                                                                                    
                                                                                                    const tDate = termObj?.dueDate ? new Date(termObj.dueDate) : null;
                                                                                                    const fTermDate = tDate && !isNaN(tDate.getTime())
                                                                                                        ? tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                                                                                        : null;

                                                                                                    return (
                                                                                                        <td key={i} className="py-2.5 text-right text-gray-700 bg-blue-50/5">
                                                                                                            <div className={termBalance > 0 ? "font-bold text-red-600" : "text-gray-400"}>
                                                                                                                ₹{termBalance.toLocaleString('en-IN')}
                                                                                                            </div>
                                                                                                            {termTarget > 0 && (
                                                                                                                <div className="text-[9px] text-gray-400 font-normal mt-0.5">
                                                                                                                    Target: ₹{termTarget.toLocaleString('en-IN')}
                                                                                                                    {termConc > 0 && ` (Conc: ₹${termConc.toLocaleString('en-IN')})`}
                                                                                                                </div>
                                                                                                            )}
                                                                                                            {termBalance > 0 && fTermDate && (
                                                                                                                <div className="text-[9px] text-gray-400 font-normal font-mono mt-0.5">{fTermDate}</div>
                                                                                                            )}
                                                                                                        </td>
                                                                                                    );
                                                                                                })}
                                                                                                <td className="py-2.5 text-right text-amber-600 font-bold">₹{catActiveDue.toLocaleString('en-IN')}</td>
                                                                                                <td className="py-2.5 text-right text-purple-600">₹{catData.concession.toLocaleString('en-IN')}</td>
                                                                                                <td className="py-2.5 text-right font-bold text-red-600">₹{catData.due.toLocaleString('en-IN')}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    });
                                                                                })()}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {!loading && filteredData.length > 0 && (
                                <div className="bg-gray-50 border-t border-gray-200 p-2 flex items-center justify-between text-xs">
                                    <span className="text-gray-500">
                                        {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-2 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-2 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Print Options Modal */}
                    {showPrintModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200 relative p-6">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                    <div className="flex items-center gap-2 text-gray-800">
                                        <Printer size={20} className="text-blue-600" />
                                        <h3 className="text-base font-bold">Print Outstanding Dues Report</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowPrintModal(false)}
                                        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={includePrintDetails}
                                                onChange={e => setIncludePrintDetails(e.target.checked)}
                                                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-gray-900 block">Include Detailed Fee Breakdown</span>
                                                <span className="text-[11px] text-gray-500 block mt-0.5">
                                                    Adds a column displaying fee head breakdowns (e.g. TUT:5000, LAB:2000...) for each student.
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    {!filters.year && (
                                        <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                                            Note: Since no specific year filter is selected, records in the print report will be automatically divided by student year.
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setShowPrintModal(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleOverallPrint(includePrintDetails)}
                                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition flex items-center gap-1.5"
                                    >
                                        <Printer size={14} /> Print Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DueReports;
