import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText, Check, Database, Shield, Layers } from 'lucide-react';

const Documentation = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
            {/* Header / Nav */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                        <ChevronLeft size={18} />
                        Back to Home
                    </Link>
                    <div className="h-6 w-px bg-gray-200 mx-2"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <FileText size={18} />
                        </div>
                        <span className="font-bold text-slate-800 tracking-tight">System Documentation</span>
                    </div>
                </div>
                <div className="text-xs font-medium text-slate-400">v2.0.0</div>
            </div>

            <div className="max-w-5xl mx-auto p-6 md:p-12">

                {/* Title Section */}
                <div className="mb-16 text-center">
                    <div className="inline-block p-2 bg-blue-50 rounded-2xl mb-4">
                        <span className="text-blue-600 font-bold tracking-wide text-xs uppercase px-2">Requirement & Functional Overview</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Fee Collection Web Application</h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                        A comprehensive guide to the functional requirements, architecture, and purpose of the Fee Collection System.
                    </p>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-12 items-start">

                    {/* Table of Contents (Sticky) */}
                    <div className="hidden lg:block sticky top-28 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Contents</h3>
                        <ul className="space-y-3 text-sm font-medium text-slate-500">
                            <li><a href="#intro" className="hover:text-blue-600 transition-colors block">1. Introduction</a></li>
                            <li><a href="#purpose" className="hover:text-blue-600 transition-colors block">2. Purpose</a></li>
                            <li><a href="#scope" className="hover:text-blue-600 transition-colors block">3. Scope</a></li>
                            <li><a href="#configuration" className="hover:text-blue-600 transition-colors block">4. Fee Configuration</a></li>
                            <li><a href="#collection" className="hover:text-blue-600 transition-colors block">7. Fee Collection</a></li>
                            <li><a href="#tech" className="hover:text-blue-600 transition-colors block">12. Data Strategy</a></li>
                        </ul>
                    </div>

                    {/* Main Markdown Content */}
                    <div className="space-y-16">

                        <section id="intro" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span>
                                Introduction
                            </h2>
                            <p className="text-slate-600 leading-7">
                                This document describes the functional requirements and overall concept of a web-based <strong>Fee Collection System</strong> designed for educational institutions. The application aims to simplify fee configuration, fee applicability, student-wise fee collection, and receipt generation while maintaining structured access through role-based dashboards.
                            </p>
                        </section>

                        <section id="purpose" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">2</span>
                                Purpose of the Application
                            </h2>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <ul className="space-y-3">
                                    {['Manage institutional fee structures flexibly', 'Collect fees from students accurately', 'Maintain transaction records', 'Role-based access control', 'Generate unified fee receipts'].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-slate-600">
                                            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        <section id="scope" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">3</span>
                                Scope of the System
                            </h2>
                            <p className="text-slate-600 leading-7">
                                The system covers the complete lifecycle of fee management, starting from fee configuration to fee collection and receipt generation.
                                It supports multiple colleges, academic years, courses, branches, and students under a single application.
                            </p>
                        </section>

                        <section id="configuration" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">4</span>
                                Fee Configuration & Applicability
                            </h2>
                            <p className="text-slate-600 mb-6">
                                The application allows administrators to create and manage various types of fees independently. Once configured, fees can be applied based on:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-3">
                                    <Layers className="text-purple-500" size={20} />
                                    <span className="font-semibold text-slate-700">College-wise</span>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-3">
                                    <Layers className="text-blue-500" size={20} />
                                    <span className="font-semibold text-slate-700">Academic Year-wise</span>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-3">
                                    <Layers className="text-pink-500" size={20} />
                                    <span className="font-semibold text-slate-700">Course & Branch-wise</span>
                                </div>
                            </div>
                        </section>

                        <section id="data" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">6</span>
                                Institutional Data Usage
                            </h2>
                            <p className="text-slate-600 leading-7">
                                The system utilizes existing institutional data (Colleges, Courses, Students). Fee collection is allowed <strong>only for valid students</strong> fetched from institutional records.
                            </p>
                        </section>

                        <section id="collection" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">7</span>
                                Fee Collection & Transactions
                            </h2>
                            <div className="prose prose-slate text-slate-600">
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Fee collection is performed on a <strong>student-wise basis</strong>.</li>
                                    <li>Every transaction is strictly linked to a specific student.</li>
                                    <li>Full payment history tracking with partial payment support.</li>
                                </ul>
                            </div>
                        </section>

                        <section id="access" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">9</span>
                                Role-Based Access Control
                            </h2>
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex gap-4">
                                <Shield className="text-blue-600 flex-shrink-0" size={24} />
                                <div>
                                    <h4 className="font-bold text-slate-900 mb-2">Secure Dashboard</h4>
                                    <p className="text-slate-600 text-sm">
                                        A single dashboard layout is used, but access varies by role. Users can only view and perform operations assigned to them.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="tech" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">12</span>
                                Data Storage Approach
                            </h2>
                            <p className="text-slate-600 mb-6">
                                The application follows a <strong>hybrid data management approach</strong>:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Database className="text-blue-600" />
                                        <h3 className="font-bold text-slate-900">SQL (Relational)</h3>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-3">Structured master-level data:</p>
                                    <ul className="text-sm font-medium text-slate-700 space-y-1">
                                        <li>• Colleges & Years</li>
                                        <li>• Courses & Branches</li>
                                        <li>• Student Profiles</li>
                                    </ul>
                                </div>

                                <div className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-green-400 hover:shadow-lg hover:shadow-green-50 transition-all">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Database className="text-green-600" />
                                        <h3 className="font-bold text-slate-900">MongoDB (NoSQL)</h3>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-3">Dynamic transactional data:</p>
                                    <ul className="text-sm font-medium text-slate-700 space-y-1">
                                        <li>• Fee Transactions</li>
                                        <li>• Payment Records</li>
                                        <li>• Collection History</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section className="pt-8 border-t border-gray-200">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Conclusion</h2>
                            <p className="text-slate-600 italic">
                                "This Fee Collection Web Application provides a structured, scalable, and user-friendly solution for managing institutional fees."
                            </p>
                        </section>

                    </div>
                </div>
            </div>

            <div className="h-20"></div>
        </div>
    );
};

export default Documentation;
