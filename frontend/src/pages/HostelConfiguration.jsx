import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Building2, X, DollarSign, UserPlus, Edit2, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';

const API_URL = import.meta.env.VITE_API_URL;

const HostelConfiguration = () => {
  const [activeTab, setActiveTab] = useState('hostel-details'); // hostel-details | fee-structure

  // Hostel details (read-only)
  const [hostels, setHostels] = useState([]);
  const [hostelDetails, setHostelDetails] = useState({}); // { [hostelId]: { categories: [], rooms: [] } }
  const [loadingHostels, setLoadingHostels] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  // Fee structure
  const [hostelFeeStructures, setHostelFeeStructures] = useState([]);
  const [feeStructureFilterHostel, setFeeStructureFilterHostel] = useState('');
  const [feeStructureFilterYear, setFeeStructureFilterYear] = useState('');
  const [categoriesForFeeStructure, setCategoriesForFeeStructure] = useState([]);
  const [categoriesForFeeTable, setCategoriesForFeeTable] = useState([]);
  const [feeStructureForm, setFeeStructureForm] = useState({ academicYear: '', hostelId: '', course: '', studentYears: [1], categoryAmounts: {}, description: '' });
  const [currentFeeStructure, setCurrentFeeStructure] = useState(null);
  const [isFeeStructureModalOpen, setIsFeeStructureModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyStructure, setApplyStructure] = useState(null);
  const [applySearch, setApplySearch] = useState('');
  const [applyFoundStudents, setApplyFoundStudents] = useState([]);
  const [applySelectedIds, setApplySelectedIds] = useState([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [metadata, setMetadata] = useState({});

  const currentYear = new Date().getFullYear();

  // Course options: from student metadata (all colleges) + existing fee structure courses
  const courseOptions = useMemo(() => {
    const fromMeta = [];
    const hierarchy = metadata.hierarchy || metadata;
    if (typeof hierarchy === 'object') {
      Object.values(hierarchy).forEach((college) => {
        if (college && typeof college === 'object') {
          Object.keys(college).forEach((course) => {
            if (course && !fromMeta.includes(course)) fromMeta.push(course);
          });
        }
      });
    }
    const fromStructures = (hostelFeeStructures || [])
      .map((fs) => (fs.course || '').trim())
      .filter(Boolean);
    const combined = [...new Set([...fromMeta, ...fromStructures])].sort((a, b) => a.localeCompare(b));
    return combined;
  }, [metadata, hostelFeeStructures]);

  // Student year options: dynamic per course from SQL courses.total_years (metadata.courseYears)
  const yearOptions = useMemo(() => {
    const course = (feeStructureForm.course || '').trim();
    if (!course) return Array.from({ length: 4 }, (_, i) => i + 1);
    const courseYears = metadata.courseYears || {};
    let total = courseYears[course];
    if (total == null) {
      const hierarchy = metadata.hierarchy || metadata;
      for (const college of Object.values(hierarchy)) {
        if (college && college[course] && (college[course].total_years != null)) {
          total = Math.max(1, Math.min(Number(college[course].total_years) || 4, 10));
          break;
        }
      }
    }
    if (total == null) total = 4;
    total = Math.max(1, Math.min(Number(total), 10));
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [metadata, feeStructureForm.course]);

  const academicYears = Array.from({ length: 5 }, (_, i) => `${currentYear - 2 + i}-${currentYear - 1 + i}`);

  const fetchHostels = async () => {
    setLoadingHostels(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/hostels`);
      setHostels(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch hostels. Is MONGO_HOSTEL_URI set?');
      setHostels([]);
    } finally {
      setLoadingHostels(false);
    }
  };

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/students/metadata`).then((r) => setMetadata(r.data || {})).catch(() => setMetadata({}));
  }, []);

  // When on Hostel details tab, fetch categories and rooms for each hostel
  useEffect(() => {
    if (activeTab !== 'hostel-details' || hostels.length === 0) return;
    setLoadingDetails(true);
    const details = {};
    const promises = hostels.map(async (h) => {
      try {
        const [catRes, roomRes] = await Promise.all([
          axios.get(`${API_URL}/api/hostels/${h._id}/categories`),
          axios.get(`${API_URL}/api/hostels/rooms`, { params: { hostelId: h._id } })
        ]);
        details[h._id] = { categories: catRes.data, rooms: roomRes.data };
      } catch {
        details[h._id] = { categories: [], rooms: [] };
      }
    });
    Promise.all(promises).then(() => {
      setHostelDetails(details);
      setLoadingDetails(false);
    });
  }, [activeTab, hostels]);

  const fetchHostelFeeStructures = async () => {
    try {
      const params = {};
      if (feeStructureFilterHostel) params.hostelId = feeStructureFilterHostel;
      if (feeStructureFilterYear) params.academicYear = feeStructureFilterYear;
      const res = await axios.get(`${API_URL}/api/hostels/fee-structures`, { params });
      setHostelFeeStructures(res.data);
    } catch {
      setHostelFeeStructures([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'fee-structure') fetchHostelFeeStructures();
  }, [activeTab, feeStructureFilterHostel, feeStructureFilterYear]);

  useEffect(() => {
    if (feeStructureForm.hostelId) {
      axios.get(`${API_URL}/api/hostels/${feeStructureForm.hostelId}/categories`).then((r) => setCategoriesForFeeStructure(r.data)).catch(() => setCategoriesForFeeStructure([]));
    } else setCategoriesForFeeStructure([]);
  }, [feeStructureForm.hostelId]);

  useEffect(() => {
    if (feeStructureFilterHostel) {
      axios.get(`${API_URL}/api/hostels/${feeStructureFilterHostel}/categories`).then((r) => setCategoriesForFeeTable(r.data)).catch(() => setCategoriesForFeeTable([]));
    } else setCategoriesForFeeTable([]);
  }, [feeStructureFilterHostel]);

  const openFeeStructureModal = (row = null) => {
    setCurrentFeeStructure(row);
    if (row) {
      const categoryAmounts = {};
      (row.structures || []).forEach((s) => {
        const catId = s.categoryId || s.category?._id || s.category;
        if (catId) categoryAmounts[catId] = s.amount ?? '';
      });
      setFeeStructureForm({
        academicYear: row.academicYear,
        hostelId: row.hostelId || feeStructureFilterHostel,
        course: row.course || '',
        studentYears: row.studentYear != null ? [row.studentYear] : [1],
        categoryAmounts,
        description: row.description || ''
      });
    } else {
      const categoryAmounts = {};
      categoriesForFeeTable.forEach((c) => { categoryAmounts[c._id] = ''; });
      setFeeStructureForm({
        academicYear: feeStructureFilterYear || academicYears[0] || '',
        hostelId: feeStructureFilterHostel || '',
        course: '',
        studentYears: [1],
        categoryAmounts: Object.keys(categoryAmounts).length ? categoryAmounts : {},
        description: ''
      });
    }
    setIsFeeStructureModalOpen(true);
  };

  const toggleFeeStructureYear = (year) => {
    setFeeStructureForm((prev) => {
      const next = prev.studentYears.includes(year)
        ? prev.studentYears.filter((y) => y !== year)
        : [...prev.studentYears, year].sort((a, b) => a - b);
      return { ...prev, studentYears: next.length ? next : [year] };
    });
  };

  const handleFeeStructureSubmit = async (e) => {
    e.preventDefault();
    const courseVal = (feeStructureForm.course || '').trim();
    const years = Array.isArray(feeStructureForm.studentYears) ? feeStructureForm.studentYears.map(Number).filter((y) => !isNaN(y) && y >= 1) : [];
    if (!feeStructureForm.academicYear || !feeStructureForm.hostelId || !courseVal) {
      alert('Academic year, hostel and course are required');
      return;
    }
    if (years.length === 0) {
      alert('Select at least one student year');
      return;
    }
    const categoryAmounts = (categoriesForFeeStructure.length ? categoriesForFeeStructure : categoriesForFeeTable).map((c) => ({
      categoryId: c._id,
      amount: Number(feeStructureForm.categoryAmounts[c._id]) || 0
    }));
    if (categoryAmounts.every((a) => a.amount === 0)) {
      alert('Enter at least one category amount');
      return;
    }
    try {
      for (const studentYear of years) {
        await axios.post(`${API_URL}/api/hostels/fee-structures/bulk-upsert`, {
          academicYear: feeStructureForm.academicYear,
          hostelId: feeStructureForm.hostelId,
          course: courseVal,
          studentYear,
          categoryAmounts,
          description: feeStructureForm.description || ''
        });
      }
      fetchHostelFeeStructures();
      setIsFeeStructureModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDeleteFeeStructureByRow = async (academicYear, course, hostelId, studentYear) => {
    const effectiveHostelId = hostelId || feeStructureFilterHostel;
    if (!effectiveHostelId) return;
    if (!window.confirm(`Delete all fee structures for ${academicYear} / ${course} / Year ${studentYear ?? ''}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/hostels/fee-structures/by-row`, {
        data: { academicYear, hostelId: effectiveHostelId, course: (course || '').trim(), studentYear: studentYear != null ? Number(studentYear) : undefined }
      });
      fetchHostelFeeStructures();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const openApplyModal = (structure) => {
    setApplyStructure(structure);
    setApplySearch('');
    setApplyFoundStudents([]);
    setApplySelectedIds([]);
    setIsApplyModalOpen(true);
  };

  const handleApplySearch = async (e) => {
    e.preventDefault();
    if (!applySearch.trim()) return;
    setApplyLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/students`);
      const term = applySearch.toLowerCase();
      const matches = res.data.filter((s) =>
        (s.admission_number && String(s.admission_number).toLowerCase().includes(term)) ||
        (s.student_name && s.student_name.toLowerCase().includes(term)) ||
        (s.student_mobile && String(s.student_mobile).includes(applySearch))
      );
      setApplyFoundStudents(matches);
    } catch {
      setApplyFoundStudents([]);
    } finally {
      setApplyLoading(false);
    }
  };

  const toggleApplyStudent = (admissionNo) => {
    setApplySelectedIds((prev) =>
      prev.includes(admissionNo) ? prev.filter((id) => id !== admissionNo) : [...prev, admissionNo]
    );
  };

  const handleApplySubmit = async () => {
    if (!applyStructure || applySelectedIds.length === 0) {
      alert('Select at least one student');
      return;
    }
    setApplySubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/hostels/fee-structures/apply`, {
        hostelFeeStructureId: applyStructure._id,
        studentIds: applySelectedIds
      });
      alert(res.data.message || `Applied to ${res.data.applied} student(s)`);
      setIsApplyModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Apply failed');
    } finally {
      setApplySubmitting(false);
    }
  };

  // Rows: group by (academicYear, hostelId, course, studentYear)
  const feeStructureRows = useMemo(() => {
    if (!Array.isArray(hostelFeeStructures)) return [];
    const byKey = {};
    hostelFeeStructures.forEach((fs) => {
      const hostelId = fs.hostel?._id || fs.hostel;
      if (feeStructureFilterHostel && hostelId !== feeStructureFilterHostel) return;
      const course = (fs.course || '').trim();
      const studentYear = fs.studentYear != null ? Number(fs.studentYear) : 1;
      const key = feeStructureFilterHostel
        ? `${fs.academicYear}|${course}|${studentYear}`
        : `${fs.academicYear}|${hostelId}|${course}|${studentYear}`;
      if (!byKey[key]) {
        byKey[key] = { academicYear: fs.academicYear, course, studentYear, hostelId, hostelName: fs.hostel?.name || '—', structures: [], description: fs.description };
      }
      const catId = fs.category?._id || fs.category;
      byKey[key].structures.push({ categoryId: catId, categoryName: fs.category?.name, amount: fs.amount, _id: fs._id });
    });
    return Object.values(byKey).sort((a, b) => {
      if (a.academicYear !== b.academicYear) return (b.academicYear || '').localeCompare(a.academicYear || '');
      if (!feeStructureFilterHostel && (a.hostelName || '') !== (b.hostelName || '')) return (a.hostelName || '').localeCompare(b.hostelName || '');
      if ((a.course || '') !== (b.course || '')) return (a.course || '').localeCompare(b.course || '');
      return (a.studentYear ?? 1) - (b.studentYear ?? 1);
    });
  }, [hostelFeeStructures, feeStructureFilterHostel]);

  // Category columns: when a hostel is selected use its categories; when "All" use unique categories from data
  const feeStructureCategoryColumns = useMemo(() => {
    if (feeStructureFilterHostel && categoriesForFeeTable.length > 0) return categoriesForFeeTable;
    const seen = new Map();
    (hostelFeeStructures || []).forEach((fs) => {
      const cat = fs.category;
      const id = cat?._id || cat;
      const name = cat?.name || '—';
      if (id && !seen.has(id)) seen.set(id, { _id: id, name });
    });
    return Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [feeStructureFilterHostel, categoriesForFeeTable, hostelFeeStructures]);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="flex-1 p-4 md:p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="text-gray-800" size={28} />
              Hostel Configuration
            </h1>
            <p className="text-sm text-gray-500 mt-1">View hostel details and manage fee structures (read-only hostel data).</p>
          </div>
          <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            {['hostel-details', 'fee-structure'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {tab === 'hostel-details' ? 'Hostel details' : 'Fee structures'}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            {error}
          </div>
        )}

        {/* --- HOSTEL DETAILS TAB (read-only: compact table) --- */}
        {activeTab === 'hostel-details' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingHostels ? (
              <div className="p-10 text-center text-gray-500 text-sm">Loading hostels...</div>
            ) : hostels.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm border-t border-gray-100">No hostels found. Check MONGO_HOSTEL_URI.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider w-48">Hostel</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider">Categories</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider">Rooms by category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hostels.map((hostel) => {
                      const details = hostelDetails[hostel._id] || { categories: [], rooms: [] };
                      const { categories = [], rooms = [] } = details;
                      const roomsByCategory = {};
                      rooms.forEach((r) => {
                        const catName = r.category?.name || 'Uncategorized';
                        if (!roomsByCategory[catName]) roomsByCategory[catName] = [];
                        roomsByCategory[catName].push(r.roomNumber || r);
                      });
                      const isLoading = loadingDetails && !details.categories?.length && !details.rooms?.length;
                      return (
                        <tr key={hostel._id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-2">
                              <Building2 className="text-slate-400 shrink-0 mt-0.5" size={18} />
                              <div>
                                <span className="font-semibold text-slate-800">{hostel.name}</span>
                                {hostel.description && (
                                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{hostel.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {isLoading ? (
                              <span className="text-slate-400 text-xs">Loading…</span>
                            ) : categories.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {categories.map((c) => (
                                  <span
                                    key={c._id}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                                    title={c.description || c.name}
                                  >
                                    {c.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {isLoading ? (
                              <span className="text-slate-400 text-xs">Loading…</span>
                            ) : rooms.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                {Object.entries(roomsByCategory).map(([catName, roomNumbers]) => (
                                  <div key={catName} className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-slate-500 text-xs font-medium shrink-0">{catName}:</span>
                                    <span className="font-mono text-slate-700 text-xs">
                                      {roomNumbers.map((rn, i) => (
                                        <span key={typeof rn === 'object' && rn?._id ? rn._id : i}>
                                          {i > 0 && ', '}
                                          {typeof rn === 'object' && rn != null && 'roomNumber' in rn ? rn.roomNumber : rn}
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- FEE STRUCTURE TAB --- */}
        {activeTab === 'fee-structure' && (
          <div>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Academic year</label>
                  <select
                    className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={feeStructureFilterYear}
                    onChange={(e) => setFeeStructureFilterYear(e.target.value)}
                  >
                    <option value="">All years</option>
                    {academicYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Hostel</label>
                  <select
                    className="border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={feeStructureFilterHostel}
                    onChange={(e) => setFeeStructureFilterHostel(e.target.value)}
                  >
                    <option value="">All hostels</option>
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => openFeeStructureModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition text-sm">
                <DollarSign size={16} /> Add fee structure
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="p-4 whitespace-nowrap">Academic year</th>
                    {!feeStructureFilterHostel && <th className="p-4 whitespace-nowrap">Hostel</th>}
                    <th className="p-4 whitespace-nowrap">Course</th>
                    <th className="p-4 whitespace-nowrap">Year</th>
                    {feeStructureCategoryColumns.map((c) => (
                      <th key={c._id} className="p-4 text-right whitespace-nowrap">{c.name} (₹)</th>
                    ))}
                    <th className="p-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {feeStructureRows.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (feeStructureFilterHostel ? 0 : 1) + feeStructureCategoryColumns.length} className="p-6 text-center text-gray-500">
                        No fee structures. Use filters or add one for an academic year, hostel, course and student year.
                      </td>
                    </tr>
                  ) : (
                    feeStructureRows.map((row) => (
                      <tr key={feeStructureFilterHostel ? `${row.academicYear}|${row.course}|${row.studentYear}` : `${row.academicYear}|${row.hostelId}|${row.course}|${row.studentYear}`} className="hover:bg-gray-50">
                        <td className="p-4 font-medium text-gray-800">{row.academicYear}</td>
                        {!feeStructureFilterHostel && <td className="p-4 font-medium text-gray-800">{row.hostelName}</td>}
                        <td className="p-4 font-medium text-gray-800">{row.course || '-'}</td>
                        <td className="p-4 font-medium text-gray-800">Year {row.studentYear ?? 1}</td>
                        {feeStructureCategoryColumns.map((c) => {
                          const s = row.structures.find((st) => String(st.categoryId || st.category) === String(c._id));
                          return (
                            <td key={c._id} className="p-4 text-right align-top">
                              {s != null ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-bold text-green-700">₹{Number(s.amount).toLocaleString()}</span>
                                  <button
                                    type="button"
                                    onClick={() => openApplyModal({ _id: s._id, amount: s.amount, hostel: { name: row.hostelName }, category: { name: s.categoryName }, academicYear: row.academicYear, course: row.course, studentYear: row.studentYear })}
                                    className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded flex items-center gap-1"
                                    title={`Apply ${s.categoryName} (₹${Number(s.amount).toLocaleString()}) to students`}
                                  >
                                    <UserPlus size={12} /> Apply
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <button onClick={() => openFeeStructureModal(row)} className="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Edit all categories"><Edit2 size={16} /></button>
                            <button onClick={() => handleDeleteFeeStructureByRow(row.academicYear, row.course, row.hostelId, row.studentYear)} className="text-red-600 hover:bg-red-50 p-2 rounded" title="Delete row"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fee structure modal */}
        {isFeeStructureModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-gray-800">{currentFeeStructure ? 'Edit fee structure (all categories)' : 'New fee structure (all categories)'}</h3>
                <button onClick={() => setIsFeeStructureModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleFeeStructureSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Academic year</label>
                    <select required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={feeStructureForm.academicYear} onChange={(e) => setFeeStructureForm({ ...feeStructureForm, academicYear: e.target.value })}>
                      <option value="">Select year</option>
                      {academicYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Hostel</label>
                    <select required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={feeStructureForm.hostelId} onChange={(e) => setFeeStructureForm({ ...feeStructureForm, hostelId: e.target.value, categoryAmounts: {} })}>
                      <option value="">Select hostel</option>
                      {hostels.map((h) => (
                        <option key={h._id} value={h._id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Course</label>
                  <select
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={feeStructureForm.course}
                    onChange={(e) => setFeeStructureForm({ ...feeStructureForm, course: e.target.value })}
                  >
                    <option value="">Select course</option>
                    {courseOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">Create for year(s)</p>
                  <p className="text-xs text-gray-500 mb-2">Same fee structure will be created for each selected year (dynamic per course from schema).</p>
                  <div className="flex flex-wrap gap-3">
                    {yearOptions.map((y) => (
                      <label key={y} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feeStructureForm.studentYears.includes(y)}
                          onChange={() => toggleFeeStructureYear(y)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-800">Year {y}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Amount (₹) per category</label>
                  <div className="space-y-3">
                    {(categoriesForFeeStructure.length ? categoriesForFeeStructure : categoriesForFeeTable).map((c) => (
                      <div key={c._id} className="flex items-center gap-3">
                        <span className="w-32 text-sm font-medium text-gray-700 shrink-0">{c.name}</span>
                        <input type="number" min={0} className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={feeStructureForm.categoryAmounts[c._id] ?? ''} onChange={(e) => setFeeStructureForm({ ...feeStructureForm, categoryAmounts: { ...feeStructureForm.categoryAmounts, [c._id]: e.target.value } })} placeholder="0" />
                      </div>
                    ))}
                    {!(categoriesForFeeStructure.length || categoriesForFeeTable.length) && <p className="text-sm text-gray-500">Select a hostel that has categories.</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description (optional)</label>
                  <textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={feeStructureForm.description} onChange={(e) => setFeeStructureForm({ ...feeStructureForm, description: e.target.value })} rows={2} placeholder="e.g. Hostel fee for this course" />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 mt-2">Save all categories</button>
              </form>
            </div>
          </div>
        )}

        {/* Apply hostel fee modal */}
        {isApplyModalOpen && applyStructure && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-gray-800">
                  Apply hostel fee: {applyStructure.hostel?.name} – {applyStructure.category?.name} (₹{Number(applyStructure.amount).toLocaleString()}) – {applyStructure.academicYear} – Year {applyStructure.studentYear ?? 1}
                </h3>
                <button onClick={() => setIsApplyModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
              <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
                <p className="text-sm font-bold text-gray-600">Search and select students</p>
                <form onSubmit={handleApplySearch} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Search by admission no, name or mobile"
                    value={applySearch}
                    onChange={(e) => setApplySearch(e.target.value)}
                  />
                  <button type="submit" disabled={applyLoading} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                    {applyLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>
                {applyFoundStudents.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-600 mb-2">Select students ({applySelectedIds.length} selected)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {applyFoundStudents.map((s) => (
                        <label key={s.admission_number} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                          <input type="checkbox" checked={applySelectedIds.includes(s.admission_number)} onChange={() => toggleApplyStudent(s.admission_number)} className="rounded" />
                          <span className="font-medium text-gray-800">{s.student_name}</span>
                          <span className="text-xs text-gray-500">({s.admission_number})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsApplyModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button
                  type="button"
                  onClick={handleApplySubmit}
                  disabled={applySelectedIds.length === 0 || applySubmitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {applySubmitting ? 'Applying...' : `Apply to ${applySelectedIds.length} selected student(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostelConfiguration;
