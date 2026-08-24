import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, PieChart, CheckCircle, ArrowRight, Activity, Users, Database } from 'lucide-react';

const slogans = [
    "Future of Education",
    "Institutional Finance",
    "Smart Fee Management",
    "Seamless Student Billing",
    "Real-time Collections"
];

const Landing = () => {
    const [sloganIdx, setSloganIdx] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setSloganIdx((prev) => (prev + 1) % slogans.length);
                setFade(true);
            }, 500);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Inject local CSS for silver button shine and scrollbar colors (removed on unmount)
    useEffect(() => {
        const css = `
        /* Landing-local: black button with silver shine */
        .btn-silver { position: relative; overflow: hidden; background: #0f172a; color: #fff; box-shadow: 0 8px 22px rgba(2,6,23,0.3); border: 1px solid rgba(11,37,69,0.2); }
        .btn-silver .shine { position: absolute; top: 0; left: -90%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); transform: skewX(-20deg); animation: landing-shine 2s ease-in-out 0.3s infinite; }
        .btn-silver:hover { background: #1a2544; }
        .btn-silver:active { transform: translateY(1px); }
        @keyframes landing-shine { 0% { left: -90%; } 50% { left: 100%; } 100% { left: 100%; } }

        /* Scrollbar styling to match the landing background (applies to chrome/safari and firefox) */
        html, body { scrollbar-width: thin; scrollbar-color: rgba(230,236,255,0.65) transparent !important; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 12px !important; }
        /* keep the track subtle and matching background */
        html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: transparent !important; }
        /* thumb uses a subtle gradient close to the page background to blend in */
        html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(230,236,255,0.9), rgba(240,246,255,0.7)) !important; border-radius: 10px !important; border: 3px solid transparent !important; background-clip: padding-box !important; }
        html::-webkit-scrollbar-corner { background: transparent !important; }
        `;
        const style = document.createElement('style');
        style.setAttribute('data-landing-local', 'true');
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // (no global overflow changes) keep native scrolling but style scrollbar to match background

    return (
        <div className="min-h-screen font-sans text-gray-800 overflow-x-hidden relative" style={{ backgroundImage: "url('/background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
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
                {/* Brand Logo Code Emblem */}
                <div className="flex items-center gap-3.5 select-none">
                    <div className="border-[2px] border-blue-700 px-3.5 py-1.5 rounded-tl-[12px] rounded-br-[12px] rounded-tr-[2px] rounded-bl-[2px] relative flex items-center justify-center leading-none bg-blue-50/50">
                        <span className="text-base font-extrabold text-blue-700 tracking-wider font-sans">
                            PYDAH
                        </span>
                    </div>
                </div>


                <Link to="/login" className="px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full transition-all border border-blue-100">
                    Staff Portal
                </Link>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-4 sm:pt-5 md:pt-6 lg:pt-7 pb-3 sm:pb-4 md:pb-5 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 h-[calc(100vh-80px)] flex items-center">
                <div className="w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12 items-center">

                    {/* Hero Text */}
                    <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-50 border border-blue-100 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[10px] sm:text-xs font-bold text-blue-700 tracking-wide">Institutional Finance v2.0</span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-extrabold text-slate-900 leading-tight tracking-tight">
                            Powering the <br />
                            <span className={`text-blue-600 inline-block transition-all duration-500 transform ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
                                {slogans[sloganIdx]}
                            </span>
                        </h1>

                        <p className="text-xs sm:text-sm md:text-base text-slate-500 max-w-sm sm:max-w-md lg:max-w-lg leading-snug border-l-4 border-blue-200 pl-2 sm:pl-3 md:pl-4">
                            Experience a seamless, secure, and smart fee management ecosystem designed for high-performance institutions.
                        </p>

                        <div className="flex flex-wrap gap-2 sm:gap-3 pt-1 sm:pt-2">
                            <Link to="/login" className="btn-silver group px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold shadow-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base">
                                <span className="shine" aria-hidden></span>
                                <span className="relative z-10 flex items-center gap-2">Access Dashboard
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                            <Link to="/about" className="px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 bg-white text-slate-700 border border-gray-200 rounded-lg md:rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center justify-center text-xs sm:text-sm md:text-base">
                                About
                            </Link>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6 pt-2 sm:pt-3 md:pt-4 border-t border-gray-200/60">
                            <div>
                                <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-slate-900">100%</p>
                                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider mt-0.5">Digital</p>
                            </div>
                            <div>
                                <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-slate-900">0s</p>
                                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider mt-0.5">Downtime</p>
                            </div>
                            <div>
                                <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-slate-900">SECURE</p>
                                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider mt-0.5">Encryption</p>
                            </div>
                        </div>
                    </div>

                    {/* Hero Visual / Placeholder */}
                    <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl lg:ml-auto mx-auto">
                        <div className="absolute inset-0 bg-blue-600 rounded-3xl rotate-2 opacity-10 scale-95 blur-sm"></div>
                        <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 p-2 rounded-3xl shadow-2xl ring-1 ring-gray-900/5">
                            {/* Browser Mockup Header */}
                            <div className="h-5 sm:h-6 md:h-7 lg:h-8 border-b border-gray-100 flex items-center px-2 sm:px-3 gap-1">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                                </div>
                                <div className="ml-2 sm:ml-3 flex-1 h-4 sm:h-5 bg-gray-100 rounded-md text-[8px] sm:text-[9px] text-gray-400 flex items-center px-2 font-mono">
                                    auth.pydah.edu/dashboard
                                </div>
                            </div>

                            {/* Main Placeholder Area - Realistic Dashboard Mockup */}
                            <div className="h-[200px] sm:h-[240px] md:h-[280px] lg:h-[320px] xl:h-[360px] bg-slate-50 rounded-b-2xl relative overflow-hidden flex flex-row">

                                {/* Mock Sidebar */}
                                <div className="w-8 sm:w-9 md:w-10 lg:w-12 bg-white border-r border-gray-100 flex flex-col items-center py-2 sm:py-3 gap-2 sm:gap-3 z-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-[15px]">₹</div>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><PieChart size={16} /></div>
                                    <div className="w-8 h-8 rounded-lg bg-transparent text-gray-400 flex items-center justify-center"><Users size={16} /></div>
                                    <div className="w-8 h-8 rounded-lg bg-transparent text-gray-400 flex items-center justify-center"><Database size={16} /></div>
                                </div>

                                {/* Mock Main Content */}
                                <div className="flex-1 p-2 sm:p-3 md:p-4 overflow-hidden">

                                    {/* Mock Header */}
                                    <div className="flex justify-between items-center mb-2 sm:mb-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                        <div className="h-4 w-32 bg-gray-200 rounded-full"></div>
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                        </div>
                                    </div>

                                    {/* Mock Stats Grid */}
                                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-3 mb-2 sm:mb-3">
                                        <div className="bg-white p-1.5 sm:p-2 md:p-3 rounded-lg md:rounded-xl shadow-sm border border-gray-100 animate-scale-in" style={{ animationDelay: '0.3s' }}>
                                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
                                                <Activity size={14} />
                                            </div>
                                            <div className="h-3 w-12 bg-gray-100 rounded-full mb-2"></div>
                                            <div className="h-5 w-20 bg-slate-800 rounded-md"></div>
                                        </div>
                                        <div className="bg-white p-1.5 sm:p-2 md:p-3 rounded-lg md:rounded-xl shadow-sm border border-gray-100 animate-scale-in" style={{ animationDelay: '0.4s' }}>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                                                <PieChart size={14} />
                                            </div>
                                            <div className="h-3 w-12 bg-gray-100 rounded-full mb-2"></div>
                                            <div className="h-5 w-20 bg-slate-800 rounded-md"></div>
                                        </div>
                                    </div>

                                    {/* Mock Chart Area */}
                                    <div className="bg-white p-1.5 sm:p-2 md:p-3 rounded-lg md:rounded-xl shadow-sm border border-gray-100 h-12 sm:h-16 md:h-20 w-full flex items-end gap-1 sm:gap-2 justify-between px-1 pb-1 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                                        <div className="w-full bg-blue-100 rounded-t-sm h-[40%]"></div>
                                        <div className="w-full bg-blue-200 rounded-t-sm h-[60%]"></div>
                                        <div className="w-full bg-blue-300 rounded-t-sm h-[30%]"></div>
                                        <div className="w-full bg-blue-400 rounded-t-sm h-[80%]"></div>
                                        <div className="w-full bg-blue-500 rounded-t-sm h-[50%]"></div>
                                        <div className="w-full bg-blue-600 rounded-t-sm h-[90%]"></div>
                                    </div>

                                    {/* Mock List Items - Floating over slightly */}
                                    <div className="mt-1 sm:mt-2 bg-white p-1.5 sm:p-2 md:p-3 rounded-lg md:rounded-xl border border-gray-100 flex items-center gap-1.5 sm:gap-2 shadow-md transform translate-x-1 sm:translate-x-2 animate-fade-in-up text-[10px] sm:text-xs md:text-sm" style={{ animationDelay: '0.6s' }}>
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
                        <div className="absolute -bottom-2 sm:-bottom-3 -left-2 sm:-left-3 bg-white p-1.5 sm:p-2 rounded-lg shadow-lg border border-gray-100 flex items-center gap-1.5 sm:gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
                            <div className="w-5 sm:w-6 h-5 sm:h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                <Activity size={10} className="sm:size-3" />
                            </div>
                            <div>
                                <p className="text-[8px] sm:text-[10px] text-gray-400 font-bold uppercase">Real-time</p>
                                <p className="text-[9px] sm:text-xs font-bold text-gray-800">Sync Active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Footer */}
            <footer className="bg-slate-50 border-t border-slate-200 py-2 sm:py-3 md:py-4 px-4 sm:px-6 md:px-8 lg:px-12">
                <div className="w-full mx-auto flex flex-col md:flex-row justify-between items-center opacity-60 hover:opacity-100 transition-opacity text-xs sm:text-sm">
                    <p className="font-bold text-slate-900 tracking-tight">Pydah<span className="text-blue-600">Fees</span> System</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">© 2025 Pydah Group. Internal Use Only.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;