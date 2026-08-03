import React, { forwardRef } from 'react';

const PRINT_STYLES = `
    @page { size: A4; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, sans-serif; color: #000; background-color: #fff; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 2px solid #000; table-layout: auto; }
    .print-table th, .print-table td { border: 1.5px solid #000; padding: 5px 8px; box-sizing: border-box; }
    .print-table th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; text-align: left; }
    .print-table td { vertical-align: top; word-break: break-word; }
    .print-table tr:nth-child(even) { background-color: #fafafa; }
    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .compact-row { line-height: 1.2; }
`;

const PRINT_STYLES_LANDSCAPE = `
    @page { size: A4 landscape; margin: 8mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, sans-serif; color: #000; background-color: #fff; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 9.5px; border: 2px solid #000; table-layout: auto; }
    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 6px; box-sizing: border-box; }
    .print-table th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; text-align: left; }
    .print-table td { vertical-align: top; word-break: break-word; }
    .print-table tr:nth-child(even) { background-color: #fafafa; }
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
        landscape: false,
    },
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

const FeeStructuresTable = ({ rows, tableYears, collegeCodes, filters = {} }) => {
    const isBranchSelected = !!filters?.branch;
    const titleAlign = isBranchSelected ? 'center' : 'left';
    let lastBranch = null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {rows.map((row, idx) => {
                const feeHeadsList = Object.values(row.feeHeadsMap || {}).sort((a, b) => 
                    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                );

                const showBranchHeader = row.branch !== lastBranch;
                if (showBranchHeader) {
                    lastBranch = row.branch;
                }

                return (
                    <div key={idx} style={{ pageBreakInside: 'avoid', marginBottom: '25px' }}>
                        {showBranchHeader && (
                            <h3 style={{ 
                                fontSize: '11px', 
                                fontWeight: 'bold', 
                                marginBottom: '8px', 
                                textTransform: 'uppercase', 
                                textAlign: titleAlign, 
                                paddingBottom: '4px',
                                borderLeft: titleAlign === 'left' ? '4px solid #000' : 'none',
                                paddingLeft: titleAlign === 'left' ? '8px' : '0'
                            }}>
                                {row.branch}
                            </h3>
                        )}

                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '12%', backgroundColor: '#f0f0f0', textAlign: 'center', textTransform: 'uppercase' }}>{row.category}</th>
                                {feeHeadsList.map(fh => (
                                    <th key={fh._id} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: 'bold' }}>{fh.name}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginTop: '3px' }}>
                                            {fh.code && <span style={{ fontWeight: 'normal', fontSize: '8px', color: '#555' }}>({fh.code})</span>}
                                            {fh.isScholarshipApplicable && (
                                                <span style={{ display: 'inline-block', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '7.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', marginTop: '2px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                                    Scholarship
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ width: '15%', textAlign: 'right', backgroundColor: '#f0f0f0' }}>Total Year Fee</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableYears.map(y => {
                                const yearTotal = row.yearTotals?.[y] || 0;
                                return (
                                    <tr key={y}>
                                        <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', textAlign: 'center' }}>Yr {y}</td>
                                        {feeHeadsList.map(fh => {
                                            const items = row.matrix?.[y]?.[fh._id] || [];
                                            return (
                                                <td key={fh._id} style={{ textAlign: 'center' }}>
                                                    {items.length > 0 ? (
                                                        items.map((item, iIdx) => {
                                                            const semLabel = item.semester ? `S${item.semester}: ` : '';
                                                            const amount = `₹${(item.amount || 0).toLocaleString('en-IN')}`;
                                                            return (
                                                                <div key={iIdx} style={{ fontSize: '9.5px', fontWeight: 'bold', lineHeight: '1.2', display: 'inline-block', textAlign: 'center' }}>
                                                                    <div>{semLabel}{amount}</div>
                                                                    {item.terms && (item.terms.length > 1 || item.terms.some(t => Number(t.lateFeeAmount) > 0)) && (
                                                                        <div style={{ fontSize: '7.5px', fontWeight: 'normal', color: '#333', marginTop: '4px', borderTop: '1px dashed #bbb', paddingTop: '2px' }}>
                                                                            {item.terms.map(t => (
                                                                                <div key={t.termNumber} style={{ whiteSpace: 'nowrap', marginTop: '1.5px' }}>
                                                                                    T{t.termNumber}: ₹{Number(t.amount || 0).toLocaleString('en-IN')} (Lf: ₹{Number(t.lateFeeAmount || 0).toLocaleString('en-IN')})
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <span style={{ color: '#aaa' }}>-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#000', backgroundColor: '#f0f0f0' }}>
                                            ₹{yearTotal.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                <td style={{ textTransform: 'uppercase', fontSize: '9px', color: '#000' }}>Total Fee</td>
                                {feeHeadsList.map(fh => (
                                    <td key={fh._id} style={{ color: '#000', textAlign: 'center' }}>
                                        ₹{(row.feeHeadTotals?.[fh._id] || 0).toLocaleString('en-IN')}
                                    </td>
                                ))}
                                <td style={{ textAlign: 'right', color: '#000', fontSize: '11px' }}>
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
};

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
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
                    Pydah Group of Colleges
                </h1>
                <p style={{ margin: '4px 0', fontSize: '11px', fontWeight: 'bold' }}>
                    FEE CONFIGURATION - {config.title}
                </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '11px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                <div>
                    <strong>{config.countLabel}:</strong> {count}
                </div>
                <div style={{ color: '#4b5563' }}>
                    <strong>Generated On:</strong>{' '}
                    {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                </div>
            </div>

            {filterLabels.length > 0 && (
                <div style={{ marginBottom: '15px', fontSize: '11px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                    <strong>Filters:</strong> {filterLabels.join(' | ')}
                </div>
            )}

            {count > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    {variant === 'heads' && <FeeHeadsTable data={reportData} />}
                    {variant === 'groups' && <FeeGroupsTable data={reportData} />}
                    {variant === 'structures' && (
                        <FeeStructuresTable rows={rows} tableYears={tableYears} collegeCodes={collegeCodes} filters={filters} />
                    )}
                </div>
            )}

            {count === 0 && (
                <p style={{ textAlign: 'center', fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '30px' }}>
                    {config.emptyMessage}
                </p>
            )}

            <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1.5px solid #000' }}>
                <p style={{ textAlign: 'center', fontSize: '9px', color: '#6b7280', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                    This is a computer-generated {config.footer} for Internal Records only.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontWeight: '750', transform: 'uppercase', color: '#000', fontSize: '9px', letterSpacing: '0.3px' }}>
                    Powered by PydahSoft
                </div>
            </div>
        </div>
    );
});

export default FeeConfigurationPrint;
