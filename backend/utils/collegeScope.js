const db = require('../config/sqlDb');
const campusService = require('../services/campusService');

const isUnscopedAdmin = (user) =>
    user?.role === 'superadmin' || user?.role === 'admin';

const normalizeCampusIds = (campusIds = []) =>
    (campusIds || [])
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id) && id > 0);

/**
 * Resolve college names the current request should be limited to.
 * Returns null = no restriction (all colleges).
 * Returns [] = no access.
 */
const getEffectiveCollegeNames = async (user, campusIdParam) => {
    const userColleges = await getUserCollegeNames(user);

    if (campusIdParam && campusIdParam !== 'all' && campusIdParam !== '') {
        const campusColleges = await campusService.getCollegeNamesByCampusId(Number(campusIdParam));
        if (userColleges === null) return campusColleges;
        if (userColleges.length === 0) return [];
        return campusColleges.filter((c) => userColleges.includes(c));
    }

    return userColleges;
};

const getUserCollegeNames = async (user) => {
    if (!user) return null;

    const campusIds = normalizeCampusIds(user.campuses);
    let fromCampuses = [];
    if (campusIds.length > 0) {
        fromCampuses = await campusService.getCollegesForCampusIds(campusIds);
    }

    const explicitColleges = user.colleges?.length > 0
        ? user.colleges
        : (user.college ? [user.college] : []);

    if (fromCampuses.length > 0 && explicitColleges.length > 0) {
        const scoped = fromCampuses.filter((c) => explicitColleges.includes(c));
        return scoped.length > 0 ? scoped : fromCampuses;
    }
    if (fromCampuses.length > 0) return fromCampuses;
    if (explicitColleges.length > 0) return explicitColleges;

    // Superadmin/admin with no campus/college assignment → all colleges
    if (isUnscopedAdmin(user) && campusIds.length === 0 && explicitColleges.length === 0) {
        return null;
    }

    return null;
};

const getStudentIdentifiersByColleges = async (collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return [];
    const [rows] = await db.query(
        `SELECT admission_number, pin_no FROM students WHERE TRIM(college) IN (${collegeNames.map(() => '?').join(',')})`,
        collegeNames.map((c) => c.trim())
    );
    const ids = new Set();
    rows.forEach((r) => {
        if (r.admission_number) ids.add(String(r.admission_number).trim());
        if (r.pin_no) ids.add(String(r.pin_no).trim());
    });
    return Array.from(ids);
};

const getStudentAdmissionNumbersByColleges = getStudentIdentifiersByColleges;

const applyStudentIdFilter = async (user, campusIdParam, existingQuery = {}) => {
    const collegeNames = await getEffectiveCollegeNames(user, campusIdParam);
    if (collegeNames === null) return existingQuery;

    const studentIds = await getStudentIdentifiersByColleges(collegeNames);
    if (studentIds.length === 0) {
        return { ...existingQuery, studentId: { $in: ['__none__'] } };
    }
    return { ...existingQuery, studentId: { $in: studentIds } };
};

const applyCollegeFilter = async (user, campusIdParam, existingQuery = {}) => {
    const collegeNames = await getEffectiveCollegeNames(user, campusIdParam);
    if (collegeNames === null) return existingQuery;
    return { ...existingQuery, college: { $in: collegeNames } };
};

const filterHierarchyByColleges = (hierarchy, collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return hierarchy;
    const filtered = {};
    collegeNames.forEach((name) => {
        if (hierarchy[name]) filtered[name] = hierarchy[name];
    });
    return filtered;
};

const filterCollegeCodes = (collegeCodes, collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return collegeCodes;
    const filtered = {};
    collegeNames.forEach((name) => {
        if (collegeCodes[name]) filtered[name] = collegeCodes[name];
    });
    return filtered;
};

const buildCollegeSqlFilter = (collegeNames, column = 'college') => {
    if (!collegeNames || collegeNames.length === 0) {
        return { clause: '', params: [] };
    }
    return {
        clause: ` AND TRIM(${column}) IN (${collegeNames.map(() => '?').join(',')})`,
        params: collegeNames.map((c) => c.trim()),
    };
};

const intersectCollegeNames = (requestedColleges, allowedColleges) => {
    if (!allowedColleges) return requestedColleges;
    if (!requestedColleges || requestedColleges.length === 0) return allowedColleges;
    return requestedColleges.filter((c) => allowedColleges.includes(c));
};

const isCollegeAllowed = (collegeName, allowedColleges) => {
    if (!allowedColleges || allowedColleges.length === 0) return true;
    if (!collegeName) return false;
    return allowedColleges.includes(String(collegeName).trim());
};

module.exports = {
    getEffectiveCollegeNames,
    getUserCollegeNames,
    getStudentIdentifiersByColleges,
    getStudentAdmissionNumbersByColleges,
    applyStudentIdFilter,
    applyCollegeFilter,
    filterHierarchyByColleges,
    filterCollegeCodes,
    buildCollegeSqlFilter,
    intersectCollegeNames,
    isCollegeAllowed,
    normalizeCampusIds,
    isUnscopedAdmin,
};
