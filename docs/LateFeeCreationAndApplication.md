# Late Fee Creation & Application

## Overview

Late fees are **penalty demands** applied when a student has **not paid enough** toward a **term-divided fee structure** by the configured due date. The system evaluates overdue terms daily (and on manual sync), then creates a `StudentFee` demand under a dedicated **Late Fee Head** — separate from the original fee head (e.g. Tuition).

Late fee **rules are stored on the fee structure itself** (`FeeStructure.terms`), not in the legacy `LateFeeConfig` collection (that model exists but is **not used** by the current apply job).

---

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **Fee Configuration UI** | Configure per-term late fee amount, due rules, and late fee head on an existing term-divided structure |
| **`FeeStructure` (MongoDB)** | Source of truth: `lateFeeHead`, `terms[].lateFeeAmount`, due date fields |
| **SQL `semesters` table** | Academic calendar dates for **Semester Offset** due mode |
| **`processLateFees`** | Core job: find overdue terms → check underpayment → create `StudentFee` |
| **`StudentFee` (MongoDB)** | Generated late fee demand shown in Fee Collection |
| **Scheduler (cron)** | Runs `processLateFees` daily at **3:00 AM IST** |

---

## Prerequisites

Before late fees can be configured or applied:

1. **Term-divided fee structure**  
   The base fee (e.g. Tuition) must have `isTermsDivided: true` with one or more terms (`termNumber`, `percentage`, `amount`).

2. **Late fee head selected**  
   A fee head must be chosen (e.g. "Late Fee" / `LF01`). Demands are created under this head — **not** under the original Tuition head.

3. **Per-term late fee amount**  
   At least one term must have `lateFeeAmount > 0`.

4. **Due date rule per term**  
   Each term with a late fee must have either:
   - **Semester Offset** — semester start date + offset days, or  
   - **Fixed Date** — an explicit calendar date.

5. **Academic calendar (offset mode only)**  
   SQL `semesters` rows must exist matching:
   - `courses.name` = structure course  
   - `semesters.batch` = admission year (first segment of structure batch, e.g. `2023` from `2023-2027`)  
   - `semesters.year_of_study` = structure `studentYear`  
   - `colleges.name` = structure college  
   - `semesters.college_id IS NOT NULL`

6. **Regular students only**  
   Apply job filters `student_status = 'regular'` (case-insensitive).

---

## Configuration (Fee Configuration → Late Fees)

### Tabs

| Tab | Purpose |
|-----|---------|
| **View** | Filter and list structures that already have late fee config; **Sync** / **Sync All** to apply now |
| **Create** | Filter structures → pick one → configure terms → save |

### Create flow

1. Filter by College, Course, Branch, Batch, Student Year, Category.
2. Select a **term-divided** fee structure from the list.
3. Choose **Late Fee Head** (fee heads whose name/code match “late fee”).
4. For each term, configure:

| Field | Description |
|-------|-------------|
| **Due Date Mode** | `offset` (Semester Offset) or `fixed` (Fixed Date) |
| **Reference Semester** | Sem 1 or Sem 2 — used only in offset mode |
| **Offset Days** | Days after semester start (offset mode) |
| **Fixed Due Date** | Explicit due date (fixed mode) |
| **Description** | Optional label stored in demand remarks |
| **Late Fee (₹)** | Penalty amount if term is overdue and underpaid |

5. **Save Configuration** → `PUT /api/fee-structures/:id` with updated `terms` and `lateFeeHead`.

### View flow

- Lists structures where `lateFeeHead` is set **or** any term has `lateFeeAmount > 0`.
- **Sync** (per row): `POST /api/late-fees/process` with `{ structureId }`.
- **Sync All**: same endpoint without `structureId` (processes all qualifying structures).

---

## Term Due Date Calculation

For each term with `lateFeeAmount > 0`, the job computes **effective due date**:

### Mode A — Semester Offset (`dueDateMode: 'offset'`)

```
dueDate = semesters.start_date (for referenceSemester)
        + dueOffsetDays
```

