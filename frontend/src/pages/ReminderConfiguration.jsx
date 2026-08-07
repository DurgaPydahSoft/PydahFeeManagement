import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Bell } from 'lucide-react';

import ReminderTemplates from './ReminderConfiguration/ReminderTemplates';
import SendReminders from './ReminderConfiguration/SendReminders';
import ReminderRules from './ReminderConfiguration/ReminderRules';
import ReminderSetupGuide from './ReminderConfiguration/ReminderSetupGuide';

const VALID_HASHES = ['templates', 'send', 'rules', 'guide'];

const getHashValue = (hash) => {
    const cleaned = (hash || '').replace('#', '');
    return VALID_HASHES.includes(cleaned) ? cleaned : 'templates';
};

const ReminderConfiguration = () => {
    const location = useLocation();
    const activeTab = getHashValue(location.hash);

    const [templates, setTemplates] = useState([]);
    const [metadata, setMetadata] = useState({});
    const [colleges, setColleges] = useState([]);
    const [batches, setBatches] = useState([]);
    const [quotaOptions, setQuotaOptions] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [variableSources, setVariableSources] = useState([]);

    useEffect(() => {
        fetchTemplates();
        fetchMetadata();
        fetchAcademicYears();
        fetchVariableSources();
    }, []);

    const fetchVariableSources = async () => {
        try {
            const res = await api.get(`/reminders/variable-sources`);
            setVariableSources(res.data || []);
        } catch (error) {
            console.error('Error fetching variable sources:', error);
        }
    };

    const fetchAcademicYears = async () => {
        try {
            const res = await api.get(`/academic-calendar/academic-years`);
            setAcademicYears(res.data || []);
        } catch (error) {
            console.error('Error fetching academic years:', error);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get(`/reminders/templates`);
            setTemplates(res.data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const response = await api.get(`/students/metadata`);
            const meta = response.data.hierarchy || response.data;
            const batchList = response.data.batches || [];
            setMetadata(meta);
            setBatches(batchList);
            setColleges(Object.keys(meta));
            setQuotaOptions(response.data.categories || []);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="p-6 pb-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Bell className="text-gray-800" size={24} /> Reminder System
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 font-medium">Configure templates and send automated notifications.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-6 pt-2 min-h-0">
                    {activeTab === 'templates' && (
                        <ReminderTemplates
                            templates={templates}
                            fetchTemplates={fetchTemplates}
                            variableSources={variableSources}
                        />
                    )}

                    {activeTab === 'send' && (
                        <SendReminders
                            templates={templates}
                            metadata={metadata}
                            colleges={colleges}
                            uniqueAcademicYears={academicYears}
                            batches={batches}
                        />
                    )}

                    {activeTab === 'rules' && (
                        <ReminderRules
                            templates={templates}
                            colleges={colleges}
                            metadata={metadata}
                            academicYears={academicYears}
                            quotaOptions={quotaOptions}
                        />
                    )}

                    {activeTab === 'guide' && (
                        <ReminderSetupGuide />
                    )}
                </main>
            </div>
        </div>
    );
};

export default ReminderConfiguration;
