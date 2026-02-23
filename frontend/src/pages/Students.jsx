import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';

const Students = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            // Super Admin sees all; others see scoped
            const isSuperAdmin = user?.role === 'superadmin';
            const collegeParam = (!isSuperAdmin && user?.college) ? `?college=${encodeURIComponent(user.college)}` : '';

            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/students${collegeParam}`);
            setStudents(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error:', err);
            setError('Failed to load students. Check database connection.');
            setLoading(false);
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

    // Dynamic Categories based on Course & Branch
    const availableCategories = useMemo(() => {
        let list = students;
        if (courseFilter) list = list.filter(s => s.course === courseFilter);
        if (branchFilter) list = list.filter(s => s.branch === branchFilter);
        return [...new Set(list.map(s => s.stud_type).filter(Boolean))];
    }, [students, courseFilter, branchFilter]);

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-8 overflow-hidden flex flex-col">
                <header className="mb-4 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
                        <p className="text-sm text-gray-500 mt-1">View and search student records.</p>
                    </div>
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
        </div>
    );
};

export default Students;
