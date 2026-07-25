import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Pencil, Trash2, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import Swal from 'sweetalert2';

const buildAcademicYears = () => {
  const cy = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => {
    const y = cy - 3 + i;
    return `${y}-${y + 1}`;
  });
};

const equalPercentages = (count) => {
  const n = Math.max(1, Number(count) || 1);
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === n - 1 ? rem : 0));
};

const emptyDefaultTerms = (count) => {
  const pcts = equalPercentages(count);
  return Array.from({ length: count }, (_, i) => ({
    termNumber: i + 1,
    percentage: pcts[i]
  }));
};

const emptyLateFeeTerms = (count) =>
  Array.from({ length: count }, (_, i) => ({
    termNumber: i + 1,
    lateFeeAmount: 0,
    dueDateMode: 'offset',
    referenceSemester: i === 0 ? 1 : 2,
    dueOffsetDays: 15,
    fixedDueDate: '',
    dueDescription: `Term ${i + 1} Late Fee`
  }));

/**
 * Hostel / Transport year config:
 * 1) Year default terms (applicable head + how many terms + %) — all students use this
 * 2) Late-fee rules by terms count — independent; can save for any 1/2/3/4
 */
const ServiceLateFeeConfigPanel = ({ type, feeHeads = [], title }) => {
  const serviceType = String(type || '').toUpperCase();
  const academicYears = useMemo(() => buildAcademicYears(), []);
  const lateFeeHeadOptions = useMemo(
    () => (feeHeads || []).filter((h) => /late\s*fee/i.test(`${h.name || ''} ${h.code || ''}`)),
    [feeHeads]
  );
  const defaultApplicableHeadId = useMemo(() => {
    const target = serviceType === 'HOSTEL' ? /hostel\s*fee/i : /transport\s*fee/i;
    const match = (feeHeads || []).find((h) => target.test(h.name || ''));
    return match?._id || '';
  }, [feeHeads, serviceType]);

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingYear, setSavingYear] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingYearId, setEditingYearId] = useState(null);

  // Section 1 — year default terms only
  const [yearForm, setYearForm] = useState({
    academicYear: academicYears[3] || academicYears[0] || '',
    applicableFeeHead: '',
    defaultTermsCount: 3,
    defaultTerms: emptyDefaultTerms(3)
  });

  // Section 2 — late fee rule for any terms count (uses selected academic year)
  const [ruleForm, setRuleForm] = useState({
    termsCount: 3,
    lateFeeHead: '',
    terms: emptyLateFeeTerms(3)
  });
  const [editingRuleTermsCount, setEditingRuleTermsCount] = useState(null);

  useEffect(() => {
    if (!editingYearId && !yearForm.applicableFeeHead && defaultApplicableHeadId) {
      setYearForm((prev) =>
        prev.applicableFeeHead ? prev : { ...prev, applicableFeeHead: defaultApplicableHeadId }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultApplicableHeadId]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/late-fees/service-config', { params: { type: serviceType } });
      setConfigs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching service late fee configs', err);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!serviceType) return;
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const selectedYearConfig = useMemo(
    () => configs.find((c) => c.academicYear === yearForm.academicYear) || null,
    [configs, yearForm.academicYear]
  );

  const resetYearForm = () => {
    setEditingYearId(null);
    setYearForm({
      academicYear: academicYears[3] || academicYears[0] || '',
      applicableFeeHead: defaultApplicableHeadId || '',
      defaultTermsCount: 3,
      defaultTerms: emptyDefaultTerms(3)
    });
  };

  const resetRuleForm = () => {
    setEditingRuleTermsCount(null);
    setRuleForm({
      termsCount: 3,
      lateFeeHead: '',
      terms: emptyLateFeeTerms(3)
    });
  };

  const updateDefaultTermsCount = (newCount) => {
    const count = Number(newCount) || 1;
    const pcts = equalPercentages(count);
    setYearForm((prev) => ({
      ...prev,
      defaultTermsCount: count,
      defaultTerms: Array.from({ length: count }, (_, i) => ({
        termNumber: i + 1,
        percentage: pcts[i]
      }))
    }));
  };

  const updateTermPercentage = (editedIndex, rawValue) => {
    setYearForm((prev) => {
      const terms = [...(prev.defaultTerms || [])];
      if (terms.length <= 1) {
        return { ...prev, defaultTerms: terms.map((t) => ({ ...t, percentage: 100 })) };
      }
      const editedValue = Math.min(100, Math.max(0, Number(rawValue) || 0));
      const remaining = 100 - editedValue;
      const otherCount = terms.length - 1;
      const equalShare = Math.floor((remaining / otherCount) * 100) / 100;
      let assigned = 0;
      const next = terms.map((term, index) => {
        if (index === editedIndex) return { ...term, percentage: editedValue };
        assigned += 1;
        const percentage =
          assigned === otherCount
            ? Number((remaining - equalShare * (otherCount - 1)).toFixed(2))
            : equalShare;
        return { ...term, percentage };
      });
      return { ...prev, defaultTerms: next };
    });
  };

  const updateRuleTermsCount = (newCount) => {
    const count = Number(newCount) || 1;
    setRuleForm((prev) => {
      let terms = [...(prev.terms || [])];
      if (terms.length < count) {
        while (terms.length < count) {
          const n = terms.length + 1;
          terms.push({
            termNumber: n,
            lateFeeAmount: 0,
            dueDateMode: 'offset',
            referenceSemester: 1,
            dueOffsetDays: 15,
            fixedDueDate: '',
            dueDescription: `Term ${n} Late Fee`
          });
        }
      } else {
        terms = terms.slice(0, count);
      }
      return {
        ...prev,
        termsCount: count,
        terms: terms.map((t, i) => ({ ...t, termNumber: i + 1 }))
      };
    });
    setEditingRuleTermsCount(null);
  };

  const patchRuleTerm = (idx, patch) => {
    setRuleForm((prev) => {
      const next = [...(prev.terms || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, terms: next };
    });
  };

  const loadYearIntoForm = (cfg, editDefaults = false) => {
    setEditingYearId(editDefaults ? cfg._id : null);
    const count = Number(cfg.defaultTermsCount) || (cfg.defaultTerms || []).length || 1;
    const pcts = equalPercentages(count);
    const defaultTerms = (cfg.defaultTerms || []).map((t, i) => ({
      termNumber: t.termNumber || i + 1,
      percentage: Number.isFinite(Number(t.percentage)) ? Number(t.percentage) : pcts[i]
    }));
    while (defaultTerms.length < count) {
      defaultTerms.push({ termNumber: defaultTerms.length + 1, percentage: pcts[defaultTerms.length] || 0 });
    }
    setYearForm({
      academicYear: cfg.academicYear || '',
      applicableFeeHead: cfg.applicableFeeHead?._id || cfg.applicableFeeHead || '',
      defaultTermsCount: count,
      defaultTerms: defaultTerms.slice(0, count)
    });
    resetRuleForm();
  };

  const loadRuleIntoForm = (rule) => {
    const count = Number(rule.termsCount) || (rule.terms || []).length || 1;
    const terms = (rule.terms || []).map((t, i) => ({
      termNumber: t.termNumber || i + 1,
      lateFeeAmount: Number(t.lateFeeAmount) || 0,
      dueDateMode: t.dueDateMode || 'offset',
      referenceSemester: Number(t.referenceSemester) || 1,
      dueOffsetDays: Number(t.dueOffsetDays) || 0,
      fixedDueDate: t.fixedDueDate ? String(t.fixedDueDate).slice(0, 10) : '',
      dueDescription: t.dueDescription || `Term ${t.termNumber || i + 1} Late Fee`
    }));
    while (terms.length < count) {
      terms.push(...emptyLateFeeTerms(1).map((t) => ({ ...t, termNumber: terms.length + 1 })));
    }
    setEditingRuleTermsCount(count);
    setRuleForm({
      termsCount: count,
      lateFeeHead: rule.lateFeeHead?._id || rule.lateFeeHead || '',
      terms: terms.slice(0, count)
    });
  };

  const handleSaveYearDefaults = async () => {
    if (!yearForm.academicYear) {
      alert('Please select an academic year');
      return;
    }
    if (!yearForm.applicableFeeHead) {
      alert(`Please select the ${serviceType.toLowerCase()} fee head`);
      return;
    }
    const pctSum = (yearForm.defaultTerms || []).reduce((s, t) => s + (Number(t.percentage) || 0), 0);
    if (Math.abs(pctSum - 100) > 0.01) {
      alert(`Default term percentages must total 100% (currently ${pctSum}%)`);
      return;
    }

    setSavingYear(true);
    try {
      await api.post('/late-fees/service-config', {
        ...(editingYearId ? { _id: editingYearId } : {}),
        type: serviceType,
        academicYear: yearForm.academicYear,
        applicableFeeHead: yearForm.applicableFeeHead,
        defaultTermsCount: Number(yearForm.defaultTermsCount),
        defaultTerms: (yearForm.defaultTerms || []).map((t, i) => ({
          termNumber: Number(t.termNumber) || i + 1,
          percentage: Number(t.percentage) || 0
        }))
      });
      await fetchConfigs();
      // Keep year selected so user can add late-fee rules next
      setEditingYearId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save year default terms');
    } finally {
      setSavingYear(false);
    }
  };

  const handleSaveLateFeeRule = async () => {
    if (!yearForm.academicYear) {
      alert('Please select an academic year');
      return;
    }
    if (!selectedYearConfig && !editingYearId) {
      // allow if year exists in list for current academicYear
      const exists = configs.some((c) => c.academicYear === yearForm.academicYear);
      if (!exists) {
        alert('Save year default terms first (Section 1), then add late-fee rules for any terms count');
        return;
      }
    }
    if (!ruleForm.lateFeeHead) {
      alert('Please select a late fee demand head');
      return;
    }

    setSavingRule(true);
    try {
      await api.post('/late-fees/service-config/late-fee-rule', {
        type: serviceType,
        academicYear: yearForm.academicYear,
        termsCount: Number(ruleForm.termsCount),
        lateFeeHead: ruleForm.lateFeeHead,
        terms: (ruleForm.terms || []).map((t, i) => ({
          termNumber: Number(t.termNumber) || i + 1,
          lateFeeAmount: Number(t.lateFeeAmount) || 0,
          dueDateMode: t.dueDateMode || 'offset',
          referenceSemester: Number(t.referenceSemester) || 1,
          dueOffsetDays: Number(t.dueOffsetDays) || 0,
          fixedDueDate: t.fixedDueDate || null,
          dueDescription: t.dueDescription || `Term ${i + 1} Late Fee`
        }))
      });
      await fetchConfigs();
      resetRuleForm();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save late fee rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteYear = async (id) => {
    if (!window.confirm('Remove this academic year config (default terms + all late-fee rules)?')) return;
    try {
      await api.delete(`/late-fees/service-config/${id}`);
      if (editingYearId === id) resetYearForm();
      await fetchConfigs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleDeleteRule = async (configId, termsCount) => {
    if (!window.confirm(`Remove late-fee rule for ${termsCount} term(s)? Year default terms stay.`)) return;
    try {
      await api.delete(`/late-fees/service-config/${configId}/late-fee-rule/${termsCount}`);
      if (editingRuleTermsCount === Number(termsCount)) resetRuleForm();
      await fetchConfigs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete rule');
    }
  };

  const syncServiceLateFees = async ({ allYears = false } = {}) => {
    setSyncing(true);
    try {
      const payload = { type: serviceType };
      if (!allYears && yearForm.academicYear) {
        payload.academicYear = yearForm.academicYear;
      }
      const res = await api.post('/late-fees/process-service', payload);
      const generated = res.data?.generated ?? 0;
      const updated = res.data?.updated ?? 0;
      await Swal.fire({
        icon: 'success',
        title: 'Late Fee Sync Completed',
        html: `<div style="text-align:left;font-size:13px">
          <p><b>Type:</b> ${serviceType}</p>
          <p><b>Scope:</b> ${allYears ? 'All years' : yearForm.academicYear}</p>
          <p><b>Generated:</b> ${generated}</p>
          <p><b>Updated:</b> ${updated}</p>
          <p class="text-muted" style="margin-top:8px;color:#6b7280">Default terms for the applicable fee head are applied on sync (T1/T2/…). Late-fee details include Due and Applied dates.</p>
        </div>`,
        confirmButtonColor: '#2563eb'
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Sync Failed',
        text: err.response?.data?.message || err.message || 'Failed to sync late fees'
      });
    } finally {
      setSyncing(false);
    }
  };

  const pctSum = (yearForm.defaultTerms || []).reduce((s, t) => s + (Number(t.percentage) || 0), 0);
  const pctOk = Math.abs(pctSum - 100) <= 0.01;
  const yearRules = selectedYearConfig?.lateFeeRules || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — single configure panel */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                  <Calendar size={18} />
                </span>
                {title || serviceType} Configuration
              </h2>
              <p className="text-[11px] text-gray-500 mt-1">
                Set default terms for the year, then optionally add late-fee rules for any terms count.
              </p>
            </div>

            {/* Academic year + applicable head + default terms */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Academic Year</label>
                  <select
                    className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white"
                    value={yearForm.academicYear}
                    onChange={(e) => {
                      const y = e.target.value;
                      const existing = configs.find((c) => c.academicYear === y);
                      if (existing) loadYearIntoForm(existing, false);
                      else {
                        setEditingYearId(null);
                        setYearForm((prev) => ({
                          ...prev,
                          academicYear: y,
                          applicableFeeHead: defaultApplicableHeadId || prev.applicableFeeHead,
                          defaultTermsCount: 3,
                          defaultTerms: emptyDefaultTerms(3)
                        }));
                        resetRuleForm();
                      }
                    }}
                  >
                    {academicYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {(!selectedYearConfig || editingYearId) && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Default Terms</label>
                    <select
                      className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white"
                      value={yearForm.defaultTermsCount}
                      onChange={(e) => updateDefaultTermsCount(e.target.value)}
                    >
                      <option value={1}>1 Term</option>
                      <option value={2}>2 Terms</option>
                      <option value={3}>3 Terms</option>
                      <option value={4}>4 Terms</option>
                    </select>
                  </div>
                )}
              </div>

              {(!selectedYearConfig || editingYearId) && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Applicable Fee Head</label>
                    <select
                      className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white"
                      value={yearForm.applicableFeeHead}
                      onChange={(e) => setYearForm({ ...yearForm, applicableFeeHead: e.target.value })}
                    >
                      <option value="">Select Fee Head...</option>
                      {(feeHeads || []).map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name}{h.code ? ` (${h.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border ${pctOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    Term share total: {pctSum}% {pctOk ? '✓' : '(must equal 100%)'}
                  </div>

                  <div className="space-y-2">
                    {(yearForm.defaultTerms || []).map((term, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50/50 rounded-lg border border-gray-100">
                        <span className="text-xs font-bold text-gray-700">Term {term.termNumber}</span>
                        <div className="relative w-28">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] pr-6"
                            value={term.percentage}
                            onChange={(e) => updateTermPercentage(idx, e.target.value)}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingYear}
                      onClick={handleSaveYearDefaults}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg disabled:opacity-50"
                    >
                      {savingYear ? 'Saving…' : editingYearId ? 'Update Default Terms' : 'Save Default Terms'}
                    </button>
                    {editingYearId && (
                      <button
                        type="button"
                        onClick={() => loadYearIntoForm(selectedYearConfig, false)}
                        className="text-xs font-bold text-gray-500 px-3 py-2"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-dashed border-gray-200" />

            {/* Late fee rule form (same card) */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-xs">Late Fee Rule</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Optional — save amounts &amp; due dates for any terms count. Shown on the right after save.
                  </p>
                </div>
                <div className="shrink-0 w-28">
                  <label className="text-[9px] font-bold text-gray-400 uppercase block">For N terms</label>
                  <select
                    className="w-full border-gray-200 border p-1.5 rounded-lg text-xs bg-gray-50 focus:bg-white"
                    value={ruleForm.termsCount}
                    onChange={(e) => updateRuleTermsCount(e.target.value)}
                    disabled={!!editingRuleTermsCount}
                  >
                    <option value={1}>1 Term</option>
                    <option value={2}>2 Terms</option>
                    <option value={3}>3 Terms</option>
                    <option value={4}>4 Terms</option>
                  </select>
                </div>
              </div>

              {!selectedYearConfig && (
                <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                  Save Default Terms for {yearForm.academicYear} first, then add a late-fee rule.
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Late Fee Demand Head</label>
                <select
                  className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white"
                  value={ruleForm.lateFeeHead}
                  onChange={(e) => setRuleForm({ ...ruleForm, lateFeeHead: e.target.value })}
                >
                  <option value="">Select Late Fee Head...</option>
                  {lateFeeHeadOptions.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}{h.code ? ` (${h.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {(ruleForm.terms || []).map((term, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/50 rounded-lg border border-gray-100 space-y-2">
                    <div className="text-xs font-bold text-gray-700">Term {term.termNumber}</div>
                    <div>
                      <label className="text-[9px] text-gray-400 font-semibold block">Late Fee Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px]"
                        value={term.lateFeeAmount}
                        onChange={(e) => patchRuleTerm(idx, { lateFeeAmount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 font-semibold block">Due Mode</label>
                      <select
                        className="w-full border border-gray-200 rounded bg-white p-1 text-[11px]"
                        value={term.dueDateMode}
                        onChange={(e) => patchRuleTerm(idx, { dueDateMode: e.target.value })}
                      >
                        <option value="offset">Sem Offset</option>
                        <option value="fixed">Fixed Date</option>
                      </select>
                    </div>
                    {term.dueDateMode === 'offset' ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-gray-400 font-semibold block">Ref Semester</label>
                          <select
                            className="w-full border border-gray-200 rounded bg-white p-1 text-[11px]"
                            value={term.referenceSemester || 1}
                            onChange={(e) => patchRuleTerm(idx, { referenceSemester: Number(e.target.value) })}
                          >
                            <option value={1}>Semester 1 Start</option>
                            <option value={2}>Semester 2 Start</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-400 font-semibold block">Offset Days</label>
                          <input
                            type="number"
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px]"
                            value={term.dueOffsetDays}
                            onChange={(e) => patchRuleTerm(idx, { dueOffsetDays: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[9px] text-gray-400 font-semibold block">Fixed Date</label>
                        <input
                          type="date"
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px]"
                          value={term.fixedDueDate ? String(term.fixedDueDate).slice(0, 10) : ''}
                          onChange={(e) => patchRuleTerm(idx, { fixedDueDate: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingRule || !selectedYearConfig}
                  onClick={handleSaveLateFeeRule}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg disabled:opacity-50"
                >
                  {savingRule
                    ? 'Saving…'
                    : editingRuleTermsCount
                      ? `Update ${editingRuleTermsCount}-Term Rule`
                      : `Save ${ruleForm.termsCount}-Term Late Fee Rule`}
                </button>
                {editingRuleTermsCount && (
                  <button type="button" onClick={resetRuleForm} className="text-xs font-bold text-gray-500 px-3 py-2">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — saved rules for selected year + year list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/60 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">
                  Saved rules for {yearForm.academicYear || '—'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedYearConfig
                    ? `${selectedYearConfig.defaultTermsCount || 0} default terms · ${yearRules.length} late-fee rule${yearRules.length === 1 ? '' : 's'}`
                    : 'No default terms saved for this year yet'}
                </p>
              </div>
              <button
                type="button"
                disabled={syncing || !selectedYearConfig}
                onClick={() => syncServiceLateFees({ allYears: false })}
                className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition inline-flex items-center gap-1.5 disabled:opacity-50"
                title={`Sync late fees for ${yearForm.academicYear} using academic calendar dates`}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            </div>

            {selectedYearConfig && (
              <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-600 bg-white">
                <span className="font-semibold text-gray-800">{selectedYearConfig.applicableFeeHead?.name || '—'}</span>
                <span className="text-gray-400 mx-1.5">·</span>
                {(selectedYearConfig.defaultTerms || [])
                  .map((t) => `T${t.termNumber}: ${Number(t.percentage) || 0}%`)
                  .join(' · ') || 'No term split'}
              </div>
            )}

            <div className="p-4 space-y-2 min-h-[140px]">
              {!selectedYearConfig ? (
                <div className="py-10 text-center text-gray-400 text-xs">
                  Save Default Terms on the left to start configuring this year.
                </div>
              ) : yearRules.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-xs">
                  No late-fee rules yet for {yearForm.academicYear}.
                  <br />
                  <span className="text-gray-300">Falls back to Default Rules until you add one.</span>
                </div>
              ) : (
                yearRules.map((rule) => (
                  <div
                    key={rule.termsCount}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {rule.termsCount} Term{Number(rule.termsCount) > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-semibold text-gray-800 truncate">
                          {rule.lateFeeHead?.name || '—'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1.5">
                        {(rule.terms || [])
                          .map((t) => `T${t.termNumber}: ₹${Number(t.lateFeeAmount) || 0}`)
                          .join(' · ')}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {(rule.terms || [])
                          .map((t) =>
                            t.dueDateMode === 'fixed'
                              ? `T${t.termNumber}: fixed ${t.fixedDueDate ? String(t.fixedDueDate).slice(0, 10) : '—'}`
                              : `T${t.termNumber}: +${Number(t.dueOffsetDays) || 0}d (Sem ${t.referenceSemester || 1})`
                          )
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Edit rule"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        onClick={() => loadRuleIntoForm(rule)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete rule"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        onClick={() => handleDeleteRule(selectedYearConfig._id, rule.termsCount)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">All Academic Years</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Click a year to load it on the left</p>
              </div>
              <button
                type="button"
                disabled={syncing || configs.length === 0}
                onClick={() => syncServiceLateFees({ allYears: true })}
                className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition inline-flex items-center gap-1.5 disabled:opacity-50"
                title={`Sync late fees for all ${serviceType.toLowerCase()} years`}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync All'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 font-bold uppercase text-gray-500">Year</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-gray-500">Fee Head</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-gray-500">Default Terms</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-gray-500">Rules</th>
                    <th className="px-4 py-2.5 font-bold uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                    </tr>
                  ) : configs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No years configured yet
                      </td>
                    </tr>
                  ) : (
                    configs.map((cfg) => (
                      <tr
                        key={cfg._id}
                        className={`hover:bg-gray-50/80 cursor-pointer ${cfg.academicYear === yearForm.academicYear ? 'bg-blue-50/40' : ''}`}
                        onClick={() => loadYearIntoForm(cfg, false)}
                      >
                        <td className="px-4 py-2.5 font-semibold text-gray-800">{cfg.academicYear}</td>
                        <td className="px-4 py-2.5 text-gray-700">{cfg.applicableFeeHead?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {cfg.defaultTermsCount} terms
                          <div className="text-[10px] text-gray-400">
                            {(cfg.defaultTerms || [])
                              .map((t) => `T${t.termNumber}: ${Number(t.percentage) || 0}%`)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {(cfg.lateFeeRules || []).length === 0
                            ? <span className="text-gray-400">None</span>
                            : (cfg.lateFeeRules || []).map((r) => `${r.termsCount}-term`).join(', ')}
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => loadYearIntoForm(cfg, true)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDeleteYear(cfg._id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceLateFeeConfigPanel;
