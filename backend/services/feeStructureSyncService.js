const FeeStructure = require('../models/FeeStructure');
const db = require('../config/sqlDb');

const syncFeeStructureNamesWithSql = async () => {
  try {
    console.log("[Startup Name Sync] Verifying MongoDB FeeStructure names against SQL masters...");
    // 1. Fetch reference maps from MySQL
    const [colleges] = await db.query("SELECT id, name FROM colleges");
    const [courses] = await db.query("SELECT id, name FROM courses");
    const [branches] = await db.query("SELECT id, name FROM course_branches");

    const collegeMap = {};
    colleges.forEach(c => collegeMap[c.id] = c.name);
    
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c.name);
    
    const branchMap = {};
    branches.forEach(b => branchMap[b.id] = b.name);

    // 2. Fetch all MongoDB fee structures with IDs populated
    const structures = await FeeStructure.find({
      collegeId: { $ne: null },
      courseId: { $ne: null },
      branchId: { $ne: null }
    });

    let updatedCount = 0;
    for (const fs of structures) {
      let changed = false;
      const dbCollegeName = collegeMap[fs.collegeId];
      const dbCourseName = courseMap[fs.courseId];
      const dbBranchName = branchMap[fs.branchId];

      if (dbCollegeName && fs.college !== dbCollegeName) {
        console.log(`[Startup Name Sync] College renamed for ID ${fs.collegeId}: "${fs.college}" -> "${dbCollegeName}"`);
        fs.college = dbCollegeName;
        changed = true;
      }
      if (dbCourseName && fs.course !== dbCourseName) {
        console.log(`[Startup Name Sync] Course renamed for ID ${fs.courseId}: "${fs.course}" -> "${dbCourseName}"`);
        fs.course = dbCourseName;
        changed = true;
      }
      if (dbBranchName && fs.branch !== dbBranchName) {
        console.log(`[Startup Name Sync] Branch renamed for ID ${fs.branchId}: "${fs.branch}" -> "${dbBranchName}"`);
        fs.branch = dbBranchName;
        changed = true;
      }

      if (changed) {
        await fs.save();
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`[Startup Name Sync] Successfully updated ${updatedCount} MongoDB FeeStructure documents.`);
    } else {
      console.log("[Startup Name Sync] All MongoDB FeeStructure names match SQL master definitions.");
    }
  } catch (err) {
    console.error("[Startup Name Sync] Error syncing names:", err);
  }
};

module.exports = {
  syncFeeStructureNamesWithSql
};
