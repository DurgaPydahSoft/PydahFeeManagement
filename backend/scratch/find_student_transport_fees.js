const mongoose = require('mongoose');

// Connection URIs
const MONGO_URI = "mongodb+srv://durgaprasad:durga2144@cluster0.i5iew6d.mongodb.net/fee-management";
const MONGO_TRANSPORT_URI = "mongodb+srv://durgaprasad:durga2144@cluster0.i5iew6d.mongodb.net/pydah_transport";

const studentDetails = {
  name: "PANDIRI KUMARASWAMY",
  adm: "20240018",
  pin: "24320-CM-044"
};

async function run() {
  console.log("==================================================");
  console.log(`Starting query for student: ${studentDetails.name}`);
  console.log(`Admission No: ${studentDetails.adm} | PIN: ${studentDetails.pin}`);
  console.log("==================================================");

  // 1. Connect to Transport DB
  console.log("\n[1/3] Connecting to Transport DB...");
  const transportConn = await mongoose.createConnection(MONGO_TRANSPORT_URI).asPromise();
  console.log("Connected.");

  const variants = [
    studentDetails.adm,
    studentDetails.adm.trim(),
    studentDetails.pin,
    studentDetails.pin.trim(),
    studentDetails.pin.toUpperCase(),
    studentDetails.pin.toLowerCase()
  ].filter(Boolean);

  console.log(`Searching transport_requests collection with variants: ${JSON.stringify(variants)}`);
  
  const transportRequests = await transportConn.db.collection('transport_requests').find({
    $or: [
      { admission_number: { $in: variants } },
      { admissionNumber: { $in: variants } },
      { pinNo: { $in: variants } },
      { pin_number: { $in: variants } },
      { student_name: { $regex: new RegExp(studentDetails.name, 'i') } }
    ]
  }).toArray();

  if (transportRequests.length === 0) {
    console.log("❌ No transport requests found in Transport DB.");
  } else {
    console.log(`\n✅ Found ${transportRequests.length} transport request(s):`);
    transportRequests.forEach((req, idx) => {
      console.log(`\n--- Request #${idx + 1} ---`);
      console.log(`  ID: ${req._id}`);
      console.log(`  Admission No: ${req.admission_number || req.admissionNumber}`);
      console.log(`  Student Name: ${req.student_name || req.studentName}`);
      console.log(`  Academic Year: ${req.academic_year || req.academicYear}`);
      console.log(`  Fare: ${req.fare || req.amount}`);
      console.log(`  Route: ${req.route_name || req.routeName}`);
      console.log(`  Stage: ${req.stage_name || req.stageName}`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Updated At: ${req.updated_at || req.updatedAt || req.createdAt}`);
    });
  }

  // 2. Connect to main Fee-Management DB
  console.log("\n[2/3] Connecting to Main Fee-Management DB...");
  const mainConn = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log("Connected.");

  // Define FeeHead and StudentFee inline models
  const FeeHeadSchema = new mongoose.Schema({ name: String, code: String });
  const FeeHead = mainConn.model('FeeHead', FeeHeadSchema, 'feeheads');

  const StudentFeeSchema = new mongoose.Schema({
    studentId: String,
    studentName: String,
    feeHead: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeHead' },
    academicYear: String,
    studentYear: String,
    semester: Number,
    amount: Number,
    remarks: String
  });
  const StudentFee = mainConn.model('StudentFee', StudentFeeSchema, 'studentfees');

  const transportHead = await FeeHead.findOne({
    $or: [
      { name: 'Transport Fee' },
      { code: { $in: ['TRN', 'TRN01'] } }
    ]
  }).lean();

  if (!transportHead) {
    console.log("⚠️ Could not find a Transport Fee head in Main DB.");
  } else {
    console.log(`🔍 Found Transport Fee Head ID: ${transportHead._id} (Code: ${transportHead.code})`);
    
    const syncedFees = await StudentFee.find({
      studentId: studentDetails.adm,
      feeHead: transportHead._id
    }).populate('feeHead').lean();

    if (syncedFees.length === 0) {
      console.log(`❌ No synced transport demands found for studentId: ${studentDetails.adm}`);
    } else {
      console.log(`✅ Found ${syncedFees.length} synced student fee demand(s):`);
      syncedFees.forEach((fee, idx) => {
        console.log(`\n--- Fee Demand #${idx + 1} ---`);
        console.log(`  ID: ${fee._id}`);
        console.log(`  Academic Year: ${fee.academicYear}`);
        console.log(`  Student Year: ${fee.studentYear}`);
        console.log(`  Semester: ${fee.semester}`);
        console.log(`  Amount: ${fee.amount}`);
        console.log(`  Remarks: ${fee.remarks}`);
      });
    }
  }

  // Close connections
  console.log("\n[3/3] Closing DB connections...");
  await transportConn.close();
  await mainConn.close();
  console.log("Done.");
}

run().catch(console.error);
