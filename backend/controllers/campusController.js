const campusService = require('../services/campusService');
const collegeScope = require('../utils/collegeScope');

const getCampuses = async (req, res) => {
    try {
        const allCampuses = await campusService.getAllCampuses();
        const userCollegeNames = await collegeScope.getUserCollegeNames(req.user);

        if (userCollegeNames === null) {
            return res.json(allCampuses);
        }

        const allowed = new Set(userCollegeNames);
        const filtered = allCampuses
            .map((campus) => ({
                ...campus,
                colleges: campus.colleges.filter((c) => allowed.has(c.name)),
                college_ids: campus.colleges
                    .filter((c) => allowed.has(c.name))
                    .map((c) => c.id),
            }))
            .filter((campus) => campus.colleges.length > 0);

        res.json(filtered);
    } catch (error) {
        console.error('Error fetching campuses:', error);
        res.status(500).json({ message: 'Failed to fetch campuses' });
    }
};

const getCampusColleges = async (req, res) => {
    try {
        const campus = await campusService.getCampusById(req.params.id);
        if (!campus) {
            return res.status(404).json({ message: 'Campus not found' });
        }

        const userCollegeNames = await collegeScope.getUserCollegeNames(req.user);
        if (userCollegeNames === null) {
            return res.json(campus.colleges);
        }

        const allowed = new Set(userCollegeNames);
        res.json(campus.colleges.filter((c) => allowed.has(c.name)));
    } catch (error) {
        console.error('Error fetching campus colleges:', error);
        res.status(500).json({ message: 'Failed to fetch campus colleges' });
    }
};

module.exports = { getCampuses, getCampusColleges };
