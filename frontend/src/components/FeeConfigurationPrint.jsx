import React, { forwardRef } from 'react';

const PRINT_STYLES = `
    @page { size: A4; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Segoe UI', Arial, sans-serif; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1.5px solid #0f172a; }
    .print-table th { background-color: #e2e8f0; color: #0f172a; font-weight: 700; text-transform: uppercase; font-size: 10px; border: 1px solid #475569; padding: 6px 8px; text-align: left; }
    .print-table td { border: 1px solid #64748b; padding: 6px 8px; vertical-align: top; color: #0f172a; }
    .print-table tr:nth-child(even) { background-color: #f8fafc; }
    .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .compact-row { line-height: 1.3; }
`;

const PRINT_STYLES_LANDSCAPE = `
    @page { size: A4 landscape; margin: 8mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Segoe UI', Arial, sans-serif; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1.5px solid #0f172a; }
    .print-table th { background-color: #e2e8f0; color: #0f172a; font-weight: 700; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.3px; border: 1px solid #475569; padding: 5px 7px; text-align: left; }
    .print-table td { border: 1px solid #64748b; padding: 5px 7px; vertical-align: top; color: #0f172a; }
    .print-table tr:nth-child(even) { background-color: #f8fafc; }
    .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .compact-row { line-height: 1.3; }
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
        const amount = `₹${(item.amount || 0).toLocaleString('en-IN')}`;
        const termsLabel = item.isTermsDivided && item.terms?.length
            ? ` (${item.terms.map(t => `T${t.termNumber}: ₹${(t.amount || 0).toLocaleString('en-IN')}`).join(', ')})`
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

const renderYearCell = (items) => {
    if (!items || items.length === 0) return <span style={{ color: '#94a3b8' }}>-</span>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {items.map((item, idx) => (
                <div key={idx} style={{ fontSize: '9.5px', lineHeight: '1.3' }}>
                    <div>
                        {item.semester ? <span style={{ fontWeight: '700', color: '#475569' }}>S{item.semester}: </span> : null}
                        <span style={{ fontWeight: '700', color: '#0f172a' }}>₹{(item.amount || 0).toLocaleString('en-IN')}</span>
                        {item.isTermsDivided && item.terms && item.terms.length > 0 && (
                            <span style={{ marginLeft: '3px', fontSize: '8.5px', fontWeight: '700', color: '#1e40af' }}>
                                ({item.terms.length} Terms)
                            </span>
                        )}
                    </div>
                    {item.isTermsDivided && item.terms && item.terms.length > 0 && (
                        <div style={{ fontSize: '8.5px', color: '#475569', paddingLeft: '4px', borderLeft: '1.5px solid #94a3b8', marginTop: '1px' }}>
                            {item.terms.map(t => `T${t.termNumber}: ₹${(t.amount || 0).toLocaleString('en-IN')}`).join(', ')}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const FeeStructuresTable = ({ rows, tableYears, collegeCodes }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {rows.map((row, idx) => {
            const feeHeadsList = Object.values(row.feeHeadsMap || {});
            return (
                <div key={idx} style={{ pageBreakInside: 'avoid', border: '1.5px solid #0f172a', borderRadius: '4px', padding: '8px', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                        <div>
                            <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>
                                {(collegeCodes[row.college] || row.college)} ({row.batch})
                            </span>
                            <span style={{ margin: '0 6px', color: '#64748b' }}>|</span>
                            <span style={{ fontSize: '10.5px', color: '#334155' }}>
                                {row.course} - {row.branch}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '9.5px' }}>
                                {row.category} QUOTA
                            </span>
                            <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>
                                Total: ₹{(row.grandTotal || 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    <table className="print-table" style={{ marginTop: '4px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '15%', backgroundColor: '#f1f5f9' }}>Year</th>
                                {feeHeadsList.map(fh => (
                                    <th key={fh._id}>
                                        {fh.name}
                                        {fh.code && <span style={{ fontWeight: 'normal', fontSize: '8.5px', color: '#475569' }}> ({fh.code})</span>}
                                    </th>
                                ))}
                                <th style={{ width: '18%', textAlign: 'right', backgroundColor: '#f1f5f9' }}>Total Year Fee</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableYears.map(y => {
                                const yearTotal = row.yearTotals?.[y] || 0;
                                return (
                                    <tr key={y}>
                                        <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Yr {y}</td>
                                        {feeHeadsList.map(fh => {
                                            const items = row.matrix?.[y]?.[fh._id] || [];
                                            return (
                                                <td key={fh._id}>
                                                    {items.length > 0 ? (
                                                        items.map((item, iIdx) => (
                                                            <div key={iIdx}>
                                                                {item.semester ? `S${item.semester}: ` : ''}
                                                                ₹{(item.amount || 0).toLocaleString('en-IN')}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1' }}>-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#1e3a8a', backgroundColor: '#f8fafc' }}>
                                            ₹{yearTotal.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                                <td style={{ textTransform: 'uppercase', fontSize: '9px', color: '#475569' }}>Total Fee</td>
                                {feeHeadsList.map(fh => (
                                    <td key={fh._id} style={{ color: '#1e1b4b' }}>
                                        ₹{(row.feeHeadTotals?.[fh._id] || 0).toLocaleString('en-IN')}
                                    </td>
                                ))}
                                <td style={{ textAlign: 'right', color: '#065f46', fontSize: '11px' }}>
                                    ₹{(row.grandTotal || 0).toLocaleString('en-IN')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        })}
    </div>
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
            filters.batch && `Batch: ${filters.batch}`,
            filters.course && `Course: ${filters.course}`,
            filters.branch && `Branch: ${filters.branch}`,
            filters.category && `Category: ${filters.category}`,
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
