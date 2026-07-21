import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/api';
import { Pencil, Trash2, Calendar, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react';
import Sidebar from './Sidebar';
import FeeConfigPrintButton from '../components/FeeConfigPrintButton';

const FeeConfiguration = () => {
    const location = useLocation();
    const VALID_TABS = ['heads', 'groups', 'definitions', 'latefees'];

    const getTabFromHash = (hash) => {
        const cleaned = (hash || '').replace('#', '');
        return VALID_TABS.includes(cleaned) ? cleaned : 'heads';
    };

    const [activeTab, setActiveTab] = useState(() => getTabFromHash(location.hash));

    useEffect(() => {
        const tab = getTabFromHash(location.hash);
        setActiveTab(tab);
    }, [location.hash]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        window.location.hash = tabId;
    };

    // --- SHARED STATE ---
    const [feeHeads, setFeeHeads] = useState([]);

    // --- TAB 1B: FEE GROUPS ---
    const [feeGroups, setFeeGroups] = useState([]);
    const [groupForm, setGroupForm] = useState({ name: '', code: '', description: '', feeHeads: [] });
    const [editGroupId, setEditGroupId] = useState(null);
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoryMapping, setCategoryMapping] = useState({}); // Mapping of category per college|course|batch
    const [metadata, setMetadata] = useState({});
    const [collegeCodes, setCollegeCodes] = useState({});
    const [message, setMessage] = useState('');
    const [calendarData, setCalendarData] = useState([]);
    const [isSavingLateFee, setIsSavingLateFee] = useState(false);
    const [lateFeeSubTab, setLateFeeSubTab] = useState('view'); // 'create' | 'view'
    const [syncingLateFeeId, setSyncingLateFeeId] = useState(null); // structureId | 'all' | null
    const [lateFeeViewFilters, setLateFeeViewFilters] = useState({
        college: '',
        course: '',
        branch: '',
        batch: '',
        studentYear: '',
        semester: '',
        category: '',
        feeHead: ''
    });
    const [lateFeeForm, setLateFeeForm] = useState({
        college: '',
        course: '',
        branch: '',
        batch: '',
        studentYear: '',
        semester: '',
        categories: [],
        feeHead: '',
        lateFeeHead: '',
        termMappings: [],
        penaltyType: 'Fixed',
        penaltyValue: 0
    });

    // --- TAB 1: FEE HEADS ---
    const [headForm, setHeadForm] = useState({ name: '', code: '', description: '' });
    const [editHeadId, setEditHeadId] = useState(null);




    // --- TAB 2: DEFINITIONS (Fee Structures) ---
    const [structures, setStructures] = useState([]);
    const [isLoadingStructures, setIsLoadingStructures] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tableFilters, setTableFilters] = useState({
        college: '',
        batch: '',
        course: '',
        branch: '',
        category: '',
        feeHeadId: ''
    });
    const [structForm, setStructForm] = useState({
        feeHeadId: '', college: '', course: '', branch: '',
        batch: '', categories: [], studentYear: '', amount: '', // Replaced category with categories
        semester: '', // '1', '2' or empty for yearly
        isScholarshipApplicable: false,
        isTermsDivided: true
    });
    const [feeType, setFeeType] = useState('Yearly'); // 'Yearly' or 'Semester'
    const [semAmounts, setSemAmounts] = useState({ 1: '', 2: '' }); // For simultaneous creation
    const [bulkAmounts, setBulkAmounts] = useState({}); // For "All Years" creation: { 1: '', 2: '', ... }
    const [bulkTerms, setBulkTerms] = useState({}); // { "1-Y": { count: 3, data: [{p: 40, a: 0}, {p: 30, a: 0}, {p: 30, a: 0}] } }
    const [isMultiYear, setIsMultiYear] = useState(true); // Default to true (Always All Years)

    // Helper to generate Academic Years (Still useful for some display?)
    const currentYear = new Date().getFullYear();
    const academicYearOptions = ['ALL', ...Array.from({ length: 9 }, (_, i) => `${currentYear - 4 + i}-${currentYear - 3 + i}`)];

    const [editingId, setEditingId] = useState(null);
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [filterCollege, setFilterCollege] = useState('');
    const [filterCourse, setFilterCourse] = useState('');

    const [batches, setBatches] = useState([]);
    const [isSavingDefinition, setIsSavingDefinition] = useState(false);

    // --- STEPPER WIZARD STATE FOR FEE STRUCTURE REDESIGN ---
    const [wizardStep, setWizardStep] = useState(1); // 1: Context Selection, 2: Quota Breakdown
    const [wizardContext, setWizardContext] = useState({
        college: '',
        batch: '',
        course: '',
        branch: '',
        feeType: 'Yearly'
    });
    const [activeQuotaIndex, setActiveQuotaIndex] = useState(0);
    const [quotaConfigs, setQuotaConfigs] = useState({}); // { [quotaName]: { columns: [...], amounts: {...}, terms: {...} } }
    const [savedQuotas, setSavedQuotas] = useState({}); // { [quotaName]: boolean }
    const [isSavingQuota, setIsSavingQuota] = useState(false);
    const [wizardError, setWizardError] = useState('');

    // --- MAIN TABLE & QUOTA EXPAND/COLLAPSE STATE ---
    const [expandedRows, setExpandedRows] = useState({});
    const [expandedQuotas, setExpandedQuotas] = useState({});

    const toggleRowExpand = (rowKey) => {
        setExpandedRows(prev => ({
            ...prev,
            [rowKey]: !prev[rowKey]
        }));
    };

    const toggleQuotaExpand = (quotaKey) => {
        setExpandedQuotas(prev => ({
            ...prev,
            [quotaKey]: !prev[quotaKey]
        }));
    };

    // --- LOCAL STORAGE DRAFT PERSISTENCE ---
    const WIZARD_DRAFT_KEY = 'pydah_fee_wizard_draft_v1';

    // Auto-save draft to localStorage whenever wizard state updates
    useEffect(() => {
        if (isModalOpen || wizardContext.college || Object.keys(quotaConfigs).length > 0) {
            const draftData = {
                wizardStep,
                wizardContext,
                activeQuotaIndex,
                quotaConfigs,
                savedQuotas
            };
            localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draftData));
        }
    }, [wizardStep, wizardContext, activeQuotaIndex, quotaConfigs, savedQuotas, isModalOpen]);

    // Load draft from localStorage
    const loadWizardDraft = () => {
        try {
            const saved = localStorage.getItem(WIZARD_DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && (parsed.wizardContext?.college || Object.keys(parsed.quotaConfigs || {}).length > 0)) {
                    if (parsed.wizardStep) setWizardStep(parsed.wizardStep);
                    if (parsed.wizardContext) setWizardContext(parsed.wizardContext);
                    if (parsed.activeQuotaIndex !== undefined) setActiveQuotaIndex(parsed.activeQuotaIndex);
                    if (parsed.quotaConfigs) setQuotaConfigs(parsed.quotaConfigs);
                    if (parsed.savedQuotas) setSavedQuotas(parsed.savedQuotas);
                    return true;
                }
            }
        } catch (e) {
            console.error("Error reading wizard draft from localStorage", e);
        }
        return false;
    };

    // Clear draft from localStorage
    const clearWizardDraft = () => {
        localStorage.removeItem(WIZARD_DRAFT_KEY);
        setWizardStep(1);
        setWizardContext({ college: '', batch: '', course: '', branch: '', feeType: 'Yearly' });
        setActiveQuotaIndex(0);
        setQuotaConfigs({});
        setSavedQuotas({});
    };

    // Auto-load draft when component mounts
    useEffect(() => {
        loadWizardDraft();
    }, []);

    // Available categories/quotas for current context
    const availableQuotas = React.useMemo(() => {
        if (categories && categories.length > 0) return categories;
        return ['Convenor (A-Category)', 'Management (B-Category)', 'NRI (C-Category)', 'Spot Admission'];
    }, [categories]);

    // Open wizard for new fee structure creation
    const handleOpenCreateWizard = () => {
        const hasDraft = loadWizardDraft();
        if (!hasDraft) {
            setWizardStep(1);
            setWizardContext({
                college: tableFilters.college || '',
                batch: tableFilters.batch || '',
                course: tableFilters.course || '',
                branch: tableFilters.branch || '',
                feeType: 'Yearly'
            });
            setActiveQuotaIndex(0);
            setQuotaConfigs({});
            setSavedQuotas({});
        }
        setIsEditingContext(false);
        setEditingId(null);
        setIsModalOpen(true);
    };

    // Helper: Initialize/Retrieve configuration for a specific quota
    const getQuotaConfig = (quotaName) => {
        if (quotaConfigs[quotaName]) return quotaConfigs[quotaName];
        // Default 3 extendable columns for Fee Head selection (unchecked by default)
        const defaultCols = [
            { id: 'col_1', feeHeadId: feeHeads[0]?._id || '', isLateFeeApplicable: false, isScholarshipApplicable: false, termsCount: 0 },
            { id: 'col_2', feeHeadId: feeHeads[1]?._id || '', isLateFeeApplicable: false, isScholarshipApplicable: false, termsCount: 0 },
            { id: 'col_3', feeHeadId: feeHeads[2]?._id || '', isLateFeeApplicable: false, isScholarshipApplicable: false, termsCount: 0 },
        ];
        return {
            columns: defaultCols,
            amounts: {},
            terms: {}
        };
    };

    // Column Manipulation Actions
    const addColumnToActiveQuota = (quotaName) => {
        const currentConfig = getQuotaConfig(quotaName);
        const usedHeadIds = currentConfig.columns.map(c => c.feeHeadId);
        const unusedHead = feeHeads.find(h => !usedHeadIds.includes(h._id));
        const newCol = {
            id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            feeHeadId: unusedHead ? unusedHead._id : '',
            isLateFeeApplicable: false,
            isScholarshipApplicable: false,
            termsCount: 0
        };
        setQuotaConfigs(prev => ({
            ...prev,
            [quotaName]: {
                ...currentConfig,
                columns: [...currentConfig.columns, newCol]
            }
        }));
    };

    const removeColumnFromActiveQuota = (quotaName, colId) => {
        const currentConfig = getQuotaConfig(quotaName);
        if (currentConfig.columns.length <= 1) return;
        setQuotaConfigs(prev => ({
            ...prev,
            [quotaName]: {
                ...currentConfig,
                columns: currentConfig.columns.filter(c => c.id !== colId)
            }
        }));
    };

    const updateColumnInActiveQuota = (quotaName, colId, field, val) => {
        const currentConfig = getQuotaConfig(quotaName);
        const updatedCols = currentConfig.columns.map(c => {
            if (c.id === colId) {
                const updated = { ...c, [field]: val };
                if (field === 'termsCount') {
                    updated.isLateFeeApplicable = Number(val) > 0;
                } else if (field === 'isLateFeeApplicable') {
                    if (val && (!c.termsCount || c.termsCount === 0)) {
                        updated.termsCount = 3;
                    } else if (!val) {
                        updated.termsCount = 0;
                    }
                }
                return updated;
            }
            return c;
        });

        // Re-calculate terms breakdown for non-zero amounts if termsCount or late fee applicability changed
        const colObj = updatedCols.find(c => c.id === colId);
        const count = colObj?.termsCount || 0;
        let updatedTerms = { ...currentConfig.terms };

        Object.keys(currentConfig.amounts).forEach(amtKey => {
            if (amtKey.endsWith(`_${colId}`)) {
                const numAmount = Number(currentConfig.amounts[amtKey]) || 0;
                if (colObj?.isLateFeeApplicable && count > 0 && numAmount > 0) {
                    let defaultPcts = [];
                    if (count === 1) defaultPcts = [100];
                    else if (count === 2) defaultPcts = [50, 50];
                    else if (count === 3) defaultPcts = [40, 30, 30];
                    else {
                        const equalP = Math.floor(100 / count);
                        defaultPcts = Array(count).fill(equalP);
                        const sum = equalP * count;
                        defaultPcts[count - 1] += (100 - sum);
                    }

                    let sumA = 0;
                    const termData = defaultPcts.map((p, idx) => {
                        if (idx === count - 1) {
                            return { p, a: numAmount - sumA };
                        } else {
                            const a = Math.round(numAmount * (p / 100));
                            sumA += a;
                            return { p, a };
                        }
                    });

                    updatedTerms[amtKey] = { count, data: termData };
                }
            }
        });

        setQuotaConfigs(prev => ({
            ...prev,
            [quotaName]: {
                ...currentConfig,
                columns: updatedCols,
                terms: updatedTerms
            }
        }));
    };

    // Amount & Terms Update Handlers
    const updateAmountInActiveQuota = (quotaName, rowKey, colId, amountVal) => {
        const currentConfig = getQuotaConfig(quotaName);
        const key = `${rowKey}_${colId}`;
        const numAmount = Number(amountVal) || 0;
        
        let updatedTerms = { ...currentConfig.terms };
        const colObj = currentConfig.columns.find(c => c.id === colId);
        const count = colObj?.termsCount || (colObj?.isLateFeeApplicable ? 3 : 0);

        if (colObj?.isLateFeeApplicable && count > 0 && numAmount > 0) {
            let defaultPcts = [];
            if (count === 1) defaultPcts = [100];
            else if (count === 2) defaultPcts = [50, 50];
            else if (count === 3) defaultPcts = [40, 30, 30];
            else {
                const equalP = Math.floor(100 / count);
                defaultPcts = Array(count).fill(equalP);
                const sum = equalP * count;
                defaultPcts[count - 1] += (100 - sum);
            }

            let sumA = 0;
            const termData = defaultPcts.map((p, idx) => {
                if (idx === count - 1) {
                    return { p, a: numAmount - sumA };
                } else {
                    const a = Math.round(numAmount * (p / 100));
                    sumA += a;
                    return { p, a };
                }
            });

            updatedTerms[key] = {
                count,
                data: termData
            };
        }

        setQuotaConfigs(prev => ({
            ...prev,
            [quotaName]: {
                ...currentConfig,
                amounts: { ...currentConfig.amounts, [key]: amountVal },
                terms: updatedTerms
            }
        }));
    };

    const updateTermPctInActiveQuota = (quotaName, rowKey, colId, termIdx, pctVal) => {
        const currentConfig = getQuotaConfig(quotaName);
        const key = `${rowKey}_${colId}`;
        const totalAmt = Number(currentConfig.amounts[key]) || 0;
        const currentTermObj = currentConfig.terms[key] 
            ? JSON.parse(JSON.stringify(currentConfig.terms[key])) 
            : { count: 3, data: [{ p: 40, a: 0 }, { p: 30, a: 0 }, { p: 30, a: 0 }] };
        
        currentTermObj.data[termIdx].p = Number(pctVal);
        let sumA = 0;
        currentTermObj.data.forEach((t, i) => {
            if (i === currentTermObj.data.length - 1) {
                t.a = totalAmt - sumA;
            } else {
                t.a = Math.round(totalAmt * (t.p / 100));
                sumA += t.a;
            }
        });

        setQuotaConfigs(prev => ({
            ...prev,
            [quotaName]: {
                ...currentConfig,
                terms: { ...currentConfig.terms, [key]: currentTermObj }
            }
        }));
    };

    // Save Active Quota & Advance to Next
    const handleSaveQuotaAndNext = async (quotaName, isLastQuota) => {
        setWizardError('');
        if (!wizardContext.college || !wizardContext.batch || !wizardContext.course || !wizardContext.branch) {
            setWizardError('Please select complete academic context first.');
            return;
        }

        const config = getQuotaConfig(quotaName);
        if (!config.columns || config.columns.length === 0) {
            setWizardError('Please add at least one Fee Head column.');
            return;
        }

        // 1. Validation: Every present column must have a Fee Head selected
        for (let i = 0; i < config.columns.length; i++) {
            if (!config.columns[i].feeHeadId) {
                setWizardError(`Please select a Fee Head for Column ${i + 1}, or remove unused columns.`);
                return;
            }
        }

        const selectedMeta = metadata[wizardContext.college]?.[wizardContext.course];
        const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 4;

        const matrixRows = [];
        for (let y = 1; y <= yearsCount; y++) {
            if (wizardContext.feeType === 'Yearly') {
                matrixRows.push({ year: y, semester: null, rowKey: `${y}-Y` });
            } else {
                matrixRows.push({ year: y, semester: 1, rowKey: `${y}-S1` });
                matrixRows.push({ year: y, semester: 2, rowKey: `${y}-S2` });
            }
        }

        // 2. Validation: Every present column MUST have an amount > 0 entered in at least one year/period
        for (let i = 0; i < config.columns.length; i++) {
            const col = config.columns[i];
            const hasValueInAnyYear = matrixRows.some(row => {
                const amtKey = `${row.rowKey}_${col.id}`;
                const val = config.amounts[amtKey];
                return val !== undefined && val !== '' && !isNaN(Number(val)) && Number(val) > 0;
            });

            if (!hasValueInAnyYear) {
                const fh = feeHeads.find(h => h._id === col.feeHeadId);
                setWizardError(`Column ${i + 1} (${fh?.name || 'Selected Fee Head'}) does not have a fee amount entered. Please enter a fee amount in at least one year/period for every column.`);
                return;
            }
        }

        setIsSavingQuota(true);
        try {
            const requests = [];
            for (const col of config.columns) {
                for (const row of matrixRows) {
                    const amtKey = `${row.rowKey}_${col.id}`;
                    const rawAmt = config.amounts[amtKey];
                    if (rawAmt !== undefined && rawAmt !== '' && !isNaN(Number(rawAmt)) && Number(rawAmt) > 0) {
                        const amt = Number(rawAmt);
                        const termObj = config.terms[amtKey];
                        const termsData = (col.isLateFeeApplicable && termObj) ? termObj.data.map((t, idx) => ({
                            termNumber: idx + 1,
                            percentage: t.p,
                            amount: t.a
                        })) : [];

                        requests.push(api.post('/fee-structures', {
                            feeHeadId: col.feeHeadId,
                            college: wizardContext.college,
                            course: wizardContext.course,
                            branch: wizardContext.branch,
                            batch: wizardContext.batch,
                            category: quotaName,
                            studentYear: row.year,
                            semester: row.semester,
                            amount: amt,
                            isScholarshipApplicable: col.isScholarshipApplicable || false,
                            isTermsDivided: col.isLateFeeApplicable || false,
                            terms: col.isLateFeeApplicable ? termsData : []
                        }));
                    }
                }
            }

            if (requests.length === 0) {
                setWizardError('Please enter at least one fee amount before saving this quota.');
                setIsSavingQuota(false);
                return;
            }

            await Promise.all(requests);

            setSavedQuotas(prev => ({ ...prev, [quotaName]: true }));
            fetchStructures();

            if (isLastQuota) {
                clearWizardDraft();
                setMessage(`All quota fee structures saved successfully for ${wizardContext.course} - ${wizardContext.branch}!`);
                setIsModalOpen(false);
                setTimeout(() => setMessage(''), 4000);
            } else {
                setActiveQuotaIndex(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error saving quota fee structure:', err);
            setWizardError(err.response?.data?.message || 'Failed to save fee structure for this quota.');
        } finally {
            setIsSavingQuota(false);
        }
    };

    // Reset selected categories when primary context changes in Late Fees
    useEffect(() => {
        setLateFeeForm(prev => ({ ...prev, categories: [] }));
    }, [lateFeeForm.college, lateFeeForm.course, lateFeeForm.batch]);

    useEffect(() => {
        fetchFeeHeads();
        fetchFeeGroups();
        fetchStructures();
        fetchMetadata();
        fetchCalendarData();
    }, []);

    const fetchCalendarData = async () => {
        try {
            const res = await api.get(`/academic-calendar/academic-years`);
            setCalendarData(res.data);
        } catch (error) {
            console.error('Error fetching academic years', error);
        }
    };

    const syncLateFees = async (structureId = null) => {
        const key = structureId || 'all';
        setSyncingLateFeeId(key);
        try {
            const res = await api.post('/late-fees/process', structureId ? { structureId } : {});
            const generated = res.data?.generated ?? res.data?.results?.length ?? 0;
            setMessage(
                generated > 0
                    ? `Late fee sync complete: ${generated} demand(s) generated.`
                    : 'Late fee sync complete: no new demands (already applied, not overdue, or students fully paid).'
            );
            setTimeout(() => setMessage(''), 6000);
        } catch (e) {
            alert(e.response?.data?.message || 'Late fee sync failed');
        } finally {
            setSyncingLateFeeId(null);
        }
    };


    const fetchMetadata = async () => {
        try {
            const response = await api.get(`/students/metadata`);
            setMetadata(response.data.hierarchy || response.data);
            if (response.data.batches) setBatches(response.data.batches);
            if (response.data.categories) setCategories(response.data.categories);
            if (response.data.categoryMapping) setCategoryMapping(response.data.categoryMapping);
            if (response.data.collegeCodes) setCollegeCodes(response.data.collegeCodes);
        } catch (error) { console.error('Error fetching metadata', error); }
    };

    const fetchFeeHeads = async () => {
        try {
            const response = await api.get(`/fee-heads`);
            setFeeHeads(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchFeeGroups = async () => {
        try {
            const response = await api.get(`/fee-groups`);
            setFeeGroups(response.data);
        } catch (error) { console.error('Error fetching fee groups', error); }
    };

    const fetchStructures = async () => {
        setIsLoadingStructures(true);
        try {
            const response = await api.get(`/fee-structures`);
            setStructures(response.data);
        } catch (error) { console.error(error); }
        finally { setIsLoadingStructures(false); }
    };


    const activeHeadSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            if (editHeadId) {
                const response = await api.put(`/fee-heads/${editHeadId}`, headForm);
                setFeeHeads(feeHeads.map(h => h._id === editHeadId ? response.data : h));
                setMessage('Fee Head updated successfully!');
            } else {
                const response = await api.post(`/fee-heads`, headForm);
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
            await api.delete(`/fee-heads/${id}`);
            setFeeHeads(feeHeads.filter(h => h._id !== id));
        } catch (error) { alert('Failed to delete'); }
    };

    const activeGroupSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSavingGroup(true);
        try {
            if (editGroupId) {
                const response = await api.put(`/fee-groups/${editGroupId}`, groupForm);
                setFeeGroups(feeGroups.map(g => g._id === editGroupId ? response.data : g));
                setMessage('Fee Group updated successfully!');
            } else {
                const response = await api.post(`/fee-groups`, groupForm);
                setFeeGroups([response.data, ...feeGroups]);
                setMessage('Fee Group added successfully!');
            }
            setGroupForm({ name: '', code: '', description: '', feeHeads: [] });
            setEditGroupId(null);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Error saving Fee Group');
        } finally {
            setIsSavingGroup(false);
        }
    };

    const handleEditGroup = (g) => {
        setGroupForm({
            name: g.name,
            code: g.code || '',
            description: g.description || '',
            feeHeads: g.feeHeads ? g.feeHeads.map(fh => fh._id || fh) : []
        });
        setEditGroupId(g._id);
    };

    const deleteGroup = async (id) => {
        if (!window.confirm('Delete this Fee Group?')) return;
        try {
            await api.delete(`/fee-groups/${id}`);
            setFeeGroups(feeGroups.filter(g => g._id !== id));
            setMessage('Fee Group deleted successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) { alert('Failed to delete Fee Group'); }
    };

    const handleTermChange = (key, count) => {
        const total = Number(bulkAmounts[key]) || 0;
        const newData = Array.from({ length: count }, (_, i) => ({
            p: i === 0 ? 100 : 0, // Default first term to 100%
            a: i === 0 ? total : 0
        }));
        // If 3 terms, maybe default to 40-30-30 or similar? 
        if (Number(count) === 3) {
            newData[0] = { p: 40, a: Math.round(total * 0.4) };
            newData[1] = { p: 30, a: Math.round(total * 0.3) };
            newData[2] = { p: 30, a: total - newData[0].a - newData[1].a };
        } else if (Number(count) > 0) {
            const equalP = Math.floor(100 / count);
            let sumA = 0;
            for (let i = 0; i < count; i++) {
                const p = (i === count - 1) ? (100 - (equalP * (count - 1))) : equalP;
                const a = (i === count - 1) ? (total - sumA) : Math.round(total * (p / 100));
                newData[i] = { p, a };
                sumA += a;
            }
        }

        setBulkTerms({ ...bulkTerms, [key]: { count: Number(count), data: newData } });
    };

    const updateTermPercentage = (key, index, p) => {
        const total = Number(bulkAmounts[key]) || 0;
        setBulkTerms(prev => {
            const currentTerms = JSON.parse(JSON.stringify(prev[key]));
            currentTerms.data[index].p = Number(p);

            // Recalc all amounts based on percentages
            let sumA = 0;
            currentTerms.data.forEach((t, i) => {
                if (i === currentTerms.data.length - 1) {
                    t.a = total - sumA;
                } else {
                    t.a = Math.round(total * (t.p / 100));
                    sumA += t.a;
                }
            });
            return { ...prev, [key]: currentTerms };
        });
    };

    const updateAmountAndRecalcTerms = (key, val) => {
        const total = Number(val) || 0;
        setBulkAmounts(prev => ({ ...prev, [key]: val }));

        if (structForm.isTermsDivided) {
            if (bulkTerms[key]) {
                setBulkTerms(prev => {
                    const currentTerms = JSON.parse(JSON.stringify(prev[key]));
                    let sumA = 0;
                    currentTerms.data.forEach((t, i) => {
                        if (i === currentTerms.data.length - 1) {
                            t.a = total - sumA;
                        } else {
                            t.a = Math.round(total * (t.p / 100));
                            sumA += t.a;
                        }
                    });
                    return { ...prev, [key]: currentTerms };
                });
            } else if (val && !isNaN(val)) {
                // Default to 3 terms as per user request
                handleTermChange(key, 3);
            }
        }
    };

    // --- DEFINITIONS LOGIC ---
    const activeStructSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSavingDefinition(true);
        try {
            if (editingId) {
                // Update existing
                await api.put(`/fee-structures/${editingId}`, structForm);
            } else {
                // Determine Years to Process from Metadata
                const selectedMeta = (structForm.college && structForm.course) ? metadata[structForm.college]?.[structForm.course] : null;
                const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 4;

                const requests = [];
                for (let y = 1; y <= yearsCount; y++) {
                    if (feeType === 'Yearly') {
                        const key = `${y}-Y`;
                        const amount = bulkAmounts[key];
                        if (amount) {
                            const termsData = bulkTerms[key] ? bulkTerms[key].data.map((t, idx) => ({
                                termNumber: idx + 1,
                                percentage: t.p,
                                amount: t.a
                            })) : [];

                            requests.push(api.post(`/fee-structures`, {
                                ...structForm,
                                studentYear: y,
                                semester: null,
                                amount: Number(amount),
                                batch: structForm.batch,
                                categories: structForm.categories,
                                isScholarshipApplicable: structForm.isScholarshipApplicable,
                                isTermsDivided: structForm.isTermsDivided,
                                terms: structForm.isTermsDivided ? termsData : []
                            }));
                        }
                    } else {
                        // Semester Wise
                        ['S1', 'S2'].forEach((sSuff, sIdx) => {
                            const key = `${y}-${sSuff}`;
                            const amount = bulkAmounts[key];
                            if (amount) {
                                const termsData = bulkTerms[key] ? bulkTerms[key].data.map((t, tidx) => ({
                                    termNumber: tidx + 1,
                                    percentage: t.p,
                                    amount: t.a
                                })) : [];

                                requests.push(api.post(`/fee-structures`, {
                                    ...structForm,
                                    studentYear: y,
                                    semester: sIdx + 1,
                                    amount: Number(amount),
                                    batch: structForm.batch,
                                    categories: structForm.categories,
                                    isScholarshipApplicable: structForm.isScholarshipApplicable,
                                    isTermsDivided: structForm.isTermsDivided,
                                    terms: structForm.isTermsDivided ? termsData : []
                                }));
                            }
                        });
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
            setIsEditingContext(false);
            setIsModalOpen(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) { setMessage(error.response?.data?.message || 'Error saving structure'); }
        finally { setIsSavingDefinition(false); }
    };

    // Edit entire row (Propagate context)
    const handleEditRow = (row) => {
        setStructForm({
            feeHeadId: row.feeHeadId,
            college: row.college,
            course: row.course,
            branch: row.branch,
            batch: row.batch, // Ensure Batch is selected
            categories: row.category ? [row.category] : (row.categories || []), // Support both singular and array
            academicYear: row.academicYear,
            studentYear: '', // User must select year to refine OR use Multi-Year
            amount: '',
            semester: '',
            isScholarshipApplicable: row.isScholarshipApplicable || false,
            isTermsDivided: row.isTermsDivided || false
        });

        // Populate bulkAmounts and bulkTerms for Multi-Year Editing
        const newBulk = {};
        const newTerms = {};
        if (row.years) {
            Object.keys(row.years).forEach(y => {
                const items = row.years[y]; // Array of { semester, amount, terms }
                items.forEach(item => {
                    const suffice = item.semester ? `S${item.semester}` : 'Y';
                    const key = `${y}-${suffice}`;
                    newBulk[key] = item.amount;
                    if (item.terms && item.terms.length > 0) {
                        newTerms[key] = {
                            count: item.terms.length,
                            data: item.terms.map(t => ({ p: t.percentage, a: t.amount }))
                        };
                    }
                });
            });
        }
        setBulkAmounts(newBulk);
        setBulkTerms(newTerms);
        setIsMultiYear(true); // Default to Multi-Year edit mode
        setFeeType(Object.keys(newBulk).some(k => k.includes('S')) ? 'Semester' : 'Yearly');

        setEditingId(null);
        setIsEditingContext(true);
        setIsModalOpen(true);
        setMessage('Context loaded. Use "All Years" to edit multiple years at once.');
    };

    const handleCancelEditContext = () => {
        setStructForm({
            feeHeadId: '',
            college: '',
            course: '',
            branch: '',
            batch: '',
            categories: [],
            academicYear: '',
            studentYear: '',
            amount: '',
            semester: '',
            isScholarshipApplicable: false,
            isTermsDivided: true
        });
        setBulkAmounts({});
        setBulkTerms({});
        setIsEditingContext(false);
        setIsModalOpen(false);
        setMessage('');
    };

    const deleteStruct = async (id) => {
        if (!window.confirm('Delete this Fee Structure?')) return;
        try {
            await api.delete(`/fee-structures/${id}`);
            setStructures(structures.filter(s => s._id !== id));
        } catch (error) { alert('Failed to delete structure'); }
    };

    // --- RENDER HELPERS ---
    const colleges = Object.keys(metadata);

    // Definitions Grouping (Grouped by Context + Quota/Category)
    const grouped = {};
    structures.filter(s => {
        // Dynamic Filtering based on Table Filters
        if (tableFilters.college && s.college !== tableFilters.college) return false;
        if (tableFilters.batch && String(s.batch) !== String(tableFilters.batch)) return false;
        if (tableFilters.course && s.course !== tableFilters.course) return false;
        if (tableFilters.branch && s.branch !== tableFilters.branch) return false;
        if (tableFilters.category && s.category !== tableFilters.category) return false;
        if (tableFilters.feeHeadId && s.feeHead?._id !== tableFilters.feeHeadId) return false;

        return true;
    }).forEach(st => {
        const key = `${st.college}|${st.batch}|${st.course}|${st.branch}`;
        if (!grouped[key]) {
            grouped[key] = {
                key,
                college: st.college,
                batch: st.batch,
                course: st.course,
                branch: st.branch,
                quotasMap: {}, // category -> { category, feeHeadsMap, matrix, allIds, grandTotal, yearTotals, feeHeadTotals }
                categories: [],
                allIds: [],
                grandTotal: 0
            };
        }

        const grp = grouped[key];
        const cat = st.category || 'General';
        if (!grp.quotasMap[cat]) {
            grp.quotasMap[cat] = {
                category: cat,
                feeHeadsMap: {},
                matrix: {},
                allIds: [],
                grandTotal: 0,
                yearTotals: {},
                feeHeadTotals: {}
            };
            grp.categories.push(cat);
        }

        const qGrp = grp.quotasMap[cat];
        const fhId = st.feeHead?._id || 'unknown';
        const fhName = st.feeHead?.name || 'Unnamed';
        const fhCode = st.feeHead?.code || '';
        const yr = st.studentYear;

        // Register fee head
        if (!qGrp.feeHeadsMap[fhId]) {
            qGrp.feeHeadsMap[fhId] = {
                _id: fhId,
                name: fhName,
                code: fhCode,
                isScholarshipApplicable: st.isScholarshipApplicable,
                isTermsDivided: st.isTermsDivided,
                termsCount: st.terms?.length || 0
            };
        } else {
            if (st.isScholarshipApplicable) qGrp.feeHeadsMap[fhId].isScholarshipApplicable = true;
            if (st.isTermsDivided) qGrp.feeHeadsMap[fhId].isTermsDivided = true;
            if (st.terms?.length) qGrp.feeHeadsMap[fhId].termsCount = Math.max(qGrp.feeHeadsMap[fhId].termsCount || 0, st.terms.length);
        }

        // Register matrix cell
        if (!qGrp.matrix[yr]) qGrp.matrix[yr] = {};
        if (!qGrp.matrix[yr][fhId]) qGrp.matrix[yr][fhId] = [];

        const item = {
            id: st._id,
            amount: Number(st.amount) || 0,
            semester: st.semester,
            terms: st.terms,
            isTermsDivided: st.isTermsDivided,
            isScholarshipApplicable: st.isScholarshipApplicable
        };

        qGrp.matrix[yr][fhId].push(item);
        qGrp.allIds.push(st._id);
        grp.allIds.push(st._id);

        // Totals
        const amt = Number(st.amount) || 0;
        qGrp.grandTotal += amt;
        qGrp.yearTotals[yr] = (qGrp.yearTotals[yr] || 0) + amt;
        qGrp.feeHeadTotals[fhId] = (qGrp.feeHeadTotals[fhId] || 0) + amt;
        grp.grandTotal += amt;
    });

    // Hierarchical Sorting: College -> Batch -> Course -> Branch
    const groupedArray = Object.values(grouped).sort((a, b) => {
        // 1. College wise
        const collegeA = String(a.college || '').toLowerCase();
        const collegeB = String(b.college || '').toLowerCase();
        if (collegeA !== collegeB) return collegeA.localeCompare(collegeB);

        // 2. Batch wise (descending, e.g. 2026, 2025, 2024...)
        const batchA = String(a.batch || '');
        const batchB = String(b.batch || '');
        if (batchA !== batchB) return batchB.localeCompare(batchA, undefined, { numeric: true });

        // 3. Course wise
        const courseA = String(a.course || '').toLowerCase();
        const courseB = String(b.course || '').toLowerCase();
        if (courseA !== courseB) return courseA.localeCompare(courseB);

        // 4. Branch wise
        const branchA = String(a.branch || '').toLowerCase();
        const branchB = String(b.branch || '').toLowerCase();
        return branchA.localeCompare(branchB);
    });

    // Calculate dynamic years for the Table based on Table Filters
    const tableMeta = (tableFilters.college && tableFilters.course) ? metadata[tableFilters.college]?.[tableFilters.course] : null;
    const tableYearsCount = tableMeta ? (tableMeta.total_years || 4) : 4;
    const tableYears = Array.from({ length: tableYearsCount }, (_, i) => i + 1);

    // semesters.batch is admission year ("2023"); fee/student batch may be "2023" or "2023-2027"
    const normalizeBatch = (batch) => String(batch || '').split('-')[0].trim();

    const findCalendarDate = (tm) => {
        if (!lateFeeForm.batch || !lateFeeForm.course || !calendarData.length) return null;
        const targetBatch = normalizeBatch(lateFeeForm.batch);
        if (!targetBatch) return null;

        const item = calendarData.find(ay =>
            normalizeBatch(ay.batch) === targetBatch &&
            ay.course_name === lateFeeForm.course &&
            Number(ay.year_of_study) === Number(tm.studentYear) &&
            (!tm.semester || Number(ay.semester_number) === Number(tm.semester)) &&
            (!ay.college_name || !lateFeeForm.college || ay.college_name === lateFeeForm.college) &&
            (tm.dueEventType === 'END_DATE' ? ay.end_date : ay.start_date)
        );

        if (!item) return null;
        return tm.dueEventType === 'START_DATE' ? item.start_date : item.end_date;
    };

    const TAB_TITLES = {
        heads: { title: 'Fee Heads', desc: 'Manage fee heads.' },
        groups: { title: 'Fee Groups', desc: 'Manage fee groups and head mappings.' },
        definitions: { title: 'Fee Structures', desc: 'Manage fee structure definitions.' },
        latefees: { title: 'Late Fees', desc: 'Manage late fee rules and penalty settings.' }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <div className="flex-1 p-4 md:p-6">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-gray-200 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Fee Configuration {TAB_TITLES[activeTab] ? `- ${TAB_TITLES[activeTab].title}` : ''}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {TAB_TITLES[activeTab]?.desc || 'Manage fee configuration settings.'}
                        </p>
                    </div>
                    {activeTab === 'latefees' && (
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setLateFeeSubTab('create')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${lateFeeSubTab === 'create' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setLateFeeSubTab('view')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${lateFeeSubTab === 'view' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                View Configs
                            </button>
                        </div>
                    )}
                    {activeTab === 'definitions' && (
                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={handleOpenCreateWizard}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                Create Fee Structure
                            </button>
                            <FeeConfigPrintButton
                                variant="structures"
                                data={{
                                    rows: groupedArray,
                                    tableYears,
                                    collegeCodes,
                                    filters: {
                                        college: tableFilters.college || '',
                                        course: tableFilters.course || '',
                                        branch: tableFilters.branch || '',
                                        batch: tableFilters.batch || '',
                                        category: tableFilters.category || '',
                                        feeHeadName: feeHeads.find(h => h._id === tableFilters.feeHeadId)?.name || '',
                                    }
                                }}
                                label="Print"
                                disabled={groupedArray.length === 0}
                            />
                        </div>
                    )}
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
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-semibold text-gray-800">Existing Heads</h2>
                                <FeeConfigPrintButton
                                    variant="heads"
                                    data={{ reportData: feeHeads }}
                                    label="Print"
                                    disabled={feeHeads.length === 0}
                                />
                            </div>
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

                {/* --- TAB 1B: FEE GROUPS --- */}
                {activeTab === 'groups' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
                        {/* Group Add/Edit Panel */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 h-fit">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-semibold text-gray-800">{editGroupId ? 'Edit Fee Group' : 'Add Fee Group'}</h2>
                                {editGroupId && (
                                    <button 
                                        onClick={() => { 
                                            setEditGroupId(null); 
                                            setGroupForm({ name: '', code: '', description: '', feeHeads: [] }); 
                                        }} 
                                        className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                            <form onSubmit={activeGroupSubmit} className="space-y-4 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 block">Group Name</label>
                                        <input 
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-xs font-semibold" 
                                            placeholder="e.g. Tuition Fee Group" 
                                            value={groupForm.name} 
                                            onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 block">Group Code</label>
                                        <input 
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none transition uppercase text-xs font-mono font-bold" 
                                            placeholder="e.g. TUI" 
                                            maxLength={10}
                                            value={groupForm.code} 
                                            onChange={e => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase().replace(/\s/g, '') })} 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 block">Description</label>
                                    <textarea 
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        placeholder="Group description..." 
                                        value={groupForm.description} 
                                        onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 block">Select Fee Heads</label>
                                    <div className="max-h-[220px] overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50 scrollbar-thin">
                                        {feeHeads.filter(fh => {
                                            const otherGroup = feeGroups.find(g => 
                                                g._id !== editGroupId && 
                                                g.feeHeads.some(h => (h._id || h) === fh._id)
                                            );
                                            return !otherGroup;
                                        }).length === 0 && (
                                            <p className="text-xs text-gray-400 italic text-center py-2">All fee heads are already grouped.</p>
                                        )}
                                        {feeHeads
                                            .filter(fh => {
                                                const otherGroup = feeGroups.find(g => 
                                                    g._id !== editGroupId && 
                                                    g.feeHeads.some(h => (h._id || h) === fh._id)
                                                );
                                                return !otherGroup;
                                            })
                                            .map(fh => (
                                                <label 
                                                    key={fh._id} 
                                                    className="flex items-center gap-2 p-1.5 rounded transition cursor-pointer hover:bg-white"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={groupForm.feeHeads.includes(fh._id)}
                                                        onChange={e => {
                                                            const isChecked = e.target.checked;
                                                            let updated = [...groupForm.feeHeads];
                                                            if (isChecked) {
                                                                updated.push(fh._id);
                                                            } else {
                                                                updated = updated.filter(id => id !== fh._id);
                                                            }
                                                            setGroupForm({ ...groupForm, feeHeads: updated });
                                                        }}
                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs text-gray-700 font-medium">{fh.name}</span>
                                                </label>
                                            ))
                                        }
                                    </div>
                                    {groupForm.feeHeads.length === 0 && (
                                        <p className="text-[10px] text-red-500 font-medium">Select at least one fee head.</p>
                                    )}
                                </div>
                                <button 
                                    disabled={isSavingGroup || groupForm.feeHeads.length === 0}
                                    className={`w-full text-white py-2 rounded font-bold transition flex items-center justify-center gap-2 ${
                                        (isSavingGroup || groupForm.feeHeads.length === 0) 
                                            ? 'bg-gray-400 cursor-not-allowed' 
                                            : (editGroupId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700')
                                    }`}
                                >
                                    {isSavingGroup ? 'Saving...' : (editGroupId ? 'Update Fee Group' : 'Add Fee Group')}
                                </button>
                            </form>
                        </div>

                        {/* Existing Groups Table */}
                        <div className="md:col-span-2 bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="font-semibold text-gray-800">Existing Fee Groups</h2>
                                <FeeConfigPrintButton
                                    variant="groups"
                                    data={{ reportData: feeGroups }}
                                    label="Print"
                                    disabled={feeGroups.length === 0}
                                />
                            </div>
                            {feeGroups.length === 0 ? (
                                <p className="text-gray-400 italic text-sm">No fee groups defined yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="p-3 w-1/4">Name / Code</th>
                                                <th className="p-3 w-1/4">Description</th>
                                                <th className="p-3 w-2/5">Included Fee Heads</th>
                                                <th className="p-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {feeGroups.map(g => (
                                                <tr key={g._id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="font-semibold text-gray-800">{g.name}</div>
                                                        <div className="text-[10px] font-mono font-bold text-blue-600 uppercase bg-blue-50 w-fit px-1.5 py-0.5 rounded border border-blue-100 mt-1">{g.code}</div>
                                                    </td>
                                                    <td className="p-3 text-gray-500 text-xs">{g.description || '-'}</td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto scrollbar-thin">
                                                            {g.feeHeads && g.feeHeads.map(fh => (
                                                                <span key={fh._id} className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase whitespace-nowrap">
                                                                    {fh.name}
                                                                </span>
                                                            ))}
                                                            {(!g.feeHeads || g.feeHeads.length === 0) && <span className="text-xs text-gray-400 italic">None</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleEditGroup(g)} 
                                                                className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded transition" 
                                                                title="Edit"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => deleteGroup(g._id)} 
                                                                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition" 
                                                                title="Delete"
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
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB 2: DEFINITIONS --- */}
                {activeTab === 'definitions' && (
                    <div className="space-y-6">
                        {/* Full-width Fee Templates Table Card */}
                        <div className="w-full bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100">
                            {/* Table Filters Bar */}
                            <div className="bg-gray-50/90 p-3.5 rounded-xl border border-gray-200/80 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">College</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        value={tableFilters.college} 
                                        onChange={e => setTableFilters({ ...tableFilters, college: e.target.value, course: '', branch: '' })}
                                    >
                                        <option value="">All Colleges</option>
                                        {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Batch</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        value={tableFilters.batch} 
                                        onChange={e => setTableFilters({ ...tableFilters, batch: e.target.value })}
                                    >
                                        <option value="">All Batches</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Course</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400" 
                                        value={tableFilters.course} 
                                        onChange={e => setTableFilters({ ...tableFilters, course: e.target.value, branch: '' })}
                                        disabled={!tableFilters.college}
                                    >
                                        <option value="">All Courses</option>
                                        {(tableFilters.college ? Object.keys(metadata[tableFilters.college] || {}) : []).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Branch</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400" 
                                        value={tableFilters.branch} 
                                        onChange={e => setTableFilters({ ...tableFilters, branch: e.target.value })}
                                        disabled={!tableFilters.course}
                                    >
                                        <option value="">All Branches</option>
                                        {(tableFilters.college && tableFilters.course ? (metadata[tableFilters.college]?.[tableFilters.course]?.branches || []) : []).map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Category</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        value={tableFilters.category} 
                                        onChange={e => setTableFilters({ ...tableFilters, category: e.target.value })}
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-gray-600 block mb-1 uppercase tracking-wider">Fee Head</label>
                                    <select 
                                        className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        value={tableFilters.feeHeadId} 
                                        onChange={e => setTableFilters({ ...tableFilters, feeHeadId: e.target.value })}
                                    >
                                        <option value="">All Fee Heads</option>
                                        {feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                    </select>
                                </div>

                                <div className="shrink-0">
                                    {(tableFilters.college || tableFilters.batch || tableFilters.course || tableFilters.branch || tableFilters.category || tableFilters.feeHeadId) ? (
                                        <button
                                            type="button"
                                            onClick={() => setTableFilters({ college: '', batch: '', course: '', branch: '', category: '', feeHeadId: '' })}
                                            className="px-3.5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition text-center shrink-0 w-auto"
                                        >
                                           Clear
                                        </button>
                                    ) : (
                                        <div className="text-[11px] text-gray-400 font-medium py-2 px-1 text-center italic whitespace-nowrap">No filters active</div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="p-3">College / Batch</th>
                                            <th className="p-3">Course & Branch</th>
                                            <th className="p-3">Category (Quota)</th>
                                            <th className="p-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {isLoadingStructures ? (
                                            Array.from({ length: 5 }).map((_, idx) => (
                                                <tr key={idx} className="animate-pulse">
                                                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-36 mb-1"></div><div className="h-3 bg-slate-100 rounded w-24"></div></td>
                                                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-28 mb-1"></div><div className="h-3 bg-slate-100 rounded w-16"></div></td>
                                                    <td className="p-3"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
                                                    <td className="p-3 text-right"><div className="h-8 bg-slate-200 rounded-lg w-24 ml-auto"></div></td>
                                                </tr>
                                            ))
                                        ) : groupedArray.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-10 text-center text-gray-400 italic">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <span>No fee templates found for selected filters.</span>
                                                        <button onClick={handleOpenCreateWizard} className="text-xs text-blue-600 font-semibold hover:underline mt-1">
                                                            + Define Standard Fees Now
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedArray.map((row, i) => {
                                                const isExpanded = !!expandedRows[row.key];

                                                return (
                                                    <React.Fragment key={row.key || i}>
                                                        <tr 
                                                            onClick={() => toggleRowExpand(row.key)}
                                                            className={`cursor-pointer hover:bg-blue-50/50 transition-colors group/row ${isExpanded ? 'bg-blue-50/40' : ''}`}
                                                        >
                                                            {/* 1. College / Batch */}
                                                            <td className="p-3 text-xs text-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    <ChevronRight size={16} className={`text-gray-400 group-hover/row:text-blue-600 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                                                                    <span className="font-bold text-gray-900">{collegeCodes[row.college] || row.college}</span>
                                                                    <span className="text-blue-600 font-mono font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[11px] border border-blue-100 shrink-0">{row.batch}</span>
                                                                </div>
                                                            </td>

                                                            {/* 2. Course & Branch */}
                                                            <td className="p-3 text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-gray-800">{row.course}</span>
                                                                    <span className="text-gray-400 font-normal">-</span>
                                                                    <span className="text-gray-600 font-medium">{row.branch}</span>
                                                                </div>
                                                            </td>

                                                            {/* 3. Category (Quota) - All Quotas */}
                                                            <td className="p-3">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {row.categories.map(cat => (
                                                                        <span key={cat} className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-200">
                                                                            {cat}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>

                                                            {/* 4. Actions */}
                                                            <td className="p-3 text-right">
                                                                <div className="flex justify-end items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setWizardContext({
                                                                                college: row.college,
                                                                                batch: row.batch,
                                                                                course: row.course,
                                                                                branch: row.branch,
                                                                                feeType: 'Yearly'
                                                                            });
                                                                            setWizardStep(2);
                                                                            setIsModalOpen(true);
                                                                        }}
                                                                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition"
                                                                        title="Edit Fee Structure"
                                                                    >
                                                                        <Pencil size={16} />
                                                                    </button>

                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!window.confirm(`Delete ALL fee definitions for ${row.course} - ${row.branch} (${row.batch})?`)) return;
                                                                            try {
                                                                                await Promise.all(row.allIds.map(id => api.delete(`/fee-structures/${id}`)));
                                                                                fetchStructures();
                                                                            } catch (e) { alert('Delete failed'); }
                                                                        }}
                                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition"
                                                                        title="Delete Fee Structure"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* EXPANDABLE SECTION FOR QUOTAS - MATCHING CREATION MATRIX TABLES */}
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan={4} className="p-0 bg-slate-50/70 border-y-2 border-blue-100">
                                                                    <div className="p-4 space-y-4">
                                                                        {row.categories.map(catName => {
                                                                            const quotaKey = `${row.key}|${catName}`;
                                                                            const isQuotaExpanded = !!expandedQuotas[quotaKey];
                                                                            const qData = row.quotasMap[catName];
                                                                            if (!qData) return null;
                                                                            const qFeeHeads = Object.values(qData.feeHeadsMap || {});

                                                                            const selectedMeta = metadata[row.college]?.[row.course];
                                                                            const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 4;
                                                                            const hasSemesters = Object.values(qData.matrix).some(yrMap => 
                                                                                Object.values(yrMap).some(items => items.some(it => it.semester))
                                                                            );

                                                                            const matrixRows = [];
                                                                            for (let y = 1; y <= yearsCount; y++) {
                                                                                if (!hasSemesters) {
                                                                                    matrixRows.push({ year: y, semester: null, rowKey: `${y}-Y`, label: `Year ${y}` });
                                                                                } else {
                                                                                    matrixRows.push({ year: y, semester: 1, rowKey: `${y}-S1`, label: `Yr ${y} Sem 1` });
                                                                                    matrixRows.push({ year: y, semester: 2, rowKey: `${y}-S2`, label: `Yr ${y} Sem 2` });
                                                                                }
                                                                            }

                                                                            return (
                                                                                <div key={catName} className="border border-gray-200 rounded-xl bg-white shadow-xs overflow-hidden transition-all duration-200">
                                                                                    {/* Quota Header Bar - Click to Expand / Collapse */}
                                                                                    <div 
                                                                                        onClick={() => toggleQuotaExpand(quotaKey)}
                                                                                        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer select-none transition-colors ${isQuotaExpanded ? 'bg-slate-100/90 border-b border-gray-200 hover:bg-slate-200/60' : 'bg-white hover:bg-gray-50'}`}
                                                                                    >
                                                                                        <div className="flex items-center gap-2">
                                                                                            <ChevronRight size={16} className={`text-gray-500 transition-transform duration-200 shrink-0 ${isQuotaExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                                                                                            <span className="font-bold text-gray-800 text-xs md:text-sm">{catName}</span>
                                                                                            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">
                                                                                                Quota
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                                                                                            <span>Quota Total: <span className="font-mono font-bold text-blue-900">₹{qData.grandTotal.toLocaleString('en-IN')}</span></span>
                                                                                            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isQuotaExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Quota Matrix Table - Expandable & Collapsible (Closed by Default) */}
                                                                                    {isQuotaExpanded && (
                                                                                        <div className="overflow-x-auto">
                                                                                            <table className="w-full text-center text-xs border-collapse">
                                                                                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                                                                                                    <tr>
                                                                                                        <th className="p-2.5 border-r border-gray-200 w-28 font-bold bg-gray-100/70 text-center">Period</th>
                                                                                                        {qFeeHeads.map(fh => (
                                                                                                            <th key={fh._id} className="p-2.5 border-r border-gray-200 min-w-[220px] align-top bg-gray-50 text-center">
                                                                                                                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                                                                                                    <div className="font-bold text-gray-900 text-xs">{fh.name}</div>
                                                                                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                                                                                                        {fh.isTermsDivided && (
                                                                                                                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                                                                                                                                Terms: {fh.termsCount || 'Divided'}
                                                                                                                            </span>
                                                                                                                        )}
                                                                                                                        {fh.isScholarshipApplicable && (
                                                                                                                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                                                                                                                Scholarship
                                                                                                                            </span>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            </th>
                                                                                                        ))}
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-gray-100">
                                                                                                    {matrixRows.map(rowInfo => {
                                                                                                        return (
                                                                                                            <tr key={rowInfo.rowKey} className="hover:bg-gray-50/80">
                                                                                                                <td className="p-2.5 font-semibold text-gray-800 bg-gray-50 border-r border-gray-200 whitespace-nowrap text-center">
                                                                                                                    {rowInfo.label}
                                                                                                                </td>
                                                                                                                {qFeeHeads.map(fh => {
                                                                                                                    const items = qData.matrix[rowInfo.year]?.[fh._id] || [];
                                                                                                                    const matchItem = items.find(it => rowInfo.semester ? Number(it.semester) === Number(rowInfo.semester) : !it.semester);
                                                                                                                    const amt = matchItem ? matchItem.amount : 0;
                                                                                                                    const terms = matchItem?.terms || [];

                                                                                                                    return (
                                                                                                                        <td key={fh._id} className="p-2 border-r border-gray-200 align-top space-y-1 text-center">
                                                                                                                            <div className="font-mono font-bold text-gray-800 text-xs">
                                                                                                                                {amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : <span className="text-gray-300 font-normal italic">-</span>}
                                                                                                                            </div>

                                                                                                                            {matchItem?.isTermsDivided && terms.length > 0 && (
                                                                                                                                <div className="p-1.5 bg-blue-50/50 rounded border border-blue-100 text-[10px] space-y-1 mt-1">
                                                                                                                                    <span className="font-bold text-blue-900 block text-center">Terms Breakdown ({terms.length} Terms)</span>
                                                                                                                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                                                                                                                        {terms.map(t => (
                                                                                                                                            <div key={t.termNumber} className="bg-white border border-blue-200 px-1.5 py-1 rounded flex items-center justify-between gap-1 text-[10px] whitespace-nowrap">
                                                                                                                                                <span className="text-[9px] text-gray-500 font-bold">T{t.termNumber}</span>
                                                                                                                                                <span className="text-[10px] font-bold text-blue-600 font-mono">₹{t.amount.toLocaleString('en-IN')}</span>
                                                                                                                                            </div>
                                                                                                                                        ))}
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </td>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </tr>
                                                                                                        );
                                                                                                    })}
                                                                                                </tbody>
                                                                                                <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                                                                                    <tr>
                                                                                                        <td className="p-2.5 border-r border-gray-200 text-center">Total</td>
                                                                                                        {qFeeHeads.map(fh => {
                                                                                                            const cTotal = qData.feeHeadTotals[fh._id] || 0;
                                                                                                            return (
                                                                                                                <td key={fh._id} className="p-2.5 border-r border-gray-200 font-mono text-blue-900 text-center">
                                                                                                                    ₹{cTotal.toLocaleString('en-IN')}
                                                                                                                </td>
                                                                                                            );
                                                                                                        })}
                                                                                                    </tr>
                                                                                                </tfoot>
                                                                                            </table>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
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
                        </div>

                        {/* Modal Popup for "Define Standard Fees" - Simple & Clean UI */}
                        {isModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
                                <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-xl shadow-xl border border-gray-200 flex flex-col my-auto overflow-hidden text-gray-800">
                                    
                                    {/* Modal Header */}
                                    <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-lg font-bold text-gray-800">Create Fee Structure</h2>
                                                <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                                                    Step {wizardStep} of 2
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {wizardStep === 1 
                                                    ? 'Select College, Batch, Course and Branch context.' 
                                                    : 'Configure Fee Head columns and amounts quota by quota.'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {(wizardContext.college || Object.keys(quotaConfigs).length > 0) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm("Are you sure you want to reset and clear all draft configuration?")) {
                                                            clearWizardDraft();
                                                        }
                                                    }}
                                                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-semibold px-2.5 py-1 rounded border border-red-200 transition"
                                                >
                                                    Reset Draft
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsModalOpen(false)}
                                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                                                title="Close"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stepper Tabs Bar */}
                                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center gap-6 text-xs font-semibold shrink-0">
                                        <button 
                                            type="button"
                                            onClick={() => setWizardStep(1)}
                                            className={`flex items-center gap-2 py-1 transition ${wizardStep === 1 ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-2' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${wizardStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                                            1. Context Selection
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (wizardContext.college && wizardContext.batch && wizardContext.course && wizardContext.branch) {
                                                    setWizardStep(2);
                                                }
                                            }}
                                            disabled={!wizardContext.college || !wizardContext.batch || !wizardContext.course || !wizardContext.branch}
                                            className={`flex items-center gap-2 py-1 transition ${wizardStep === 2 ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-2' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40'}`}
                                        >
                                            <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${wizardStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                                            2. Quota-wise Setup
                                        </button>
                                    </div>

                                    {/* Modal Content Area */}
                                    <div className="p-6 overflow-y-auto flex-1 space-y-6">

                                        {/* STEP 1: CONTEXT SELECTION */}
                                        {wizardStep === 1 && (
                                            <div className="max-w-2xl mx-auto space-y-6 py-2">
                                                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 space-y-4">
                                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-2">Academic Context</h3>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {/* College */}
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-700 block mb-1">College *</label>
                                                            <select 
                                                                className="w-full border border-gray-300 bg-white p-2 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                                value={wizardContext.college}
                                                                onChange={e => setWizardContext({ ...wizardContext, college: e.target.value, course: '', branch: '' })}
                                                                required
                                                            >
                                                                <option value="">Select College</option>
                                                                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>

                                                        {/* Batch */}
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-700 block mb-1">Batch *</label>
                                                            <select 
                                                                className="w-full border border-gray-300 bg-white p-2 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                                value={wizardContext.batch}
                                                                onChange={e => setWizardContext({ ...wizardContext, batch: e.target.value })}
                                                                required
                                                            >
                                                                <option value="">Select Batch</option>
                                                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                                            </select>
                                                        </div>

                                                        {/* Course */}
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-700 block mb-1">Course *</label>
                                                            <select 
                                                                className="w-full border border-gray-300 bg-white p-2 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                                                                value={wizardContext.course}
                                                                onChange={e => setWizardContext({ ...wizardContext, course: e.target.value, branch: '' })}
                                                                disabled={!wizardContext.college}
                                                                required
                                                            >
                                                                <option value="">Select Course</option>
                                                                {(wizardContext.college ? Object.keys(metadata[wizardContext.college] || {}) : []).map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>

                                                        {/* Branch */}
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-700 block mb-1">Branch *</label>
                                                            <select 
                                                                className="w-full border border-gray-300 bg-white p-2 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                                                                value={wizardContext.branch}
                                                                onChange={e => setWizardContext({ ...wizardContext, branch: e.target.value })}
                                                                disabled={!wizardContext.course}
                                                                required
                                                            >
                                                                <option value="">Select Branch</option>
                                                                {(metadata[wizardContext.college]?.[wizardContext.course]?.branches || []).map(b => <option key={b} value={b}>{b}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Structure Type */}
                                                    <div className="pt-3 border-t">
                                                        <label className="text-xs font-bold text-gray-700 block mb-2">Structure Type</label>
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                                                <input 
                                                                    type="radio" 
                                                                    name="feeType" 
                                                                    checked={wizardContext.feeType === 'Yearly'} 
                                                                    onChange={() => setWizardContext({ ...wizardContext, feeType: 'Yearly' })} 
                                                                /> 
                                                                Yearly Structure
                                                            </label>

                                                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                                                <input 
                                                                    type="radio" 
                                                                    name="feeType" 
                                                                    checked={wizardContext.feeType === 'Semester'} 
                                                                    onChange={() => setWizardContext({ ...wizardContext, feeType: 'Semester' })} 
                                                                /> 
                                                                Semester-wise Structure
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex justify-end gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsModalOpen(false)}
                                                        className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!wizardContext.college || !wizardContext.batch || !wizardContext.course || !wizardContext.branch}
                                                        onClick={() => setWizardStep(2)}
                                                        className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition flex items-center gap-1.5"
                                                    >
                                                        <span>Next: Configure Quotas</span>
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* STEP 2: QUOTA-WISE SETUP */}
                                        {wizardStep === 2 && (
                                            <div className="space-y-4">
                                                {/* Context Summary Bar */}
                                                <div className="bg-blue-50/80 border border-blue-200 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                                                    <div className="flex items-center gap-2 font-medium text-gray-800">
                                                        <span className="font-bold text-blue-900">{wizardContext.college}</span>
                                                        <span>•</span>
                                                        <span>Batch {wizardContext.batch}</span>
                                                        <span>•</span>
                                                        <span>{wizardContext.course} ({wizardContext.branch})</span>
                                                        <span>•</span>
                                                        <span className="text-gray-500">{wizardContext.feeType}</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setWizardStep(1)}
                                                        className="text-xs text-blue-700 hover:underline font-semibold"
                                                    >
                                                        Change Context
                                                    </button>
                                                </div>

                                                {/* Quotas Accordion List */}
                                                <div className="space-y-3">
                                                    {availableQuotas.map((quotaName, qIndex) => {
                                                        const isExpanded = activeQuotaIndex === qIndex;
                                                        const isSaved = !!savedQuotas[quotaName];
                                                        const currentConfig = getQuotaConfig(quotaName);

                                                        // Quota accessibility check: Accessible if saved or if all preceding quotas are saved
                                                        const isAccessible = isSaved || availableQuotas.slice(0, qIndex).every(q => !!savedQuotas[q]);
                                                        const firstUnsavedQuota = availableQuotas.find(q => !savedQuotas[q]);

                                                        const handleQuotaClick = () => {
                                                            setWizardError('');
                                                            if (isAccessible) {
                                                                setActiveQuotaIndex(qIndex);
                                                            } else {
                                                                setWizardError(`Quota "${quotaName}" is locked. Please configure and save "${firstUnsavedQuota}" first.`);
                                                            }
                                                        };

                                                        // Compute Matrix Rows
                                                        const selectedMeta = metadata[wizardContext.college]?.[wizardContext.course];
                                                        const yearsCount = selectedMeta ? (selectedMeta.total_years || 4) : 4;
                                                        const matrixRows = [];
                                                        for (let y = 1; y <= yearsCount; y++) {
                                                            if (wizardContext.feeType === 'Yearly') {
                                                                matrixRows.push({ year: y, semester: null, rowKey: `${y}-Y`, label: `Year ${y}` });
                                                            } else {
                                                                matrixRows.push({ year: y, semester: 1, rowKey: `${y}-S1`, label: `Yr ${y} Sem 1` });
                                                                matrixRows.push({ year: y, semester: 2, rowKey: `${y}-S2`, label: `Yr ${y} Sem 2` });
                                                            }
                                                        }

                                                        // Calculate Grand Total for quota
                                                        let quotaTotal = 0;
                                                        currentConfig.columns.forEach(col => {
                                                            matrixRows.forEach(row => {
                                                                const key = `${row.rowKey}_${col.id}`;
                                                                quotaTotal += Number(currentConfig.amounts[key]) || 0;
                                                            });
                                                        });

                                                        return (
                                                            <div 
                                                                key={quotaName}
                                                                className={`border rounded-lg bg-white overflow-hidden transition ${!isAccessible ? 'opacity-75 bg-gray-50 border-gray-200' : isExpanded ? 'border-blue-400 ring-1 ring-blue-200' : isSaved ? 'border-green-200 bg-green-50/20' : 'border-gray-200'}`}
                                                            >
                                                                {/* Quota Single Header Row */}
                                                                <div 
                                                                    onClick={handleQuotaClick}
                                                                    className={`p-3 flex items-center justify-between select-none ${!isAccessible ? 'cursor-not-allowed bg-gray-50/70' : 'cursor-pointer hover:bg-gray-50'} ${isExpanded ? 'bg-blue-50/40 border-b border-blue-100' : ''}`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${isSaved ? 'bg-green-600 text-white' : isExpanded ? 'bg-blue-600 text-white' : isAccessible ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                                                                            {isSaved ? '✓' : (qIndex + 1)}
                                                                        </span>

                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`font-bold text-xs md:text-sm ${!isAccessible ? 'text-gray-500' : 'text-gray-800'}`}>{quotaName}</span>
                                                                                {isSaved && (
                                                                                    <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                                                                        Saved
                                                                                    </span>
                                                                                )}
                                                                                {!isAccessible && (
                                                                                    <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded border border-gray-200">
                                                                                        🔒 Complete {firstUnsavedQuota} first
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[11px] text-gray-500 mt-0.5">
                                                                                {currentConfig.columns.filter(c => c.feeHeadId).length} Fee Head Columns | Total: <span className="font-mono font-bold text-gray-800">₹{quotaTotal.toLocaleString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        {!isExpanded && isAccessible && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleQuotaClick(); }}
                                                                                className={`text-xs font-semibold px-2.5 py-1 rounded border ${isSaved ? 'bg-white text-green-700 border-green-300 hover:bg-green-50' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                                                            >
                                                                                {isSaved ? 'Edit' : 'Configure'}
                                                                            </button>
                                                                        )}
                                                                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                                                                    </div>
                                                                </div>

                                                                {/* EXPANDED SECTION FOR ACTIVE QUOTA */}
                                                                {isExpanded && (
                                                                    <div className="p-4 space-y-4 bg-white">
                                                                        {/* Fee Head Columns Header */}
                                                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                                                            <span className="text-xs font-bold text-gray-700">Fee Head Columns for {quotaName}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => addColumnToActiveQuota(quotaName)}
                                                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-300 bg-blue-50 px-2.5 py-1 rounded hover:bg-blue-100 transition"
                                                                            >
                                                                                + Add Fee Head Column
                                                                            </button>
                                                                        </div>
                                         {/* Matrix Table */}
                                                                        <div className="overflow-x-auto border border-gray-200 rounded">
                                                                            <table className="w-full text-center text-xs border-collapse">
                                                                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                                                                                    <tr>
                                                                                        <th className="p-2.5 border-r border-gray-200 w-28 text-center">Period</th>
                                                                                        {currentConfig.columns.map((col, cIdx) => (
                                                                                             <th key={col.id} className="p-2.5 border-r border-gray-200 min-w-[280px] align-top bg-gray-50 text-center">
                                                                                                 <div className="space-y-1.5">
                                                                                                     <div className="flex items-center gap-1">
                                                                                                         {/* Fee Head Dropdown */}
                                                                                                         <select
                                                                                                             className="w-full border border-gray-300 bg-white p-1.5 rounded text-xs font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none text-center"
                                                                                                             value={col.feeHeadId}
                                                                                                             onChange={e => updateColumnInActiveQuota(quotaName, col.id, 'feeHeadId', e.target.value)}
                                                                                                         >
                                                                                                             <option value="">Select Fee Head</option>
                                                                                                             {feeHeads.map(h => (
                                                                                                                 <option key={h._id} value={h._id} disabled={currentConfig.columns.some(c => c.id !== col.id && c.feeHeadId === h._id)}>
                                                                                                                     {h.name}
                                                                                                                 </option>
                                                                                                             ))}
                                                                                                         </select>

                                                                                                         {currentConfig.columns.length > 1 && (
                                                                                                             <button
                                                                                                                 type="button"
                                                                                                                 onClick={() => removeColumnFromActiveQuota(quotaName, col.id)}
                                                                                                                 className="text-gray-400 hover:text-red-600 p-1 shrink-0"
                                                                                                                 title="Remove column"
                                                                                                             >
                                                                                                                 <Trash2 size={15} />
                                                                                                             </button>
                                                                                                         )}
                                                                                                     </div>

                                                                                                     {/* Checkboxes & Terms dropdown aligned in single line */}
                                                                                                     <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-gray-200 text-[11px] text-gray-700 whitespace-nowrap">
                                                                                                         <label className="flex items-center gap-1 cursor-pointer select-none">
                                                                                                             <input
                                                                                                                 type="checkbox"
                                                                                                                 checked={col.isLateFeeApplicable || false}
                                                                                                                 onChange={e => {
                                                                                                                     const checked = e.target.checked;
                                                                                                                     updateColumnInActiveQuota(quotaName, col.id, 'isLateFeeApplicable', checked);
                                                                                                                 }}
                                                                                                                 className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                                                                                             />
                                                                                                             <span className="font-semibold text-gray-800">Late Fee</span>
                                                                                                         </label>

                                                                                                         {col.isLateFeeApplicable && (
                                                                                                             <div className="flex items-center gap-1">
                                                                                                                 <span className="text-[10px] text-gray-500 font-bold">Terms:</span>
                                                                                                                 <select
                                                                                                                     className="border border-gray-300 bg-white p-0.5 rounded text-[10px] font-bold text-blue-700 focus:ring-1 focus:ring-blue-500 outline-none"
                                                                                                                     value={col.termsCount || 0}
                                                                                                                     onChange={e => updateColumnInActiveQuota(quotaName, col.id, 'termsCount', Number(e.target.value))}
                                                                                                                 >
                                                                                                                     <option value={0}>0</option>
                                                                                                                     <option value={2}>2</option>
                                                                                                                     <option value={3}>3</option>
                                                                                                                     <option value={4}>4</option>
                                                                                                                 </select>
                                                                                                             </div>
                                                                                                         )}

                                                                                                         <label className="flex items-center gap-1 cursor-pointer select-none">
                                                                                                             <input
                                                                                                                 type="checkbox"
                                                                                                                 checked={col.isScholarshipApplicable || false}
                                                                                                                 onChange={e => updateColumnInActiveQuota(quotaName, col.id, 'isScholarshipApplicable', e.target.checked)}
                                                                                                                 className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                                                                                             />
                                                                                                             <span className="font-semibold text-gray-800">Scholarship</span>
                                                                                                         </label>
                                                                                                     </div>
                                                                                                 </div>
                                                                                             </th>
                                                                                         ))}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {matrixRows.map(row => {
                                                                                        return (
                                                                                            <tr key={row.rowKey} className="hover:bg-gray-50/80">
                                                                                                <td className="p-2.5 font-semibold text-gray-800 bg-gray-50 border-r border-gray-200 whitespace-nowrap text-center">
                                                                                                    {row.label}
                                                                                                </td>
                                                                                                {currentConfig.columns.map(col => {
                                                                                                    const amtKey = `${row.rowKey}_${col.id}`;
                                                                                                    const val = currentConfig.amounts[amtKey] || '';
                                                                                                    const nVal = Number(val) || 0;
                                                                                                    const termObj = currentConfig.terms[amtKey];

                                                                                                    return (
                                                                                                        <td key={col.id} className="p-2 border-r border-gray-200 align-top space-y-1 text-center">
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                placeholder="₹ Amount"
                                                                                                                className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none text-center"
                                                                                                                value={val}
                                                                                                                onChange={e => updateAmountInActiveQuota(quotaName, row.rowKey, col.id, e.target.value)}
                                                                                                                disabled={!col.feeHeadId}
                                                                                                            />

                                                                                                            {col.isLateFeeApplicable && nVal > 0 && termObj && termObj.data && termObj.data.length > 0 && (
                                                                                                                <div className="p-1.5 bg-blue-50/50 rounded border border-blue-100 text-[10px] space-y-1">
                                                                                                                    <span className="font-bold text-blue-900 block text-center">Terms Breakdown ({termObj.data.length} Terms)</span>
                                                                                                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                                                                                                        {termObj.data.map((t, tidx) => (
                                                                                                                            <div key={tidx} className="bg-white border border-blue-200 px-1.5 py-1 rounded flex items-center justify-between gap-1 text-[10px] whitespace-nowrap">
                                                                                                                                <span className="text-[9px] text-gray-500 font-bold">T{tidx+1}</span>
                                                                                                                                <input
                                                                                                                                    type="number"
                                                                                                                                    className="w-7 border text-center text-[9px] p-0.5 rounded font-bold"
                                                                                                                                    value={t.p}
                                                                                                                                    onChange={e => updateTermPctInActiveQuota(quotaName, row.rowKey, col.id, tidx, e.target.value)}
                                                                                                                                    title="Term ratio"
                                                                                                                                />
                                                                                                                                <span className="text-[10px] font-bold text-blue-600 font-mono">₹{Number(t.a || 0).toLocaleString('en-IN')}</span>
                                                                                                                            </div>
                                                                                                                        ))}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </td>
                                                                                                    );
                                                                                                })}
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                                <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                                                                                    <tr>
                                                                                        <td className="p-2.5 border-r border-gray-200">Total</td>
                                                                                        {currentConfig.columns.map(col => {
                                                                                            let cTotal = 0;
                                                                                            matrixRows.forEach(row => {
                                                                                                const amtKey = `${row.rowKey}_${col.id}`;
                                                                                                cTotal += Number(currentConfig.amounts[amtKey]) || 0;
                                                                                            });
                                                                                            return (
                                                                                                <td key={col.id} className="p-2.5 border-r border-gray-200 font-mono text-blue-900">
                                                                                                    ₹{cTotal.toLocaleString()}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>

                                                                        {/* Inline Validation Error Banner inside active quota card */}
                                                                        {wizardError && (
                                                                            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 my-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-red-600 font-bold">⚠️</span>
                                                                                    <span>{wizardError}</span>
                                                                                </div>
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={() => setWizardError('')}
                                                                                    className="text-red-400 hover:text-red-600 font-bold text-xs shrink-0"
                                                                                >
                                                                                    ✕
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {/* Bottom Button for Save & Next Quota */}
                                                                        <div className="flex justify-between items-center pt-2">
                                                                            <span className="text-xs text-gray-500">
                                                                                Quota {qIndex + 1} of {availableQuotas.length}: <span className="font-bold text-gray-700">{quotaName}</span>
                                                                            </span>

                                                                            <div className="flex items-center gap-2">
                                                                                {qIndex > 0 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setActiveQuotaIndex(qIndex - 1)}
                                                                                        className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition"
                                                                                    >
                                                                                        Previous Quota
                                                                                    </button>
                                                                                )}

                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isSavingQuota}
                                                                                    onClick={() => handleSaveQuotaAndNext(quotaName, qIndex === availableQuotas.length - 1)}
                                                                                    className="px-5 py-2 rounded text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-1"
                                                                                >
                                                                                    {isSavingQuota ? (
                                                                                        <span>Saving...</span>
                                                                                    ) : qIndex === availableQuotas.length - 1 ? (
                                                                                        <span>Save & Complete All Quotas</span>
                                                                                    ) : (
                                                                                        <>
                                                                                            <span>Next Quota ({availableQuotas[qIndex + 1]})</span>
                                                                                            <ChevronRight size={15} />
                                                                                        </>
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 3: LATE FEES --- */}
                
                {activeTab === 'latefees' && (
                    <div className="space-y-6">
                        {lateFeeSubTab === 'view' && (
                            <div className="space-y-4">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><Calendar size={18} /></span>
                                            Filter Late Fee Configurations
                                        </h2>
                                        {(lateFeeViewFilters.college || lateFeeViewFilters.course || lateFeeViewFilters.branch || lateFeeViewFilters.batch || lateFeeViewFilters.studentYear || lateFeeViewFilters.semester || lateFeeViewFilters.category || lateFeeViewFilters.feeHead) && (
                                            <button
                                                type="button"
                                                onClick={() => setLateFeeViewFilters({ college: '', course: '', branch: '', batch: '', studentYear: '', semester: '', category: '', feeHead: '' })}
                                                className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
                                            >
                                                Clear Filters
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">College</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.college}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, college: e.target.value, course: '', branch: '', feeHead: '' })}
                                            >
                                                <option value="">All</option>
                                                {colleges.map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Course</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.course}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, course: e.target.value, branch: '', feeHead: '' })}
                                                disabled={!lateFeeViewFilters.college}
                                            >
                                                <option value="">All</option>
                                                {(lateFeeViewFilters.college ? Object.keys(metadata[lateFeeViewFilters.college] || {}) : []).map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Branch</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.branch}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, branch: e.target.value, feeHead: '' })}
                                                disabled={!lateFeeViewFilters.course}
                                            >
                                                <option value="">All</option>
                                                {(lateFeeViewFilters.college && lateFeeViewFilters.course ? metadata[lateFeeViewFilters.college]?.[lateFeeViewFilters.course]?.branches || [] : []).map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Batch</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.batch}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, batch: e.target.value, feeHead: '' })}
                                            >
                                                <option value="">All</option>
                                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Year</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.studentYear}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, studentYear: e.target.value, semester: '', feeHead: '' })}
                                            >
                                                <option value="">All</option>
                                                {(() => {
                                                    const yearsCount = (lateFeeViewFilters.college && lateFeeViewFilters.course)
                                                        ? metadata[lateFeeViewFilters.college]?.[lateFeeViewFilters.course]?.total_years || 4
                                                        : 4;
                                                    return Array.from({ length: yearsCount }, (_, i) => i + 1).map(y => (
                                                        <option key={y} value={y}>Year {y}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Semester</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.semester}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, semester: e.target.value, feeHead: '' })}
                                            >
                                                <option value="">All</option>
                                                <option value="full">Full Year</option>
                                                <option value="1">Sem 1</option>
                                                <option value="2">Sem 2</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.category}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, category: e.target.value, feeHead: '' })}
                                            >
                                                <option value="">All</option>
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Fee Head</label>
                                            <select
                                                className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                                value={lateFeeViewFilters.feeHead}
                                                onChange={e => setLateFeeViewFilters({ ...lateFeeViewFilters, feeHead: e.target.value })}
                                            >
                                                <option value="">All</option>
                                                {feeHeads.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-bold text-gray-800">Existing Late Fee Configurations</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">Structures with late fee amounts or a late fee head saved</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={!!syncingLateFeeId}
                                            onClick={() => syncLateFees()}
                                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition inline-flex items-center gap-1.5 disabled:opacity-50"
                                            title="Run late fee job for all configurations (same as nightly sync)"
                                        >
                                            <RefreshCw size={13} className={syncingLateFeeId === 'all' ? 'animate-spin' : ''} />
                                            {syncingLateFeeId === 'all' ? 'Syncing…' : 'Sync All'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLateFeeSubTab('create')}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition"
                                        >
                                            + New Configuration
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">College / Course</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Batch</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Year / Sem</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Category</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Fee Head</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Late Fee Head</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider">Terms</th>
                                                <th className="px-4 py-3 font-bold uppercase text-gray-500 tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(() => {
                                                const configured = structures.filter(s => {
                                                    const hasLateFee = s.lateFeeHead ||
                                                        (Array.isArray(s.terms) && s.terms.some(t => Number(t.lateFeeAmount) > 0));
                                                    if (!hasLateFee) return false;

                                                    if (lateFeeViewFilters.college && s.college !== lateFeeViewFilters.college) return false;
                                                    if (lateFeeViewFilters.course && s.course !== lateFeeViewFilters.course) return false;
                                                    if (lateFeeViewFilters.branch && s.branch !== lateFeeViewFilters.branch) return false;
                                                    if (lateFeeViewFilters.batch && String(s.batch) !== String(lateFeeViewFilters.batch)) return false;
                                                    if (lateFeeViewFilters.studentYear && Number(s.studentYear) !== Number(lateFeeViewFilters.studentYear)) return false;
                                                    if (lateFeeViewFilters.semester === 'full') {
                                                        if (s.semester) return false;
                                                    } else if (lateFeeViewFilters.semester) {
                                                        if (Number(s.semester) !== Number(lateFeeViewFilters.semester)) return false;
                                                    }
                                                    if (lateFeeViewFilters.category && s.category !== lateFeeViewFilters.category) return false;
                                                    if (lateFeeViewFilters.feeHead) {
                                                        const headId = String(s.feeHead?._id || s.feeHead || '');
                                                        if (headId !== String(lateFeeViewFilters.feeHead)) return false;
                                                    }
                                                    return true;
                                                });
                                                if (configured.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan="8" className="px-6 py-16 text-center text-gray-400">
                                                                <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
                                                                <p className="font-medium">No late fee configurations found</p>
                                                                <p className="text-[11px] mt-1">
                                                                    {(lateFeeViewFilters.college || lateFeeViewFilters.course || lateFeeViewFilters.batch)
                                                                        ? 'Try clearing filters, or create one from the Create tab'
                                                                        : 'Create one from the Create tab'}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                                return configured.map(s => {
                                                    const lateTerms = (s.terms || []).filter(t => Number(t.lateFeeAmount) > 0);
                                                    return (
                                                        <tr key={s._id} className="hover:bg-gray-50/80">
                                                            <td className="px-4 py-3">
                                                                <div className="font-semibold text-gray-800">{s.college}</div>
                                                                <div className="text-gray-500">{s.course} · {s.branch}</div>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-gray-800">{s.batch}</td>
                                                            <td className="px-4 py-3">
                                                                Yr {s.studentYear}
                                                                {s.semester ? ` / Sem ${s.semester}` : ' / Full Year'}
                                                            </td>
                                                            <td className="px-4 py-3">{s.category}</td>
                                                            <td className="px-4 py-3 font-semibold text-blue-700">
                                                                {s.feeHead?.name || '—'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {s.lateFeeHead?.name
                                                                    ? `${s.lateFeeHead.name}${s.lateFeeHead.code ? ` (${s.lateFeeHead.code})` : ''}`
                                                                    : <span className="text-amber-600 font-medium">Not set</span>}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {lateTerms.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {lateTerms.map(t => (
                                                                            <span key={t.termNumber} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                                                                T{t.termNumber}: ₹{Number(t.lateFeeAmount).toLocaleString()}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="inline-flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!!syncingLateFeeId || !s.lateFeeHead}
                                                                        title={!s.lateFeeHead ? 'Set a late fee head before syncing' : 'Apply late fees for this structure now'}
                                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        onClick={() => syncLateFees(s._id)}
                                                                    >
                                                                        <RefreshCw size={13} className={syncingLateFeeId === s._id ? 'animate-spin' : ''} />
                                                                        {syncingLateFeeId === s._id ? 'Syncing…' : 'Sync'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition"
                                                                        onClick={() => {
                                                                            setLateFeeForm({
                                                                                college: s.college || '',
                                                                                course: s.course || '',
                                                                                branch: s.branch || '',
                                                                                batch: s.batch || '',
                                                                                studentYear: String(s.studentYear || ''),
                                                                                semester: s.semester ? String(s.semester) : '',
                                                                                categories: s.category ? [s.category] : [],
                                                                                feeHead: String(s.feeHead?._id || s.feeHead || ''),
                                                                                lateFeeHead: String(s.lateFeeHead?._id || s.lateFeeHead || ''),
                                                                                termMappings: s.terms || [],
                                                                                penaltyType: 'Fixed',
                                                                                penaltyValue: 0,
                                                                                _id: s._id
                                                                            });
                                                                            setLateFeeSubTab('create');
                                                                        }}
                                                                    >
                                                                        <Pencil size={13} /> Edit
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            </div>
                        )}

                        {lateFeeSubTab === 'create' && (
                        <>
                        {/* Selector Section */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><Calendar size={18} /></span>
                                Select Context to Load Fee Structures
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3">
                                <div className="md:col-span-2 lg:col-span-3">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">College</label>
                                    <select className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={lateFeeForm.college} onChange={e => setLateFeeForm({ ...lateFeeForm, college: e.target.value, course: '', branch: '', feeHead: '', lateFeeHead: '', termMappings: [], _id: null })}>
                                        <option value="">Select...</option>
                                        {colleges.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Course</label>
                                    <select className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={lateFeeForm.course} onChange={e => setLateFeeForm({ ...lateFeeForm, course: e.target.value, branch: '', feeHead: '', lateFeeHead: '', termMappings: [], _id: null })} disabled={!lateFeeForm.college}>
                                        <option value="">Select...</option>
                                        {(lateFeeForm.college ? Object.keys(metadata[lateFeeForm.college] || {}) : []).map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Branch</label>
                                    <select 
                                        className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" 
                                        value={lateFeeForm.branch} 
                                        onChange={e => setLateFeeForm({ ...lateFeeForm, branch: e.target.value, feeHead: '', lateFeeHead: '', termMappings: [], _id: null })} 
                                        disabled={!lateFeeForm.course}
                                    >
                                        <option value="">Select...</option>
                                        {(lateFeeForm.college && lateFeeForm.course ? metadata[lateFeeForm.college]?.[lateFeeForm.course]?.branches || [] : []).map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Batch</label>
                                    <select className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={lateFeeForm.batch} onChange={e => setLateFeeForm({ ...lateFeeForm, batch: e.target.value, feeHead: '', lateFeeHead: '', termMappings: [], _id: null })}>
                                        <option value="">Select...</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div className="lg:col-span-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Year</label>
                                    <select className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={lateFeeForm.studentYear} onChange={e => setLateFeeForm({ ...lateFeeForm, studentYear: e.target.value, feeHead: '', lateFeeHead: '', termMappings: [], _id: null })}>
                                        <option value="">Select...</option>
                                        {(() => {
                                            const yearsCount = (lateFeeForm.college && lateFeeForm.course) ? metadata[lateFeeForm.college]?.[lateFeeForm.course]?.total_years || 4 : 4;
                                            return Array.from({ length: yearsCount }, (_, i) => i + 1).map(y => (
                                                <option key={y} value={y}>Year {y}</option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                                    <select className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors" value={lateFeeForm.categories[0] || ''} onChange={e => setLateFeeForm({ ...lateFeeForm, categories: [e.target.value], feeHead: '', lateFeeHead: '', termMappings: [], _id: null })}>
                                        <option value="">Select...</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Matching structures — pick fee head / structure from list */}
                        {(() => {
                            const contextReady = !!(
                                lateFeeForm.college &&
                                lateFeeForm.course &&
                                lateFeeForm.branch &&
                                lateFeeForm.batch &&
                                lateFeeForm.studentYear &&
                                lateFeeForm.categories[0]
                            );
                            if (!contextReady) {
                                return (
                                    <div className="bg-white p-16 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                        <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
                                            <Calendar size={28} />
                                        </div>
                                        <h3 className="text-base font-bold text-gray-800">Select Context First</h3>
                                        <p className="text-gray-400 text-sm max-w-sm mt-1">Choose College, Course, Branch, Batch, Year and Category to list matching fee structures.</p>
                                    </div>
                                );
                            }

                            const matchingStructures = structures.filter(s =>
                                s.college === lateFeeForm.college &&
                                s.course === lateFeeForm.course &&
                                s.branch === lateFeeForm.branch &&
                                String(s.batch) === String(lateFeeForm.batch) &&
                                Number(s.studentYear) === Number(lateFeeForm.studentYear) &&
                                s.category === lateFeeForm.categories[0]
                            );

                            return (
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800">Matching Fee Structures</h3>
                                            <p className="text-[11px] text-gray-500 mt-0.5">Select a fee head / structure to configure late fees</p>
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                                            {matchingStructures.length} found
                                        </span>
                                    </div>
                                    {matchingStructures.length === 0 ? (
                                        <div className="px-6 py-12 text-center text-gray-400">
                                            <AlertTriangle size={28} className="mx-auto mb-2 text-amber-400" />
                                            <p className="font-medium text-amber-700">No fee structures for this context</p>
                                            <p className="text-[11px] mt-1 max-w-md mx-auto">Create a fee structure under Fee Structures (Definitions) first, then come back to configure late fees.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Fee Head</th>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Year / Sem</th>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider text-right">Amount</th>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider text-center">Terms</th>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Late Fee Head</th>
                                                        <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {matchingStructures.map(s => {
                                                        const headId = String(s.feeHead?._id || s.feeHead || '');
                                                        const isSelected = String(lateFeeForm._id) === String(s._id);
                                                        const termCount = Array.isArray(s.terms) ? s.terms.length : 0;
                                                        const hasLateConfigured = s.lateFeeHead || (s.terms || []).some(t => Number(t.lateFeeAmount) > 0);
                                                        return (
                                                            <tr
                                                                key={s._id}
                                                                className={`transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50/80'}`}
                                                            >
                                                                <td className="px-4 py-2.5">
                                                                    <div className="font-semibold text-gray-800">{s.feeHead?.name || '—'}</div>
                                                                    {s.feeHead?.code && <div className="text-[10px] text-gray-400">{s.feeHead.code}</div>}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                                                                    Yr {s.studentYear}{s.semester ? ` / Sem ${s.semester}` : ' / Full Year'}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-700">
                                                                    ₹{Number(s.amount || 0).toLocaleString()}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    {termCount > 0 ? (
                                                                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold text-[10px]">{termCount} terms</span>
                                                                    ) : (
                                                                        <span className="text-amber-600 font-medium">Not divided</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    {hasLateConfigured ? (
                                                                        <span className="text-emerald-700 font-medium">
                                                                            {s.lateFeeHead?.name || 'Configured'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400">Not set</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-right">
                                                                    <button
                                                                        type="button"
                                                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                                                                        onClick={() => {
                                                                            setLateFeeForm({
                                                                                ...lateFeeForm,
                                                                                semester: s.semester ? String(s.semester) : '',
                                                                                feeHead: headId,
                                                                                lateFeeHead: s.lateFeeHead?._id || s.lateFeeHead || '',
                                                                                termMappings: s.terms || [],
                                                                                _id: s._id
                                                                            });
                                                                        }}
                                                                    >
                                                                        {isSelected ? 'Selected' : 'Configure'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Term Due Dates Configuration Section */}
                        {lateFeeForm._id && lateFeeForm.termMappings.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800">Term Due Dates Configuration</h3>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Editing: {feeHeads.find(h => String(h._id) === String(lateFeeForm.feeHead))?.name || 'Structure'}
                                        </p>
                                    </div>
                                    <div className="min-w-[220px]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Late Fee Head (all terms)</label>
                                        <select
                                            className="w-full border border-gray-200 bg-white rounded-lg p-2 text-xs font-bold text-gray-800 focus:border-blue-300 outline-none"
                                            value={lateFeeForm.lateFeeHead || ''}
                                            onChange={e => setLateFeeForm({ ...lateFeeForm, lateFeeHead: e.target.value })}
                                        >
                                            <option value="">Select late fee head...</option>
                                            {feeHeads
                                                .filter(h => /late\s*fee/i.test(`${h.name || ''} ${h.code || ''}`))
                                                .map(h => (
                                                    <option key={h._id} value={h._id}>
                                                        {h.name}{h.code ? ` (${h.code})` : ''}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Term</th>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Due Date Mode</th>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Due Rule</th>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Effective Due</th>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider">Description</th>
                                                <th className="px-4 py-2.5 font-bold uppercase text-gray-500 tracking-wider text-right">Late Fee (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {lateFeeForm.termMappings.map((term, idx) => {
                                                const mode = term.dueDateMode === 'fixed' ? 'fixed' : 'offset';
                                                const sDate = mode === 'offset'
                                                    ? findCalendarDate({ studentYear: lateFeeForm.studentYear, semester: (term.referenceSemester || 1), dueEventType: 'START_DATE' })
                                                    : null;
                                                let effectiveDue = null;
                                                if (mode === 'fixed' && term.fixedDueDate) {
                                                    effectiveDue = String(term.fixedDueDate).slice(0, 10);
                                                } else if (mode === 'offset' && sDate) {
                                                    const d = new Date(sDate);
                                                    if (!Number.isNaN(d.getTime())) {
                                                        d.setDate(d.getDate() + (term.dueOffsetDays || 0));
                                                        effectiveDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                    }
                                                }
                                                const formatDisplay = (iso) => {
                                                    if (!iso) return '—';
                                                    const [y, m, d] = iso.split('-');
                                                    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                                                };

                                                return (
                                                    <tr key={idx} className="align-top hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="font-bold text-gray-800">Term {term.termNumber}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">₹{Number(term.amount || 0).toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                                                                <button
                                                                    type="button"
                                                                    className={`px-2.5 py-1.5 text-[10px] font-bold transition ${mode === 'offset' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                                                    onClick={() => {
                                                                        const newTerms = [...lateFeeForm.termMappings];
                                                                        newTerms[idx] = { ...newTerms[idx], dueDateMode: 'offset', fixedDueDate: '' };
                                                                        setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                    }}
                                                                >
                                                                    Semester Offset
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={`px-2.5 py-1.5 text-[10px] font-bold transition border-l border-gray-200 ${mode === 'fixed' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                                                    onClick={() => {
                                                                        const newTerms = [...lateFeeForm.termMappings];
                                                                        newTerms[idx] = { ...newTerms[idx], dueDateMode: 'fixed', referenceSemester: '', dueOffsetDays: 0 };
                                                                        setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                    }}
                                                                >
                                                                    Fixed Date
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 min-w-[220px]">
                                                            {mode === 'offset' ? (
                                                                <div className="space-y-2">
                                                                    <select
                                                                        className="w-full border border-gray-200 rounded-lg p-1.5 text-xs font-medium bg-white outline-none focus:border-blue-300"
                                                                        value={term.referenceSemester || ''}
                                                                        onChange={e => {
                                                                            const newTerms = [...lateFeeForm.termMappings];
                                                                            newTerms[idx].referenceSemester = Number(e.target.value);
                                                                            newTerms[idx].dueDateMode = 'offset';
                                                                            setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                        }}
                                                                    >
                                                                        <option value="">Ref Semester...</option>
                                                                        <option value="1">Semester 1 start</option>
                                                                        <option value="2">Semester 2 start</option>
                                                                    </select>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="number"
                                                                            className="w-20 border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-blue-300"
                                                                            value={term.dueOffsetDays || 0}
                                                                            onChange={e => {
                                                                                const newTerms = [...lateFeeForm.termMappings];
                                                                                newTerms[idx].dueOffsetDays = Number(e.target.value);
                                                                                newTerms[idx].dueDateMode = 'offset';
                                                                                setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                            }}
                                                                        />
                                                                        <span className="text-[10px] text-gray-500">days after start</span>
                                                                    </div>
                                                                    {term.referenceSemester && !sDate && (
                                                                        <p className="text-[9px] text-orange-600 font-bold">Semester dates missing in calendar</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-blue-300 bg-white"
                                                                        value={term.fixedDueDate ? String(term.fixedDueDate).slice(0, 10) : ''}
                                                                        onChange={e => {
                                                                            const newTerms = [...lateFeeForm.termMappings];
                                                                            newTerms[idx].fixedDueDate = e.target.value;
                                                                            newTerms[idx].dueDateMode = 'fixed';
                                                                            setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                        }}
                                                                    />
                                                                    <p className="text-[9px] text-gray-400 mt-1">Demand applies after this date</p>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className={`font-bold font-mono ${effectiveDue ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                                {formatDisplay(effectiveDue)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Term 1 due"
                                                                className="w-full min-w-[140px] border border-gray-200 rounded-lg p-1.5 text-xs outline-none focus:border-blue-300"
                                                                value={term.dueDescription || ''}
                                                                onChange={e => {
                                                                    const newTerms = [...lateFeeForm.termMappings];
                                                                    newTerms[idx].dueDescription = e.target.value;
                                                                    setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="relative inline-block">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-28 border border-gray-200 rounded-lg p-1.5 pl-5 text-xs font-bold text-gray-800 outline-none focus:border-blue-300 text-right"
                                                                    value={term.lateFeeAmount || 0}
                                                                    onChange={e => {
                                                                        const newTerms = [...lateFeeForm.termMappings];
                                                                        newTerms[idx].lateFeeAmount = Number(e.target.value);
                                                                        setLateFeeForm({ ...lateFeeForm, termMappings: newTerms });
                                                                    }}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/30">
                                    <button
                                        className="bg-white border border-gray-200 text-gray-600 px-5 py-2 rounded-xl font-bold text-xs hover:bg-gray-50 transition-all shadow-sm"
                                        onClick={() => {
                                            setLateFeeForm({ ...lateFeeForm, feeHead: '', lateFeeHead: '', termMappings: [], _id: null });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 group disabled:bg-gray-400 disabled:shadow-none"
                                        disabled={isSavingLateFee}
                                        onClick={async () => {
                                            if (!lateFeeForm._id) return alert("No structure selected");
                                            const hasLateFeeAmount = lateFeeForm.termMappings.some(t => Number(t.lateFeeAmount) > 0);
                                            if (hasLateFeeAmount && !lateFeeForm.lateFeeHead) {
                                                return alert("Please select the fee head under which late fees should be added");
                                            }
                                            for (const t of lateFeeForm.termMappings) {
                                                if (Number(t.lateFeeAmount) <= 0) continue;
                                                const mode = t.dueDateMode === 'fixed' ? 'fixed' : 'offset';
                                                if (mode === 'fixed' && !t.fixedDueDate) {
                                                    return alert(`Term ${t.termNumber}: set a fixed due date`);
                                                }
                                                if (mode === 'offset' && !t.referenceSemester) {
                                                    return alert(`Term ${t.termNumber}: select a reference semester`);
                                                }
                                            }
                                            setIsSavingLateFee(true);
                                            try {
                                                const originalStruct = structures.find(s => s._id === lateFeeForm._id);
                                                if (originalStruct) {
                                                    const payload = {
                                                        ...originalStruct,
                                                        feeHead: originalStruct.feeHead?._id || originalStruct.feeHead,
                                                        lateFeeHead: lateFeeForm.lateFeeHead || null,
                                                        terms: lateFeeForm.termMappings.map(t => ({
                                                            ...t,
                                                            dueDateMode: t.dueDateMode === 'fixed' ? 'fixed' : 'offset',
                                                            fixedDueDate: t.dueDateMode === 'fixed' && t.fixedDueDate
                                                                ? String(t.fixedDueDate).slice(0, 10)
                                                                : null,
                                                            referenceSemester: t.dueDateMode === 'fixed' ? undefined : t.referenceSemester,
                                                            dueOffsetDays: t.dueDateMode === 'fixed' ? 0 : (t.dueOffsetDays || 0)
                                                        }))
                                                    };
                                                    await api.put(`/fee-structures/${lateFeeForm._id}`, payload);
                                                }
                                                setMessage("Late Fee Configuration Updated Successfully!");
                                                await fetchStructures();
                                                setLateFeeSubTab('view');
                                                setTimeout(() => setMessage(''), 3000);
                                            } catch (e) { alert("Update failed"); }
                                            finally { setIsSavingLateFee(false); }
                                        }}
                                    >
                                        {isSavingLateFee ? 'Saving Changes...' : 'Save Configuration'}
                                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {lateFeeForm._id && lateFeeForm.termMappings.length === 0 && (
                            <div className="bg-white p-16 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-3">
                                    <AlertTriangle size={28} />
                                </div>
                                <h3 className="text-base font-bold text-amber-700">Structure is Not Divided into Terms</h3>
                                <p className="text-gray-500 text-sm max-w-sm mt-1">
                                    Late fees need term-divided structures. Edit this structure under Fee Structures (Definitions) and set term counts first.
                                </p>
                            </div>
                        )}
                        </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


export default FeeConfiguration;
