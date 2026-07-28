# Student Fee Flow Chart

This document shows how the current system links:

- student profile
- fee structure
- term-wise split
- due-date calculation
- late-fee generation
- final due calculation

## Flowchart

```mermaid
flowchart TD
    A[Student Profile<br/>College, Course, Branch, Batch,<br/>Category, Student Year, Semester] --> B[Match Applicable Fee Structure<br/>by student context and fee head]

    B --> C{Is terms divided?}
    C -->|Yes| D[Split fee into terms<br/>Term 1, Term 2, ...<br/>Each term has percent or amount]
    C -->|No| E[Treat as Term 1<br/>100 percent of fee]

    D --> F[Create or Sync StudentFee Demands<br/>Linked by student + fee head + structureId + year/semester + termNumber]
    E --> F

    F --> G[Apply concessions and payments in order]

    G --> G1[1. Declaration concession<br/>split across all terms]
    G1 --> G2[2. Paid amount applied<br/>term by term]
    G2 --> G3[3. Application concession applied<br/>to first unpaid term(s)]

    G3 --> H[Calculate term balance<br/>Balance = term target - declaration - paid - application concession]

    H --> I{Any balance remaining<br/>up to this term?}
    I -->|No| J[No Due / Cleared]
    I -->|Yes| K{Due date passed?}

    L[Due date source<br/>1. Fixed date<br/>or<br/>2. Semester start date + offset days<br/>using academic calendar semester reference] -.-> K

    K -->|No| M[No late fee yet]
    K -->|Yes| N[Generate Late Fee StudentFee<br/>Uses configured lateFeeHead<br/>Late fee amount comes from term config<br/>Only if overdue and still underpaid]

    J --> O[Student Due View / Fee Collection]
    M --> O
    N --> O

    O --> P[Final due calculation<br/>Total Due = Total StudentFee demands - Paid transactions<br/>Includes regular fee + generated late fee<br/>Shows head-wise total, paid, due]
```

## Step-by-Step Meaning

### 1. Student profile decides which fee structure applies

The system first uses the student's:

- college
- course
- branch
- batch
- category (`stud_type`)
- student year
- semester

to find the matching `FeeStructure`.

### 2. Fee structure becomes student demand

Once matched, the fee structure is converted into `StudentFee` demand records for that student.

That is the main link between:

- the master fee setup (`FeeStructure`)
- the actual collectible demand for a student (`StudentFee`)

### 3. Terms decide how the total fee is divided

If the fee head is terms-divided:

- the total amount is split into Term 1, Term 2, and so on
- each term can have its own percentage or amount
- each term can also carry its own due rule and late-fee amount

If not terms-divided:

- the system treats the full fee as a single Term 1

### 4. How the system checks whether a student is still due

For each term, the balance is reduced in this order:

1. declaration concession is split across all terms
2. paid amount is applied term by term
3. application concession is applied to the first unpaid term(s)

After that:

`term balance = term target - declaration concession - paid amount - application concession`

If balance still exists for the current term or any earlier term in scope, the student is still underpaid for that term path.

### 5. How due date is derived

The term due date can come from either:

1. a fixed date configured directly for the term
2. semester start date plus offset days

When offset mode is used, the semester date is taken from the academic calendar reference for the selected semester.

### 6. When late fee is created

Late fee is generated only when both conditions are true:

1. the due date has already passed
2. the student is still underpaid for that term

Then the system creates another `StudentFee` demand:

- under the configured `lateFeeHead`
- with the late-fee amount defined for that term

So late fee itself becomes part of the student's due.

### 7. Final student due

The final due shown in due reports or collection screens is:

`Total Due = Total StudentFee demand - Total Paid transactions`

This includes:

- normal fee demand
- any generated late-fee demand

and can also be shown head-wise as:

- total
- paid
- due

## Quick Summary

- `FeeStructure` is the template
- `StudentFee` is the actual demand raised on the student
- term logic breaks fee into payable stages
- due date decides when a term becomes overdue
- overdue + unpaid leads to late-fee demand generation
- total due is based on demand minus payments
