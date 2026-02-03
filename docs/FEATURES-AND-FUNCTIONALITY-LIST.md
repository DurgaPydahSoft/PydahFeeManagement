# Pydah Fees – Features & Functionality List

This document lists the **functionalities** of the application from a user/business perspective (not technical implementation). Use it for onboarding, stakeholder communication, or product overview.

---

## 1. Landing & Access

- **Public landing page** – Marketing/info page for the product with link to Staff Portal.
- **Documentation page** – Standalone docs view (route: `/docs`).
- **Login** – Staff sign-in with username and password to access the app.

---

## 2. Dashboard

- **Overview dashboard** – Summary of:
  - Today’s collection
  - Monthly collection
  - Total collection
  - Active students count

---

## 3. Fee Configuration

- **Fee heads** – Create, edit, and delete fee heads (e.g. Tuition, Lab, Transport) with name, code, description.
- **Fee structures** – Define fee amounts by college, course, branch, batch, year, and semester (yearly or semester-wise).
- **Applicability** – Assign fee structures to students (e.g. apply to a batch or view/apply for individual students).

---

## 4. Bulk Fee Upload

- **Bulk payment upload** – Upload a file (e.g. Excel) to record multiple fee payments in one go.
- **Bulk due upload** – Upload a file to add or update multiple students’ dues.
- **Download template** – Get a standard Excel template for bulk uploads.
- **Preview and save** – Preview uploaded rows, select which to save, then confirm and save.

---

## 5. Payment Configuration

- **Payment accounts** – Configure payment methods per college/course (e.g. bank name, account, IFSC, UPI, Razorpay).
- **Create / edit / delete** – Add, update, or remove payment configurations.
- **Enable / disable** – Toggle a payment config active or inactive without deleting it.

---

## 6. Reminder Configuration

- **SMS & email templates** – Create and manage templates for due reminders (SMS and email).
- **Send reminders** – Send due reminders to selected students (by filters or selection) using a chosen template (SMS or email).
- **Academic year list** – View available academic years for reminder targeting.
- **Scheduled reminders** – Set up rules so reminders are sent automatically (e.g. before start date, by course/year/semester) with configurable offsets and template choice.

---

## 7. Students

- **Student directory** – View list of students with filters (search, status, branch, course).
- **Student scope** – Super admin sees all students; other users can be limited to their college.

---

## 8. Fee Collection

- **Search student** – Find student by admission number (or similar) to collect fee.
- **View dues** – See student’s fee details and dues (by year/semester where applicable).
- **Collect payment** – Record payment with:
  - Fee head(s) and amount(s)
  - Payment mode (e.g. Cash, Bank)
  - Optional bank/payment config, instrument date, reference number, remarks
- **Receipt** – Generate and print receipt after collection.
- **Transaction history** – View past transactions for the student on the same screen.

---

## 9. Reports & Analytics

- **Transaction reports** – View and filter transaction data by:
  - **Daily** – Day-wise collection.
  - **Cashier** – Collection by cashier/staff.
  - **Fee head** – Collection by fee type.
  - **Mode** – Collection by payment mode (e.g. Cash, Card, UPI).
- **Export** – Export report data (e.g. Excel).
- **Print** – Print reports (e.g. daily summary, cashier report).

---

## 10. Due Reports

- **Due list** – View list of students with dues, filtered by college, course, branch, batch (or search).
- **Export** – Export due report (e.g. Excel).
- **Expand row** – See more detail per student (e.g. fee-wise breakdown) where supported.

---

## 11. Concessions

- **Request concession** – Staff or student can submit a concession request (fee head, amount, reason, optional document/image) for a student.
- **View requests** – List concession requests with filters (e.g. status, college, course, branch, batch, search).
- **Approve / reject** – Approve (with optional adjusted amount) or reject requests, with optional rejection reason.

---

## 12. Hostel Configuration

- **Hostels** – Create, edit, and delete hostels (name, description, active/inactive). Data is read from a separate MongoDB (hostel database).
- **Hostel categories** – For each hostel, create and manage categories (e.g. AC / Non-AC) with name, description, and status.
- **Rooms** – For each hostel and category, add rooms with 3-digit room number, bed count, meter type (single/dual), and status. List/filter rooms by hostel.

---

## 13. Transport Configuration

- **Routes** – Create, edit, and delete transport routes (name, code, description, status).
- **Stages** – For each route, define stages/stops (e.g. stage code, name, order, amount).
- **Allocation** – Assign a route (and stage) to a student for transport fee/billing.
- **View allocations** – See all transport allocations or look up by student.

---

## 14. Permissions (Special Permissions)

- **Grant permission** – Grant a special permission to a student (e.g. Principal approval, remarks, valid-until date).
- **List permissions** – View all such permissions (with search by student).

---

## 15. User Management

- **User list** – View all users (staff/cashiers etc.).
- **Create user** – Add new user (name, username, password, role, college).
- **Edit user** – Update user details.
- **Delete user** – Remove a user.
- **User permissions** – For each user, assign which app pages/features they can access (e.g. Dashboard, Fee Collection, Reports).

---

## 16. Permissions (Role-Based Menu)

- **Menu by role** – Super admin sees all menu items; other users see only the pages they are allowed (based on User Management permissions).
- **Permissions page** – Dedicated screen to manage “Permissions” (e.g. special student permissions or permission templates, depending on usage).

---

## Summary Table

| # | Feature area           | Main functionalities |
|---|------------------------|----------------------|
| 1 | Landing & access       | Landing page, docs, login |
| 2 | Dashboard              | Collection and student KPIs |
| 3 | Fee configuration      | Fee heads, structures, applicability |
| 4 | Bulk fee upload        | Bulk payment/due upload, template, preview & save |
| 5 | Payment configuration  | Payment accounts per college/course, enable/disable |
| 6 | Reminder configuration | SMS/email templates, send now, scheduled rules |
| 7 | Students               | Directory, search, filters, scope by college |
| 8 | Fee collection         | Search student, view dues, collect payment, receipt, history |
| 9 | Reports & analytics    | Daily/cashier/fee head/mode reports, export, print |
| 10| Due reports            | Due list by filters/search, export |
| 11| Concessions            | Request, list, approve/reject |
| 12| Hostel configuration   | Hostels, categories, rooms (separate MongoDB) |
| 13| Transport configuration| Routes, stages, student allocation |
| 14| Permissions (special)  | Grant/list special student permissions |
| 15| User management        | CRUD users, assign page-level permissions |
| 16| Role-based menu        | Sidebar/menu filtered by user permissions |

---

*Document generated from backend routes/controllers and frontend pages. Source of truth: backend `server.js` + `routes/*`, frontend `App.jsx` + `pages/*` and `Sidebar.jsx`.*
