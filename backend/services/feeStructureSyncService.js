const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
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

    // Phase 0: Resolve missing collegeId, courseId, branchId for existing FeeStructure documents
    const allStructures = await FeeStructure.find({});
    const nameToIdMap = {};
    allStructures.forEach(fs => {
      if (fs.collegeId && fs.courseId && fs.branchId) {
        const key = `${fs.college.trim()}|${fs.course.trim()}|${fs.branch.trim()}`;
        nameToIdMap[key] = {
          collegeId: fs.collegeId,
          courseId: fs.courseId,
          branchId: fs.branchId
        };
      }
    });

    for (const fs of allStructures) {
      if (!fs.collegeId || !fs.courseId || !fs.branchId) {
        const key = `${fs.college.trim()}|${fs.course.trim()}|${fs.branch.trim()}`;
        let ids = nameToIdMap[key];
        if (!ids) {
          // Fallback 1: Query SQL by name
          try {
            const [colRows] = await db.query('SELECT id FROM colleges WHERE name = ?', [fs.college]);
            if (colRows.length > 0) {
              const colId = colRows[0].id;
              const [crsRows] = await db.query('SELECT id FROM courses WHERE name = ? AND college_id = ?', [fs.course, colId]);
              if (crsRows.length > 0) {
                const crsId = crsRows[0].id;
                const [brRows] = await db.query('SELECT id FROM course_branches WHERE name = ? AND course_id = ?', [fs.branch, crsId]);
                if (brRows.length > 0) {
                  ids = { collegeId: colId, courseId: crsId, branchId: brRows[0].id };
                  nameToIdMap[key] = ids; // cache
                }
              }
            }
          } catch (sqlErr) {
            console.error('[Startup Name Sync] Error resolving fallback IDs from SQL:', sqlErr);
          }
        }

        if (!ids) {
          // Fallback 2: Try to resolve IDs via existing StudentFee records and SQL student lookup
          try {
            const sampleFee = await StudentFee.findOne({
              college: fs.college,
              course: fs.course,
              branch: fs.branch
            });

            if (sampleFee && sampleFee.studentId) {
              const [sqlStuds] = await db.query(
                'SELECT college_id, course_id, branch_id FROM students WHERE admission_number = ?',
                [sampleFee.studentId]
              );
              if (sqlStuds.length > 0 && sqlStuds[0].branch_id) {
                ids = {
                  collegeId: sqlStuds[0].college_id,
                  courseId: sqlStuds[0].course_id,
                  branchId: sqlStuds[0].branch_id
                };
                nameToIdMap[key] = ids; // cache it
                console.log(`[Startup Name Sync] Resolved branchId ${ids.branchId} for "${fs.branch}" via student fee link (student: ${sampleFee.studentId})`);
              }
            }
          } catch (studentErr) {
            console.error('[Startup Name Sync] Error resolving IDs via StudentFee fallback:', studentErr);
          }
        }
        
        if (ids) {
          fs.collegeId = ids.collegeId;
          fs.courseId = ids.courseId;
          fs.branchId = ids.branchId;
          await fs.save();
          console.log(`[Startup Name Sync] Resolved missing IDs for structure ${fs._id} (${fs.branch})`);
        }
      }
    }

    // Now reload structures that have IDs populated
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

      const oldCollege = fs.college;
      const oldCourse = fs.course;
      const oldBranch = fs.branch;

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
        // Check if there is already a FeeStructure with the new name combination to avoid duplicate key validation error
        const duplicate = await FeeStructure.findOne({
          feeHead: fs.feeHead,
          college: fs.college,
          course: fs.course,
          branch: fs.branch,
          batch: fs.batch,
          category: fs.category,
          studentYear: fs.studentYear,
          semester: fs.semester ?? null
        });

        if (duplicate) {
          console.log(`[Startup Name Sync] Duplicate fee structure found for "${fs.branch}". Merging existing StudentFees and removing duplicate template...`);
          // Update all StudentFee records referencing the old structure ID to point to the duplicate structure ID
          await StudentFee.updateMany(
            { structureId: fs._id },
            { 
              $set: { 
                structureId: duplicate._id,
                college: fs.college,
                course: fs.course,
                branch: fs.branch
              } 
            }
          );
          // Delete the old duplicate structure
          await FeeStructure.deleteOne({ _id: fs._id });
        } else {
          await fs.save();
          // Update corresponding StudentFee records pointing to this structure
          await StudentFee.updateMany(
            { structureId: fs._id },
            { 
              $set: { 
                college: fs.college,
                course: fs.course,
                branch: fs.branch
              } 
            }
          );
        }

        // Also update any remaining StudentFee records matching the old names that don't have structureId
        await StudentFee.updateMany(
          { college: oldCollege, course: oldCourse, branch: oldBranch },
          {
            $set: {
              college: fs.college,
              course: fs.course,
              branch: fs.branch
            }
          }
        );

        updatedCount++;
      }
    }
    
    // Phase 2: Historical/Catch-up sync for StudentFee records pointing to templates
    console.log("[Startup Name Sync] Running catch-up sync for existing student fee snapshots...");
    const latestStructures = await FeeStructure.find({});
    const ops = [];
    for (const fs of latestStructures) {
      ops.push({
        updateMany: {
          filter: {
            structureId: fs._id,
            $or: [
              { college: { $ne: fs.college } },
              { course: { $ne: fs.course } },
              { branch: { $ne: fs.branch } }
            ]
          },
          update: {
            $set: {
              college: fs.college,
              course: fs.course,
              branch: fs.branch
            }
          }
        }
      });
    }

    let studentFeesUpdated = 0;
    if (ops.length > 0) {
      const bulkRes = await StudentFee.bulkWrite(ops, { ordered: false });
      studentFeesUpdated = bulkRes.modifiedCount || 0;
    }

    if (studentFeesUpdated > 0) {
      console.log(`[Startup Name Sync] Cleaned up ${studentFeesUpdated} historically mismatched StudentFee records.`);
    }

    // Phase 3: Clean up any stale branch names in StudentFee records (for records without structureId)
    try {
      const activeBranchNames = new Set(branches.map(b => String(b.name || '').trim().toLowerCase()));
      const mongoBranches = await StudentFee.distinct("branch");
      const staleBranches = mongoBranches.filter(b => b && !activeBranchNames.has(String(b).trim().toLowerCase()));

      if (staleBranches.length > 0) {
        console.log(`[Startup Name Sync] Found stale branch names in StudentFees: ${staleBranches.join(', ')}. Syncing student records...`);
        let staleFeesUpdated = 0;
        for (const staleBranch of staleBranches) {
          const mismatchedFees = await StudentFee.find({ branch: staleBranch });
          for (const fee of mismatchedFees) {
            const [sqlStuds] = await db.query(
              "SELECT college, course, branch FROM students WHERE admission_number = ?",
              [fee.studentId]
            );
            if (sqlStuds.length > 0) {
              const s = sqlStuds[0];
              if (fee.college !== s.college || fee.course !== s.course || fee.branch !== s.branch) {
                fee.college = s.college;
                fee.course = s.course;
                fee.branch = s.branch;
                await fee.save();
                staleFeesUpdated++;
              }
            }
          }
        }
        if (staleFeesUpdated > 0) {
          console.log(`[Startup Name Sync] Successfully updated ${staleFeesUpdated} student fee records with renamed branch names.`);
        }
      }
    } catch (staleErr) {
      console.error("[Startup Name Sync] Error syncing stale student fee branch names:", staleErr);
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
