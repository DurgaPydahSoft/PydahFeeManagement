import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import axios from 'axios';
import { Filter, Download, ArrowRight, DollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

const DueReports = () => {
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [batches, setBatches] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        college: '',
        course: '',
        branch: '',
        batch: ''
    });

    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Search & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [expandedRow, setExpandedRow] = useState(null);

    const toggleRow = (admissionNumber) => {
        setExpandedRow(prev => prev === admissionNumber ? null : admissionNumber);
    };

    // Fetch Metadata on Load
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
                const meta = response.data.hierarchy || response.data;
                const batchList = response.data.batches || [];
                setMetadata(meta);
                setBatches(batchList);
                setColleges(Object.keys(meta));
            } catch (error) {
                console.error('Error fetching metadata', error);
            }
        };
        fetchMetadata();
    }, []);

    // Handle Dependable Dropdowns
    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFilters({ ...filters, college, course: '', branch: '', batch: '' });
        setCourses(college ? Object.keys(metadata[college] || {}) : []);
        setBranches([]);
    };

    const handleCourseChange = (e) => {
        const course = e.target.value;
        const newFilters = { ...filters, course, branch: '', batch: '' };

        if (course && filters.college) {
            const courseData = metadata[filters.college][course];
            setBranches(courseData?.branches || []);
        } else {
            setBranches([]);
        }
        setFilters(newFilters);
    };

    const fetchReport = async () => {
        // Validation: Must have either full filters OR a search term
        const hasFilters = filters.college && filters.course && filters.branch && filters.batch;
        const hasSearch = searchTerm.trim().length > 0;

        if (!hasFilters && !hasSearch) {
            alert('Please select all filters or enter a search term.');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setCurrentPage(1); // Reset page on new fetch
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/reports/dues`, {
                params: { ...filters, search: searchTerm }
            });
            setReportData(response.data);
        } catch (error) {
            console.error('Error fetching due report:', error);
            alert('Failed to fetch report');
        } finally {
            setLoading(false);
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

    // Filter Logic - Now Server Side, so we just use reportData
    const filteredData = reportData;

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalDue = filteredData.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);
    const totalCollected = filteredData.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shrink-0">
                    <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <DollarSign className="text-gray-500" size={18} /> Student Due Reports
                    </h1>
                    <div className="text-xs text-gray-500">
                        {reportData.length > 0 ? (
                            <span className="flex gap-4">
                                <span>Total Paid: <b className="text-green-600">₹{totalCollected.toLocaleString()}</b></span>
                                <span>Total Due: <b className="text-red-600">₹{totalDue.toLocaleString()}</b></span>
                            </span>
                        ) : (
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-200 animate-pulse">
                                Set filters or search to show results
                            </span>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-[1600px] mx-auto space-y-4">

                        {/* Control Bar: Filters & Search */}
                        <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
                            <div className="flex flex-col xl:flex-row gap-3 items-end">
                                {/* Filters Group */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full xl:w-auto flex-1">
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                        value={filters.college}
                                        onChange={handleCollegeChange}
                                    >
                                        <option value="">Select College</option>
                                        {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                        value={filters.course}
                                        onChange={handleCourseChange}
                                        disabled={!filters.college}
                                    >
                                        <option value="">Course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                        value={filters.batch}
                                        onChange={e => setFilters({ ...filters, batch: e.target.value })}
                                    >
                                        <option value="">Batch</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                        value={filters.branch}
                                        onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                        disabled={!filters.course}
                                    >
                                        <option value="">Branch</option>
                                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                {/* Actions Group */}
                                <div className="flex items-center gap-2 w-full xl:w-auto">
                                    <button
                                        onClick={fetchReport}
                                        disabled={loading}
                                        className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded text-xs px-4 py-2 transition flex items-center justify-center gap-2 whitespace-nowrap"
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
                                            <th className="p-2 w-24">Pin No</th>
                                            <th className="p-2">Name / Admission No</th>
                                            <th className="p-2 text-right">Total Fee</th>
                                            <th className="p-2 text-right">Paid</th>
                                            <th className="p-2 text-right">Due</th>
                                            <th className="p-2 text-center w-24">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loading ? (
                                            <tr><td colSpan="7" className="text-center py-20 text-gray-500 italic">Processing data...</td></tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-32">
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
                                                            <td className="p-2">
                                                                <div className="font-medium text-gray-900">{student.student_name}</div>
                                                                <div className="text-[10px] text-gray-500">{student.admission_number}</div>
                                                            </td>
                                                            <td className="p-2 text-right text-gray-600">₹{(student.totalFee || 0).toLocaleString()}</td>
                                                            <td className="p-2 text-right text-green-600">₹{(student.paidAmount || 0).toLocaleString()}</td>
                                                            <td className="p-2 text-right font-bold text-red-600">₹{due.toLocaleString()}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status === 'CLEARED' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                                    {status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan="7" className="p-4 border-b border-gray-200">
                                                                    <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
                                                                        {/* <h4 className="text-xs font-bold text-gray-700 uppercase mb-3">Fee Breakdown</h4> */}
                                                                        <table className="w-full text-xs">
                                                                            <thead>
                                                                                <tr className="text-gray-500 border-b border-gray-100">
                                                                                    <th className="text-left pb-2 font-medium">Type of Fee</th>
                                                                                    <th className="text-right pb-2 font-medium">Total</th>
                                                                                    <th className="text-right pb-2 font-medium">Paid</th>
                                                                                    <th className="text-right pb-2 font-medium">Due</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {student.feeDetailsArray && student.feeDetailsArray.map((detail, dIdx) => (
                                                                                    <tr key={dIdx}>
                                                                                        <td className="py-2 text-gray-800 font-medium">{detail.headName}</td>
                                                                                        <td className="py-2 text-right text-gray-600">₹{(detail.total || 0).toLocaleString()}</td>
                                                                                        <td className="py-2 text-right text-green-600">₹{(detail.paid || 0).toLocaleString()}</td>
                                                                                        <td className="py-2 text-right text-red-600 font-bold">₹{((detail.total || 0) - (detail.paid || 0)).toLocaleString()}</td>
                                                                                    </tr>
                                                                                ))}
                                                                                {(!student.feeDetailsArray || student.feeDetailsArray.length === 0) && (
                                                                                    <tr><td colSpan="4" className="py-2 text-center text-gray-400">No detailed fee breakdown available.</td></tr>
                                                                                )}
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
                </main>
            </div>
        </div>
    );
};

export default DueReports;
