# API Documentation

**Base URL**: `http://localhost:5656`

## Response Format

All responses follow this structure:

### Success Response

```json
{
  "success": true,
  "message": "Description of what happened",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": ["field-specific errors (optional)"]
}
```

### Error Response Sanitization

For security, error messages are sanitized to prevent internal information leakage. Only predefined safe error messages are returned to clients:

- "Email already registered"
- "Phone number already registered"
- "Invalid email or password"
- "Invalid OTP"
- "Invalid or expired OTP"
- "Invalid or expired reset token"
- "Invalid role"
- "Account suspended"
- "User not found"
- "Account not eligible for verification"
- "User is not pending verification"
- "Only rejected accounts can resubmit verification"
- "Insufficient permissions"

Any other internal errors return generic fallback messages (e.g., "Registration failed. Please try again.") while logging the actual error server-side for debugging.

---

## Health Check

### GET /api/health

Check if the API is running.

**Response**

```json
{
  "status": "API is up!"
}
```

---

## User Roles

The API supports three user roles with different access levels:

| Role | Description | Registration |
|------|-------------|--------------|
| `USER` | Regular user with standard access | Self-registration (default) |
| `MED` | Medical professional with elevated access | Self-registration |
| `ADMIN` | System administrator with full access | Manual creation by sysadmin only |

**Important Notes:**
- Users can register as `USER` (default) or `MED` through the `/api/auth/register` endpoint
- The `ADMIN` role cannot be selected during registration and must be assigned manually by system administrators
- If no role is specified during registration, the user is assigned the `USER` role by default

---

## Account Status & Verification

MED (Medical Professional) users require identity verification before they can log in. The verification workflow is as follows:

### Account Statuses

| Status | Description |
|--------|-------------|
| `ACTIVE` | Account is verified and can log in (default for USER role) |
| `PENDING_VERIFICATION` | Account created but awaiting admin verification (default for MED role) |
| `REJECTED` | Verification documents were rejected by admin |
| `SUSPENDED` | Account suspended by admin |

### MED User Verification Flow

1. **Registration**: MED user registers with role `MED`
   - Account status is automatically set to `PENDING_VERIFICATION`
   - User receives a bearer token and can log in

2. **Login & App Redirect**: MED user logs in
   - Login succeeds and returns bearer token + `accountStatus`
   - Mobile app checks `accountStatus` in response:
     - `PENDING_VERIFICATION` → Redirect to verification upload screen
     - `REJECTED` → Redirect to re-submission screen
     - `ACTIVE` → Redirect to main app

3. **Submit Documents**: MED user submits verification documents via `/api/verification/submit`
   - Front and back images of ID document
   - Medical license number
   - Documents stored locally in `uploads/verifications/`

4. **Admin Review**: Admin reviews pending verifications via `/api/admin/verifications/pending`
   - Approves via `/api/admin/verifications/approve` → Status becomes `ACTIVE`
   - Rejects via `/api/admin/verifications/reject` → Status becomes `REJECTED`

5. **Email Notification**: User receives email notification of approval/rejection

6. **Re-login After Status Change**:
   - If **approved**, next login redirects to main app
   - If **rejected**, next login redirects to re-submission screen
   - User can resubmit via `/api/verification/resubmit`
     - Status changes back to `PENDING_VERIFICATION`
     - Previous rejection notes are cleared
     - Admin reviews again from step 4

### Document Storage

- ID documents are stored in local filesystem at `uploads/verifications/`
- Filename format: `{userId}_{timestamp}_{side}.{ext}`
- Supported formats: JPEG, PNG, WebP
- Maximum file size: 5MB per image

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request Body**

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+14155552671",
  "password": "securepassword123",
  "confirmPassword": "securepassword123",
  "role": "USER"
}
```

**Validation Rules**

| Field | Rules |
|-------|-------|
| fullName | Required, non-empty string |
| email | Required, valid email format, must be unique |
| phoneNumber | Required, valid international format (E.164), must be unique |
| password | Required, minimum 8 characters |
| confirmPassword | Must match password |
| role | Optional, must be "USER" or "MED" (defaults to "USER"). ADMIN role cannot be registered. |

**Phone Number Validation:**
- Phone numbers are validated using `libphonenumber-js` on both frontend and backend
- Must be in valid international format (e.g., `+14155552671`, `+639171234567`)
- Stored in E.164 format in the database for consistency
- Each phone number can only be registered once

**Success Response** (201)

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phoneNumber": "+14155552671",
    "role": "USER",
    "accountStatus": "ACTIVE"
  }
}
```

