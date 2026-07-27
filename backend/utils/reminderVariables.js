/**
 * Allowed sources for template placeholder → data mapping.
 * student.* = SQL students columns; computed.* = filled at send time from due context.
 *
 * DLT SMS bodies use positional {#var#}. Named {{student_name}} still works for email.
 */
const VARIABLE_SOURCES = [
  { value: 'student.admission_number', label: 'Admission Number', group: 'Student' },
  { value: 'student.student_name', label: 'Student Name', group: 'Student' },
  { value: 'student.father_name', label: 'Father Name', group: 'Student' },
  { value: 'student.pin_no', label: 'PIN Number', group: 'Student' },
  { value: 'student.college', label: 'College', group: 'Student' },
  { value: 'student.course', label: 'Course', group: 'Student' },
  { value: 'student.branch', label: 'Branch', group: 'Student' },
  { value: 'student.batch', label: 'Batch', group: 'Student' },
  { value: 'student.student_mobile', label: 'Mobile', group: 'Student' },
  { value: 'student.email', label: 'Email', group: 'Student' },
  { value: 'student.current_year', label: 'Current Year', group: 'Student' },
  { value: 'student.current_semester', label: 'Current Semester', group: 'Student' },
  { value: 'student.stud_type', label: 'Category / Stud Type', group: 'Student' },
  { value: 'computed.due_date', label: 'Due Date', group: 'Computed' },
  { value: 'computed.due_amount', label: 'Pending Fee (unpaid)', group: 'Computed' },
  { value: 'computed.late_fee_amount', label: 'Late Fee Amount', group: 'Computed' },
  { value: 'computed.term_number', label: 'Term Number', group: 'Computed' },
  { value: 'computed.fee_head_name', label: 'Fee Head Name', group: 'Computed' },
  { value: 'computed.academic_year', label: 'Academic Year', group: 'Computed' },
  { value: 'computed.offset_days', label: 'Offset Days', group: 'Computed' }
];

const DLT_VAR_RE = /\{#var#\}/gi;
const NAMED_VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Detect placeholders in body.
 * - Each {#var#} becomes var_1, var_2, … in left-to-right order
 * - {{named}} placeholders are included by name
 */
const extractPlaceholders = (body = '') => {
  const text = String(body || '');
  const keys = [];

  const dltCount = (text.match(DLT_VAR_RE) || []).length;
  for (let i = 1; i <= dltCount; i += 1) {
    keys.push(`var_${i}`);
  }

  const named = new Set();
  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    named.add(m[1]);
  }
  named.forEach((k) => {
    if (!keys.includes(k)) keys.push(k);
  });

  return keys;
};

/**
 * Build / refresh variableMap rows from body, preserving existing source picks by key.
 */
const syncVariableMap = (body = '', existingMap = []) => {
  const keys = extractPlaceholders(body);
  return keys.map((key, idx) => {
    const existing = (existingMap || []).find((m) => m.key === key);
    return {
      key,
      index: key.startsWith('var_') ? Number(key.replace('var_', '')) || (idx + 1) : undefined,
      source: existing?.source || ''
    };
  });
};

const formatDueDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dd}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
};

const getByPath = (obj, path) => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
};

const resolveSourceValue = (source, recipient = {}) => {
  if (!source) return '';
  const fromPath = getByPath(recipient, source);
  if (fromPath !== undefined && fromPath !== null && fromPath !== '') return String(fromPath);
  const flat = source.includes('.') ? source.split('.').pop() : source;
  if (recipient[flat] != null && recipient[flat] !== '') return String(recipient[flat]);
  return '';
};

/**
 * Resolve template body using variableMap + recipient context.
 * Replaces {#var#} in order (var_1, var_2, …) and {{named}} placeholders.
 */
const applyVariableMap = (body, variableMap = [], recipient = {}) => {
  const mapByKey = {};
  (variableMap || []).forEach((m) => {
    if (m?.key && m?.source) mapByKey[m.key] = m.source;
  });

  const resolveKey = (key) => {
    const source = mapByKey[key];
    if (source) {
      const val = resolveSourceValue(source, recipient);
      if (val !== '') return val;
    }
    if (recipient[key] != null && recipient[key] !== '') return String(recipient[key]);
    if (recipient.student?.[key] != null) return String(recipient.student[key]);
    if (recipient.computed?.[key] != null) return String(recipient.computed[key]);
    return '';
  };

  let out = String(body || '');

  // Named {{placeholders}}
  out = out.replace(NAMED_VAR_RE, (_, key) => resolveKey(key));

  // Positional DLT {#var#} → var_1, var_2, …
  let dltIndex = 0;
  out = out.replace(DLT_VAR_RE, () => {
    dltIndex += 1;
    return resolveKey(`var_${dltIndex}`);
  });

  return out;
};

module.exports = {
  VARIABLE_SOURCES,
  extractPlaceholders,
  syncVariableMap,
  formatDueDate,
  applyVariableMap
};
