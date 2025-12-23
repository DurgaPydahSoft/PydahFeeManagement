import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pencil, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';

const FeeConfiguration = () => {
    const [activeTab, setActiveTab] = useState('heads'); // heads, definitions, applicability

    // --- SHARED STATE ---
    const [feeHeads, setFeeHeads] = useState([]);
    const [metadata, setMetadata] = useState({});
    const [message, setMessage] = useState('');

    // --- TAB 1: FEE HEADS ---
    const [headForm, setHeadForm] = useState({ name: '', code: '', description: '' });
    const [editHeadId, setEditHeadId] = useState(null);

    // --- TAB 2: DEFINITIONS (Fee Structures) ---
    const [structures, setStructures] = useState([]);
    const [structForm, setStructForm] = useState({
        feeHeadId: '', college: '', course: '', branch: '',
        academicYear: 'ALL', studentYear: '', amount: '',
        semester: '' // '1', '2' or empty for yearly
    });
    const [feeType, setFeeType] = useState('Yearly'); // 'Yearly' or 'Semester'
    const [semAmounts, setSemAmounts] = useState({ 1: '', 2: '' }); // For simultaneous creation
    const [bulkAmounts, setBulkAmounts] = useState({}); // For "All Years" creation: { 1: '', 2: '', ... }
    const [isMultiYear, setIsMultiYear] = useState(true); // Default to true (Always All Years)

    // Helper to generate Academic Years
    const currentYear = new Date().getFullYear();
    const academicYears = ['ALL', ...Array.from({ length: 9 }, (_, i) => `${currentYear - 4 + i}-${currentYear - 3 + i}`)];

    const [editingId, setEditingId] = useState(null);
    const [filterCollege, setFilterCollege] = useState('');
    const [filterCourse, setFilterCourse] = useState('');

    // --- TAB 3: APPLICABILITY (Assignment) ---
    const [appContext, setAppContext] = useState({
        college: '', course: '', branch: '', studentYear: '', semester: '', feeHeadId: '', academicYear: '2024-2025' // Default active year
    });
    const [studentList, setStudentList] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [templateAmount, setTemplateAmount] = useState(null); // The "standard" amount found
    const [applicabilityMode, setApplicabilityMode] = useState('batch'); // 'batch' or 'individual'
    const [expandedYears, setExpandedYears] = useState({}); // { 1: true, 2: false, ... }

    useEffect(() => {
        fetchFeeHeads();
        fetchStructures();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students/metadata`);
            setMetadata(response.data);
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchFeeHeads = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-heads`);
            setFeeHeads(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchStructures = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/fee-structures`);
            setStructures(response.data);
        } catch (error) { console.error(error); }
    };

    const activeHeadSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            if (editHeadId) {
                const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/fee-heads/${editHeadId}`, headForm);
                setFeeHeads(feeHeads.map(h => h._id === editHeadId ? response.data : h));
                setMessage('Fee Head updated successfully!');
            } else {
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-heads`, headForm);
                setFeeHeads([response.data, ...feeHeads]);
                setMessage('Fee Head added successfully!');
            }
            setHeadForm({ name: '', code: '', description: '' });
            setEditHeadId(null);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) { setMessage(error.response?.data?.message || 'Error'); }
    };

    const handleEditHead = (h) => {
        setHeadForm({ name: h.name, code: h.code || '', description: h.description });
        setEditHeadId(h._id);
    };

    const deleteHead = async (id) => {
        if (!window.confirm('Delete this Fee Head?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/fee-heads/${id}`);
            setFeeHeads(feeHeads.filter(h => h._id !== id));
        } catch (error) { alert('Failed to delete'); }
    };

    // --- DEFINITIONS LOGIC ---
    const activeStructSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const requests = [];

            if (editingId) {
                // Update existing (Single ID)
                await axios.put(`${import.meta.env.VITE_API_URL}/api/fee-structures/${editingId}`, structForm);
            } else {
                // Determine Years to Process
                const total = (structForm.college && structForm.course) ? (metadata[structForm.college][structForm.course].total_years || 4) : 4;
                const targetYears = Array.from({ length: total }, (_, i) => i + 1);

                // Generate Requests
                targetYears.forEach(year => {
                    if (feeType === 'Semester') {
                        // Semester Wise (Always from bulkAmounts)
                        const s1 = bulkAmounts[`${year}-S1`];
                        const s2 = bulkAmounts[`${year}-S2`];

                        if (s1) requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, { ...structForm, studentYear: year, semester: 1, amount: Number(s1) }));
                        if (s2) requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, { ...structForm, studentYear: year, semester: 2, amount: Number(s2) }));

                    } else {
                        // Yearly (Always from bulkAmounts)
                        const amt = bulkAmounts[`${year}-Y`];
                        if (amt) requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, { ...structForm, studentYear: year, semester: null, amount: Number(amt) }));
                    }
                });

                if (requests.length === 0) { alert('Please enter at least one amount'); return; }
                await Promise.all(requests);
            }

            setMessage(editingId ? 'Fee Structure updated!' : 'Fee Definitions created successfully!');
            fetchStructures();
            setStructForm({ ...structForm, amount: '' });
            setSemAmounts({ 1: '', 2: '' });
            setBulkAmounts({});
            setEditingId(null);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) { setMessage(error.response?.data?.message || 'Error saving structure'); }
    };

    // Edit entire row (Propagate context)
    const handleEditRow = (row) => {
        setStructForm({
            feeHeadId: row.feeHeadId,
            college: row.college,
            course: row.course,
            branch: row.branch,
            academicYear: row.academicYear,
            studentYear: '', // User must select year to refine OR use Multi-Year
            amount: '',
            semester: ''
        });

        // Populate bulkAmounts for Multi-Year Editing
        const newBulk = {};
        if (row.years) {
            Object.keys(row.years).forEach(y => {
                const items = row.years[y]; // Array of { semester, amount }
                items.forEach(item => {
                    if (item.semester) {
                        newBulk[`${y}-S${item.semester}`] = item.amount;
                    } else {
                        newBulk[`${y}-Y`] = item.amount;
                    }
                });
            });
        }
        setBulkAmounts(newBulk);
        setIsMultiYear(true); // Default to Multi-Year edit mode
        setFeeType(Object.keys(newBulk).some(k => k.includes('S')) ? 'Semester' : 'Yearly');

        setEditingId(null);
        window.scrollTo(0, 0);
        setMessage('Context loaded. Use "All Years" to edit multiple years at once.');
    };

    const deleteStruct = async (id) => {
        if (!window.confirm('Delete this Fee Structure?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/fee-structures/${id}`);
            setStructures(structures.filter(s => s._id !== id));
        } catch (error) { alert('Failed to delete structure'); }
    };

    const toggleYearExpand = (y) => {
        setExpandedYears(prev => ({ ...prev, [y]: !prev[y] }));
    };

    // --- APPLICABILITY LOGIC ---
    const fetchStudentsForApplicability = async () => {
        // Validation based on Mode
        const { college, course, branch, studentYear, academicYear, feeHeadId } = appContext;

        const isExcelMode = applicabilityMode === 'individual';

        if (!college || !course || !branch || !academicYear || !feeHeadId) {
            alert("Please select College, Fee Head, Academic Year, Course, and Branch.");
            return;
        }

        // In Batch Mode, Student Year is required
        if (!isExcelMode && !studentYear) {
            alert("Please select Student Year for Batch Mode.");
            return;
        }

        setLoadingStudents(true);
        try {
            // 1. Fetch Students (All for the batch)
            const studentsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/students`);

            // Filter: Match College, Course, Branch
            // If Excel Mode: Fetch ALL students (ignore studentYear filter)
            // If Batch Mode: Filter by s.current_year
            const batchStudents = studentsRes.data.filter(s =>
                s.college === college && s.course === course && s.branch === branch &&
                (isExcelMode ? true : s.current_year === Number(studentYear))
            );

            // 2. Fetch Existing Fee Records (Real Data)
            // Only need this for Excel Mode to show current state, but useful for Batch too (to show if Applied)
            let existingFees = [];
            try {
                const feeRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures/batch-fees`, {
                    college, course, branch, academicYear, feeHeadId
                });
                existingFees = feeRes.data;
            } catch (e) { console.error("Error fetching fee records", e); }

            // 3. Prepare List
            const list = batchStudents.map(s => {
                const sYear = s.current_year;

                // Find existing fee for this student and this head/year
                // We are looking for fee with: studentId, feeHead, academicYear
                // AND studentYear matching their current year (since the column is for THAT year)
                /* 
                   Wait, in Excel View: "Rows represent students... shows all year-wise fee columns".
                   "Display fee values in the corresponding year column."
                   "Other year columns should remain empty or disabled unless applicable."
                   
                   Actually, typically a student ONLY pays for their CURRENT year. 
                   Usually you don't collect Year 3 fees from a Year 1 student yet.
                   Requirement: "Fetch their current year... Display fee values in the corresponding year column."
                   
                   So:
                   Student A (Year 1) -> Input in Col 1. Col 2,3,4 Disabled.
                   Student B (Year 2) -> Input in Col 2. Col 1,3,4 Disabled.
                   
                   Value to pre-fill: 
                   1. Check `existingFees` for a record matching (studentId, studentYear=sYear).
                   2. If none, check `structures` template matching (studentYear=sYear).
                */

                const relevantFee = existingFees.find(f => f.studentId === s.admission_number && f.studentYear === sYear);

                // Template Fallback
                let templateAmount = 0;
                if (!relevantFee) {
                    let template = structures.find(st =>
                        st.college === college && st.course === course && st.branch === branch &&
                        (st.academicYear === academicYear || st.academicYear === 'ALL') &&
                        st.studentYear === sYear &&
                        st.feeHead._id === feeHeadId &&
                        (appContext.semester ? st.semester === Number(appContext.semester) : !st.semester)
                    );
                    if (template) templateAmount = template.amount;
                }

                return {
                    studentId: s.admission_number,
                    studentName: s.student_name,
                    pinNo: s.pin_no || '-',
                    current_year: sYear,
                    amount: relevantFee ? relevantFee.amount : templateAmount, // The value to show
                    isExisting: !!relevantFee,
                    feeId: relevantFee ? relevantFee._id : null
                };
            });

            // Set Template Amount just for Batch Mode reference
            // ... (skipped for brevity as it's less critical for Excel mode)

            setStudentList(list);

        } catch (error) { console.error(error); }
        setLoadingStudents(false);
    };

    const handleApplyBatch = async () => {
        if (!window.confirm(`Apply Fee to ALL students in this list?`)) return;

        try {
            const yearsToProcess = appContext.studentYear === 'ALL'
                ? Array.from({ length: appTotalYears }, (_, i) => i + 1)
                : [Number(appContext.studentYear)];

            let processedCount = 0;

            for (const year of yearsToProcess) {
                // Find structure for this specific year
                let template = structures.find(s =>
                    s.college === appContext.college && s.course === appContext.course && s.branch === appContext.branch &&
                    (s.academicYear === appContext.academicYear || s.academicYear === 'ALL') &&
                    s.studentYear === year &&
                    s.feeHead._id === appContext.feeHeadId &&
                    (appContext.semester ? s.semester === Number(appContext.semester) : !s.semester)
                );

                if (template) {
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures/apply-batch`, {
                        structureId: template._id,
                        targetAcademicYear: appContext.academicYear
                    });
                    processedCount++;
                }
            }

            if (processedCount === 0) {
                alert("No matching Fee Structures found for the selected criteria.");
            } else {
                setMessage(`Fees applied successfully for ${processedCount} year groups!`);
                setTimeout(() => setMessage(''), 3000);
            }

        } catch (error) { alert("Failed to apply batch"); }
    };

    const handleSaveStudentFees = async () => {
        try {
            // Save Logic - Handles both Batch (if reused) and Individual Excel Save
            // Payload: List of fee objects
            const fees = studentList.map(s => ({
                studentId: s.studentId,
                studentName: s.studentName,
                feeHeadId: appContext.feeHeadId,
                college: appContext.college,
                course: appContext.course,
                branch: appContext.branch,
                block: appContext.block,
                academicYear: appContext.academicYear,
                studentYear: s.current_year, // ALWAYS use student's actual year
                semester: appContext.semester,
                amount: s.amount // The edited amount
            }));

            await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures/save-student-fees`, { fees });
            setMessage("Student List fees saved successfully!");
            setTimeout(() => setMessage(''), 3000);
        } catch (error) { alert("Failed to save student fees"); }
    };

    // --- RENDER HELPERS ---
    const colleges = Object.keys(metadata);
    // Dynamic Dropdowns for Applicability
    const appCourses = appContext.college ? Object.keys(metadata[appContext.college] || {}) : [];
    const appBranches = (appContext.college && appContext.course) ? metadata[appContext.college][appContext.course]?.branches || [] : [];
    const appTotalYears = (appContext.college && appContext.course) ? metadata[appContext.college][appContext.course]?.total_years || 4 : 0;
    const appYearOptions = ['ALL', ...Array.from({ length: appTotalYears }, (_, i) => i + 1)]; // Added ALL

    // Definitions Grouping
    const grouped = {};
    structures.filter(s => {
        if (filterCollege && s.college !== filterCollege) return false;
        if (filterCourse && s.course !== filterCourse) return false;
        return true;
    }).forEach(s => {
        const key = `${s.college}|${s.course}|${s.branch}|${s.academicYear}|${s.feeHead?._id}`;
        if (!grouped[key]) grouped[key] = { ...s, feeHeadName: s.feeHead?.name, feeHeadId: s.feeHead?._id, feeHeadCode: s.feeHead?.code, years: {}, allIds: [] };

        // Initialize year array if missing
        if (!grouped[key].years[s.studentYear]) grouped[key].years[s.studentYear] = [];

        grouped[key].years[s.studentYear].push({
            id: s._id,
            amount: s.amount,
            semester: s.semester
        });

        grouped[key].allIds.push(s._id);
    });
    const groupedArray = Object.values(grouped);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6">
                <header className="mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Fee Configuration</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage definitions and active assignments.</p>
                </header>

                {/* TABS */}
                <div className="flex space-x-4 mb-6 border-b border-gray-200">
                    <button className={`pb-2 px-4 font-medium transition ${activeTab === 'heads' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('heads')}>1. Fee Heads</button>
                    <button className={`pb-2 px-4 font-medium transition ${activeTab === 'definitions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('definitions')}>2. Fee Structures (Definitions)</button>
                    <button className={`pb-2 px-4 font-medium transition ${activeTab === 'applicability' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('applicability')}>3. Fee Applicability (Assignment)</button>
                </div>

                {message && <div className="p-3 bg-green-50 text-green-700 rounded mb-4 border border-green-200">{message}</div>}

                {/* --- TAB 1: HEADS --- */}
                {activeTab === 'heads' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 h-fit">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-semibold text-gray-800">{editHeadId ? 'Edit Fee Head' : 'Add Fee Head'}</h2>
                                {editHeadId && <button onClick={() => { setEditHeadId(null); setHeadForm({ name: '', description: '' }); }} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">Cancel</button>}
                            </div>
                            <form onSubmit={activeHeadSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input className="w-full border p-2 rounded" placeholder="Name (e.g. Tuition)" value={headForm.name} onChange={e => setHeadForm({ ...headForm, name: e.target.value })} required />
                                    <input className="w-full border p-2 rounded" placeholder="Code (e.g. TUI01)" value={headForm.code} onChange={e => setHeadForm({ ...headForm, code: e.target.value })} />
                                </div>
                                <textarea className="w-full border p-2 rounded" placeholder="Description" value={headForm.description} onChange={e => setHeadForm({ ...headForm, description: e.target.value })} />
                                <button className={`w-full text-white py-2 rounded ${editHeadId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    {editHeadId ? 'Update Fee Head' : 'Add Fee Head'}
                                </button>
                            </form>
                        </div>
                        <div className="md:col-span-2 bg-white p-5 rounded-lg shadow-sm">
                            <h2 className="font-semibold text-gray-800 mb-3">Existing Heads</h2>
                            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Name</th><th className="p-2">Code</th><th className="p-2">Desc</th><th className="p-2 text-right">Action</th></tr></thead>
                                <tbody>{feeHeads.map(h => (
                                    <tr key={h._id} className="border-t hover:bg-gray-50">
                                        <td className="p-2 font-medium">{h.name}</td>
                                        <td className="p-2 text-mono text-gray-600">{h.code || '-'}</td>
                                        <td className="p-2 text-gray-500 text-sm">{h.description}</td>
                                        <td className="p-2 text-right space-x-2 flex justify-end">
                                            <button onClick={() => handleEditHead(h)} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded transition" title="Edit"><Pencil size={16} /></button>
                                            <button onClick={() => deleteHead(h._id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition" title="Delete"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}</tbody></table></div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: DEFINITIONS --- */}
                {activeTab === 'definitions' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Edit Form (Simplified for brevity, logic same as before) */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 h-fit">
                            <div className="flex justify-between mb-3"><h2 className="font-semibold text-gray-800">{editingId ? 'Edit' : 'Define Standard Fees'}</h2>{editingId && <button onClick={() => setEditingId(null)} className="text-xs bg-gray-200 px-2 rounded">Cancel</button>}</div>
                            <form onSubmit={activeStructSubmit} className="space-y-4 text-sm">
                                {/* Context Selection */}
                                {/* Row 1: College & Fee Head */}
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="w-full border p-2 rounded" value={structForm.college} onChange={e => { setStructForm({ ...structForm, college: e.target.value }); }} required><option value="">Select College</option>{colleges.map(c => <option key={c}>{c}</option>)}</select>
                                    <select className="w-full border p-2 rounded" value={structForm.feeHeadId} onChange={e => setStructForm({ ...structForm, feeHeadId: e.target.value })} required><option value="">Select Fee Head</option>{feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}</select>
                                </div>

                                {/* Row 2: Course & Branch */}
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="w-full border p-2 rounded" value={structForm.course} onChange={e => { setStructForm({ ...structForm, course: e.target.value }); }} required disabled={!structForm.college}><option value="">Select Course</option>{(structForm.college ? Object.keys(metadata[structForm.college] || {}) : []).map(c => <option key={c}>{c}</option>)}</select>
                                    <select className="w-full border p-2 rounded" value={structForm.branch} onChange={e => setStructForm({ ...structForm, branch: e.target.value })} required disabled={!structForm.course}><option value="">Select Branch</option>{((structForm.college && structForm.course) ? metadata[structForm.college][structForm.course].branches : []).map(b => <option key={b}>{b}</option>)}</select>
                                </div>

                                {/* Row 3: Academic Year */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Academic Year</label>
                                    <select className="w-full border p-2 rounded mt-1" value={structForm.academicYear} onChange={e => setStructForm({ ...structForm, academicYear: e.target.value })} required>
                                        {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                {/* Amount Section */}
                                {editingId ? (
                                    <input type="number" className="w-full border p-2 rounded" value={structForm.amount} onChange={e => setStructForm({ ...structForm, amount: e.target.value })} placeholder="Amount" />
                                ) : (
                                    <div className="bg-blue-50 p-3 rounded space-y-3">
                                        <div className="flex gap-4 border-b border-blue-200 pb-2">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="radio" checked={feeType === 'Yearly'} onChange={() => setFeeType('Yearly')} /> Yearly
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="radio" checked={feeType === 'Semester'} onChange={() => setFeeType('Semester')} /> Semester-wise
                                            </label>
                                        </div>

                                        {/* Amount Inputs Logic (Always All Years) */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-500">Enter Amounts per Year:</p>
                                            {(() => {
                                                const selectedMeta = (structForm.college && structForm.course) ? metadata[structForm.college]?.[structForm.course] : null;
                                                const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 0;

                                                if (yearsCount === 0) {
                                                    return <p className="text-xs text-gray-400 italic">Select College and Course above to configure years.</p>;
                                                }

                                                return Array.from({ length: yearsCount }, (_, i) => i + 1).map(y => (
                                                    <div key={y} className="flex items-center gap-2">
                                                        <span className="w-12 text-xs font-bold text-gray-600">Yr {y}:</span>
                                                        {feeType === 'Yearly' ? (
                                                            <input className="flex-1 border p-1 rounded text-sm" placeholder="Amount" value={bulkAmounts[`${y}-Y`] || ''} onChange={e => setBulkAmounts({ ...bulkAmounts, [`${y}-Y`]: e.target.value })} />
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                                <input className="border p-1 rounded text-sm" placeholder="Sem 1" value={bulkAmounts[`${y}-S1`] || ''} onChange={e => setBulkAmounts({ ...bulkAmounts, [`${y}-S1`]: e.target.value })} />
                                                                <input className="border p-1 rounded text-sm" placeholder="Sem 2" value={bulkAmounts[`${y}-S2`] || ''} onChange={e => setBulkAmounts({ ...bulkAmounts, [`${y}-S2`]: e.target.value })} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}
                                <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Save Definition</button>
                            </form>
                        </div>

                        {/* Matrix Table */}
                        <div className="xl:col-span-2 bg-white p-5 rounded-lg shadow-sm overflow-x-auto">
                            <h2 className="font-semibold text-gray-800 mb-3">Fee Templates (Not Active Dues)</h2>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr><th className="p-3">Fee Head</th><th className="p-3">Context</th><th className="p-3 text-center">Yr 1</th><th className="p-3 text-center">Yr 2</th><th className="p-3 text-center">Yr 3</th><th className="p-3 text-center">Yr 4</th><th className="p-3 text-right">Action</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {groupedArray.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 group/row">
                                            <td className="p-3 font-medium text-blue-800 relative">
                                                {row.feeHeadName} <span className="text-xs text-gray-400">({row.feeHeadCode || '-'})</span>
                                            </td>
                                            <td className="p-3 text-xs text-gray-500">
                                                <div className="font-bold">{row.course} - {row.branch}</div>
                                                <div className="text-[10px] uppercase bg-gray-100 w-fit px-1 rounded">{row.college}</div>
                                                <div className="mt-1 text-black font-semibold">AY: {row.academicYear}</div>
                                            </td>
                                            {[1, 2, 3, 4].map(y => (
                                                <td key={y} className="p-2 text-center text-gray-700 align-top">
                                                    {row.years[y] ? (
                                                        <div className="flex flex-col gap-1">
                                                            {row.years[y].map((item, idx) => (
                                                                <div key={idx} className="text-xs bg-gray-50 p-1 rounded border">
                                                                    {item.semester ? <span className="font-bold text-gray-500">S{item.semester}: </span> : <span className="font-bold text-gray-500">Yr: </span>}
                                                                    ₹{item.amount.toLocaleString()}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                            ))}
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditRow(row)}
                                                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded transition"
                                                        title="Edit Context"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (!window.confirm(`Delete ALL definitions for ${row.course}?`)) return;
                                                            try {
                                                                await Promise.all(row.allIds.map(id => axios.delete(`${import.meta.env.VITE_API_URL}/api/fee-structures/${id}`)));
                                                                fetchStructures();
                                                            } catch (e) { alert('Delete failed'); }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
                }

                {/* --- TAB 3: APPLICABILITY --- */}
                {
                    activeTab === 'applicability' && (
                        <div className="flex flex-col gap-4">
                            {/* 1. Context Selection */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-blue-200">
                                <div className="flex space-x-4 border-b mb-4 pb-2">
                                    <button
                                        className={`pb-1 px-4 font-semibold transition ${applicabilityMode === 'batch' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                        onClick={() => setApplicabilityMode('batch')}
                                    >
                                        Option 1: Batch Apply
                                    </button>
                                    <button
                                        className={`pb-1 px-4 font-semibold transition ${applicabilityMode === 'individual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                                        onClick={() => setApplicabilityMode('individual')}
                                    >
                                        Option 2: Excel View (Edit Individual)
                                    </button>
                                </div>

                                <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span> Select Filters</h2>

                                {/* Strict Order: College -> Fee Head -> Academic Year -> Course -> Branch */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {/* 1. College */}
                                    <div><label className="text-xs font-bold text-gray-500">College</label><select className="w-full border p-2 rounded mt-1" value={appContext.college} onChange={e => setAppContext({ ...appContext, college: e.target.value, course: '', branch: '', studentYear: '' })}><option value="">Select...</option>{colleges.map(c => <option key={c}>{c}</option>)}</select></div>

                                    {/* 2. Fee Head */}
                                    <div><label className="text-xs font-bold text-gray-500">Fee Head</label><select className="w-full border p-2 rounded mt-1" value={appContext.feeHeadId} onChange={e => setAppContext({ ...appContext, feeHeadId: e.target.value })}><option value="">Select...</option>{feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}</select></div>

                                    {/* 3. Academic Year */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Academic Year</label>
                                        <select className="w-full border p-2 rounded mt-1" value={appContext.academicYear} onChange={e => setAppContext({ ...appContext, academicYear: e.target.value })}>
                                            {academicYears.filter(y => y !== 'ALL').map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>

                                    {/* 4. Course */}
                                    <div><label className="text-xs font-bold text-gray-500">Course</label><select className="w-full border p-2 rounded mt-1" value={appContext.course} onChange={e => setAppContext({ ...appContext, course: e.target.value, branch: '', studentYear: '' })} disabled={!appContext.college}><option value="">Select...</option>{appCourses.map(c => <option key={c}>{c}</option>)}</select></div>

                                    {/* 5. Branch */}
                                    <div><label className="text-xs font-bold text-gray-500">Branch</label><select className="w-full border p-2 rounded mt-1" value={appContext.branch} onChange={e => setAppContext({ ...appContext, branch: e.target.value })} disabled={!appContext.course}><option value="">Select...</option>{appBranches.map(c => <option key={c}>{c}</option>)}</select></div>
                                </div>

                                {/* Dynamic Filters: Student Year (Only for Batch Mode) */}
                                {applicabilityMode === 'batch' && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3 border-t pt-3">
                                        <div><label className="text-xs font-bold text-gray-500 text-blue-600">Student Year (Batch Only)</label><select className="w-full border p-2 rounded mt-1 border-blue-200" value={appContext.studentYear} onChange={e => setAppContext({ ...appContext, studentYear: e.target.value })} disabled={!appContext.branch}><option value="">Select...</option>{appYearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                                    </div>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <button onClick={fetchStudentsForApplicability} className="bg-gray-800 text-white px-6 py-2 rounded font-semibold hover:bg-gray-900 shadow-md">Load Data</button>
                                </div>
                            </div>

                            {/* 2. Action Area */}
                            {studentList.length > 0 && (
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">

                                    {applicabilityMode === 'batch' && (
                                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 max-w-2xl">
                                            <h3 className="font-bold text-blue-900 mb-2">Apply Standard Fee to All</h3>
                                            <p className="text-sm text-blue-700 mb-6">
                                                This will apply the standard fees to all <strong>{studentList.length}</strong> students.
                                                <br />
                                                <span className="text-xs opacity-75">Note: Any previous individual overrides will be reset to this standard amount.</span>
                                            </p>
                                            <button onClick={handleApplyBatch} className="bg-blue-600 text-white py-2 px-6 rounded font-bold shadow hover:bg-blue-700 transition">
                                                Confirm Batch Apply
                                            </button>
                                        </div>
                                    )}

                                    {applicabilityMode === 'individual' && (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-sm text-gray-500">Year-wise Fee Entry. Only the column matching the student's current year is editable.</p>
                                                <button onClick={handleSaveStudentFees} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 shadow">Save Changes</button>
                                            </div>
                                            <div className="overflow-x-auto max-h-[500px] border rounded bg-white">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                                        <tr>
                                                            <th className="p-3 border-b font-semibold text-gray-600 w-32">Admission No</th>
                                                            <th className="p-3 border-b font-semibold text-gray-600 w-32">Pin Number</th>
                                                            <th className="p-3 border-b font-semibold text-gray-600">Student Name</th>
                                                            {/* Dynamic Year Columns based on Course Duration */}
                                                            {Array.from({ length: appTotalYears }, (_, i) => i + 1).map(y => (
                                                                <th key={y} className="p-3 border-b border-l text-center w-32 font-bold text-gray-700">Year {y}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {(() => {
                                                            // Group Students by current_year
                                                            const groupedStudents = {};
                                                            studentList.forEach(s => {
                                                                if (!groupedStudents[s.current_year]) groupedStudents[s.current_year] = [];
                                                                groupedStudents[s.current_year].push(s);
                                                            });

                                                            return Object.keys(groupedStudents).sort().map(yearStr => {
                                                                const y = Number(yearStr);
                                                                const students = groupedStudents[y];
                                                                const isExpanded = expandedYears[y] ?? true; // Default expanded

                                                                return (
                                                                    <React.Fragment key={y}>
                                                                        {/* Group Header */}
                                                                        <tr className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition" onClick={() => toggleYearExpand(y)}>
                                                                            <td colSpan={3 + appTotalYears} className="p-2 font-bold text-blue-800 border-b border-blue-200">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                                                    Year {y} Students ({students.length})
                                                                                </div>
                                                                            </td>
                                                                        </tr>

                                                                        {/* Student Rows */}
                                                                        {isExpanded && students.map((s, idx) => (
                                                                            <tr key={s.studentId} className="hover:bg-gray-50 border-b">
                                                                                <td className="p-3 font-mono text-gray-600 text-xs pl-8 border-l-4 border-l-transparent bg-white">{s.studentId}</td>
                                                                                <td className="p-3 font-mono text-gray-600 text-xs bg-white">{s.pinNo}</td>
                                                                                <td className="p-3 font-medium text-gray-800 bg-white">{s.studentName}</td>

                                                                                {/* Dynamic Year Inputs */}
                                                                                {Array.from({ length: appTotalYears }, (_, i) => i + 1).map(yearCol => (
                                                                                    <td key={yearCol} className={`p-2 border-l text-center ${s.current_year === yearCol ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                                                        {s.current_year === yearCol ? (
                                                                                            <input
                                                                                                type="number"
                                                                                                className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-gray-900"
                                                                                                value={s.amount || ''}
                                                                                                placeholder="0"
                                                                                                onChange={(e) => {
                                                                                                    // IMPORTANT: We need to find the index in original studentList
                                                                                                    const originalIndex = studentList.findIndex(st => st.studentId === s.studentId);
                                                                                                    if (originalIndex === -1) return;

                                                                                                    const newList = [...studentList];
                                                                                                    newList[originalIndex].amount = e.target.value;
                                                                                                    setStudentList(newList);
                                                                                                }}
                                                                                                onClick={(e) => e.stopPropagation()} // Prevent row collapse
                                                                                            />
                                                                                        ) : (
                                                                                            <span className="text-gray-300 text-xs">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                ))}
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {studentList.length === 0 && loadingStudents && <p className="text-gray-500 text-center animate-pulse">Loading students...</p>}
                        </div>
                    )
                }
            </div >
        </div >
    );
};

export default FeeConfiguration;
