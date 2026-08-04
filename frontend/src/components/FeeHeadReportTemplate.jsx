import React, { forwardRef } from 'react';

const PRINT_STYLES = `
    @page { size: A4 portrait; margin: 10mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 2px solid #000; }
    .print-table th, .print-table td { border: 1.5px solid #000; padding: 4px 8px; }
    .print-table th { background-color: #f0f0f0 !important; font-weight: bold; text-align: left; }
    .print-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .section-header { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-left: 4px solid #333; padding-left: 8px; margin: 16px 0 8px 0; }
    .page-break { page-break-before: always; }
    @media screen { .print-container { padding: 20px; font-family: Arial, sans-serif; } }
`;

const formatCurrency = (v) => `Rs.${Number(v || 0).toLocaleString('en-IN')}`;
const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '-'; }
};

const SingleFeeHeadReport = ({ data, dateRange, options = {}, hideGeneratedInfo = false }) => {
    if (!data) return null;
    const { showSummary = true, showDetails = true } = options;

    const activeTransactions = (data.transactions || []).filter(tx => tx.status !== 'cancelled');
    const cancelledTransactions = (data.transactions || []).filter(tx => tx.status === 'cancelled');

    const debitTxns = activeTransactions.filter(tx => tx.transactionType === 'DEBIT');
    const creditTxns = activeTransactions.filter(tx => tx.transactionType === 'CREDIT');
    const cashTotal  = debitTxns.filter(tx => tx.paymentMode === 'Cash').reduce((s, tx) => s + (tx.amount || 0), 0);
    const bankTotal  = debitTxns.filter(tx => tx.paymentMode !== 'Cash').reduce((s, tx) => s + (tx.amount || 0), 0);
    const netTotal   = cashTotal + bankTotal;
    const concessionTotal = creditTxns.reduce((s, tx) => s + (tx.amount || 0), 0);

    // ── College-wise summary ───────────────────────────────────────────
    const collegeMap = {};
    debitTxns.forEach(tx => {
        const col = tx.college || 'Unknown';
        if (!collegeMap[col]) collegeMap[col] = { cash: 0, bank: 0, total: 0, count: 0 };
        const isCash = tx.paymentMode === 'Cash';
        collegeMap[col].count++;
        collegeMap[col].total += tx.amount || 0;
        if (isCash) collegeMap[col].cash += tx.amount || 0;
        else        collegeMap[col].bank += tx.amount || 0;
    });
    const sortedColleges = Object.entries(collegeMap).sort(([, a], [, b]) => b.total - a.total);

    // ── User-wise (cashier) summary ────────────────────────────────────
    const userMap = {};
    debitTxns.forEach(tx => {
        const key  = (tx.collectedBy || tx.collectedByName || 'Unknown').trim();
        const name = (tx.collectedByName || tx.collectedBy || 'Unknown').trim();
        if (!userMap[key]) userMap[key] = { name, cash: 0, bank: 0, total: 0, count: 0 };
        const isCash = tx.paymentMode === 'Cash';
        userMap[key].count++;
        userMap[key].total += tx.amount || 0;
        if (isCash) userMap[key].cash += tx.amount || 0;
        else        userMap[key].bank += tx.amount || 0;
    });
    const sortedUsers = Object.values(userMap).sort((a, b) => b.total - a.total);

    // ── Course → Branch → transactions tree ───────────────────────────
    // courseTree: { courseName: { branchName: [txns] } }
    const courseTree = {};
    activeTransactions.forEach(tx => {
        const course = tx.course  || 'Unknown Course';
        const branch = tx.branch  || 'Unknown Branch';
        if (!courseTree[course])         courseTree[course] = {};
        if (!courseTree[course][branch]) courseTree[course][branch] = [];
        courseTree[course][branch].push(tx);
    });
    // Sort courses alphabetically, branches alphabetically within each course
    const sortedCourses = Object.entries(courseTree).sort(([a], [b]) => a.localeCompare(b));

    // ── Shared transaction table render ───────────────────────────────
    const TxTable = ({ txns, snoStart = 1 }) => {
        const debit  = txns.filter(t => t.transactionType !== 'CREDIT');
        const subtotal = debit.reduce((s, t) => s + (t.amount || 0), 0);
        return (
            <table className="print-table" style={{ marginBottom: '10px' }}>
                <thead>
                    <tr>
                        <th style={{ width: '4%'  }}>S.No</th>
                        <th style={{ width: '9%'  }}>Date</th>
                        <th style={{ width: '13%' }}>Receipt No</th>
                        <th style={{ width: '20%' }}>Student Name</th>
                        <th style={{ width: '10%' }}>PIN</th>
                        <th style={{ width: '5%'  }}>Yr</th>
                        <th style={{ width: '9%'  }}>Mode</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {txns.map((tx, i) => (
                        <tr key={i} style={tx.transactionType === 'CREDIT' ? { backgroundColor: '#fdf4ff' } : {}}>
                            <td style={{ textAlign: 'center' }}>{snoStart + i}</td>
                            <td style={{ fontSize: '8.5px' }}>{formatDate(tx.paymentDate || tx.createdAt)}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '8.5px' }}>{tx.receiptNo || '-'}</td>
                            <td style={{ fontWeight: 'bold' }}>{tx.studentName || '-'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '8.5px' }}>{tx.pinNo || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{tx.studentYear || '-'}</td>
                            <td style={{ fontSize: '8.5px' }}>{tx.paymentMode || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: tx.transactionType === 'CREDIT' ? '#7c3aed' : '#000' }}>
                                {tx.transactionType === 'CREDIT' ? '(' : ''}{Number(tx.amount || 0).toLocaleString('en-IN')}{tx.transactionType === 'CREDIT' ? ')' : ''}
                            </td>
                        </tr>
                    ))}
                    <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                        <td colSpan="7" style={{ textTransform: 'uppercase', fontSize: '9px' }}>Sub Total</td>
                        <td style={{ textAlign: 'right', fontSize: '10px' }}>{formatCurrency(subtotal)}</td>
                    </tr>
                </tbody>
            </table>
        );
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>

            {/* ── Page 1: Header + Summary tables ── */}
            <div className="print-header">
                <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>Fee Head Collection Report</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>{data.name || 'Unknown Fee Head'}</div>
                {dateRange && (
                    <div style={{ fontSize: '10px', marginTop: '4px', color: '#333' }}>
                        Period: {dateRange.start} to {dateRange.end}
                    </div>
                )}
                {!hideGeneratedInfo && (
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                        Generated: {new Date().toLocaleString('en-IN')}
                    </div>
                )}
            </div>

            {showSummary && (
                <>
                    {/* Collection Summary */}
                    <h3 className="section-header">Collection Summary</h3>
                    <table className="print-table" style={{ marginBottom: '14px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Description</th>
                                <th style={{ textAlign: 'right' }}>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Total Receipts (Active)</td><td style={{ textAlign: 'right' }}>{debitTxns.length}</td></tr>
                            <tr><td>Cash Collection</td><td style={{ textAlign: 'right' }}>{formatCurrency(cashTotal)}</td></tr>
                            <tr><td>Bank / Online Collection</td><td style={{ textAlign: 'right' }}>{formatCurrency(bankTotal)}</td></tr>
                            <tr><td>Concession / Credit</td><td style={{ textAlign: 'right' }}>{formatCurrency(concessionTotal)}</td></tr>
                            {cancelledTransactions.length > 0 && (
                                <tr><td>Cancelled Transactions</td><td style={{ textAlign: 'right' }}>{cancelledTransactions.length}</td></tr>
                            )}
                            <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                <td>Net Total Collection</td>
                                <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatCurrency(netTotal)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* College-wise Breakdown */}
                    {sortedColleges.length > 0 && (
                        <>
                            <h3 className="section-header">College-wise Breakdown</h3>
                            <table className="print-table" style={{ marginBottom: '14px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '5%' }}>S.No</th>
                                        <th>College</th>
                                        <th style={{ textAlign: 'right' }}>Receipts</th>
                                        <th style={{ textAlign: 'right' }}>Cash</th>
                                        <th style={{ textAlign: 'right' }}>Bank</th>
                                        <th style={{ textAlign: 'right' }}>Collection</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedColleges.map(([col, d], i) => (
                                        <tr key={col}>
                                            <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                            <td style={{ fontWeight: 'bold' }}>{col}</td>
                                            <td style={{ textAlign: 'right' }}>{d.count}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(d.cash)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(d.bank)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(d.total)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                        <td colSpan="2" style={{ textTransform: 'uppercase', fontSize: '9px' }}>Total</td>
                                        <td style={{ textAlign: 'right' }}>{debitTxns.length}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(cashTotal)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(bankTotal)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatCurrency(netTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* User-wise (Cashier) Breakdown */}
                    {sortedUsers.length > 0 && (
                        <>
                            <h3 className="section-header">User-wise Breakdown</h3>
                            <table className="print-table" style={{ marginBottom: '14px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '5%' }}>S.No</th>
                                        <th>Cashier / User</th>
                                        <th style={{ textAlign: 'right' }}>Receipts</th>
                                        <th style={{ textAlign: 'right' }}>Cash</th>
                                        <th style={{ textAlign: 'right' }}>Bank</th>
                                        <th style={{ textAlign: 'right' }}>Collection</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedUsers.map((u, i) => (
                                        <tr key={i}>
                                            <td style={{ textAlign: 'center' }}>{i + 1}</td>
                                            <td style={{ fontWeight: 'bold' }}>{u.name}</td>
                                            <td style={{ textAlign: 'right' }}>{u.count}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(u.cash)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(u.bank)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(u.total)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                                        <td colSpan="2" style={{ textTransform: 'uppercase', fontSize: '9px' }}>Total</td>
                                        <td style={{ textAlign: 'right' }}>{debitTxns.length}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(cashTotal)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(bankTotal)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatCurrency(netTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* Signatures at end of page 1 */}
                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderTop: '1px solid #ccc', paddingTop: '12px' }}>
                        <div>Prepared By: ___________________________</div>
                        <div>Verified By: ___________________________</div>
                        <div>Principal / Head of Finance</div>
                    </div>
                </>
            )}

            {/* ── Page 2+: Course → Branch → Transactions ── */}
            {showDetails && activeTransactions.length > 0 && (
                <>
                    {sortedCourses.map(([courseName, branchMap], ci) => {
                        const sortedBranches = Object.entries(branchMap).sort(([a], [b]) => a.localeCompare(b));
                        // course total
                        const courseTxns  = sortedBranches.flatMap(([, txns]) => txns);
                        const courseTotal = courseTxns.filter(t => t.transactionType !== 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);

                        return (
                            <div key={courseName} className="page-break">

                                {/* Course header bar */}
                                <div style={{
                                    background: '#1e293b', color: '#fff',
                                    padding: '6px 12px', marginBottom: '10px',
                                    fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span>Course: {courseName}</span>
                                    <span style={{ fontSize: '11px', fontWeight: '700' }}>
                                        {courseTxns.length} records &nbsp;|&nbsp; {formatCurrency(courseTotal)}
                                    </span>
                                </div>

                                {sortedBranches.map(([branchName, txns], bi) => {
                                    // running sno offset within this course
                                    const offset = sortedBranches
                                        .slice(0, bi)
                                        .reduce((s, [, t]) => s + t.length, 0);

                                    return (
                                        <div key={branchName} style={{ marginBottom: '14px' }}>
                                            {/* Branch sub-header */}
                                            <div style={{
                                                background: '#f1f5f9',
                                                borderLeft: '4px solid #334155',
                                                padding: '4px 10px',
                                                marginBottom: '4px',
                                                fontSize: '10px', fontWeight: '800',
                                                textTransform: 'uppercase', color: '#1e293b',
                                                display: 'flex', justifyContent: 'space-between'
                                            }}>
                                                <span>Branch: {branchName}</span>
                                                <span>{txns.length} records</span>
                                            </div>

                                            <TxTable txns={txns} snoStart={offset + 1} />
                                        </div>
                                    );
                                })}

                                {/* Course grand total row */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', border: '2px solid #000', marginTop: '4px' }}>
                                    <tbody>
                                        <tr style={{ background: '#1e293b', color: '#fff', fontWeight: '900' }}>
                                            <td style={{ border: '2px solid #000', padding: '5px 8px', textTransform: 'uppercase', fontSize: '9px' }}>
                                                Course Total — {courseName} ({courseTxns.length} records)
                                            </td>
                                            <td style={{ border: '2px solid #000', padding: '5px 8px', textAlign: 'right', fontSize: '11px', width: '15%' }}>
                                                {formatCurrency(courseTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

const FeeHeadReportTemplate = forwardRef(({ data, dateRange, options = {}, hideGeneratedInfo = false }, ref) => {
    const isArray = Array.isArray(data);
    const items = isArray ? data : (data ? [data] : []);

    return (
        <div ref={ref} className="print-container">
            <style type="text/css">{PRINT_STYLES}</style>
            {items.map((item, idx) => (
                <div key={idx} className={idx > 0 ? 'page-break' : ''}>
                    <SingleFeeHeadReport
                        data={item}
                        dateRange={dateRange}
                        options={options}
                        hideGeneratedInfo={hideGeneratedInfo}
                    />
                </div>
            ))}
        </div>
    );
});

FeeHeadReportTemplate.displayName = 'FeeHeadReportTemplate';
export default FeeHeadReportTemplate;
