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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[600px]">

                {/* Visual Side (Left) */}
                <div className="relative hidden md:flex flex-col justify-between p-12 bg-blue-600 overflow-hidden text-white">
                    {/* Background Patterns */}
                    <div className="absolute top-0 left-0 w-full h-full">
                        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-blue-500 rounded-full blur-3xl opacity-50"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-cyan-500 rounded-full blur-3xl opacity-40"></div>
                        <div className="absolute inset-0 opacity-10"
                            style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <span className="text-2xl font-bold tracking-tight">Pydah<span className="opacity-80 font-light">Fees</span></span>
                        </div>
                        <h1 className="text-4xl font-extrabold leading-tight mb-4">Secure Portal Access</h1>
                        <p className="text-blue-100 text-lg opacity-90 max-w-sm">
                            Manage institutional finances with banking-grade security and real-time analytics.
                        </p>
                    </div>

                    <div className="relative z-10 glass-card p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mt-12">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-white shadow-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                                <p className="font-bold">System Status</p>
                                <p className="text-xs text-blue-100">All Systems Operational</p>
                            </div>
                        </div>
                        <div className="w-full bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-green-400 w-full animate-pulse"></div>
                        </div>
                    </div>

                    <div className="relative z-10 text-xs text-blue-200 mt-auto pt-8">
                        © 2025 Pydah Group of Institutions
                    </div>
                </div>

                {/* Form Side (Right) */}
                <div className="flex items-center justify-center p-8 md:p-12 lg:p-16 bg-white relative">
                    <div className="w-full max-w-sm space-y-8">
                        <div className="text-center md:text-left">
                            <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
                            <p className="text-gray-500 mt-2">Please enter your credentials to continue.</p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 animate-fade-in">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        <form onSubmit={onSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        name="username"
                                        value={username}
                                        onChange={onChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-gray-800"
                                        placeholder="Admin ID or Username"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-bold text-gray-700">Password</label>
                                    <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700">Forgot Password?</a>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        value={password}
                                        onChange={onChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-gray-800"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="animate-spin" size={20} />
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        Sign In <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="text-center pt-2">
                            <p className="text-sm text-gray-400">
                                Need access? <a href="#" className="text-blue-600 font-semibold hover:underline">Contact System Administrator</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
