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
        batch: '', studentYear: '', amount: '', // Replaced academicYear with batch
        semester: '' // '1', '2' or empty for yearly
    });
    const [feeType, setFeeType] = useState('Yearly'); // 'Yearly' or 'Semester'
    const [semAmounts, setSemAmounts] = useState({ 1: '', 2: '' }); // For simultaneous creation
    const [bulkAmounts, setBulkAmounts] = useState({}); // For "All Years" creation: { 1: '', 2: '', ... }
    const [isMultiYear, setIsMultiYear] = useState(true); // Default to true (Always All Years)

    // Helper to generate Academic Years (Still useful for some display?)
    const currentYear = new Date().getFullYear();
    const academicYears = ['ALL', ...Array.from({ length: 9 }, (_, i) => `${currentYear - 4 + i}-${currentYear - 3 + i}`)];

    const [editingId, setEditingId] = useState(null);
    const [filterCollege, setFilterCollege] = useState('');
    const [filterCourse, setFilterCourse] = useState('');

    // --- TAB 3: APPLICABILITY (Assignment) ---
    const [appContext, setAppContext] = useState({
        college: '', course: '', branch: '', studentYear: '', semester: '', feeHeadId: '', batch: ''
        // Removed academicYear
    });
    const [batches, setBatches] = useState([]); // Store batch list
    const [studentList, setStudentList] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [isBatchApplied, setIsBatchApplied] = useState(false);
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
            setMetadata(response.data.hierarchy || response.data); // Handle both old and new format
            if (response.data.batches) setBatches(response.data.batches);
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
            if (editingId) {
                // Update existing
                await axios.put(`${import.meta.env.VITE_API_URL}/api/fee-structures/${editingId}`, structForm);
            } else {
                // Determine Years to Process from Metadata
                const selectedMeta = (structForm.college && structForm.course) ? metadata[structForm.college]?.[structForm.course] : null;
                const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 4;

                const requests = [];
                for (let y = 1; y <= yearsCount; y++) {
                    if (feeType === 'Yearly') {
                        const amount = bulkAmounts[`${y}-Y`];
                        if (amount) {
                            requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, {
                                ...structForm,
                                studentYear: y,
                                semester: null,
                                amount: Number(amount),
                                batch: structForm.batch // Explicitly ensure batch is sent
                            }));
                        }
                    } else {
                        // Semester Wise
                        const s1 = bulkAmounts[`${y}-S1`];
                        const s2 = bulkAmounts[`${y}-S2`];
                        if (s1) requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, { ...structForm, studentYear: y, semester: 1, amount: Number(s1), batch: structForm.batch }));
                        if (s2) requests.push(axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures`, { ...structForm, studentYear: y, semester: 2, amount: Number(s2), batch: structForm.batch }));
                    }
                }

                if (requests.length === 0) { alert('Please enter at least one amount.'); return; }
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
        const { college, course, branch, studentYear, feeHeadId, batch } = appContext;

        const isExcelMode = applicabilityMode === 'individual';

        if (!college || !course || !branch || !batch || !feeHeadId) {
            alert("Please select College, Fee Head, Batch, Course, and Branch.");
            return;
        }

        // In Batch Mode, we fetch ALL students

        setLoadingStudents(true);
        try {
            // 1. Fetch Students (All for the batch)
            const studentsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/students`);

            // Filter: Match College, Course, Branch, and Batch
            const batchStudents = studentsRes.data.filter(s =>
                s.college === college &&
                s.course === course &&
                s.branch === branch &&
                (String(s.batch) === String(batch))
            );
            console.log("Filtered Students for Applicability:", batchStudents.length, batchStudents);

            // 2. Fetch Existing Fee Records (Real Data)
            let existingFees = [];
            try {
                // Fetch ALL fees for this batch/feeHead (not just for current year)
                const feeRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures/batch-fees`, {
                    college, course, branch, batch, feeHeadId
                });
                existingFees = feeRes.data;
            } catch (e) { console.error("Error fetching fee records", e); }

            // Update Applied Status
            setIsBatchApplied(existingFees.length > 0);

            // 3. Prepare List with ALL Years data
            const list = batchStudents.map(s => {
                const sYear = s.current_year;
                const relevantFees = existingFees.filter(f => f.studentId === s.admission_number);

                // Build an object with amounts for each student year (1..4)
                const yearsData = {};
                // Pre-fill with Templates
                structures.filter(st =>
                    st.college === college && st.course === course && st.branch === branch &&
                    String(st.batch) === String(batch) &&
                    st.feeHead._id === feeHeadId
                ).forEach(st => {
                    // Check semester logic
                    if (appContext.semester) {
                        if (Number(st.semester) === Number(appContext.semester)) {
                            yearsData[st.studentYear] = st.amount;
                        }
                    } else if (!st.semester) {
                        yearsData[st.studentYear] = st.amount;
                    }
                });

                // Override with Existing Student Fees if present
                relevantFees.forEach(f => {
                    if (appContext.semester) {
                        if (Number(f.semester) === Number(appContext.semester)) {
                            yearsData[f.studentYear] = f.amount;
                        }
                    } else if (!f.semester) {
                        yearsData[f.studentYear] = f.amount;
                    }
                });

                return {
                    studentId: s.admission_number,
                    studentName: s.student_name,
                    pinNo: s.pin_no || '-',
                    current_year: sYear,
                    fees: yearsData, // e.g., { 1: 50000, 2: 50000, ... }
                };
            });

            setStudentList(list);

        } catch (error) { console.error(error); }
        setLoadingStudents(false);
    };

    const handleApplyBatch = async () => {
        if (!window.confirm(`Apply Fee to ALL students in this list?`)) return;

        try {
            // Processing ALL years for this Batch
            const yearsToProcess = Array.from({ length: appTotalYears }, (_, i) => i + 1);

            let processedCount = 0;

            for (const year of yearsToProcess) {
                // Find structure for this specific year
                let template = structures.find(s =>
                    s.college === appContext.college && s.course === appContext.course && s.branch === appContext.branch &&
                    s.batch === appContext.batch && // Match Batch
                    s.studentYear === year &&
                    s.feeHead._id === appContext.feeHeadId &&
                    (appContext.semester ? s.semester === Number(appContext.semester) : !s.semester)
                );

                if (template) {
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/fee-structures/apply-batch`, {
                        structureId: template._id,
                        batch: appContext.batch
                    });
                    processedCount++;
                }
            }

            if (processedCount === 0) {
                alert("No matching Fee Structures found or Fees already applied.");
            } else {
                setMessage(`Fees applied successfully for ${processedCount} year groups!`);
                setTimeout(() => setMessage(''), 3000);
            }

        } catch (error) {
            const msg = error.response?.data?.message || "Failed to apply batch";
            alert(msg);
        }
    };

    const handleSaveStudentFees = async () => {
        try {
            // Flatten the studentList to extract all fee entries
            const fees = [];
            studentList.forEach(s => {
                Object.keys(s.fees).forEach(year => {
                    const amt = s.fees[year];
                    if (amt !== undefined && amt !== null && amt !== '') {
                        fees.push({
                            studentId: s.studentId,
                            studentName: s.studentName,
                            feeHeadId: appContext.feeHeadId,
                            college: appContext.college,
                            course: appContext.course,
                            branch: appContext.branch,
                            batch: appContext.batch,
                            studentYear: Number(year),
                            semester: appContext.semester,
                            amount: amt
                        });
                    }
                });
            });

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
        const key = `${s.college}|${s.course}|${s.branch}|${s.batch}|${s.feeHead?._id}`;
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
                                {/* Row 1: College & Batch */}
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="w-full border p-2 rounded" value={structForm.college} onChange={e => { setStructForm({ ...structForm, college: e.target.value }); }} required><option value="">Select College</option>{colleges.map(c => <option key={c}>{c}</option>)}</select>
                                    <select className="w-full border p-2 rounded" value={structForm.batch} onChange={e => setStructForm({ ...structForm, batch: e.target.value })} required>
                                        <option value="">Select Batch</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                {/* Row 2: Course & Branch */}
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="w-full border p-2 rounded" value={structForm.course} onChange={e => { setStructForm({ ...structForm, course: e.target.value }); }} required disabled={!structForm.college}><option value="">Select Course</option>{(structForm.college ? Object.keys(metadata[structForm.college] || {}) : []).map(c => <option key={c}>{c}</option>)}</select>
                                    <select className="w-full border p-2 rounded" value={structForm.branch} onChange={e => setStructForm({ ...structForm, branch: e.target.value })} required disabled={!structForm.course}><option value="">Select Branch</option>{((structForm.college && structForm.course) ? metadata[structForm.college][structForm.course].branches : []).map(b => <option key={b}>{b}</option>)}</select>
                                </div>

                                {/* Row 3: Fee Head */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Fee Head</label>
                                    <select className="w-full border p-2 rounded mt-1" value={structForm.feeHeadId} onChange={e => setStructForm({ ...structForm, feeHeadId: e.target.value })} required><option value="">Select Fee Head</option>{feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}</select>
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
                                                <div className="mt-1 text-black font-semibold">Batch: {row.batch}</div>
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

                                {/* Strict Order: College -> Batch -> Course -> Branch -> Fee Head */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {/* 1. College */}
                                    <div><label className="text-xs font-bold text-gray-500">College</label><select className="w-full border p-2 rounded mt-1" value={appContext.college} onChange={e => setAppContext({ ...appContext, college: e.target.value, course: '', branch: '', studentYear: '' })}><option value="">Select...</option>{colleges.map(c => <option key={c}>{c}</option>)}</select></div>

                                    {/* 2. Batch (Required) */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Batch</label>
                                        <select className="w-full border p-2 rounded mt-1" value={appContext.batch} onChange={e => setAppContext({ ...appContext, batch: e.target.value })}>
                                            <option value="">Select Batch</option>
                                            {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>

                                    {/* 3. Course */}
                                    <div><label className="text-xs font-bold text-gray-500">Course</label><select className="w-full border p-2 rounded mt-1" value={appContext.course} onChange={e => setAppContext({ ...appContext, course: e.target.value, branch: '', studentYear: '' })} disabled={!appContext.college}><option value="">Select...</option>{appCourses.map(c => <option key={c}>{c}</option>)}</select></div>

                                    {/* 4. Branch */}
                                    <div><label className="text-xs font-bold text-gray-500">Branch</label><select className="w-full border p-2 rounded mt-1" value={appContext.branch} onChange={e => setAppContext({ ...appContext, branch: e.target.value })} disabled={!appContext.course}><option value="">Select...</option>{appBranches.map(c => <option key={c}>{c}</option>)}</select></div>

                                    {/* 5. Fee Head */}
                                    <div><label className="text-xs font-bold text-gray-500">Fee Head</label><select className="w-full border p-2 rounded mt-1" value={appContext.feeHeadId} onChange={e => setAppContext({ ...appContext, feeHeadId: e.target.value })}><option value="">Select...</option>{feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
                                </div>
                                {/* <div className="text-xs text-gray-400 mt-1">* Fee Head is now at the end. Branch filter depends on Course.</div> */}

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
                                                <div className="flex flex-col">
                                                    <p className="text-sm text-gray-500">Edit fee amounts for all years. {appContext.semester ? `(Semester ${appContext.semester} Only)` : ''}</p>
                                                    {isBatchApplied ? (
                                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded w-fit mt-1">✓ Fees Applied (Showing Actuals)</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded w-fit mt-1">⚠ Fees Not Applied (Showing Templates)</span>
                                                    )}
                                                </div>
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
                                                        {studentList.map((s, idx) => (
                                                            <tr key={s.studentId} className="hover:bg-gray-50 border-b">
                                                                <td className="p-3 font-mono text-gray-600 text-xs bg-white">{s.studentId}</td>
                                                                <td className="p-3 font-mono text-gray-600 text-xs bg-white">{s.pinNo}</td>
                                                                <td className="p-3 font-medium text-gray-800 bg-white">{s.studentName}</td>

                                                                {/* Dynamic Year Inputs (All Available) */}
                                                                {Array.from({ length: appTotalYears }, (_, i) => i + 1).map(yearCol => (
                                                                    <td key={yearCol} className="p-2 border-l text-center">
                                                                        <input
                                                                            type="number"
                                                                            className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-gray-900"
                                                                            value={s.fees[yearCol] || ''}
                                                                            placeholder="-"
                                                                            onChange={(e) => {
                                                                                const newList = [...studentList];
                                                                                const newFees = { ...newList[idx].fees, [yearCol]: e.target.value };
                                                                                newList[idx].fees = newFees;
                                                                                setStudentList(newList);
                                                                            }}
                                                                        />
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
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
