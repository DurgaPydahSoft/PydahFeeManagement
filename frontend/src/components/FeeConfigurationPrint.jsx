import React, { forwardRef } from 'react';

const PRINT_STYLES = `
    @page { size: A4; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000; }
    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .compact-row { line-height: 1.2; }
`;

const PRINT_STYLES_LANDSCAPE = `
    @page { size: A4 landscape; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 2px solid #000; }
    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
    .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .compact-row { line-height: 1.2; }
`;

const VARIANT_CONFIG = {
    heads: {
        title: 'FEE HEADS REPORT',
        countLabel: 'Total Heads',
        emptyMessage: 'No fee heads defined.',
        footer: 'Fee Heads Report',
        landscape: false,
    },
    groups: {
        title: 'FEE GROUPS REPORT',
        countLabel: 'Total Groups',
        emptyMessage: 'No fee groups defined.',
        footer: 'Fee Groups Report',
        landscape: false,
    },
    structures: {
        title: 'FEE STRUCTURES REPORT',
        countLabel: 'Total Templates',
        emptyMessage: 'No fee structures match the current filters.',
        footer: 'Fee Structures Report',
        landscape: true,
    },
};

const formatYearCell = (items) => {
    if (!items || items.length === 0) return '-';
    return items.map((item) => {
        const semLabel = item.semester ? `S${item.semester}: ` : '';
        const amount = `₹${(item.amount || 0).toLocaleString()}`;
        const termsLabel = item.isTermsDivided && item.terms?.length
            ? ` (${item.terms.map(t => `T${t.termNumber}: ₹${(t.amount || 0).toLocaleString()}`).join(', ')})`
            : '';
        return `${semLabel}${amount}${termsLabel}`;
    }).join(' | ');
};

const FeeHeadsTable = ({ data }) => (
    <table className="print-table">
        <thead>
            <tr>
                <th style={{ width: '8%', textAlign: 'center' }}>S.No</th>
                <th style={{ width: '25%' }}>Name</th>
                <th style={{ width: '15%' }}>Code</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            {data.map((head, idx) => (
                <tr key={head._id || idx} className="compact-row">
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{head.name}</td>
                    <td style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{head.code || '-'}</td>
                    <td>{head.description || '-'}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

const FeeGroupsTable = ({ data }) => (
    <table className="print-table">
        <thead>
            <tr>
                <th style={{ width: '8%', textAlign: 'center' }}>S.No</th>
                <th style={{ width: '18%' }}>Name</th>
                <th style={{ width: '12%' }}>Code</th>
                <th style={{ width: '22%' }}>Description</th>
                <th>Included Fee Heads</th>
            </tr>
        </thead>
        <tbody>
            {data.map((group, idx) => (
                <tr key={group._id || idx} className="compact-row">
                    <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{group.name}</td>
                    <td style={{ textTransform: 'uppercase', fontWeight: 'bold', verticalAlign: 'top' }}>{group.code || '-'}</td>
                    <td style={{ verticalAlign: 'top' }}>{group.description || '-'}</td>
                    <td style={{ verticalAlign: 'top' }}>
                        {group.feeHeads?.length > 0
                            ? group.feeHeads.map(fh => fh.name || fh).join(', ')
                            : 'None'}
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

const FeeStructuresTable = ({ rows, tableYears, collegeCodes }) => (
    <table className="print-table">
        <thead>
            <tr>
                <th style={{ width: '18%' }}>Fee Head</th>
                <th style={{ width: '22%' }}>Context</th>
                <th style={{ width: '12%' }}>Category</th>
                {tableYears.map(y => (
                    <th key={y} style={{ textAlign: 'center' }}>Yr {y}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {rows.map((row, idx) => (
                <tr key={idx} className="compact-row">
                    <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>
                        {row.feeHeadName}
                        {row.feeHeadCode && <span style={{ fontWeight: 'normal', color: '#4b5563' }}> ({row.feeHeadCode})</span>}
                        {row.isScholarshipApplicable && <span style={{ marginLeft: '4px', fontSize: '9px' }}>[Scholarship]</span>}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold' }}>{row.course} - {row.branch}</div>
                        <div style={{ textTransform: 'uppercase', color: '#4b5563' }}>{collegeCodes[row.college] || row.college}</div>
                        <div style={{ fontWeight: 'bold' }}>Batch: {row.batch}</div>
                    </td>
                    <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{row.category}</td>
                    {tableYears.map(y => (
                        <td key={y} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                            {formatYearCell(row.years?.[y])}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

const FeeConfigurationPrint = forwardRef(({
    variant = 'heads',
    reportData = [],
    rows = [],
    tableYears = [1, 2, 3, 4],
    collegeCodes = {},
    filters = {},
}, ref) => {
    const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.heads;
    const count = variant === 'structures' ? rows.length : reportData.length;

    const filterLabels = variant === 'structures'
        ? [
            filters.college && `College: ${filters.college}`,
            filters.course && `Course: ${filters.course}`,
            filters.branch && `Branch: ${filters.branch}`,
            filters.batch && `Batch: ${filters.batch}`,
            filters.feeHeadName && `Fee Head: ${filters.feeHeadName}`,
        ].filter(Boolean)
        : [];

    return (
        <div ref={ref} className="p-8 font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style type="text/css" media="print">
                {config.landscape ? PRINT_STYLES_LANDSCAPE : PRINT_STYLES}
            </style>

            <div className="print-header">
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
                    Pydah Group of Colleges
                </h1>
                <p style={{ margin: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>
                    FEE CONFIGURATION - {config.title}
                </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>{config.countLabel}:</strong> {count}
                </div>
                <div style={{ color: '#4b5563' }}>
                    <strong>Generated On:</strong>{' '}
                    {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
            </div>

            {filterLabels.length > 0 && (
                <div style={{ marginBottom: '15px', fontSize: '11px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                    <strong>Filters:</strong> {filterLabels.join(' | ')}
                </div>
            )}

            {count > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', borderLeft: '4px solid #000', paddingLeft: '8px' }}>
                        {variant === 'heads' && 'Existing Fee Heads'}
                        {variant === 'groups' && 'Existing Fee Groups'}
                        {variant === 'structures' && 'Fee Templates'}
                    </h3>

                    {variant === 'heads' && <FeeHeadsTable data={reportData} />}
                    {variant === 'groups' && <FeeGroupsTable data={reportData} />}
                    {variant === 'structures' && (
                        <FeeStructuresTable rows={rows} tableYears={tableYears} collegeCodes={collegeCodes} />
                    )}
                </div>
            )}

            {count === 0 && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', fontStyle: 'italic', marginTop: '30px' }}>
                    {config.emptyMessage}
                </p>
            )}

            <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1.5px solid #000' }}>
                <p style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                    This is a computer-generated {config.footer} for Internal Records only.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontWeight: '700', textTransform: 'uppercase', color: '#000', fontSize: '9px', letterSpacing: '0.3px' }}>
                    <svg style={{ width: '11px', height: '11px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 3H4a2 2 0 00-2 2v11a2 2 0 002 2h7v2H8v2h8v-2h-3v-2h7a2 2 0 002-2V5a2 2 0 00-2-2zm0 13H4V5h16v11z" />
                    </svg>
                    Powered by PydahSoft
                </div>
            </div>
        </div>
    );
});

export default FeeConfigurationPrint;
