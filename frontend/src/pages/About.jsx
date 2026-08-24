import React from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronLeft,
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
    UserRound
} from 'lucide-react';

const FEATURES = [
    {
        icon: LayoutDashboard,
        title: 'Dashboard Overview',
        summary: 'A live snapshot of institutional collections so finance teams can start the day with clear numbers.',
        points: [
            'View today’s, monthly, and overall collection totals in one place.',
            'Track active student counts to understand campus load at a glance.',
            'Use the dashboard as the default landing screen after staff login.'
        ]
    },
    {
        icon: UserRound,
        title: 'Students',
        summary: 'Browse and filter the institutional student directory before collecting fees or running reports.',
        points: [
            'Search students by name, admission number, or pin.',
            'Filter by college, course, branch, batch, and status.',
            'Access is scoped — staff only see students for colleges they are allowed to manage.'
        ]
    },
    {
        icon: Wallet,
        title: 'Fee Configuration',
        summary: 'Build the fee structure once, then reuse it across colleges, courses, batches, and years.',
        points: [
            'Create fee heads and groups (tuition, lab, transport, hostel, and more).',
            'Define amounts by college, course, branch, batch, year, and semester.',
            'Configure term splits and late-fee rules so dues activate on the right schedule.'
        ]
    },
    {
        icon: CreditCard,
        title: 'Fee Collection',
        summary: 'Collect payments student by student with a full trail of what was paid and what remains.',
        points: [
            'Look up a student and see dues by fee head, year, and term.',
            'Record cash, bank, UPI, or account-based payments with references and remarks.',
            'Generate printable receipts and review past transactions on the same screen.'
        ]
    },
    {
        icon: FileBarChart2,
        title: 'Reports & Analytics',
        summary: 'Operational reports for cashiers, accounts, and college leadership — ready to print or export.',
        points: [
            'Daily, cashier, fee-head, college, account, and mode-wise collection reports.',
            'Filter by date range, college, course, and payment details.',
            'Export to Excel or print formatted summaries for audits and handovers.'
        ]
    },
    {
        icon: FileBarChart2,
        title: 'Due Reports',
        summary: 'See who still owes fees, how much is currently due, and how balances break down by term.',
        points: [
            'Filter dues by college, course, branch, batch, or student search.',
            'View total due vs active due based on academic-calendar term dates.',
            'Expand each student for academic, hostel, and transport breakdowns, with scholarship-aware options.'
        ]
    },
    {
        icon: BadgePercent,
        title: 'Concessions',
        summary: 'Handle fee reductions through controlled declaration and application workflows instead of informal adjustments.',
        points: [
            'Declaration concessions set revised fee structures for eligible students.',
            'Application concessions request, review, approve, or reject amounts against specific fee heads.',
            'Requests can be filtered and audited so every waiver has a clear trail.'
        ]
    },
    {
        icon: FileText,
        title: 'Proceedings',
        summary: 'Manage RTF / bank-credit proceedings from drafting through verification and final approval.',
        points: [
            'Create proceedings, map students, and allocate share amounts against the credited total.',
            'Verify pending proceedings before approval; only verified items can be approved.',
            'Generate related transactions automatically (or overnight) once approved.'
        ]
    },
    {
        icon: CalendarDays,
        title: 'Academic Calendar',
        summary: 'Keep semester dates and fee due windows aligned so dues and reminders stay accurate.',
        points: [
            'Maintain semester start and end dates by college, course, batch, and year of study.',
            'View the Term Dues Calendar with dates mapped into T1 / T2 / T3 payment windows.',
            'Due reports and late-fee logic use these dates as the source of truth.'
        ]
    },
    {
        icon: Bell,
        title: 'Reminders',
        summary: 'Notify students and parents about dues through SMS or email — manually or on a schedule.',
        points: [
            'Create reusable SMS and email templates with student and fee variables.',
            'Send reminders to filtered student groups in bulk.',
            'Set reminder rules so messages go out automatically before or after due dates.'
        ]
    },
    {
        icon: Upload,
        title: 'Bulk Fee Upload',
        summary: 'Import large payment or due updates from Excel instead of entering them one by one.',
        points: [
            'Download a standard template for payments or dues.',
            'Preview uploaded rows, fix issues, and choose which lines to save.',
            'Ideal for bank statement dumps, scholarship credits, or mass due adjustments.'
        ]
    },
    {
        icon: Bus,
        title: 'Transport & Hostel',
        summary: 'Configure transport routes and hostel facilities so service fees connect cleanly to student billing.',
        points: [
            'Define transport routes and stages with amounts, then allocate students to them.',
            'Manage hostels, categories, and rooms for residential fee setup.',
            'Service fees appear alongside academic dues in collection and due reports.'
        ]
    },
    {
        icon: Landmark,
        title: 'Caution Deposit',
        summary: 'Track refundable caution deposits separately from regular academic fee collection.',
        points: [
            'Record and review caution deposit entries for students.',
            'Keep deposits distinct from tuition and other fee heads for clearer accounting.',
            'Support campus processes for deposit collection and later settlement.'
        ]
    },
    {
        icon: Building2,
        title: 'Payment Accounts',
        summary: 'Configure where collected money is deposited so cashiers pick the right account every time.',
        points: [
            'Add bank, UPI, and account details per college and course.',
            'Enable or disable configs without deleting them.',
            'Link payment modes in fee collection to the correct institutional account.'
        ]
    },
    {
        icon: Users,
        title: 'User Management',
        summary: 'Create staff accounts for cashiers, office users, and admins with the right college and page access.',
        points: [
            'Add, edit, or remove users with roles and college assignments.',
            'Grant page-level permissions so each person only opens the modules they need.',
            'Supports multi-college campuses where staff work in different scopes.'
        ]
    },
    {
        icon: Shield,
        title: 'Role-Based Access & Permissions',
        summary: 'Security is built into the menu and actions — not just the login screen.',
        points: [
            'Superadmin and admin see the full system; other roles see a filtered sidebar.',
            'Special student permissions (for example principal approval) can be granted with validity dates.',
            'Sensitive actions like verify, approve, edit, or delete follow explicit permission flags.'
        ]
    }
];

