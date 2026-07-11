import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import api from '../lib/api';
import { printHtmlDocument } from '../utils/printService';

const FeeConfigPrintButton = ({ variant, data, label = 'Print', disabled = false }) => {
    const [loading, setLoading] = useState(false);

    const handlePrint = async () => {
        try {
            setLoading(true);
            const response = await api.post('/print', {
                template: 'fee-configuration-report',
                data: { variant, ...data },
            });
            printHtmlDocument(response.data);
        } catch (err) {
            console.error('Print failed:', err);
            alert('Failed to generate print document');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePrint}
            disabled={disabled || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Printer size={14} />
            {loading ? 'Printing...' : label}
        </button>
    );
};

export default FeeConfigPrintButton;
