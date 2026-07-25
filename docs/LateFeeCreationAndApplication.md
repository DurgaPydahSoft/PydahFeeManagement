# Late Fee Creation & Application

## Overview

Late fees are **penalty demands** created when a student has **not paid enough** by a term’s due date. The job runs daily (**3:00 AM IST**) and can also be triggered manually (**Sync / Sync All**).

Demands are always stored as `StudentFee` under a dedicated **Late Fee Head** (not under Tuition / Special Fee / etc.).

There are **two penalty modes**:

| Mode | Flag on structures | Behaviour |
|------|--------------------|-----------|
| **Each Head Late Fee** | `isGroupWiseLateFee: false` | One late fee per fee head (Tuition alone, Special alone, …) |
| **Group-wise Late Fee** | `isGroupWiseLateFee: true` | One combined late fee for all heads in the same context that share group-wise mode |

---

## Where config lives

| Piece | Where |
|-------|--------|
| Penalty amount per term | `FeeStructure.terms[].lateFeeAmount` |
| Late fee demand head | `FeeStructure.lateFeeHead` (or `DefaultLateFeeConfig.lateFeeHead`) |
| Group vs each-head mode | `FeeStructure.isGroupWiseLateFee` |
| Due date rules (timing) | Structure terms, with fallback from `DefaultLateFeeConfig` by `termsCount` |

Legacy `LateFeeConfig` is **not** used by the apply job.

---

## Prerequisites

1. Term-divided structures (`isTermsDivided` / late-fee checkbox on columns).
2. At least one term with `lateFeeAmount > 0`.
3. A late fee head configured (structure or default config).
4. Due date: **Semester Offset** or **Fixed Date**.
5. For offset mode: matching SQL `semesters` row (course, batch year, year_of_study, college).
6. Students: `student_status = regular`, matching college/course/branch/batch/year/category.

---

## How apply works (common path)

```
processLateFees
  → load structures (+ expand group if syncing one group-wise structure)
  → bucket into groups (group-wise vs single)
  → for each group / term with lateFeeAmount > 0:
        compute dueDate
        find matching regular students
        check underpayment (single head OR sum of group heads)
        if overdue AND underpaid → create/update one StudentFee under lateFeeHead
        if not overdue OR fully paid → remove unpaid late fee for that term
```

### Due date

- **Fixed:** `terms.fixedDueDate`
- **Offset:** semester `start_date` + `dueOffsetDays` for `referenceSemester`

Overdue when `today > dueDate` (date-only).

### Demand record

Created under `lateFeeHead` with:

- `termNumber`
- `structureId` = first structure in the group (or the single structure)
- `amount` = that term’s `lateFeeAmount`
- `remarks` = head-specific or group label (see below)

---

## Mode A — Each Head Late Fee (`isGroupWiseLateFee: false`)

Each fee structure is processed **alone**.

**Underpayment check (Term N):**

```
required = sum of that head’s term amounts for terms 1..N
paid     = sum of payments on THAT fee head (same year/semester)
underpaid if paid < required
```

**Remarks example:**  
`Tuition Fee - Term 1 - ₹500`

**Result:** Student can get **multiple** late fees in the same term (one per underpaid head).

### Scenario

| Head | Term 1 amount | Paid | Late fee amount |
|------|---------------|------|-----------------|
| Tuition | ₹25,000 | ₹0 | ₹500 |
| Special | ₹8,000 | ₹8,000 | ₹300 |

After Term 1 due date → **only Tuition late fee ₹500** is created. Special is fully paid → no Special late fee.

---

## Mode B — Group-wise Late Fee (`isGroupWiseLateFee: true`)

### What “group” means

Structures are grouped by the same context:

```
college | course | branch | batchYear | category | studentYear | semester
```

and **`isGroupWiseLateFee: true`**.

Example group: same DIPLOMA Regular Year-1 batch, with Tuition + Special + Application all marked group-wise.

### UI behaviour (Fee Structures / Late tab)

- Toggle **Group-wise Late Fee**
- One shared late-fee amount per term is applied to **all** late-fee-applicable columns in that quota
- All those structures are saved with `isGroupWiseLateFee: true` and the **same** term late amounts
- Term counts must match across heads (UI blocks mismatched term counts)

