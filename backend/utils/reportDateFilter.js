/**
 * Build IST (+05:30) day bounds for report date filtering.
 */
const buildIstDayBounds = (startDate, endDate) => {
    const bounds = {};
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        start.setMinutes(start.getMinutes() - 330);
        bounds.$gte = start;
    }
    if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        end.setMinutes(end.getMinutes() - 330);
        bounds.$lte = end;
    }
    return bounds;
};

/**
 * Match clause: prefer paymentDate, fallback to createdAt for legacy rows.
 * Safe to spread into find()/aggregate $match.
 */
const buildCollectionDateMatch = (startDate, endDate) => {
    if (!startDate && !endDate) return {};
    const range = buildIstDayBounds(startDate, endDate);
    return {
        $or: [
            { paymentDate: range },
            { paymentDate: { $exists: false }, createdAt: range },
            { paymentDate: null, createdAt: range }
        ]
    };
};

/**
 * Build MongoDB date filter for collection/transaction date.
 */
const buildReportDateFilter = (startDate, endDate) => buildCollectionDateMatch(startDate, endDate);

/**
 * Apply collection-date filter onto a Mongo match stage.
 */
const applyReportDateToMatch = (matchStage, startDate, endDate) => {
    const clause = buildCollectionDateMatch(startDate, endDate);
    if (!clause.$or) return matchStage;
    if (!matchStage.$and) matchStage.$and = [];
    matchStage.$and.push(clause);
    return matchStage;
};

module.exports = {
    buildReportDateFilter,
    applyReportDateToMatch,
    buildIstDayBounds,
    buildCollectionDateMatch
};