**Important**:
- If registering as `USER`, `accountStatus` will be `ACTIVE` and user can log in immediately
- If registering as `MED`, `accountStatus` will be `PENDING_VERIFICATION` and user must submit verification documents before logging in

**Error Response** (400)

```json
{
  "success": false,
  "message": "Email already registered"
}
```

Or if phone number is already in use:

```json
{
  "success": false,
  "message": "Phone number already registered"
}
```

Or if phone number format is invalid:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Invalid phone number format"]
}
```

---

### POST /api/auth/login

Authenticate a user and receive a JWT token.

**Request Body**

```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response** (200)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+14155552671",
      "role": "USER",
      "accountStatus": "ACTIVE"
    }
  }
}
```

**Error Response** (401)

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

Or if account is suspended:

```json
{
  "success": false,
  "message": "Account suspended"
}
```

**Important - Account Status Handling:**

The login endpoint returns `accountStatus` in the response. Your mobile app should handle redirects based on this status:

| accountStatus | Action |
|---------------|--------|
| `ACTIVE` | User is fully verified, redirect to main app |
| `PENDING_VERIFICATION` | MED user needs to submit verification documents, redirect to upload screen |
| `REJECTED` | MED user's verification was rejected, redirect to re-submission screen with rejection reason |
| `SUSPENDED` | Login blocked with error (only this status prevents login) |

**Example Login Flow:**
```javascript
// Login response
const response = await login(email, password);
const { token, user } = response.data;

// Save token for authenticated requests
saveToken(token);

// Route user based on account status
switch (user.accountStatus) {
  case 'ACTIVE':
    navigate('/home');
    break;
  case 'PENDING_VERIFICATION':
    navigate('/verification/upload');
    break;
  case 'REJECTED':
    navigate('/verification/resubmit');
    break;
}
```

---

### POST /api/auth/forgot-password

Request a password reset OTP. Sends an OTP to the user's email if the account exists.

**Request Body**

```json
{
  "email": "john@example.com"
}
```

**Success Response** (200)

```json
{
  "success": true,
  "message": "If your email is registered, you will receive an OTP"
}
```

**Note**: This endpoint always returns success to prevent email enumeration attacks.

---

### POST /api/auth/verify-otp

Verify the OTP code and receive a reset token.

**Request Body**

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Validation Rules**

| Field | Rules |
|-------|-------|
| email | Required, valid email format |
| otp | Required, exactly 6 digits |

**Success Response** (200)

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

**Note**: OTP expires after 10 minutes. The reset token expires after 15 minutes.

---

### POST /api/auth/reset-password

Set a new password using the reset token from OTP verification.

**Request Body**

```json
{
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newsecurepassword123",
  "confirmPassword": "newsecurepassword123"
}
```

**Validation Rules**

| Field | Rules |
|-------|-------|
| resetToken | Required |
| newPassword | Required, minimum 8 characters |
| confirmPassword | Must match newPassword |

**Success Response** (200)

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

## Using Authentication

For protected endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Details

| Token Type | Expiry | Purpose |
|------------|--------|---------|
| Login Token | 7 days | API authentication |
| Reset Token | 15 minutes | Password reset only |

---

## Password Reset Flow

```
1. User requests reset     POST /api/auth/forgot-password { email }
                           ↓
2. User receives OTP       (via email or console in dev)
                           ↓
3. User verifies OTP       POST /api/auth/verify-otp { email, otp }
                           ↓