- `referenceSemester` defaults to structure `semester` or `1`.
- Semester row is matched from SQL using course, batch key, `year_of_study`, and college.

### Mode B — Fixed Date (`dueDateMode: 'fixed'`)

```
dueDate = terms.fixedDueDate
```

- Stored and compared as a local calendar date (no UTC shift).

### Overdue check

```
if (today > dueDate) → term is eligible for late fee evaluation
```

`today` is normalized to midnight (server local date at job run time; cron uses **Asia/Kolkata**).

---

## Application Process (`processLateFees`)

**Endpoint:** `POST /api/late-fees/process`  
**Optional body/query:** `{ structureId }` — limit to one structure.

### Step-by-step

```
1. Load FeeStructure documents where terms.lateFeeAmount > 0
   (optionally filtered by structureId)

2. For each structure:
   a. Skip if lateFeeHead is not configured
   b. Load matching semester calendar rows from SQL
   c. For each term with lateFeeAmount > 0:
      i.   Calculate dueDate (offset or fixed)
      ii.  Skip if not overdue (today <= dueDate)
      iii. Find students matching:
           college, course, branch, batch, current_year = studentYear,
           stud_type = category, student_status = regular
      iv.  For each student:
           - requiredAmount = sum of term.amount for terms 1..N (cumulative)
           - totalPaid = sum of DEBIT transactions on ORIGINAL feeHead
                         (same studentYear, semester as structure)
           - if totalPaid >= requiredAmount → skip (fully paid for cumulative terms)
           - else check duplicate late fee demand
           - if none → create StudentFee under lateFeeHead
```

### Cumulative term logic

Late fee for **Term 2** requires payment covering **Term 1 + Term 2** amounts.  
If the student paid only Term 1, they are still underpaid for Term 2 and may receive a Term 2 late fee once Term 2’s due date passes.

**Example** (Tuition split 50% / 50%, ₹50,000 total):

| Term | Amount | Due | Paid (cumulative) | Late fee applies? |
|------|--------|-----|-------------------|-------------------|
| T1 | ₹25,000 | Mar 1 | ₹0 | Yes after Mar 1 |
| T1 | ₹25,000 | Mar 1 | ₹25,000 | No |
| T2 | ₹25,000 | Aug 1 | ₹25,000 (T1 only) | Yes after Aug 1 |
| T2 | ₹25,000 | Aug 1 | ₹50,000 | No |

---

## Generated `StudentFee` Record

When a late fee is applied, a new demand is created:

| Field | Value |
|-------|--------|
| `studentId` | Admission number |
| `feeHead` | Structure’s `lateFeeHead` (not the original fee head) |
| `structureId` | Source fee structure `_id` |
| `termNumber` | Overdue term number |
| `amount` | `term.lateFeeAmount` |
| `studentYear` | From structure |
| `semester` | From structure |
| `academicYear` | Student’s `batch` |
| `remarks` | `Late Fee: {originalFeeHeadName} - Term {N} ({description})` |

**Example remarks:**  
`Late Fee: Tuition Fee - Term 1 (First installment)`

---

## Duplicate Prevention

A late fee is **not** created twice for the same student + term. The job checks:

1. **Primary:** `StudentFee` with same `studentId`, `feeHead` (late fee head), `structureId`, `termNumber`, `studentYear`, `semester`.
2. **Fallback:** Same `remarks` string (for older records without `termNumber`).

If a matching record exists, the student is skipped for that term.

---

## Triggers

| Trigger | When | How |
|---------|------|-----|
| **Daily cron** | Every day **3:00 AM IST** | `scheduler.js` → `processLateFees()` |
| **Manual Sync (one structure)** | Admin clicks Sync on View tab | `POST /api/late-fees/process { structureId }` |
| **Manual Sync All** | Admin clicks Sync All | `POST /api/late-fees/process` |

