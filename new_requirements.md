# Fee Collection & Management – Pending Implementation Tasks

1. Fee Head Creation --done

   * Add a unique fee head code during fee head creation for better identification and reporting.

2. **Fee Structure Management**

   * Maintain **creation date and history tracking** for each fee structure.
   * Enable **semester-wise fee configuration** within the fee structure.
   * Allow **fee applicability across all academic years**, with proper filtering and mapping.

3. **Receipt Number Configuration**

   * Provide configurable settings for **receipt number generation** (format and length).

4. **Fee Dues Summary**

   * Display **fee dues across all academic years**.
   * Add **filters** to view dues year-wise and fee-head-wise.

5. **Transaction Terminology Update** --done

   * Rename **Credit** to **Concession**, with fee head mapping.
   * Rename **Debit** to **Collect Fee** for clarity in transactions.

6. **Payment Mode Enhancements** --done

   * Restrict payment modes to **Cash** and **Bank** only.
   * For **Bank** payments, include sub-options:

     * **UPI** – transaction number mandatory.
     * **Cheque** – cheque number, cheque date, and bank name.
     * **DD** – DD number, DD date, and bank name.

7. **Payment History Enhancements** --done

   * Add **advanced filters** in the payment history section (date, mode, fee head, academic year).

8. **Fee Collection Dashboard Enhancement** --done

   * Redesign the dashboard to a **minimal view** with the ability to **expand and view more data** when required.

9. **Post-Payment Print Flow** --done

   * After saving a collected payment, display a **popup for receipt printing**.

10. **Receipt Printing Format** --done

    * Print **two duplicate copies** on the same page:

      * One for the **Cashier**
      * One for the **Student**

11. **Multiple Fee Head Collection** --done

    * Enable **multi-fee-head selection** in fee collection.
    * Allow **multiple fee payments under a single receipt**, reflected correctly in both records and printed receipts.

12. **Reports Module**

    * Add a dedicated **Reports** page under Fee Management.
    * Include the following reports:

      * Day-end report --done
      * Cashier-wise report --done
      * Fee-head-wise report --done
      * Cash vs Bank report --done
      * Fee due report