4. User sets new password  POST /api/auth/reset-password { resetToken, newPassword, confirmPassword }
```

---

## Verification Endpoints

### POST /api/verification/submit

Submit verification documents for MED users. Requires authentication.

**Authentication**: Required (Bearer token)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| medicalLicenseNumber | string | Yes | Medical license number |
| idDocumentFront | file | Yes | Front side of ID document (JPEG, PNG, WebP, max 5MB) |
| idDocumentBack | file | Yes | Back side of ID document (JPEG, PNG, WebP, max 5MB) |

**Example using cURL**:

```bash
curl -X POST http://localhost:5656/api/verification/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "medicalLicenseNumber=MED123456" \
  -F "idDocumentFront=@/path/to/front.jpg" \
  -F "idDocumentBack=@/path/to/back.jpg"
```

**Success Response** (200)

```json
{
  "success": true,
  "message": "Verification documents submitted successfully. Your account will be reviewed by our team."
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Medical license number is required",
    "Front side of ID document is required"
  ]
}
```

---

### POST /api/verification/resubmit

Re-submit verification documents after rejection. Only available for accounts with `REJECTED` status.

**Authentication**: Required (Bearer token)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| medicalLicenseNumber | string | Yes | Medical license number |
| idDocumentFront | file | Yes | Front side of ID document (JPEG, PNG, WebP, max 5MB) |
| idDocumentBack | file | Yes | Back side of ID document (JPEG, PNG, WebP, max 5MB) |

**Example using cURL**:

```bash
curl -X POST http://localhost:5656/api/verification/resubmit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "medicalLicenseNumber=MED123456" \
  -F "idDocumentFront=@/path/to/front.jpg" \
  -F "idDocumentBack=@/path/to/back.jpg"
```

**Success Response** (200)

```json
{
  "success": true,
  "message": "Verification documents resubmitted successfully. Your account will be reviewed again by our team."
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Only rejected accounts can resubmit verification"
}
```

**Important**:
- Only works for accounts with `REJECTED` status
- Account status automatically changes back to `PENDING_VERIFICATION`
- Previous rejection notes are cleared
- Old document paths are replaced with new uploads

---

## Admin Endpoints

All admin endpoints require authentication with an ADMIN role user. Attempting to access these endpoints without proper role will result in a 403 Forbidden error.

### GET /api/admin/verifications/pending

Get list of pending verifications.

**Authentication**: Required (Bearer token - ADMIN role)

**Success Response** (200)

```json
{
  "success": true,
  "message": "Pending verifications retrieved successfully",
  "data": [
    {
      "id": "user-uuid",
      "fullName": "Dr. Jane Smith",
      "email": "jane.smith@example.com",
      "phoneNumber": "+14155552671",
      "medicalLicenseNumber": "MED123456",
      "idDocumentFrontPath": "uploads/verifications/user-uuid_1234567890_idDocumentFront.jpg",
      "idDocumentBackPath": "uploads/verifications/user-uuid_1234567890_idDocumentBack.jpg",
      "createdAt": "2025-01-29T12:00:00.000Z"
    }
  ]
}
```

---

### POST /api/admin/verifications/approve

Approve a MED user's verification.

**Authentication**: Required (Bearer token - ADMIN role)

**Request Body**

```json
{
  "userId": "user-uuid",
  "notes": "All documents verified successfully"
}
```

**Success Response** (200)

```json
{
  "success": true,
  "message": "User verification approved successfully"
}
```

**Note**: User receives an email notification upon approval and account status becomes `ACTIVE`.

---

### POST /api/admin/verifications/reject

Reject a MED user's verification.

**Authentication**: Required (Bearer token - ADMIN role)

**Request Body**

```json
{
  "userId": "user-uuid",
  "notes": "Medical license number could not be verified"
}
```

**Validation Rules**

| Field | Rules |
|-------|-------|
| userId | Required |
| notes | Required (rejection reason) |

**Success Response** (200)

```json
{
  "success": true,
  "message": "User verification rejected"
}
```

**Note**: User receives an email notification with the rejection reason and account status becomes `REJECTED`.

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials or token) |
| 403 | Forbidden (valid token but insufficient permissions) |
| 500 | Internal Server Error |