### Underpayment check (Term N) — this is the important part

```
required = Σ (over ALL heads in the group) of cumulative term amounts 1..N
paid     = Σ (over ALL heads in the group) of payments on each head
underpaid if paid < required
```

Payments are **pooled across the group**. Paying more on one head can cover shortfall on another for the purpose of **avoiding the group late fee**.

### Single demand

If overdue and underpaid → **one** `StudentFee` for that term:

- Amount = shared `lateFeeAmount` (not multiplied by number of heads)
- Remarks like:  
  `Group Late Fee (Tuition Fee, SPECIAL FEE, APPLICATION FEE) - Term 1 - ₹500`
- `structureId` points to the **first** structure in the group

### Manual Sync of one structure

If you Sync one group-wise structure, the job **reloads all** group-wise structures in the same context before applying, so the pooled check stays correct.

---

## Group-wise scenarios

### 1. Fully unpaid on all heads

Tuition T1 ₹25k + Special T1 ₹8k = required ₹33k, paid ₹0, late ₹500, overdue.

→ **One** group late fee ₹500.

### 2. Partial pay across heads (still under required)

Required ₹33k, paid Tuition ₹20k + Special ₹5k = ₹25k.

→ Still underpaid → **group late fee applies**.

### 3. Short on Tuition but overpay Special enough to cover pool

Required ₹33k, Tuition paid ₹20k, Special paid ₹13k → total paid ₹33k.

→ **No late fee** (group pool is full), even though Tuition alone is short.

### 4. Each-head vs group difference

Same numbers as (3):

| Mode | Result |
|------|--------|
| Each Head | Tuition late fee **yes**; Special late fee **no** |
| Group-wise | Late fee **no** (pool covered) |

### 5. Already applied, then student pays enough

Next sync: not underpaid → **unpaid** group late fee for that term is **removed**.  
If already paid (transaction on late fee head), it is **not** deleted.

### 6. Sync twice

Second run finds matching remarks / `structureId` → no duplicate; may update amount/remarks if unpaid.

### 7. Two heads group-wise, one head each-head

Only structures with `isGroupWiseLateFee: true` join the pool.  
A third head with `isGroupWiseLateFee: false` is evaluated **separately** (own late fee if underpaid).

---

## What the job does **not** do

- Does not change original Tuition/Special demands.
- Does not multiply late fee by number of heads in a group.
- Does not apply to non-regular students.
- Does not remove **paid** late fee demands when the student later clears the original fees.

---

## Triggers

| Trigger | When |
|---------|------|
| Cron | Daily 3:00 AM IST (`scheduler.js`) |
| Sync one | `POST /api/late-fees/process` `{ structureId }` |
| Sync all | `POST /api/late-fees/process` |

---

## Key files

| File | Role |
|------|------|
| `backend/controllers/lateFeeController.js` | `processLateFees` (single + group-wise) |
| `backend/models/FeeStructure.js` | `lateFeeHead`, `isGroupWiseLateFee`, `terms[]` |
| `backend/models/DefaultLateFeeConfig.js` | Default due-date templates by terms count |
| `frontend/src/pages/FeeConfiguration.jsx` | Each Head vs Group-wise UI |
| `backend/services/scheduler.js` | Daily cron |

---

## Flow diagram

```
[Configure late fees on structures]
        │
        ├── Each Head: isGroupWiseLateFee=false → one unit per structure
        └── Group-wise: isGroupWiseLateFee=true → bucket by college/course/branch/batch/category/year/sem
                │
                ▼
        [processLateFees / Sync]
                │
                ▼
        For each term with lateFeeAmount > 0
                │
        ┌───────┴────────┐
        ▼                ▼
   dueDate passed?   underpaid?
   (calendar)        (single head OR sum of group heads)
        │                │
        └───────┬────────┘
                ▼
        Create ONE StudentFee under lateFeeHead
        (remarks = head name OR "Group Late Fee (...)")
                ▼
        Visible in Fee Collection → collect like any fee
```
