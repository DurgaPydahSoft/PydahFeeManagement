import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { getPostLoginRoute, persistAuthSession, isAuthenticated, getStoredUser } from '../lib/auth';
import { User, Lock, Loader } from 'lucide-react';

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const { username, password } = formData;

    // Already logged in — skip login screen (unless handling SSO token in URL)
    useEffect(() => {
        const ssoToken = new URLSearchParams(location.search).get('token');
        if (ssoToken) return;

        if (isAuthenticated()) {
            navigate(getPostLoginRoute(getStoredUser()), { replace: true });
        }
    }, [location.search, navigate]);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const ssoToken = queryParams.get('token');

        if (ssoToken) {
            handleSSOLogin(ssoToken);
        }
    }, [location.search]);

    const completeLogin = (user, { isSSO = false } = {}) => {
        if (!persistAuthSession(user, { isSSO })) {
            setError('Login succeeded but session could not be saved. Please try again.');
            setLoading(false);
            return;
        }
        setLoading(false);
        navigate(getPostLoginRoute(user), { replace: true });
    };

    const handleSSOLogin = async (token) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.post(`/auth/sso-login`, {
                encryptedToken: token
            });
            if (response.data) {
                completeLogin(response.data, { isSSO: true });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'SSO Login failed');
            setLoading(false);
            navigate('/login', { replace: true });
        }
    };

    const onChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            [e.target.name]: e.target.value,
        }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post(`/auth/login`, formData);
            if (response.data) {
                completeLogin(response.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">

            {/* Ambient Background Blobs */}
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-200/40 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-3xl pointer-events-none"></div>



            {/* Main Card Container - Reduced Height */}
            <div className="w-full max-w-[1000px] bg-white rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[500px] relative z-10">

                {/* Left Side: Branding & Visuals */}
                <div className="relative bg-blue-600 p-10 flex flex-col justify-center items-center text-center text-white overflow-hidden">

                    {/* Decorative Elements */}
                    <div className="absolute top-8 left-8 opacity-30">
                        <div className="grid grid-cols-4 gap-2">
                            {[...Array(16)].map((_, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            ))}
                        </div>
                    </div>
                    <div className="absolute top-[-10%] left-[30%] w-32 h-64 bg-white/10 rounded-full blur-2xl rotate-[30deg]"></div>
                    <div className="absolute top-[15%] left-[60%] w-3 h-3 bg-cyan-300 rounded-full shadow-[0_0_10px_rgba(103,232,249,0.8)]"></div>
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full border-[2px] border-white/20 opacity-60"></div>
                    <div className="absolute -bottom-12 -right-12 w-72 h-72 rounded-full border-[2px] border-white/20 opacity-60"></div>
                    <div className="absolute bottom-[10%] right-[10%] w-16 h-16 rounded-full bg-blue-500 shadow-2xl overflow-hidden z-10"></div>

                    {/* Branding Content (Pydah Fees like Landing) */}
                    <div className="relative z-20 mt-4 flex flex-col items-center">
                        {/* Custom Code Emblem Brand Logo */}
                        <div className="flex flex-col items-center select-none mb-10">
                            <div className="border-[3.5px] border-white px-10 py-4 rounded-tl-[28px] rounded-br-[28px] rounded-tr-[5px] rounded-bl-[5px] relative flex items-center justify-center leading-none shadow-xl bg-white/5 backdrop-blur-sm transition-transform hover:scale-105 duration-300">
                                <div className="relative flex items-center">
                                    {/* Small dots above P */}
                                    <div className="absolute -top-2.5 -left-3 flex gap-[2.5px]">
                                        <span className="w-3.5 h-3.5 rounded-full bg-white opacity-95 shadow-sm"></span>
                                        <span className="w-2 h-2 rounded-full bg-white opacity-85 mt-2"></span>
                                        <span className="w-[5px] h-[5px] rounded-full bg-white opacity-75 mt-1.5"></span>
                                    </div>
                                    <span className="text-4xl font-black text-white tracking-widest font-sans">
                                        PYDAH
                                    </span>
                                </div>
                            </div>
                            <span className="text-[12.5px] text-sky-200 mt-4.5 font-serif italic tracking-widest uppercase">
                                Education & Beyond
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold leading-tight mb-4 tracking-tight">
                            Institutional <br /> Excellence
                        </h1>
                        <p className="text-blue-100/90 text-base font-medium leading-relaxed max-w-sm text-center">
                            Secure access to the financial management dashboard.
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form - Compact */}
                <div className="p-8 md:p-12 flex flex-col justify-center bg-white relative">

                    <div className="max-w-sm mx-auto w-full">

                        <div className="text-center mb-8 relative flex items-center justify-center">
                            <Link 
                                to="/" 
                                className="absolute left-0 text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/50 p-2 rounded-xl border border-slate-200 transition-all shadow-sm"
                                title="Back to Home"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Welcome back</h2>
                                <p className="text-slate-400 text-sm mt-1">Please login to account</p>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-5 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2 animate-fade-in">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-600 pl-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        name="username"
                                        value={username}
                                        onChange={onChange}
                                        placeholder="Enter your username"
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-slate-700 font-medium placeholder-gray-400"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-600 pl-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        value={password}
                                        onChange={onChange}
                                        placeholder="••••••••••••"
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-slate-700 font-medium placeholder-gray-400"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-1">
                                <a href="#" className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">Forgot Password?</a>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin" size={20} /> Processing...
                                    </>
                                ) : (
                                    'Login'
                                )}
                            </button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-gray-300 font-medium tracking-wider">or</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-slate-400 text-sm font-medium">
                                Technical Issues? <span className="text-blue-600 font-bold cursor-pointer hover:underline">Contact Support</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
