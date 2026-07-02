import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import Sidebar from './Sidebar';

const initialStudentState = {
    admission_number: '',
    pin_no: '',
    student_name: '',
    father_name: '',
    student_mobile: '',
    email: '',
    college: '',
    course: '',
    branch: '',
    batch: '',
    student_status: '',
    stud_type: '',
    caste: '',
    current_year: '',
    current_semester: ''
};

const Students = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState(initialStudentState);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const showToastMessage = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 4000);
    };

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        fetchStudents();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const response = await api.get('/students/metadata');
            setMetadata(response.data);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    };

    const fetchStudents = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const isSuperAdmin = user?.role === 'superadmin';
            
            let queryParams = [];
            if (!isSuperAdmin) {
                if (user?.colleges && user.colleges.length > 0) {
                    queryParams.push(`college=${encodeURIComponent(user.colleges.join(','))}`);
                } else if (user?.college) {
                    queryParams.push(`college=${encodeURIComponent(user.college)}`);
                }
                
                if (user?.courses && user.courses.length > 0) {
                    const courseNames = [...new Set(user.courses.map(c => c.split('|')[1]))];
                    queryParams.push(`course=${encodeURIComponent(courseNames.join(','))}`);
                }
            }
            const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

            const response = await api.get(`/students${queryString}`);
            setStudents(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error:', err);
            setError('Failed to load students. Check database connection.');
            setLoading(false);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        
        if (!newStudent.admission_number || !newStudent.pin_no || !newStudent.student_name || !newStudent.college || !newStudent.course || !newStudent.branch || !newStudent.batch) {
            showToastMessage("Please fill in all required fields.", "error");
            return;
        }

        setIsSaving(true);
        try {
            // Auto-calculate year, semester, and status based on batch
            const courseDuration = metadata?.hierarchy?.[newStudent.college]?.[newStudent.course]?.total_years || 4;
            const batchYear = parseInt(newStudent.batch);
            
            let resolvedYear = 1;
            let resolvedSem = 1;
            let resolvedStatus = 'Active';

            if (!isNaN(batchYear)) {
                const today = new Date();
                const curYear = today.getFullYear();
                const curMonth = today.getMonth() + 1;

                let yearElapsed = 1;
                if (curMonth >= 6) {
                    yearElapsed = curYear - batchYear + 1;
                } else {
                    yearElapsed = curYear - batchYear;
                }
                yearElapsed = Math.max(1, yearElapsed);

                resolvedYear = yearElapsed;
                resolvedSem = (curMonth >= 6 || curMonth === 12) ? 1 : 2;

                if (yearElapsed > courseDuration) {
                    resolvedStatus = 'Course Completed';
                    resolvedYear = courseDuration;
                }
            }

            const payload = {
                ...newStudent,
                current_year: resolvedYear,
                current_semester: resolvedSem,
                student_status: resolvedStatus,
                stud_type: newStudent.stud_type || null,
                caste: newStudent.caste || null
            };

            const res = await api.post('/students', payload);
            showToastMessage(res.data.message || 'Student created successfully!', "success");
            setShowAddModal(false);
            setNewStudent(initialStudentState);
            fetchStudents(); // Refresh list
        } catch (err) {
            console.error(err);
            showToastMessage(err.response?.data?.message || 'Failed to create student.', "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Derived state for filtering
    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const matchesSearch =
                (student.student_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (student.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (student.student_mobile?.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter ? student.student_status === statusFilter : true;
            const matchesBranch = branchFilter ? student.branch === branchFilter : true;
            const matchesCourse = courseFilter ? student.course === courseFilter : true;
            const matchesCategory = categoryFilter ? student.stud_type === categoryFilter : true;

            return matchesSearch && matchesStatus && matchesBranch && matchesCourse && matchesCategory;
        });
    }, [students, searchTerm, statusFilter, branchFilter, courseFilter, categoryFilter]);

    // Unique values for dropdowns
    const branches = [...new Set(students.map(s => s.branch).filter(Boolean))];
    const courses = [...new Set(students.map(s => s.course).filter(Boolean))];
    const statuses = [...new Set(students.map(s => s.student_status).filter(Boolean))];

    const availableCategories = useMemo(() => {
        let list = students;
        if (courseFilter) list = list.filter(s => s.course === courseFilter);
        if (branchFilter) list = list.filter(s => s.branch === branchFilter);
        return [...new Set(list.map(s => s.stud_type).filter(Boolean))];
    }, [students, courseFilter, branchFilter]);

    const batchOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= 2015; y--) {
            years.push(String(y));
        }
        if (metadata?.batches) {
            metadata.batches.forEach(b => {
                if (b && !years.includes(String(b)) && Number(b) <= currentYear) {
                    years.push(String(b));
                }
            });
        }
        return years.sort((a, b) => Number(b) - Number(a));
    }, [metadata]);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8 overflow-hidden flex flex-col">
                 <header className="mb-4 flex justify-between items-center">
                     <div>
                         <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
                         <p className="text-sm text-gray-500 mt-1">View and search student records.</p>
                     </div>
                     <button
                         onClick={() => {
                             setNewStudent(initialStudentState);
                             setShowAddModal(true);
                         }}
                         className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition active:scale-95"
                     >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                         Add Student
                     </button>
                 </header>

                {/* Filters Section */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search Name, Adm No, Mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <select
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">All Courses</option>
                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        disabled={!courseFilter || !branchFilter}
                    >
                        <option value="">{(!courseFilter || !branchFilter) ? 'Select Course & Branch' : 'All Categories'}</option>
                        {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">All Statuses</option>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <button
                        onClick={() => { setSearchTerm(''); setBranchFilter(''); setStatusFilter(''); setCourseFilter(''); setCategoryFilter(''); }}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                        Clear Filters
                    </button>

                    <div className="ml-auto text-sm text-gray-500">
                        Showing {filteredStudents.length} / {students.length}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center flex-1">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                        {error}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left border-collapse relative">
                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Adm No</th>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Student Name</th>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Father Name</th>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Course / Branch</th>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Mobile</th>
                                        <th className="py-3 px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredStudents.length === 0 ? (
                                        <tr>
                                            <td className="py-8 text-center text-gray-500" colSpan="6">
                                                No matches found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((student) => (
                                            <tr key={student.id || Math.random()} className="hover:bg-gray-50 transition duration-150">
                                                <td className="py-3 px-4 text-sm font-medium text-gray-900">{student.admission_number}</td>
                                                <td className="py-3 px-4 text-sm text-gray-700">{student.student_name}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">{student.father_name}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {student.course} - <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{student.branch}</span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">{student.student_mobile}</td>
                                                <td className="py-3 px-4 text-sm">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${student.student_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {student.student_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleUp">
                        <div className="bg-gray-50 border-b border-gray-100 p-5 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Add New Student</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                {/* Admission number */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Admission Number *</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.admission_number}
                                        onChange={e => setNewStudent({ ...newStudent, admission_number: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. ADM2026001"
                                    />
                                </div>

                                {/* Pin Number */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Pin Number *</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.pin_no}
                                        onChange={e => setNewStudent({ ...newStudent, pin_no: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. 21001-C-001"
                                    />
                                </div>

                                {/* Student Name */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Student Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={newStudent.student_name}
                                        onChange={e => setNewStudent({ ...newStudent, student_name: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>

                                {/* Father Name */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Father's Name</label>
                                    <input
                                        type="text"
                                        value={newStudent.father_name}
                                        onChange={e => setNewStudent({ ...newStudent, father_name: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. Richard Doe"
                                    />
                                </div>

                                {/* College */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">College *</label>
                                    <select
                                        required
                                        value={newStudent.college}
                                        onChange={e => setNewStudent({ ...newStudent, college: e.target.value, course: '', branch: '' })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                                    >
                                        <option value="">-- Choose College --</option>
                                        {metadata?.hierarchy && Object.keys(metadata.hierarchy).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Course */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Course *</label>
                                    <select
                                        required
                                        disabled={!newStudent.college}
                                        value={newStudent.course}
                                        onChange={e => setNewStudent({ ...newStudent, course: e.target.value, branch: '', current_year: 1 })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                        <option value="">-- Choose Course --</option>
                                        {metadata?.hierarchy && newStudent.college && Object.keys(metadata.hierarchy[newStudent.college] || {}).map(course => (
                                            <option key={course} value={course}>{course}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Branch */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Branch *</label>
                                    <select
                                        required
                                        disabled={!newStudent.course}
                                        value={newStudent.branch}
                                        onChange={e => setNewStudent({ ...newStudent, branch: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                                    >
                                        <option value="">-- Choose Branch --</option>
                                        {metadata?.hierarchy && newStudent.college && newStudent.course && (metadata.hierarchy[newStudent.college][newStudent.course]?.branches || []).map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Batch */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Batch *</label>
                                    <select
                                        required
                                        value={newStudent.batch}
                                        onChange={e => setNewStudent({ ...newStudent, batch: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                                    >
                                        <option value="">-- Choose Batch Year --</option>
                                        {batchOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Mobile */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mobile Number</label>
                                    <input
                                        type="text"
                                        value={newStudent.student_mobile}
                                        onChange={e => setNewStudent({ ...newStudent, student_mobile: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. 9876543210"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={newStudent.email}
                                        onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                        placeholder="e.g. student@example.com"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl shadow-lg hover:shadow-blue-200 transition active:scale-95 flex items-center gap-1.5"
                                >
                                    {isSaving && <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>}
                                    {isSaving ? 'Adding...' : 'Add Student'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Custom Toast Alert */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 transform translate-y-0 ${
                    toast.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-800' 
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold">{toast.type === 'success' ? 'Success' : 'Error'}</p>
                        <p className="text-xs font-semibold text-gray-600 mt-0.5">{toast.message}</p>
                    </div>
                    <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Students;
