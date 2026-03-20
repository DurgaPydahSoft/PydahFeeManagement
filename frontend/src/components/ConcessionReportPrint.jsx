import React, { forwardRef } from 'react';

const ConcessionReportPrint = forwardRef(({ data, filters }, ref) => {
    // Grouping data by approver (concessionGivenBy)
    const groupedData = data.reduce((acc, item) => {
        const approver = item.concessionGivenBy || 'System/Admin';
        if (!acc[approver]) acc[approver] = [];
        acc[approver].push(item);
        return acc;
    }, {});

    const totalConcession = data.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div ref={ref} className="p-10 bg-white font-serif text-gray-900 print:p-6" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="text-center mb-10 border-b-2 border-gray-900 pb-6">
                <h1 className="text-2xl font-black uppercase tracking-widest mb-1">Pydah Group of Educational Institutions</h1>
                <p className="text-sm font-bold text-gray-600 uppercase">Concession Management - Fee Advice Report</p>
                <div className="flex justify-between mt-6 text-[10px] font-bold uppercase text-gray-500">
                    <span>Generated on: {new Date().toLocaleString()}</span>
                    <span>Period: {filters.startDate || 'Beginning'} to {filters.endDate || 'Today'}</span>
                </div>
            </div>

            {/* Content grouped by Authorizer */}
            {Object.keys(groupedData).map((authorizer, idx) => (
                <div key={idx} className="mb-12 break-inside-avoid">
                    <div className="bg-gray-100 p-3 flex justify-between items-center mb-4 border border-gray-300">
                        <h2 className="text-sm font-black uppercase tracking-tight">Authorized By: <span className="text-blue-900">{authorizer}</span></h2>
                        <span className="text-xs font-bold text-gray-500">{groupedData[authorizer].length} Students</span>
                    </div>

                    <table className="w-full text-left border-collapse border border-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black">S.No</th>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black">PIN Number</th>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black">Student Name</th>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black">Course / Branch</th>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black">Fee Head</th>
                                <th className="border border-gray-300 p-2 text-[10px] uppercase font-black text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedData[authorizer].map((student, sIdx) => (
                                <tr key={sIdx}>
                                    <td className="border border-gray-300 p-2 text-[10px]">{sIdx + 1}</td>
                                    <td className="border border-gray-300 p-2 text-[10px] font-mono font-bold uppercase">{student.studentPin || student.studentId}</td>
                                    <td className="border border-gray-300 p-2 text-[10px] font-bold">{student.studentName}</td>
                                    <td className="border border-gray-300 p-2 text-[10px]">{student.course} - {student.branch}</td>
                                    <td className="border border-gray-300 p-2 text-[10px] font-medium">{student.feeHead?.name}</td>
                                    <td className="border border-gray-300 p-2 text-[10px] font-black text-right">₹{student.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-black">
                            <tr>
                                <td colSpan="5" className="border border-gray-300 p-2 text-[10px] text-right uppercase">Subtotal for {authorizer}</td>
                                <td className="border border-gray-300 p-2 text-[10px] text-right">₹{groupedData[authorizer].reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-6 flex justify-end">
                        <div className="w-48 border-t border-gray-400 text-center pt-1 text-[9px] font-bold uppercase text-gray-500">
                            Authorizer Signature
                        </div>
                    </div>
                </div>
            ))}

            {/* Final Summary */}
            <div className="mt-12 p-6 bg-gray-900 text-white rounded-lg flex justify-between items-center shadow-lg print:shadow-none">
                <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">Grand Total Concessions</div>
                    <div className="text-2xl font-black">₹{totalConcession.toLocaleString()}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Total Students Benefitted</div>
                    <div className="text-2xl font-black">{data.length}</div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-gray-200 text-center text-[9px] text-gray-400 italic">
                This is a computer-generated Fee Advice Report for Internal Records only. 
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4; margin: 20mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            ` }} />
        </div>
    );
});

export default ConcessionReportPrint;
