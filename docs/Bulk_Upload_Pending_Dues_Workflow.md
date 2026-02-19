# Bulk Upload Workflow: Pending Dues

This document outlines the workflow for uploading "Pending Dues" (Remaining Balance) for students and automatically generating the corresponding Payment Transactions.

## Overview

The **Pending Dues Upload** feature allows you to upload the *remaining amount* a student owes. The system then compares this against the *Total Fee* (set by the Fee Structure) to calculate how much has already been paid, and creates a payment record for that difference.

**Formula:**
`Paid Amount` = `Total Fee (Demand)` - `Uploaded Pending Due`

## Prerequisites

1.  **Fee Structure Applied**: The student **MUST** have a Fee Structure applied for the relevant Fee Head and Year.
    *   *Example*: Student has "Tuition Fee" structure of ₹50,000 applied.
    *   *Check*: Go to "Fee Collection" and verify the "Total" column shows the correct amount (e.g., 50,000).

2.  **No Existing Conflicting Payments**: This workflow works best when migration data or initial setup is being done.

## Step-by-Step Guide

### 1. Download Template
1.  Navigate to **Fee Configuration** > **Bulk Fee Upload**.
2.  Select the **Dues (Demand)** tab.
3.  Click the **Template** button to download `BulkDuesTemplate.xlsx`.

### 2. Prepare the Excel File
Open the downloaded template and fill in the required details:
*   **Admission No**: The student's admission number.
*   **Year**: The academic year (e.g., 1, 2, 3, 4).
*   **Fee Head Columns** (e.g., "Tuition Fee", "Transport Fee"):
    *   Enter the **PENDING (REMAINING) AMOUNT** for each student.
    *   *Example*: If Total is 50,000 and they paid 30,000, enter **20,000**.
    *   **Do NOT** enter the Total Fee.
    *   **Do NOT** enter the Paid Amount.

| Admission No | Year | Tuition Fee | Transport Fee |
| :--- | :--- | :--- | :--- |
| 2024001 | 1 | 20000 | 5000 |
| 2024002 | 1 | 0 | 10000 |

### 3. Upload and Configure
1.  Back in the **Bulk Fee Upload** page, click **Choose File** and select your filled Excel file.
2.  **CRITICAL STEP**: Check the box labeled **"Upload as Pending Dues (Auto-Calc Payment)"**.
    *   *Note*: If you leave this unchecked, the system will simply overwrite the Total Demand with your value, which is **NOT** what you want for this workflow.
3.  Click **Parse & Preview**.

### 4. Review Preview
The preview table will show the processed data:
*   **Total Demand**: Should be `0` (because we are not adding new demands).
*   **Total Paid**: Should show the calculated paid amount.
    *   *Calculation*: `50,000 (Existing Demand) - 20,000 (Uploaded Due) = 30,000 (Paid)`.
*   **Expand Row**: Click the arrow to see details. You should see a "Cash" transaction for the calculated amount.

### 5. Start Upload
1.  Select the rows you want to save (or "Select All").
2.  Click **Confirm Upload**.
3.  The system will create the payment transactions in the database.

## Verification
After uploading, go to **Fee Configuration** > **Fee Collection** for a student:
*   **Total**: Should remain as set by Fee Structure (e.g., 50,000).
*   **Paid**: Should reflect the calculated amount (e.g., 30,000).
*   **Due**: Should match the value you uploaded (e.g., 20,000).

## Troubleshooting / FAQ

**Q: Parameters like "Total Fee" are missing or zero?**
A:The system cannot calculate "Paid" if the Total Fee is missing. Ensure you have applied the Fee Structure to the batch *before* uploading pending dues.

**Q: What if the Calculated Paid amount is negative?**
A: If `Uploaded Pending Due` > `Total Fee`, the paid amount would be negative. The system will **skip** this entry to prevent errors. Check your data.

**Q: Can I use this to update existing payments?**
A: This feature creates *new* transaction records. It does not delete or modify existing *transaction* records, but it uses the *current total demand* for calculation.
