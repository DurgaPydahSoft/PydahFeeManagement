import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    Info,
    Wallet,
    FileBarChart2,
    BadgePercent,
    FileText,
    CalendarDays,
    Bell,
    Upload,
    Bus,
    Building2,
    Shield,
    Users,
    CreditCard,
    Landmark,
    LayoutDashboard,
    ArrowRight,
    UserRound,
    CheckCircle2,
    BookOpen
} from 'lucide-react';

const FEATURES = [
    {
        icon: LayoutDashboard,
        title: "Dashboard Overview",
        summary: "The Dashboard Overview serves as the central command hub for campus directors, finance heads, and cashiers. It consolidates real-time financial metrics, daily collection trends, monthly aggregates, and active student strength into an intuitive single-screen landing dashboard so leadership can start the day with complete financial transparency.",
        points: [
            "Real-Time Revenue Metrics: View live metrics for today's collection totals, monthly collection aggregates, and total academic year receipts categorized by payment mode.",
            "Campus Enrollment & Capacity Load: Monitor active student enrollment strength across assigned colleges, courses, and branches at a glance.",
            "Quick Action Shortcuts: Directly initiate Fee Collection, view Due Reports, inspect Cashier Summaries, or review pending Concession applications from the landing screen.",
            "Multi-College Scoped Filtering: Automatically scopes displayed financial totals to reflect only the specific campus units assigned to the logged-in staff member.",
            "Operational System Alerts: Displays notifications regarding overdue fee term cutoffs, pending proceedings, and automated scheduled jobs."
        ]
    },
    {
        icon: UserRound,
        title: "Students Directory & Search",
        summary: "The Students Directory is the master institutional repository for searching, filtering, and managing student profiles across all campus units, providing complete visibility into billing history, assigned fee structures, and academic status.",
        points: [
            "Instant Multi-Attribute Search: Search student records instantly using Name, Admission Number, Registration Pin, Mobile Number, or Father's Name.",
            "Multi-Dimensional Filtering: Filter student lists by specific College, Course, Branch, Batch Year, Academic Year, and Active/Inactive status.",
            "Profile Ledger & History: Open complete student profiles to inspect assigned fee structures, total paid ledger history, caution deposit status, and approved concessions.",
            "Scoped Campus Security: Ensures staff only view and manage student records belonging to the specific colleges they have explicit authorization to operate.",
            "Master Database Synchronization: Trigger manual or automated background synchronization with campus SQL databases to keep student master records fully up to date."
        ]
    },
    {
        icon: Wallet,
        title: "Fee Configuration & Rules",
        summary: "Fee Configuration is the administrative backbone used to construct reusable fee structures, configure term installment splits, establish fee heads, and enforce automated late-fee policies across all academic programs.",
        points: [
            "Custom Fee Heads & Groups: Create custom fee categories including Tuition Fee, Lab Fee, Special Fee, Admission Fee, Transport Fee, and Hostel Fee.",
            "Granular Structure Mapping: Map precise annual fee amounts by College, Course, Branch, Batch Year, Semester, and Year of Study.",
            "Term Installment Splits: Divide annual fee structures into custom term percentages (e.g., Term 1: 40%, Term 2: 30%, Term 3: 30%) with specific payment windows.",
            "Automated Late Fee Rules: Configure grace periods, fixed penalty amounts, or daily recurring late fee rules that activate automatically based on term cutoff dates.",
            "Structure Reuse & Cloning: Clone existing fee structures across academic years or batches to streamline annual fee setup workflows."
        ]
    },
    {
        icon: CreditCard,
        title: "Fee Collection & Cashier Desk",
        summary: "The Fee Collection module is the primary daily desk for cashiers to process student fee payments, record transaction details across multiple payment modes, allocate funds against term dues, and issue official printable receipts.",
        points: [
            "Itemized Student Dues Lookup: Select a student to immediately view current due balances broken down by Fee Head, Academic Year, and active Term.",
            "Multi-Mode Payment Processing: Process incoming payments via Cash, Bank Transfer, Cheque, Online UPI, or Direct Account credits with custom transaction references.",
            "Flexible Dues Allocation: Automatically allocate payments against the oldest active term dues or manually distribute payments across specific fee heads.",
            "Official Printable Receipts: Instantly print official fee receipts featuring college branding, cashier signatures, transaction numbers, and QR verification codes.",
            "Transaction Ledger & Reversals: Review past transaction histories for the student, re-print receipt duplicates, or submit transaction cancellation requests if authorized."
        ]
    },
    {
        icon: FileBarChart2,
        title: "Reports & Financial Analytics",
        summary: "Reports & Financial Analytics provides a comprehensive audit and reporting engine built for cashiers, accountants, campus principals, and audit handovers to monitor income streams and reconcile daily accounts.",
        points: [
            "Daily Cashier Reconciliations: Generate and reconcile all collection entries recorded by specific staff members on any date for clean daily account closeouts.",
            "Multi-Dimensional Report Filtering: Filter collection reports by Date Range, College, Course, Branch, Payment Mode (Cash vs Bank), and Fee Head.",
            "Mode & Account Breakdown: Inspect total cash collections versus bank deposits to match physical cash in hand with bank statements.",
            "Audit & Spreadsheet Exports: Export complete report datasets directly to Excel or print formatted summaries for institutional audits.",
            "Head-Wise Collection Summaries: Analyze how revenue breaks down between Tuition, Transport, Hostel, and Special fee categories."
        ]
    },
    {
        icon: FileBarChart2,
        title: "Due Reports & Outstanding Balances",
        summary: "Due Reports delivers real-time tracking of unpaid fee balances across all enrolled students to assist finance teams in revenue forecasting, payment reminders, and fee recovery efforts.",
        points: [
            "Total Due vs Active Due Tracking: Differentiate between total gross annual fee expectations and currently payable active dues based on elapsed term dates.",
            "Itemized Balance Breakdown: Expand any student row to view individual outstanding balances for Academic Tuition, Transport, and Hostel services.",
            "Scholarship & Concession Factoring: View net dues with approved concessions, government RTF proceedings, and scholarship waivers factored in.",
            "Exporting Targeted Dues Lists: Export customized due lists to Excel categorized by course, branch, or batch for department heads and class coordinators.",
            "Term-Wise Breakdown View: Inspect exact payment status across Term 1, Term 2, and Term 3 payment windows."
        ]
    },
    {
        icon: BadgePercent,
        title: "Concession Management & Approvals",
        summary: "Concession Management provides a controlled workflow to request, review, approve, or reject individual fee waivers and discounts with full audit trails and authorization levels.",
        points: [
            "Formal Concession Application: Staff submit waiver requests specifying the reason, discount amount, supporting documentation, and target fee head.",
            "Multi-Level Approval Workflow: Requests remain in a pending queue until reviewed and approved by designated management or principal authorities.",
            "Audited Balance Adjustments: Approved concessions automatically adjust active student dues while maintaining complete historical logs and approver remarks.",
            "Rejection & Revision Controls: Approvers can reject applications with specific remarks or request amount revisions before final commitment.",
            "Concession Audit Logs: Review full history of all submitted, approved, and rejected concession applications across campus units."
        ]
    },
    {
        icon: FileText,
        title: "Overall Concession (Declarations)",
        summary: "Overall Concession handles batch-level or admission-stage declared fee reductions for merit scholarship or quota categories across entire student groups.",
        points: [
            "Admission Declaration Rules: Set fixed discounted fee structures for eligible categories during initial student admission.",
            "Automated Gross Reduction: Automatically adjusts annual fee expectations without requiring manual per-term waiver approvals.",
            "Merit & Quota Governance: Maintain clear concession guidelines for management quota, sports quota, and academic merit categories.",
            "Batch-Wide Revision: Apply revised fee agreements across entire student cohorts with a single administrative action."
        ]
    },
    {
        icon: FileText,
        title: "Proceedings & Government RTF Credit",
        summary: "Proceedings & Government RTF manages government tuition fee reimbursement sanctions and bulk bank credit transfers from initial drafting through allocation and approval.",
        points: [
            "Drafting Proceeding Sanctions: Create proceeding records with sanctioned credit amounts, government reference numbers, and credit dates.",
            "Student Mapping & Share Allocation: Map beneficiary students and allocate individual share amounts against the credited total.",
            "Two-Step Verification Workflow: Verify allocations before final approval to ensure student shares match government release totals.",
            "Automated Transaction Generation: Approving a proceeding automatically records individual student fee payment transaction entries in system ledgers.",
            "Overnight Auto-Processing: Includes automated background processes to process pending proceeding transactions overnight seamlessly."
        ]
    },
    {
        icon: CalendarDays,
        title: "Academic Calendar & Due Windows",
        summary: "The Academic Calendar module configures semester start/end dates and fee payment windows to keep due calculations and late fee logic perfectly synchronized.",
        points: [
            "Semester Schedule Mapping: Set term start dates, end dates, and due cutoff dates by College, Course, Batch Year, and Year of Study.",
            "Term Due Window Activation: Mapped dates control when Term 1, Term 2, or Term 3 fees transition into active due obligations.",
            "Source of Truth for Late Fees: Serves as the authoritative date matrix for daily automated late fee calculations and reminder triggers.",
            "Term Dues Calendar View: Visual calendar interface displaying active fee collection windows across all campus programs."
        ]
    },
    {
        icon: Bell,
        title: "Automated Reminders & Communication",
        summary: "Automated Reminders & Communication provides an automated SMS and Email notification suite to alert students and parents regarding upcoming deadlines and overdue balances.",
        points: [
            "Dynamic Message Templates: Create reusable SMS and Email templates embedding dynamic variables such as Student Name, Due Amount, and Due Date.",
            "Targeted Bulk Messaging: Dispatch reminders to specific student groups filtered by college, course, branch, or due balance threshold.",
            "Scheduled Automated Alerts: Set rules for automated messages to dispatch prior to or after term due cutoff dates.",
            "Communication Delivery Logs: Track sent reminder histories, delivery statuses, and timestamp logs for audit purposes."
        ]
    },
    {
        icon: Upload,
        title: "Bulk Fee Upload & Imports",
        summary: "Bulk Fee Upload facilitates mass data imports from spreadsheets for offline payments, bank statement dumps, or large-scale due adjustments.",
        points: [
            "Standardized Excel Templates: Download pre-formatted Excel templates for offline payment uploads or mass due adjustments.",
            "Pre-Commit Validation: Pre-validates uploaded spreadsheet rows for invalid admission numbers or missing fee heads before committing.",
            "Error Preview & Fixes: Highlights invalid rows in a preview table, allowing staff to fix formatting issues before final import.",
            "Batch Commit Audit Logs: Commits validated entries into student ledgers with complete import batch tracking."
        ]
    },
    {
        icon: Bus,
        title: "Transport Configuration & Billing",
        summary: "Transport Configuration manages campus bus routes, pickup stages, transport fee slabs, and student bus route allocations.",
        points: [
            "Routes & Pickup Stops Setup: Create transport routes, pickup stops/stages, and corresponding annual transport fee rates.",
            "Student Bus Allocation: Assign students to specific transport routes and pickup stages.",
            "Unified Collection Integration: Transport fees cleanly integrate alongside academic tuition in fee collection screens and due reports.",
            "Route Capacity Tracking: Monitor student numbers assigned to each bus route and stage."
        ]
    },
    {
        icon: Building2,
        title: "Hostel Configuration & Room Allocation",
        summary: "Hostel Configuration manages residential facilities, hostel blocks, room categories, bed occupancy, and residential fee collection.",
        points: [
            "Hostel Blocks & Room Categories: Define hostel blocks, room types (AC/Non-AC, sharing capacity), and annual room charges.",
            "Student Room & Bed Allocation: Map resident students to specific hostels, rooms, and bed numbers.",
            "Hostel Fee Ledger Integration: Maintains a dedicated hostel fee ledger accessible during cashier fee collection.",
            "Occupancy Management: View available versus occupied bed counts across all hostel buildings."
        ]
    },
    {
        icon: Landmark,
        title: "Caution Deposit Management",
        summary: "Caution Deposit Management tracks refundable caution deposits separately from institutional tuition revenue for transparent accounting.",
        points: [
            "Deposit Collection Tracking: Record refundable caution deposits paid by students during campus enrollment.",
            "Settlement & Refund Processing: Process deposit refunds upon student course completion or adjust against damage settlements.",
            "Separate Financial Accounting: Keep deposit accounting distinct from non-refundable tuition and service fee heads.",
            "Student Deposit Ledgers: View complete caution deposit receipt history and refund logs per student."
        ]
    },
    {
        icon: Building2,
        title: "Payment Accounts & Bank Setup",
        summary: "Payment Accounts configures institutional bank accounts, UPI IDs, and deposit targets for cashier cash and bank transactions.",
        points: [
            "Institutional Account Mapping: Link bank accounts and UPI IDs to specific colleges, courses, or fee types.",
            "Cashier Transaction Guidance: Ensures cashiers assign incoming bank/online payments to verified institutional accounts.",
            "Account Status Controls: Enable or disable account configurations safely without deleting past accounting records.",
            "Mode Enforcement Rules: Restrict cashiers from recording bank transfers without selecting an active bank account config."
        ]
    },
    {
        icon: Users,
        title: "User Management & Campus Scoping",
        summary: "User Management provides administrative controls to onboard staff, assign operational roles, and restrict college management scopes.",
        points: [
            "Staff User Onboarding: Create and manage user accounts for cashiers, office staff, accountants, and campus principals.",
            "Campus Scope Restrictions: Restrict staff access so each user can only view and manage data for their assigned colleges.",
            "Role Assignment Controls: Assign operational roles with defined responsibilities across multi-college campuses.",
            "Credential Management: Update user passcodes, reset accounts, or deactivate former staff members cleanly."
        ]
    },
    {
        icon: Shield,
        title: "Role-Based Access & Action Permissions",
        summary: "Role-Based Access Control enforces page-level menu navigation rights and granular action-level authorization flags across the application.",
        points: [
            "Filtered Sidebar Navigation: Superadmins and Admins view all options; operational staff view a permission-filtered sidebar.",
            "Action-Level Authorization: Restrict sensitive actions such as concession approval, proceeding verification, or receipt deletion to authorized roles.",
            "Special Validity Approvals: Grant temporary student approval permissions with specific validity start and end dates.",
            "Granular Permission Flags: Toggle specific permissions like fee_collection_edit, reports_export, or concession_approve per user."
        ]
    },
    {
        icon: Shield,
        title: "System Settings & Access Rules",
        summary: "System Settings controls global application parameters, cashier mode access restrictions, and security enforcement rules.",
        points: [
            "Payment Mode Access Controls: Enable or restrict cash and bank collection privileges for cashiers with auto-reset schedules.",
            "Receipt Layout & Branding: Configure default receipt headers, logo display, and printing parameters.",
            "Automated Daily Reset Timers: Set automated timers to reset cashier payment overrides every night.",
            "Single-Device Session Enforcement: Monitors active staff logins to prevent duplicate concurrent sessions on the same account."
        ]
    },
    {
        icon: FileText,
        title: "Transaction Date Modification & Audits",
        summary: "Transaction Date Modification is a specialized audit workspace allowing senior managers to adjust payment dates under strict audit tracking.",
        points: [
            "Bank Statement Reconciliation: Modify payment transaction dates for accurate bank statement reconciliation.",
            "Mandatory Justification Remarks: Require explicit justification notes for any payment date edits.",
            "Complete Audit Logging: Records original date, revised date, modifying user credentials, and audit remarks.",
            "Restricted Access Control: Access is strictly limited to authorized users with explicit date edit permission flags."
        ]
    },
    {
        icon: Shield,
        title: "Public Receipt Verification",
        summary: "Public Receipt Verification is a secure endpoint accessible via QR codes printed on receipts to authenticate official payments.",
        points: [
            "QR Code Authentication: Parents or external auditors scan receipt QR codes to instantly verify authenticity.",
            "Live Server Data Display: Shows live server-verified payment details (Student Name, Amount Paid, Receipt Date, Mode) without requiring staff login.",
            "Fraud Protection: Protects institutions against counterfeit, forged, or altered physical receipts.",
            "Official Verification Badge: Displays a verified server badge guaranteeing transaction authenticity."
        ]
    }
];

