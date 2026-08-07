import React from 'react';
import { BookOpen, Layers } from 'lucide-react';

const ReminderSetupGuide = () => {
    return (
        <div className="w-full h-full overflow-y-auto space-y-6 pb-8">
            <div className="bg-white border border-gray-200 p-6 rounded-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg mb-2">
                    <BookOpen size={14} /> Reminder System Guide
                </div>
                <h2 className="text-xl font-bold text-gray-800">How Reminder Rules Work</h2>
                <p className="text-xs text-gray-500 mt-1 max-w-3xl">
                    Templates hold the message and variable mapping. Global rules pick academic year, fee type (Academic / Hostel / Transport), and when to send relative to due dates from Late Fee configuration. The nightly job (3 AM IST) sends only to students with unpaid balance through that term.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-gray-200 p-6 rounded-xl space-y-6">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
                        <Layers size={14} /> Setup Steps
                    </h3>
                    <div className="relative pl-6 border-l-2 border-gray-100 space-y-6 ml-3">
                        <div className="relative">
                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</div>
                            <h4 className="text-xs font-bold text-gray-800">Configure Late Fee due dates</h4>
                            <p className="text-xs text-gray-500 mt-1">In Fee Configuration → Late Fees, set Academic / Hostel / Transport due timing (Default Rules + structure or service configs). Reminders reuse those same due dates.</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</div>
                            <h4 className="text-xs font-bold text-gray-800">Create SMS / Email templates</h4>
                            <p className="text-xs text-gray-500 mt-1">Under Configuration, write the DLT-approved body with placeholders like {'{{student_name}}'}. Map each placeholder to a student column or computed field (due date, unpaid amount).</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</div>
                            <h4 className="text-xs font-bold text-gray-800">Save a global Reminder rule</h4>
                            <p className="text-xs text-gray-500 mt-1">Pick Academic Year + type (Academic / Hostel / Transport), add offsets (e.g. 3 days BEFORE due), and attach templates. Filter by quotas, colleges, or courses as needed.</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[33px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">4</div>
                            <h4 className="text-xs font-bold text-gray-800">Nightly send (automatic)</h4>
                            <p className="text-xs text-gray-500 mt-1">Scheduler resolves due dates, finds unpaid students through that term, fills template variables from the map, and sends SMS/Email via BulkSMS / Brevo. Manual blast remains available under Send Reminders.</p>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-white border border-gray-200 p-5 rounded-xl">
                        <h3 className="font-bold text-gray-800 text-sm mb-3">Audience rule</h3>
                        <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                            <li>Only <strong>regular</strong> students with unpaid balance through the due term (same underpaid logic as late fees).</li>
                            <li>Paid / fully conceded students are skipped.</li>
                            <li>Separate rules for Academic, Hostel, and Transport.</li>
                        </ul>
                    </div>
                    <div className="bg-white border border-gray-200 p-5 rounded-xl">
                        <h3 className="font-bold text-gray-800 text-sm mb-3">Example</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            AY <strong>2025-2026</strong>, type <strong>ACADEMIC</strong>, offsets <strong>3, 0 BEFORE</strong>, SMS template linked.
                            If Term 1 due is 30 Jul, unpaid students get SMS on 27 Jul and again on 30 Jul. Hostel and Transport need their own rules for the same AY.
                        </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl">
                        <h3 className="font-bold text-amber-900 text-sm mb-2">Note on old rules</h3>
                        <p className="text-xs text-amber-800">College-scoped legacy rules are skipped by the new scheduler. Delete them and recreate as global AY + type rules.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReminderSetupGuide;
