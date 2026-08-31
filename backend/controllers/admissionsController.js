const admissionsDb = require('../config/admissionsDb');

const validJsonObject = (column) =>
    `COALESCE(CASE WHEN JSON_VALID(${column}) THEN ${column} ELSE JSON_OBJECT() END, JSON_OBJECT())`;

let hiddenTableExistsCache = null;

const referencePickerHiddenExists = async () => {
    if (hiddenTableExistsCache !== null) return hiddenTableExistsCache;
    try {
        const [rows] = await admissionsDb.query(
            `SELECT 1 AS ok
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'reference_picker_hidden'
             LIMIT 1`
        );
        hiddenTableExistsCache = rows.length > 0;
    } catch {
        hiddenTableExistsCache = false;
    }
    return hiddenTableExistsCache;
};

// @desc    Distinct reference names used on admissions / joinings / leads
// @route   GET /api/admissions/reference-names
// @access  Protected
const getReferenceNames = async (req, res) => {
    try {
        if (!admissionsDb?.isConfigured) {
            return res.status(503).json({
                success: false,
                message: 'Admissions database is not configured'
            });
        }

        const hasHiddenTable = await referencePickerHiddenExists();
        const hiddenClause = hasHiddenTable
            ? `AND LOWER(TRIM(name)) NOT IN (
                    SELECT name_normalized FROM reference_picker_hidden
               )`
            : '';

        const sql = `
            SELECT DISTINCT TRIM(name) AS name
            FROM (
                SELECT JSON_UNQUOTE(JSON_EXTRACT(${validJsonObject('lead_data')}, '$.reference1')) AS name
                FROM admissions
                UNION
                SELECT JSON_UNQUOTE(JSON_EXTRACT(${validJsonObject('lead_data')}, '$.reference1')) AS name
                FROM joinings
                UNION
                SELECT JSON_UNQUOTE(JSON_EXTRACT(${validJsonObject('lead_data')}, '$.referenceName')) AS name
                FROM joinings
                UNION
                SELECT JSON_UNQUOTE(JSON_EXTRACT(${validJsonObject('dynamic_fields')}, '$.reference1')) AS name
                FROM leads
            ) refs
            WHERE name IS NOT NULL AND TRIM(name) != ''
            ${hiddenClause}
            ORDER BY name ASC
            LIMIT 500
        `;

        const [rows] = await admissionsDb.query(sql);
        const names = rows
            .map((row) => String(row.name || '').trim())
            .filter(Boolean);

        res.json({
            success: true,
            data: { names }
        });
    } catch (error) {
        console.error('Error fetching reference names:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

module.exports = { getReferenceNames };
