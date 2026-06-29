import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';
import { Search, Filter, Trash2, Plus, User, Award, ShieldAlert, Check, Eye } from 'lucide-react';

const OverallConcession = () => {
    // Permission Check
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const permissions = user.permissions || [];
    const role = user.role;
    const hasPermission = role === 'superadmin' || role === 'admin' || permissions.includes('/overall-concessions');

    // Dropdown filters metadata
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [batches, setBatches] = useState([]);

    // Filter values
    const [filters, setFilters] = useState({
        college: '',
        course: '',
        branch: '',
        batch: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    
    // Students list & loading states
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Selected Student & revised fee states
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [feeHeads, setFeeHeads] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [courseYears, setCourseYears] = useState({});
    const [activeEditHeads, setActiveEditHeads] = useState([]);
    const [draftAmounts, setDraftAmounts] = useState({});
    const [concessionTypes, setConcessionTypes] = useState({});
    const [selectedNewHead, setSelectedNewHead] = useState('');
    const [activeTab, setActiveTab] = useState('add'); // 'add' or 'view'
    const [isFormDirty, setIsFormDirty] = useState(false);
    const formDirtyRef = useRef(false);

    const markFormDirty = () => {
        formDirtyRef.current = true;
        setIsFormDirty(true);
    };

    const markFormClean = () => {
        formDirtyRef.current = false;
        setIsFormDirty(false);
    };

    const normalizeConcessionType = (type) =>
        String(type ?? 'CONCESSION').trim().toUpperCase() === 'REVISED' ? 'REVISED' : 'CONCESSION';

    const normalizeFeeHeadId = (id) => String(id ?? '').trim();

    const getRowConcessionType = (fhId) =>
        normalizeConcessionType(concessionTypes[normalizeFeeHeadId(fhId)] || 'CONCESSION');

    const resolveRevisedFeeHeadId = (rf) => {
        const directId = normalizeFeeHeadId(rf.feeHeadId);
        if (directId) {
            const matched = feeHeads.find(h => normalizeFeeHeadId(h._id) === directId);
            return matched ? normalizeFeeHeadId(matched._id) : directId;
        }
        const code = (rf.feeHeadCode || '').trim().toUpperCase();
        if (!code) return '';
        const byCode = feeHeads.find(h => (h.code || '').trim().toUpperCase() === code);
        return byCode ? normalizeFeeHeadId(byCode._id) : '';
    };

    const buildDraftKey = (feeHeadId, studentYear) =>
        `${normalizeFeeHeadId(feeHeadId)}_${Number(studentYear)}`;

    const getConcessionDisplayAmount = (rf) => {
        const raw = rf?.amount ?? rf?.revisedAmount;
        if (raw === undefined || raw === null || raw === '') return '';
        return String(raw);
    };

    const applyStudentConcessionsToForm = (student) => {
        if (!student) return;

        const revisedFees = student.revisedFees || [];
        const headIds = [];
        const initialDrafts = {};
        const initialTypes = {};

        revisedFees.forEach(rf => {
            const fhId = resolveRevisedFeeHeadId(rf);
            if (!fhId) return;
            if (!headIds.includes(fhId)) headIds.push(fhId);

            initialTypes[fhId] = normalizeConcessionType(rf.concessionType);

            const amountStr = getConcessionDisplayAmount(rf);
            if (amountStr !== '') {
                initialDrafts[buildDraftKey(fhId, rf.studentYear)] = amountStr;
            }
        });

        setActiveEditHeads(headIds);
        setDraftAmounts(initialDrafts);
        setConcessionTypes(initialTypes);
        markFormClean();
    };

    // Fetch initial filter metadata and fee heads
    useEffect(() => {
        if (!hasPermission) return;
        const fetchInitialData = async () => {
            try {
                const [metaRes, headsRes] = await Promise.all([
                    api.get('/students/metadata'),
                    api.get('/fee-heads')
                ]);
                const meta = metaRes.data.hierarchy || metaRes.data;
                setMetadata(meta);
                setColleges(Object.keys(meta));
                setBatches(metaRes.data.batches || []);
                setFeeHeads(headsRes.data || []);
                setCourseYears(metaRes.data.courseYears || {});
            } catch (error) {
                console.error('Error fetching metadata/fee-heads', error);
            }
        };
        fetchInitialData();
    }, [hasPermission]);

    useEffect(() => {
        if (!selectedStudent) return;
        if (formDirtyRef.current) return;

        applyStudentConcessionsToForm(selectedStudent);
    }, [selectedStudent?.admission_number, selectedStudent?.revisedFees, feeHeads.length]);

    if (!hasPermission) {
        return (
            <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert size={40} className="text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Access Denied</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            You don't have the required permissions to view or manage Overall Concessions. Please contact your administrator.
                        </p>
                        <button 
                            onClick={() => window.history.back()}
                            className="mt-8 w-full py-3 px-6 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 cursor-pointer"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Filter cascade changes
    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFilters({ ...filters, college, course: '', branch: '' });
        setCourses(college ? Object.keys(metadata[college] || {}) : []);
        setBranches([]);
    };

    const handleCourseChange = (e) => {
        const course = e.target.value;
        setFilters({ ...filters, course, branch: '' });
        if (course && filters.college) {
            setBranches(metadata[filters.college][course]?.branches || []);
        } else {
            setBranches([]);
        }
    };

    // Load student roster matching filters
    const fetchStudents = async () => {
        const hasFilters = filters.college && filters.course && filters.branch && filters.batch;
        const hasSearch = searchTerm.trim().length > 0;

        if (!hasFilters && !hasSearch) {
            alert('Please select all filters or enter a search query.');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSelectedStudent(null);
        try {
            const res = await api.get('/overall-concessions', {
                params: { ...filters, search: searchTerm }
            });
            setStudents(res.data);
        } catch (error) {
            console.error('Error loading students:', error);
            alert('Failed to load students.');
        } finally {
            setLoading(false);
        }
    };

    // Handle selecting a student
    const handleSelectStudent = (student) => {
        markFormClean();
        setSelectedStudent(student);
        setSuccessMessage('');
        setErrorMessage('');
        setSelectedNewHead('');
        applyStudentConcessionsToForm(student);
    };

    // Add a fee head to the editing panel
    const handleAddEditHead = () => {
        if (!selectedNewHead) return;
        const fhId = normalizeFeeHeadId(selectedNewHead);
        if (!activeEditHeads.includes(fhId)) {
            setActiveEditHeads([...activeEditHeads, fhId]);
            setConcessionTypes(prev => ({
                ...prev,
                [fhId]: 'CONCESSION'
            }));
        }
        markFormDirty();
        setSelectedNewHead('');
    };

    const handleConcessionTypeChange = (fhId, type) => {
        markFormDirty();
        setConcessionTypes(prev => ({
            ...prev,
            [normalizeFeeHeadId(fhId)]: normalizeConcessionType(type)
        }));
    };

    const getYearSuffix = (yr) => {
        if (yr === 1) return '1st';
        if (yr === 2) return '2nd';
        if (yr === 3) return '3rd';
        return `${yr}th`;
    };

    const duration = (selectedStudent && selectedStudent.course && courseYears[selectedStudent.course]) || 4;
    const yearsArray = Array.from({ length: duration }, (_, i) => i + 1);

    const buildConcessionsPayload = (heads, drafts, types) => {
        const payload = [];
        heads.forEach(fhId => {
            const fh = feeHeads.find(h => normalizeFeeHeadId(h._id) === normalizeFeeHeadId(fhId));
            const fhCode = fh ? fh.code : '';
            const cType = normalizeConcessionType(types[normalizeFeeHeadId(fhId)] || 'CONCESSION');
            yearsArray.forEach(yr => {
                const val = drafts[buildDraftKey(fhId, yr)];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    payload.push({
                        feeHeadId: fhId,
                        feeHeadCode: fhCode,
                        studentYear: yr,
                        semester: null,
                        amount: Number(val),
                        concessionType: cType
                    });
                }
            });
        });
        return payload;
    };

    const persistConcessions = async (heads, drafts, types, successMsg) => {
        if (!selectedStudent) return;

        const payload = {
            admissionNumber: selectedStudent.admission_number,
            pinNo: selectedStudent.pin_no,
            studentName: selectedStudent.student_name,
            college: selectedStudent.college,
            course: selectedStudent.course,
            branch: selectedStudent.branch,
            batch: selectedStudent.batch,
            category: selectedStudent.stud_type,
            concessions: buildConcessionsPayload(heads, drafts, types)
        };

        const res = await api.post('/overall-concessions/bulk', payload);

        const updatedStudentObj = {
            ...selectedStudent,
            revisedFees: res.data.revisedFees
        };

        setSelectedStudent(updatedStudentObj);
        markFormClean();
        applyStudentConcessionsToForm(updatedStudentObj);
        setStudents(students.map(s =>
            s.admission_number === selectedStudent.admission_number ? updatedStudentObj : s
        ));

        setSuccessMessage(successMsg || res.data.message || 'Revised fees saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Remove a fee head and persist immediately
    const handleRemoveEditHead = async (fhId) => {
        if (!selectedStudent) return;
        if (!window.confirm('Remove this fee component and restore its standard fee amounts?')) return;

        const normalizedId = normalizeFeeHeadId(fhId);
        const nextHeads = activeEditHeads.filter(id => normalizeFeeHeadId(id) !== normalizedId);

        const updatedDrafts = { ...draftAmounts };
        const headPrefix = `${normalizedId}_`;
        Object.keys(updatedDrafts).forEach(key => {
            if (key.startsWith(headPrefix)) {
                delete updatedDrafts[key];
            }
        });

        const nextTypes = { ...concessionTypes };
        delete nextTypes[normalizedId];

        setActiveEditHeads(nextHeads);
        setDraftAmounts(updatedDrafts);
        setConcessionTypes(nextTypes);

        setIsSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            await persistConcessions(
                nextHeads,
                updatedDrafts,
                nextTypes,
                'Fee component removed and standard fees restored.'
            );
        } catch (error) {
            console.error('Error removing fee component:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to remove fee component.');
            applyStudentConcessionsToForm(selectedStudent);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle inline change in amounts
    const handleAmountChange = (feeHeadId, year, val) => {
        markFormDirty();
        setDraftAmounts({
            ...draftAmounts,
            [buildDraftKey(feeHeadId, year)]: val
        });
    };

    // Save All Concessions (Bulk)
    const handleSaveAllConcessions = async (e) => {
        if (e) e.preventDefault();
        if (!selectedStudent) return;

        setIsSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            await persistConcessions(
                activeEditHeads,
                draftAmounts,
                concessionTypes
            );
        } catch (error) {
            console.error('Error saving overall concessions:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to save revised fees.');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to get FeeHead Name
    const getFeeHeadName = (id, code = '') => {
        let fh = feeHeads.find(h => normalizeFeeHeadId(h._id) === normalizeFeeHeadId(id));
        if (!fh && code) {
            fh = feeHeads.find(h => h.code === code);
        }
        return fh ? fh.name : (code || 'Unknown Fee Component');
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    
                    {/* Header */}
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Award className="text-blue-600" size={26} /> Overall Concessions (Revised Fees)
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Set year-wise revised fee structures directly for specific students.</p>
                        </div>
                        
                        {/* Tabs Container */}
                        <div className="flex bg-slate-200/80 p-1 rounded-xl border border-slate-300/40 shrink-0">
                            <button
                                onClick={() => setActiveTab('add')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === 'add' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                <Plus size={14} /> Add / Manage
                            </button>
                            <button
                                onClick={() => setActiveTab('view')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === 'view' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                <Eye size={14} /> View Overview
                            </button>
                        </div>
                    </header>

                    {/* Filters Control Bar */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
                        <div className="flex flex-col xl:flex-row gap-4 items-end">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto flex-1">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">College</label>
                                    <select
                                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        value={filters.college}
                                        onChange={handleCollegeChange}
                                    >
                                        <option value="">Select College</option>
                                        {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Course</label>
                                    <select
                                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        value={filters.course}
                                        onChange={handleCourseChange}
                                        disabled={!filters.college}
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch</label>
                                    <select
                                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        value={filters.batch}
                                        onChange={e => setFilters({ ...filters, batch: e.target.value })}
                                    >
                                        <option value="">Select Batch</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Branch</label>
                                    <select
                                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        value={filters.branch}
                                        onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                        disabled={!filters.course}
                                    >
                                        <option value="">Select Branch</option>
                                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full xl:w-auto">
                                <div className="relative flex-1 xl:w-64">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Search size={14} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2.5"
                                        placeholder="Quick Search (Name/Adm/Pin)..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchStudents()}
                                    />
                                </div>

                                <button
                                    onClick={fetchStudents}
                                    disabled={loading}
                                    className="text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-lg text-xs px-5 py-2.5 transition flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                                >
                                    <Filter size={14} />
                                    {loading ? 'Searching...' : 'Load Students'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Workspace Layout */}
                    {activeTab === 'add' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                            
                            {/* LEFT: Students Roster */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                                    <h2 className="text-sm font-bold text-slate-800">Matching Students</h2>
                                </div>
                                <div className="overflow-y-auto flex-1 max-h-[600px] divide-y divide-slate-100">
                                    {loading ? (
                                        <div className="text-center py-20 text-slate-400 italic">Querying SQL database...</div>
                                    ) : students.length === 0 ? (
                                        <div className="text-center py-24 text-slate-400 p-6">
                                            {hasSearched ? 'No active regular students found matching criteria.' : 'Select filters and click Load Students.'}
                                        </div>
                                    ) : (
                                        students.map(s => {
                                            const isSelected = selectedStudent?.admission_number === s.admission_number;
                                            return (
                                                <div
                                                    key={s.admission_number}
                                                    onClick={() => handleSelectStudent(s)}
                                                    className={`p-4 hover:bg-blue-50/50 cursor-pointer transition-all duration-150 flex items-start gap-3 ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600 pl-3' : ''}`}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                                        {s.student_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-slate-900 text-sm truncate">{s.student_name}</div>
                                                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                                                            <span>Pin: <b>{s.pin_no}</b></span>
                                                            <span>•</span>
                                                            <span>Adm: {s.admission_number}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1.5">
                                                            <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">{s.course}</span>
                                                            <span className="bg-slate-50 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate max-w-[120px]">{s.branch}</span>
                                                            {s.revisedFees.length > 0 && (
                                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 text-[10px] font-extrabold">{s.revisedFees.length} Revised</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Concession Management details */}
                            <div className="lg:col-span-3 space-y-6">
                                {selectedStudent ? (
                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6 animate-fadeIn">
                                        
                                        {/* Student Card Summary */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-900">{selectedStudent.student_name}</h2>
                                                    <p className="text-xs text-slate-500">
                                                        PIN: <span className="font-semibold text-slate-700 mr-2">{selectedStudent.pin_no}</span>
                                                        Adm No: <span className="font-semibold text-slate-700">{selectedStudent.admission_number}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.batch} Batch</span>
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.course}</span>
                                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold uppercase">{selectedStudent.stud_type}</span>
                                            </div>
                                        </div>

                                        {/* Success/Error Alerts */}
                                        {successMessage && (
                                            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-semibold">
                                                <Check size={16} /> {successMessage}
                                            </div>
                                        )}
                                        {errorMessage && (
                                            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-2 text-sm font-semibold">
                                                <ShieldAlert size={16} /> {errorMessage}
                                            </div>
                                        )}

                                        {/* Unified Multi-Head & Multi-Year Bulk Editor */}
                                        <div className="border-t border-slate-100 pt-6 space-y-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <h3 className="text-sm font-bold text-slate-800">Set Revised Fee (Concession)</h3>
                                                
                                                {/* Add Fee Head Selector */}
                                                <div className="flex items-center gap-2 text-xs">
                                                    <select
                                                        className="border border-slate-300 rounded-lg p-2 bg-slate-50 focus:ring-blue-500 focus:border-blue-500"
                                                        value={selectedNewHead}
                                                        onChange={e => setSelectedNewHead(e.target.value)}
                                                    >
                                                        <option value="">Select Fee Component to Add...</option>
                                                        {feeHeads
                                                            .filter(fh => !activeEditHeads.includes(normalizeFeeHeadId(fh._id)))
                                                            .map(fh => (
                                                                <option key={fh._id} value={normalizeFeeHeadId(fh._id)}>{fh.name} ({fh.code || 'N/A'})</option>
                                                            ))
                                                        }
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddEditHead}
                                                        disabled={!selectedNewHead}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0"
                                                    >
                                                        <Plus size={14} /> Add Component
                                                    </button>
                                                </div>
                                            </div>

                                            {/* List of active fee components with years in the same row */}
                                            <div className="space-y-4">
                                                {activeEditHeads.length === 0 ? (
                                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs italic bg-white">
                                                        No fee components added yet. Select a component above and click "Add Component" to configure revised fee structures.
                                                    </div>
                                                ) : (
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                                        <div className="overflow-x-auto w-full">
                                                            <table className="w-full text-xs text-left border-collapse table-fixed">
                                                                <colgroup>
                                                                    <col className="w-[168px]" />
                                                                    <col className="w-[118px]" />
                                                                    {yearsArray.map(yr => (
                                                                        <col key={yr} />
                                                                    ))}
                                                                    <col className="w-12" />
                                                                </colgroup>
                                                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold text-[10px] uppercase">
                                                                    <tr>
                                                                        <th className="px-3 py-3 text-left">Fee Component</th>
                                                                        <th className="px-2 py-3 text-center">Type</th>
                                                                        {yearsArray.map(yr => (
                                                                            <th key={yr} className="px-2 py-3 text-center">{getYearSuffix(yr)} Year (₹)</th>
                                                                        ))}
                                                                        <th className="px-2 py-3 text-center">Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                                                    {activeEditHeads.map(fhId => {
                                                                        const matchingFee = selectedStudent?.revisedFees?.find(
                                                                            rf => resolveRevisedFeeHeadId(rf) === normalizeFeeHeadId(fhId)
                                                                        );
                                                                        const headCode = matchingFee ? matchingFee.feeHeadCode : '';
                                                                        const headName = getFeeHeadName(fhId, headCode);
                                                                        const rowType = getRowConcessionType(fhId);
                                                                        const amountPlaceholder = rowType === 'CONCESSION' ? 'Deduction' : 'Revised fee';
                                                                        return (
                                                                            <tr key={fhId} className="hover:bg-slate-50/20">
                                                                                <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{headName}</td>
                                                                                <td className="px-2 py-3">
                                                                                    <div className="flex justify-center">
                                                                                        <select
                                                                                            value={rowType}
                                                                                            onChange={e => handleConcessionTypeChange(fhId, e.target.value)}
                                                                                            className="w-[112px] border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-semibold"
                                                                                        >
                                                                                            <option value="REVISED">Revised Fee</option>
                                                                                            <option value="CONCESSION">Concession</option>
                                                                                        </select>
                                                                                    </div>
                                                                                </td>
                                                                                {yearsArray.map(yr => (
                                                                                    <td key={yr} className="px-2 py-3 text-center">
                                                                                        <div className="relative w-full max-w-[120px] mx-auto">
                                                                                            <span className="absolute left-2.5 top-2 text-slate-400 font-medium">₹</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                placeholder={amountPlaceholder}
                                                                                                value={draftAmounts[buildDraftKey(fhId, yr)] || ''}
                                                                                                onChange={e => handleAmountChange(fhId, yr, e.target.value)}
                                                                                                className="w-full border border-slate-300 pl-6 pr-2 py-1.5 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-semibold"
                                                                                            />
                                                                                        </div>
                                                                                    </td>
                                                                                ))}
                                                                                <td className="px-2 py-3 text-center">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleRemoveEditHead(fhId)}
                                                                                        disabled={isSaving}
                                                                                        className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition disabled:opacity-40"
                                                                                        title="Clear and remove component"
                                                                                    >
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            {(activeEditHeads.length > 0 || isFormDirty) && (
                                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveAllConcessions}
                                                        disabled={isSaving}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                                                    >
                                                        <Check size={16} />
                                                        {isSaving ? 'Saving Revised Fees...' : 'Save All Concessions'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-slate-400 min-h-[500px] flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                                            <User size={32} className="text-slate-300" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-700">No Student Selected</h3>
                                            <p className="text-xs mt-1 max-w-sm mx-auto">Select a student from the left panel to define revised fee components or clear existing revised dues.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : (
                        /* VIEW TAB: Full concessions table grid */
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fadeIn">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-800">Concessions Overview Roster</h2>
                                <span className="text-xs text-slate-500 font-semibold">{students.length} Students Loaded</span>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold text-[10px] uppercase">
                                        <tr>
                                            <th className="p-4 w-3/12">Student Info</th>
                                            <th className="p-4 w-5/12">Revised Fees</th>
                                            <th className="p-4 w-2/12">College / Batch</th>
                                            <th className="p-4 w-2/12">Course / Branch</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="4" className="text-center py-20 text-slate-400 italic">Querying SQL database...</td>
                                            </tr>
                                        ) : students.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="text-center py-24 text-slate-400 p-6">
                                                    {hasSearched ? 'No active regular students found matching criteria.' : 'Select filters and click Load Students.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map(s => {
                                                // Group revised fees by feeHeadId
                                                const grouped = {};
                                                if (s.revisedFees) {
                                                    s.revisedFees.forEach(rf => {
                                                        const fhId = resolveRevisedFeeHeadId(rf) || normalizeFeeHeadId(rf.feeHeadId);
                                                        if (!fhId) return;
                                                        if (!grouped[fhId]) grouped[fhId] = [];
                                                        grouped[fhId].push(rf);
                                                    });
                                                }
                                                const hasConcessions = Object.keys(grouped).length > 0;

                                                return (
                                                    <tr key={s.admission_number} className="hover:bg-slate-50/30">
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-900 text-sm">{s.student_name}</div>
                                                            <div className="text-slate-500 mt-0.5 font-medium">
                                                                Pin: <span className="font-semibold text-slate-700">{s.pin_no}</span> | Adm: {s.admission_number}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            {hasConcessions ? (
                                                                <div className="space-y-2">
                                                                    {Object.entries(grouped).map(([fhId, items]) => (
                                                                        <div key={fhId} className="flex flex-col sm:flex-row sm:items-start sm:justify-start gap-2">
                                                                            <span className="font-bold text-slate-700 bg-slate-100 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide inline-block shrink-0 mt-0.5">
                                                                                {getFeeHeadName(fhId, items[0]?.feeHeadCode)}:
                                                                            </span>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {items.map(rf => (
                                                                                    <span key={rf.id} className={`border rounded px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${rf.concessionType === 'CONCESSION' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                                        Yr {rf.studentYear}: {rf.concessionType === 'CONCESSION' ? '-' : ''}₹{(rf.amount ?? rf.revisedAmount ?? 0).toLocaleString()} {rf.concessionType === 'CONCESSION' ? '(Conc.)' : '(Revised)'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 font-bold text-sm">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-semibold text-slate-800 uppercase">{s.college}</div>
                                                            <div className="text-slate-500 mt-0.5">{s.batch} Batch</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-semibold text-slate-800 uppercase">{s.course}</div>
                                                            <div className="text-slate-500 mt-0.5 truncate max-w-[180px]">{s.branch}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OverallConcession;
