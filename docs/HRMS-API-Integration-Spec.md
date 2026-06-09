# HRMS Integration API — Specification for Fee Management

**Consumer:** Pydah Fee Management (`fees.pydah.edu.in`)  
**Purpose:** Replace direct HRMS MongoDB access with HTTPS APIs  
**Call direction:** Fee Management **backend → HRMS backend** (server-to-server only; never from the browser)

---

## General Requirements (All Endpoints)

| Item | Requirement |
|------|-------------|
| Protocol | HTTPS only |
| Base URL | e.g. `https://hrms-api.pydah.edu.in` (HRMS team to confirm) |
| Auth | Service API key in header: `X-API-Key: <secret>` or `Authorization: Bearer <service_token>` |
| Content-Type | `application/json` |
| Timeout | Respond within **5 seconds** |
| Passwords | **Never** return password hashes or plain passwords |
| Active users | Only return employees with `is_active: true` where applicable |

### Standard Error Shape (Recommended)

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "INVALID_CREDENTIALS"
}
```

---

## API 1 — Validate Credentials (Login)

**Replaces:** Direct read of HRMS `employees` / `users` collections + bcrypt validation inside Fee Management.

### Endpoint

```
POST /api/v1/auth/validate-credentials
```

### Request Body

```json
{
  "username": "EMP001",
  "password": "userPassword123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Login identifier. Must accept **any** of: `emp_no`, `username`, or `email` |
| `password` | string | Yes | Plain password (validated only inside HRMS; not stored by Fee Management) |

### Success Response — `200 OK`

```json
{
  "success": true,
  "valid": true,
  "data": {
    "employeeId": "65a1b2c3d4e5f6789012345",
    "empNo": "EMP001",
    "name": "Ramesh Kumar",
    "username": "EMP001",
    "email": "ramesh@example.com",
    "isActive": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeId` | string | Yes | Stable HRMS employee `_id` (Mongo ObjectId string). Used to link Fee `User.employeeId` |
| `empNo` | string | Yes | Employee number (primary login id for many staff) |
| `name` | string | Yes | Display name |
| `username` | string | No | HRMS login username if different from `empNo` |
| `email` | string | No | Email if available |
| `isActive` | boolean | Yes | Must be `true` for login to succeed |

### Failure Responses

| HTTP | When | Example |
|------|------|---------|
| `401` | Wrong password or unknown user | `{ "success": false, "valid": false, "message": "Invalid credentials", "code": "INVALID_CREDENTIALS" }` |
| `403` | User inactive/disabled | `{ "success": false, "valid": false, "message": "Account inactive", "code": "ACCOUNT_INACTIVE" }` |
| `503` | HRMS auth service down | `{ "success": false, "message": "Service unavailable", "code": "SERVICE_UNAVAILABLE" }` |

### Fee Management Usage After Success

1. HRMS confirms credentials are valid.
2. Fee Management looks up local `User` by `employeeId` **or** `username`.
3. If no local `User` exists → reject with *"User not authorized for Fee Management system"*.
4. If found → issue Fee Management JWT (role and permissions come from **Fee DB only**).

---

## API 2 — Get Employee by Identifier (SSO / Lookup)

**Replaces:** HRMS MongoDB lookup when CRM SSO returns `userId` and Fee Management needs employee details.

> **Note:** SSO token verification remains with **CRM** (`POST /auth/verify-token`). This API only **resolves** `userId` → employee profile.

### Endpoint

```
GET /api/v1/employees/resolve?identifier={value}
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | string | Yes | Any of: `emp_no`, `email`, `username`, or Mongo `_id` |

**Example:**

```
GET /api/v1/employees/resolve?identifier=EMP001
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "employeeId": "65a1b2c3d4e5f6789012345",
    "empNo": "EMP001",
    "name": "Ramesh Kumar",
    "username": "EMP001",
    "email": "ramesh@example.com",
    "isActive": true
  }
}
```

### Failure Responses

| HTTP | When |
|------|------|
| `404` | No employee found for identifier |
| `403` | Employee exists but inactive |

---

## API 3 — Search Employees (User Management)

**Replaces:** Direct MongoDB query in Fee Management when superadmin links an HRMS employee to a Fee user.

### Endpoint

```
GET /api/v1/employees/search?q={searchTerm}
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Minimum **3** characters. Search `employee_name` or `emp_no` (case-insensitive) |
| `limit` | number | No | Default `10`, max `20` |
| `activeOnly` | boolean | No | Default `true` |