const About = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
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
                <div className="text-xs font-medium text-slate-400">v2.0</div>
            </div>

            <div className="max-w-5xl mx-auto px-6 md:px-10 py-12 md:py-16">
                <div className="text-center mb-14 max-w-3xl mx-auto">
                    <div className="inline-block p-2 bg-blue-50 rounded-2xl mb-4">
                        <span className="text-blue-600 font-bold tracking-wide text-xs uppercase px-2">
                            Platform Overview
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-5 tracking-tight">
                        Fee management built for institutions
                    </h1>
                    <p className="text-lg text-slate-500 leading-relaxed">
                        Pydah Fees brings configuration, collection, concessions, dues, reminders, and reporting
                        into one secure staff portal — designed for multi-college campuses.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                        >
                            Staff Portal
                            <ArrowRight size={16} />
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex items-center px-6 py-2.5 bg-white text-slate-700 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
                        >
                            Home
                        </Link>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Modules & capabilities</h2>
                    <p className="text-sm text-slate-500 max-w-2xl">
                        Each module below explains what it covers and how staff use it day to day.
                    </p>
                </div>

                <div className="space-y-5">
                    {FEATURES.map(({ icon: Icon, title, summary, points }, index) => (
                        <section
                            key={title}
                            className="bg-white border border-gray-100 rounded-2xl p-6 md:p-7 shadow-sm hover:border-blue-200 transition-colors"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Icon size={22} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                                            Module {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                        {summary}
                                    </p>
                                    <ul className="space-y-2">
                                        {points.map((point) => (
                                            <li key={point} className="flex items-start gap-2.5 text-sm text-slate-500 leading-relaxed">
                                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-5">
                        <p className="text-2xl font-extrabold text-slate-900">Multi-college</p>
                        <p className="text-sm text-slate-500 mt-1">One system across colleges, courses, and batches.</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5">
                        <p className="text-2xl font-extrabold text-slate-900">Permission-aware</p>
                        <p className="text-sm text-slate-500 mt-1">Every screen follows role and page access rules.</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5">
                        <p className="text-2xl font-extrabold text-slate-900">End-to-end</p>
                        <p className="text-sm text-slate-500 mt-1">From fee setup to dues, reminders, and receipts.</p>
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
