import { useState, useEffect } from 'react';
import api from '../lib/api';

/**
 * Load campuses available to the current user.
 */
export const useCampuses = () => {
    const [campuses, setCampuses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCampuses = async () => {
            try {
                const res = await api.get('/campuses');
                setCampuses(res.data || []);
            } catch (err) {
                console.error('Error fetching campuses', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCampuses();
    }, []);

    return { campuses, loading };
};

export const getCollegeNamesForCampuses = (campuses, selectedCampusIds = []) => {
    const names = new Set();
    selectedCampusIds.forEach((campusId) => {
        const campus = campuses.find((c) => c.id === campusId);
        campus?.colleges?.forEach((col) => names.add(col.name));
    });
    return Array.from(names);
};

export const getCampusLabel = (campuses, campusId) => {
    const campus = campuses.find((c) => c.id === Number(campusId));
    return campus ? `${campus.name} (${campus.code})` : 'All Campuses';
};
