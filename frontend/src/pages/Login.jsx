import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, ArrowRight, Loader } from 'lucide-react';

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { username, password } = formData;

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
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login`, formData);
            if (response.data) {
                localStorage.setItem('user', JSON.stringify(response.data));
                navigate('/dashboard');
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

            {/* Back Button (Restored) */}
            <Link to="/" className="absolute top-8 left-8 z-50 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </div>
                Back to Home
            </Link>

            {/* Main Card Container - Reduced Height */}
            <div className="w-full max-w-[1000px] bg-white rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[500px] relative z-10">

                {/* Left Side: Branding & Visuals */}
                <div className="relative bg-blue-600 p-10 flex flex-col justify-center text-white overflow-hidden">

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
                    <div className="relative z-20 mt-4">
                        <div className="inline-flex items-center gap-3 mb-6 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20 w-fit">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <span className="text-xl font-bold tracking-tight">Pydah<span className="text-blue-100">Fees</span></span>
                        </div>

                        <h1 className="text-4xl font-bold leading-tight mb-4 tracking-tight">
                            Institutional <br /> Excellence
                        </h1>
                        <p className="text-blue-100/90 text-base font-medium leading-relaxed max-w-sm">
                            Secure access to the financial management dashboard.
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form - Compact */}
                <div className="p-8 md:p-12 flex flex-col justify-center bg-white relative">

                    <div className="max-w-sm mx-auto w-full">

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-800">Welcome back</h2>
                            <p className="text-slate-400 text-sm mt-1">Please login to account</p>
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