/**
 * Build MongoDB createdAt filter aligned to IST (+05:30), matching dashboard stats.
 */
const buildReportDateFilter = (startDate, endDate) => {
    const filter = {};
    if (!startDate && !endDate) return filter;

    filter.createdAt = {};
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        start.setMinutes(start.getMinutes() - 330);
        filter.createdAt.$gte = start;
    }
    if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        end.setMinutes(end.getMinutes() - 330);
        filter.createdAt.$lte = end;
    }
    return filter;
};

module.exports = { buildReportDateFilter };