**Example:**

```
GET /api/v1/employees/search?q=ram&limit=10
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": "65a1b2c3d4e5f6789012345",
      "empNo": "EMP001",
      "name": "Ramesh Kumar",
      "department": "Accounts",
      "division": "Finance",
      "designation": "Office Staff",
      "isActive": true
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeId` | string | Yes | Stored in Fee `User.employeeId` when linking |
| `empNo` | string | Yes | Shown in UI; often used as Fee `username` |
| `name` | string | Yes | `employee_name` |
| `department` | string | No | Display only |
| `division` | string | No | Display only |
| `designation` | string | No | Display only |

### Failure Responses

| HTTP | When |
|------|------|
| `400` | `q` missing or shorter than 3 characters |
| `200` + `data: []` | No matches (not an error) |

---

## API 4 — Get Single Employee by ID (Optional)

Useful when Fee Management already has `employeeId` and needs to refresh name or status.

### Endpoint

```
GET /api/v1/employees/{employeeId}
```

### Success Response — `200 OK`

Same `data` object shape as API 2.

---

## What Fee Management Will NOT Need from HRMS

| Do Not Expose | Reason |
|---------------|--------|
| Password hashes | Validation stays inside HRMS |
| Full employee DB dump | Only search + resolve endpoints |
| Fee roles/permissions | Managed only in Fee Management `User` collection |
| Student data | Fee Management uses a separate SQL database |

---

## Environment Variables (Fee Management — After HRMS Delivers APIs)

```env
HRMS_API_BASE_URL=https://hrms-api.pydah.edu.in
HRMS_API_KEY=<shared-secret>
```

---

## Implementation Priority for HRMS Team

| Priority | API | Why |
|----------|-----|-----|
| **P0** | `POST /auth/validate-credentials` | Replaces HRMS MongoDB login |
| **P1** | `GET /employees/search` | User Management employee linking |
| **P2** | `GET /employees/resolve` | SSO user resolution without MongoDB |
| **P3** | `GET /employees/{id}` | Optional refresh by employee ID |

---

## Authentication Flow (After Migration)

```
User → Fee Frontend (username + password)
         ↓
     Fee Backend POST /api/auth/login
         ↓
     Check local User + password (Fee MongoDB)
         ↓ (if local auth fails)
     HRMS API POST /auth/validate-credentials
         ↓
     Fee Backend finds User by employeeId / username (Fee MongoDB)
         ↓ (if no local User)
     Reject: "User not authorized for Fee Management system"
         ↓ (if local User exists)
     Return JWT + role + permissions (from Fee DB only)
         ↓
     Frontend → /dashboard
```

### SSO Flow (Unchanged for CRM; HRMS API Replaces Mongo Lookup Only)

```
User → CRM Login → encrypted SSO token → Fee Frontend /login?token=...
         ↓
     Fee Backend POST CRM /auth/verify-token
         ↓
     HRMS API GET /employees/resolve?identifier={userId}
         ↓
     Fee Backend finds local User → issue JWT
```

---

## Summary for HRMS Team

Provide **three server-to-server JSON APIs**:

1. **Validate login** — `username` + `password`
2. **Search employees** — minimum 3 character query
3. **Resolve employee** — by `emp_no` / `email` / `username` / `_id`

Return at minimum: `employeeId`, `empNo`, `name`, `isActive`.  
Never return passwords. Secure all endpoints with an API key.

---

## Current State vs Target State

| Feature | Current (Direct MongoDB) | Target (HRMS API) |
|---------|--------------------------|-------------------|
| Password login fallback | `employees` + `users` collections | `POST /auth/validate-credentials` |
| SSO employee resolution | HRMS MongoDB lookup | `GET /employees/resolve` |
| User Management search | `Employee.find()` regex | `GET /employees/search` |
| Fee roles/permissions | Fee MongoDB `User` | Fee MongoDB `User` (unchanged) |

---

*Document version: 1.0 — Fee Management integration spec for HRMS team.*