The cron runs alongside reminder processing in the same daily job.

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/late-fees/config` | Legacy `LateFeeConfig` list (not used by apply job) |
| `POST` | `/api/late-fees/config` | Legacy save (not used by apply job) |
| `DELETE` | `/api/late-fees/config/:id` | Legacy delete |
| `POST` | `/api/late-fees/process` | **Apply late fees** (all or one structure) |
| `PUT` | `/api/fee-structures/:id` | Save late fee config on structure |

All routes require JWT + `/fee-config` permission (via `/api/late-fees` prefix).

---

## Scenarios

### 1. Student fully paid before due date
- Term 1 due Mar 1; student paid ₹25,000 before Mar 1.  
- **Result:** No late fee.

### 2. Student unpaid after due date
- Term 1 due Mar 1; paid ₹0; late fee ₹500 configured.  
- **Result:** After Mar 1 (on next cron or manual sync), `StudentFee` created for ₹500 under late fee head.

### 3. Partial payment (cumulative underpaid)
- T1 ₹25k + T2 ₹25k; student paid ₹25k total after T2 due date.  
- **Result:** Late fee for Term 2 (if configured), because cumulative required = ₹50k.

### 4. Late fee already applied
- Same student, same structure, same term — demand exists.  
- **Result:** Skipped; no duplicate.

### 5. Structure missing late fee head
- Terms have `lateFeeAmount` but `lateFeeHead` is empty.  
- **Result:** Structure skipped; counted in `skippedWithoutLateFeeHead` response.

### 6. Offset mode — no calendar row
- Reference semester not found in SQL `semesters`.  
- **Result:** That term’s due date cannot be calculated; term skipped.

### 7. Fixed due date mode
- Admin sets fixed due date `2026-04-15` for Term 1.  
- **Result:** Overdue check uses that date directly; no SQL calendar lookup needed.

### 8. Non-regular student
- `student_status` = discontinued / cancelled.  
- **Result:** Excluded from late fee generation.

### 9. Category mismatch
- Structure category = `Regular`; student `stud_type` = `Management`.  
- **Result:** Student not in apply query; no late fee.

### 10. Manual sync for testing
- Admin configures one Tuition structure, clicks **Sync** on View tab.  
- **Result:** Only that structure processed; response shows `generated` count and per-student results.

---

## Payment & Fee Collection

Once created, late fee demands behave like any other fee:

1. Appear in **Fee Dues Breakdown** under the configured late fee head.
2. Can be selected and paid in Fee Collection.
3. Payments create `Transaction` records against the **late fee head** (separate from original Tuition payments).
4. Receipts include the late fee line item.

---

## What the system does NOT do

- Does **not** auto-deduct or adjust the original Tuition demand.
- Does **not** use the legacy `LateFeeConfig` model for applying fees.
- Does **not** apply late fees to non-regular students.
- Does **not** remove or reverse late fees if the student pays the original fee later (demands remain unless manually handled).
- Does **not** recalculate or update an existing late fee amount if config changes — only creates if missing.

---

## Key Files

| File | Role |
|------|------|
| `backend/controllers/lateFeeController.js` | Config CRUD + `processLateFees` |
| `backend/models/FeeStructure.js` | `lateFeeHead`, `terms[]` schema |
| `backend/models/StudentFee.js` | Generated demands (`termNumber` field) |
| `backend/services/scheduler.js` | Daily 3:00 AM IST cron |
| `backend/routes/lateFeeRoutes.js` | API routes |
| `frontend/src/pages/FeeConfiguration.jsx` | Late Fees Create / View UI |

---

## End-to-end flow (diagram)

```
[Admin configures late fees on FeeStructure]
           │
           ▼
[Save → FeeStructure.terms + lateFeeHead]
           │
           ├──────────────────────┐
           ▼                      ▼
   [Daily 3:00 AM IST]    [Manual Sync / Sync All]
           │                      │
           └──────────┬───────────┘
                      ▼
            [processLateFees]
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   [Find overdue] [Check paid] [Skip duplicates]
         │            │            │
         └────────────┴────────────┘
                      ▼
         [Create StudentFee under lateFeeHead]
                      ▼
         [Visible in Fee Collection → collect payment]
```