const About = () => {
    const [activeModuleIndex, setActiveModuleIndex] = useState(0);

    const activeModule = FEATURES[activeModuleIndex];
    const ActiveIcon = activeModule.icon;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-800 flex flex-col">
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                        <ChevronLeft size={18} />
                        Back to Home
                    </Link>
                    <div className="h-6 w-px bg-gray-200 mx-2" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <Info size={18} />
                        </div>
                        <span className="font-bold text-slate-800 tracking-tight">About Pydah Fees</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition"
                    >
                        Staff Portal
                        <ArrowRight size={14} />
                    </Link>
                    <div className="text-xs font-medium text-slate-400">v2.0</div>
                </div>
            </div>

            <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6">

                {/* Mobile horizontal pill navigation */}
                <div className="flex lg:hidden overflow-x-auto gap-2 pb-4 mb-4 border-b border-gray-200">
                    {FEATURES.map((item, idx) => {
                        const IconComponent = item.icon;
                        const isActive = idx === activeModuleIndex;
                        return (
                            <button
                                key={item.title}
                                onClick={() => setActiveModuleIndex(idx)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'bg-white text-slate-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <IconComponent size={14} />
                                <span>Module {String(idx + 1).padStart(2, '0')}: {item.title}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Documentation Layout: Sidebar + Right Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Sidebar (No inner scrollbar, expands with page) */}
                    <div className="hidden lg:block lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
                        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-2">
                            System Modules ({FEATURES.length})
                        </div>
                        <div className="space-y-1">
                            {FEATURES.map((item, idx) => {
                                const ItemIcon = item.icon;
                                const isActive = idx === activeModuleIndex;
                                return (
                                    <button
                                        key={item.title}
                                        onClick={() => setActiveModuleIndex(idx)}
                                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                            isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <ItemIcon size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                                                Module {String(idx + 1).padStart(2, '0')}
                                            </div>
                                            <div className="text-sm truncate">
                                                {item.title}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Content Panel */}
                    <div className="lg:col-span-9 space-y-6 sticky top-24">
                        <div className="bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-sm min-h-[460px] flex flex-col justify-between">
                            <div>
                                {/* Module Header */}
                                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <ActiveIcon size={28} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 mb-0.5">
                                            Module {String(activeModuleIndex + 1).padStart(2, '0')}
                                        </div>
                                        <h3 className="text-2xl font-extrabold text-slate-900">
                                            {activeModule.title}
                                        </h3>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="py-6">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Overview</h4>
                                    <p className="text-base text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        {activeModule.summary}
                                    </p>
                                </div>

                                {/* Key Features / Points */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Key Capabilities</h4>
                                    <div className="space-y-3">
                                        {activeModule.points.map((point, idx) => (
                                            <div key={idx} className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-slate-100 hover:border-blue-100 transition-colors">
                                                <div className="mt-0.5 p-1 rounded-full bg-blue-50 text-blue-600 shrink-0">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                                <span className="text-sm text-slate-600 leading-relaxed">
                                                    {point}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Pagination Controls */}
                            <div className="pt-8 mt-8 border-t border-gray-100 flex items-center justify-between">
                                <button
                                    onClick={() => setActiveModuleIndex(prev => Math.max(0, prev - 1))}
                                    disabled={activeModuleIndex === 0}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                                        activeModuleIndex === 0
                                            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100'
                                            : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                                    }`}
                                >
                                    <ChevronLeft size={16} />
                                    Previous Module
                                </button>

                                <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                                    Module {activeModuleIndex + 1} of {FEATURES.length}
                                </span>

                                <button
                                    onClick={() => setActiveModuleIndex(prev => Math.min(FEATURES.length - 1, prev + 1))}
                                    disabled={activeModuleIndex === FEATURES.length - 1}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                                        activeModuleIndex === FEATURES.length - 1
                                            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100'
                                            : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                    }`}
                                >
                                    Next Module
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400">
                © {new Date().getFullYear()} Pydah Group · Pydah Fees System
            </footer>
        </div>
    );
};

export default About;
