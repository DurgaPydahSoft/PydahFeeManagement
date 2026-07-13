const db = require('../config/sqlDb');

const parseCollegeIds = (collegeIds) => {
    if (!collegeIds) return [];
    if (Array.isArray(collegeIds)) return collegeIds.map(Number).filter(Boolean);
    if (typeof collegeIds === 'string') {
        try {
            const parsed = JSON.parse(collegeIds);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const resolveCollegesByIds = async (collegeIds) => {
    const ids = parseCollegeIds(collegeIds);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT id, name, code FROM colleges WHERE id IN (${placeholders}) AND is_active = 1 ORDER BY name`,
        ids
    );
    return rows;
};

const getAllCampuses = async () => {
    const [rows] = await db.query(
        'SELECT id, name, code, description, college_ids, is_active FROM campuses WHERE is_active = 1 ORDER BY name'
    );
    const campuses = [];
    for (const row of rows) {
        const colleges = await resolveCollegesByIds(row.college_ids);
        campuses.push({
            id: row.id,
            name: row.name,
            code: row.code,
            description: row.description,
            college_ids: parseCollegeIds(row.college_ids),
            colleges,
        });
    }
    return campuses;
};

const getCampusById = async (campusId) => {
    const [rows] = await db.query(
        'SELECT id, name, code, description, college_ids, is_active FROM campuses WHERE id = ? AND is_active = 1',
        [campusId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const colleges = await resolveCollegesByIds(row.college_ids);
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
        college_ids: parseCollegeIds(row.college_ids),
        colleges,
    };
};

const getCollegeNamesByCampusId = async (campusId) => {
    const campus = await getCampusById(campusId);
    if (!campus) return [];
    return campus.colleges.map((c) => c.name);
};

const getCollegesForCampusIds = async (campusIds = []) => {
    const names = new Set();
    const normalized = (campusIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0);
    for (const id of normalized) {
        const campusNames = await getCollegeNamesByCampusId(id);
        campusNames.forEach((n) => names.add(n));
    }
    return Array.from(names);
};

const getCollegeNamesByCampusIds = getCollegesForCampusIds;

module.exports = {
    parseCollegeIds,
    resolveCollegesByIds,
    getAllCampuses,
    getCampusById,
    getCollegeNamesByCampusId,
    getCollegesForCampusIds,
    getCollegeNamesByCampusIds,
};
