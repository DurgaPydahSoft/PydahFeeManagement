import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, PieChart, CheckCircle, ArrowRight, Activity, Users, Database } from 'lucide-react';

const Landing = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-800 overflow-hidden relative">

            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-100 rounded-full blur-3xl opacity-30"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-3xl opacity-20"></div>
                <div className="absolute top-[20%] left-[10%] w-24 h-24 bg-blue-600 rounded-full blur-xl opacity-10"></div>

                {/* Tech Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(#2563EB 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                </div>
            </div>

            {/* Navbar */}
            <nav className="relative z-10 flex justify-between items-center py-5 px-8 md:px-16 backdrop-blur-sm bg-white/70 sticky top-0 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-900">Pydah<span className="text-blue-600">Fees</span></span>
                </div>
                <Link to="/login" className="px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full transition-all border border-blue-100">
                    Staff Portal
                </Link>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-16 pb-24 px-8 md:px-16">
                <div className=" mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Hero Text */}
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-blue-700  tracking-wide">Institutional Finance v2.0</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                            Powering the <br />
                            <span className="text-blue-600">
                                Future of Education
                            </span>
                        </h1>

                        <p className="text-lg text-slate-500 max-w-lg leading-relaxed border-l-4 border-blue-200 pl-6">
                            Experience a seamless, secure, and smart fee management ecosystem designed for high-performance institutions.
                        </p>

                        <div className="flex flex-wrap gap-4 pt-2">
                            <Link to="/login" className="group px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl hover:bg-gray-800 hover:scale-[1.02] transition-all flex items-center gap-3">
                                Access Dashboard
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link to="/docs" className="px-8 py-4 bg-white text-slate-700 border border-gray-200 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center justify-center">
                                View Documentation
                            </Link>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-200/60">
                            <div>
                                <p className="text-3xl font-bold text-slate-900">100%</p>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Digital</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-slate-900">0s</p>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Downtime</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-slate-900">SECURE</p>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Encryption</p>
                            </div>
                        </div>
                    </div>

                    {/* Hero Visual / Placeholder */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-600 rounded-3xl rotate-2 opacity-10 scale-95 blur-sm"></div>
                        <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 p-2 rounded-3xl shadow-2xl ring-1 ring-gray-900/5">
                            {/* Browser Mockup Header */}
                            <div className="h-10 border-b border-gray-100 flex items-center px-4 gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                                </div>
                                <div className="ml-4 flex-1 h-5 bg-gray-100 rounded-md text-[10px] text-gray-400 flex items-center px-2 font-mono">
                                    auth.pydah.edu/dashboard
                                </div>
                            </div>

                            {/* Main Placeholder Area - Realistic Dashboard Mockup */}
                            <div className="h-[400px] bg-slate-50 rounded-b-2xl relative overflow-hidden flex flex-row">

                                {/* Mock Sidebar */}
                                <div className="w-16 md:w-12 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-6 z-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="w-8 h-8 rounded-lg bg-blue-600"></div>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><PieChart size={16} /></div>
                                    <div className="w-8 h-8 rounded-lg bg-transparent text-gray-400 flex items-center justify-center"><Users size={16} /></div>
                                    <div className="w-8 h-8 rounded-lg bg-transparent text-gray-400 flex items-center justify-center"><Database size={16} /></div>
                                </div>

                                {/* Mock Main Content */}
                                <div className="flex-1 p-6 overflow-hidden">

                                    {/* Mock Header */}
                                    <div className="flex justify-between items-center mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                        <div className="h-4 w-32 bg-gray-200 rounded-full"></div>
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                        </div>
                                    </div>

                                    {/* Mock Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 animate-scale-in" style={{ animationDelay: '0.3s' }}>
                                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
                                                <Activity size={14} />
                                            </div>
                                            <div className="h-3 w-12 bg-gray-100 rounded-full mb-2"></div>
                                            <div className="h-5 w-20 bg-slate-800 rounded-md"></div>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 animate-scale-in" style={{ animationDelay: '0.4s' }}>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                                                <PieChart size={14} />
                                            </div>
                                            <div className="h-3 w-12 bg-gray-100 rounded-full mb-2"></div>
                                            <div className="h-5 w-20 bg-slate-800 rounded-md"></div>
                                        </div>
                                    </div>

                                    {/* Mock Chart Area */}
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-32 w-full flex items-end gap-3 justify-between px-2 pb-2 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                                        <div className="w-full bg-blue-100 rounded-t-sm h-[40%]"></div>
                                        <div className="w-full bg-blue-200 rounded-t-sm h-[60%]"></div>
                                        <div className="w-full bg-blue-300 rounded-t-sm h-[30%]"></div>
                                        <div className="w-full bg-blue-400 rounded-t-sm h-[80%]"></div>
                                        <div className="w-full bg-blue-500 rounded-t-sm h-[50%]"></div>
                                        <div className="w-full bg-blue-600 rounded-t-sm h-[90%]"></div>
                                    </div>

                                    {/* Mock List Items - Floating over slightly */}
                                    <div className="mt-4 bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3 shadow-lg transform translate-x-4 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <CheckCircle size={14} />
                                        </div>
                                        <div>
                                            <div className="h-3 w-24 bg-gray-800 rounded-full mb-1"></div>
                                            <div className="h-2 w-16 bg-gray-300 rounded-full"></div>
                                        </div>
                                        <div className="ml-auto h-4 w-12 bg-green-100 rounded-full text-green-700 text-[10px] flex items-center justify-center font-bold">PAID</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badge */}
                        <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-gray-100 flex items-center gap-3 animate-bounce" style={{ animationDuration: '3s' }}>
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                <Activity size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase">Real-time</p>
                                <p className="text-sm font-bold text-gray-800">Data Sync Active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Innovative Features Grid */}
            <section className="py-20 px-8 md:px-16 bg-white relative">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-20">
                        <h2 className="text-4xl font-bold text-slate-900 mb-6">Engineered for <br /> <span className="text-blue-600">Excellence</span></h2>
                        <div className="h-1 w-20 bg-blue-600 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Card 1 */}
                        <div className="group p-8 rounded-3xl bg-slate-50 hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 hover:text-white transition-all duration-300 relative overflow-hidden">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 mb-5 shadow-sm group-hover:scale-110 transition-transform">
                                <Shield size={28} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Fortified Security</h3>
                            <p className="text-gray-500 group-hover:text-blue-100 leading-relaxed font-medium">
                                Banking-grade encryption protocols protecting every transaction and student record.
                            </p>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>
                        </div>

                        {/* Card 2 */}
                        <div className="group p-8 rounded-3xl bg-slate-50 hover:bg-gradient-to-br hover:from-purple-600 hover:to-purple-700 hover:text-white transition-all duration-300 relative overflow-hidden">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-5 shadow-sm group-hover:scale-110 transition-transform">
                                <Database size={28} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Centralized Core</h3>
                            <p className="text-gray-500 group-hover:text-purple-100 leading-relaxed font-medium">
                                Unified database architecture ensuring data consistency across all campuses and departments.
                            </p>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>
                        </div>

                        {/* Card 3 */}
                        <div className="group p-8 rounded-3xl bg-slate-50 hover:bg-gradient-to-br hover:from-cyan-600 hover:to-cyan-700 hover:text-white transition-all duration-300 relative overflow-hidden">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-cyan-600 mb-5 shadow-sm group-hover:scale-110 transition-transform">
                                <Activity size={28} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Live Analytics</h3>
                            <p className="text-gray-500 group-hover:text-cyan-100 leading-relaxed font-medium">
                                Real-time financial dashboards providing instant insights into cash flow and pending dues.
                            </p>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-50 border-t border-slate-200 py-10 px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
                    <p className="font-bold text-slate-900 tracking-tight">Pydah<span className="text-blue-600">Fees</span> System</p>
                    <p className="text-sm text-slate-500">© 2025 Pydah Group. Internal Use Only.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
