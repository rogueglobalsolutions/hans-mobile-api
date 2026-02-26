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
- "Account is not eligible for verification"
- "User is not pending verification"
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
   - Login succeeds and returns bearer token + `accountStatus` + `hasSubmittedVerification`
   - Mobile app uses **both flags** to determine routing:
     - `PENDING_VERIFICATION` + `hasSubmittedVerification: false` → Redirect to document upload screen
     - `PENDING_VERIFICATION` + `hasSubmittedVerification: true` → Show "pending review" screen (documents already submitted)
     - `REJECTED` → Redirect to re-submission screen
     - `ACTIVE` → Redirect to main app

3. **Submit Documents** (first-time): MED user submits verification documents via `POST /api/verification/submit`
   - Front and back images of ID document + medical license number
   - Documents stored locally in `uploads/verifications/`
   - Only valid for accounts with `PENDING_VERIFICATION` status

4. **Admin Review**: Admin reviews pending verifications via `/api/admin/verifications/pending`
   - Approves via `POST /api/admin/verifications/:userId/approve` → Status becomes `ACTIVE`
   - Rejects via `POST /api/admin/verifications/:userId/reject` → Status becomes `REJECTED`

5. **Email Notification**: User receives email notification of approval/rejection

6. **Re-login After Status Change**:
   - If **approved**, next login redirects to main app
   - If **rejected**, next login redirects to re-submission screen
   - User resubmits via `POST /api/verification/resubmit`
     - Only valid for accounts with `REJECTED` status
     - Status changes back to `PENDING_VERIFICATION`
     - Previous verification data is cleared
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
    "accountStatus": "ACTIVE",
    "hasSubmittedVerification": false
  }
}
```

**Important**:
- If registering as `USER`, `accountStatus` will be `ACTIVE` and `hasSubmittedVerification` will be `false`
- If registering as `MED`, `accountStatus` will be `PENDING_VERIFICATION` and `hasSubmittedVerification` will be `false`
- User can log in regardless of verification status, but the app should route based on these flags

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
      "accountStatus": "ACTIVE",
      "hasSubmittedVerification": false
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

**Important - Account Status & Verification Handling:**

The login endpoint returns both `accountStatus` and `hasSubmittedVerification`. Your mobile app should use **both flags** to determine routing:

| accountStatus | hasSubmittedVerification | Action |
|---------------|--------------------------|--------|
| `ACTIVE` | any | Fully verified, redirect to main app |
| `PENDING_VERIFICATION` | `false` | MED user hasn't uploaded documents yet — redirect to upload screen, hit `POST /api/verification/submit` |
| `PENDING_VERIFICATION` | `true` | MED user submitted documents, awaiting admin review — show "pending review" screen |
| `REJECTED` | `true` | MED user's verification was rejected — redirect to re-submission screen, hit `POST /api/verification/resubmit` |
| `SUSPENDED` | N/A | Login blocked with error (only this status prevents login) |

**Example Login Flow:**
```javascript
// Login response
const response = await login(email, password);
const { token, user } = response.data;

// Save token for authenticated requests
saveToken(token);

// Route user based on account status AND submission status
if (user.accountStatus === 'ACTIVE') {
  navigate('/home');
} else if (user.accountStatus === 'PENDING_VERIFICATION') {
  if (!user.hasSubmittedVerification) {
    // Haven't uploaded documents yet — go to upload screen (hits /submit)
    navigate('/verification/upload');
  } else {
    // Documents submitted, awaiting review — show pending screen
    navigate('/verification/pending');
  }
} else if (user.accountStatus === 'REJECTED') {
  // Rejected — go to resubmission screen (hits /resubmit with isResubmission: true)
  navigate('/verification/resubmit');
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

Re-submit verification documents after rejection. Exclusively for accounts with `REJECTED` status.

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
  "message": "Verification documents submitted successfully. Your account will be reviewed by our team."
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Account is not eligible for verification"
}
```

**Important**:
- Only works for accounts with `REJECTED` status (use `/submit` for first-time submissions)
- Account status automatically changes back to `PENDING_VERIFICATION`
- Previous verification data (notes, timestamps) is cleared
- Old document paths are replaced with new uploads

---

## Admin Endpoints

All admin endpoints require authentication with an ADMIN role user. Attempting to access these endpoints without proper role will result in a 403 Forbidden error.

> **Document Images**: ID document images are served as static files at `GET /uploads/verifications/<filename>`. Use the `idDocumentFrontPath` and `idDocumentBackPath` values returned from the API to construct the full URL: `http://localhost:5656/<path>`

---

### GET /api/admin/verifications

Get a list of all MED users who have submitted verification documents. Used to populate the admin's MED user list screen.

**Authentication**: Required (Bearer token - ADMIN role)

**Success Response** (200)

```json
{
  "success": true,
  "message": "MED users retrieved successfully",
  "data": [
    {
      "id": "user-uuid",
      "fullName": "Dr. Jane Smith",
      "email": "jane.smith@example.com",
      "phoneNumber": "+14155552671",
      "medicalLicenseNumber": "MED123456",
      "accountStatus": "PENDING_VERIFICATION",
      "createdAt": "2025-01-29T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/admin/verifications/pending

Get list of MED users who have submitted documents and are specifically awaiting review. Subset of the list above filtered to `PENDING_VERIFICATION` only.

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

### GET /api/admin/verifications/:userId

Get full details of a specific MED user. Used when the admin taps on a user from the list to view their profile, license number, and uploaded ID images before making a decision.

**Authentication**: Required (Bearer token - ADMIN role)

**URL Parameter**: `userId` — the ID of the MED user

**Success Response** (200)

```json
{
  "success": true,
  "message": "MED user retrieved successfully",
  "data": {
    "id": "user-uuid",
    "fullName": "Dr. Jane Smith",
    "email": "jane.smith@example.com",
    "phoneNumber": "+14155552671",
    "medicalLicenseNumber": "MED123456",
    "idDocumentFrontPath": "uploads/verifications/user-uuid_1234567890_idDocumentFront.jpg",
    "idDocumentBackPath": "uploads/verifications/user-uuid_1234567890_idDocumentBack.jpg",
    "accountStatus": "PENDING_VERIFICATION",
    "hasSubmittedVerification": true,
    "verifiedAt": null,
    "createdAt": "2025-01-29T12:00:00.000Z"
  }
}
```

To load the ID images in the admin UI, construct the full image URLs as:
```
http://localhost:5656/<idDocumentFrontPath>
http://localhost:5656/<idDocumentBackPath>
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### POST /api/admin/verifications/:userId/approve

Approve a MED user's verification. Triggered when admin clicks the Approve button on the detail screen.

**Authentication**: Required (Bearer token - ADMIN role)

**URL Parameter**: `userId` — the ID of the MED user to approve

**Request Body**: None

**Success Response** (200)

```json
{
  "success": true,
  "message": "User verification approved successfully"
}
```

**Note**: User receives a simple approval email notification and `accountStatus` becomes `ACTIVE`.

---

### POST /api/admin/verifications/:userId/reject

Reject a MED user's verification. Triggered when admin clicks the Reject button on the detail screen.

**Authentication**: Required (Bearer token - ADMIN role)

**URL Parameter**: `userId` — the ID of the MED user to reject

**Request Body**: None

**Success Response** (200)

```json
{
  "success": true,
  "message": "User verification rejected"
}
```

**Note**: User receives a simple rejection email notification and `accountStatus` becomes `REJECTED`.

---

---

## Training Endpoints

Trainings are medical education sessions created by admins and visible to MED users. Enrollment is tracked per user per training.

### Enum Value Reference

All enum fields accept and return **display labels** (not raw DB identifiers). The mapping is:

#### type
| Display Label | Internal Value |
|---|---|
| `Online Training` | `ONLINE` |
| `Hands on Training` | `HANDS_ON` |

#### brand
| Display Label | Internal Value |
|---|---|
| `MINT Lift® PDO Threads` | `MINT_LIFT_PDO_THREADS` |
| `MINT™ Microcannula` | `MINT_MICROCANNULA` |
| `klárdie` | `KLARDIE` |
| `TargetCool` | `TARGETCOOL` |
| `EZ-Tcon` | `EZ_TCON` |

#### level
Selecting a level automatically sets the training's `price` (USD) and `creditScore` (in-house currency). These are read-only on the client — you cannot override them.

| Display Label | Internal Value | Price (USD) | Credit Score |
|---|---|---|---|
| `Mint Lift Group Training` | `MINT_LIFT_GROUP_TRAINING` | $3,000 | 1,500 |
| `Supplemental` | `SUPPLEMENTAL` | $1,500 | 0 |
| `Advanced` | `ADVANCED` | $6,000 | 3,000 |
| `Package Bundle 1` | `PACKAGE_BUNDLE_1` | $5,000 | 2,500 |
| `Package Bundle 2` | `PACKAGE_BUNDLE_2` | $8,000 | 4,500 |

#### learningFormats (array)
| Display Label | Internal Value |
|---|---|
| `Demo` | `DEMO` |
| `Didactic` | `DIDACTIC` |
| `Discussion` | `DISCUSSION` |

---

### POST /api/admin/trainings *(Admin only)*

Create a new training. Immediately published and visible to MED users.

**Authentication**: Required (Bearer token — ADMIN role)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Display label, e.g. `"Online Training"` |
| `brand` | string | Yes | Display label, e.g. `"MINT Lift® PDO Threads"` |
| `level` | string | Yes | Display label, e.g. `"Supplemental"` |
| `learningFormats` | string[] (JSON) | Yes | Array of display labels, e.g. `["Demo","Didactic"]` |
| `title` | string | Yes | Training title |
| `speaker` | string | Yes | Speaker name |
| `speakerIntro` | string | Yes | Speaker biography / introduction |
| `productsUsed` | string | No | Products used in the training |
| `areasCovered` | string | Yes | Body areas or topics covered |
| `description` | string | Yes | Full training description |
| `location` | string | Yes | Venue / city, e.g. `"Morristown, NJ"` |
| `scheduledAt` | string (ISO 8601) | Yes | Date and time of the training, e.g. `"2026-03-15T09:00:00.000Z"` |
| `backgroundImage` | file | No | Background photo (JPEG, PNG, WebP, max 10 MB) |

> **Note on `learningFormats`**: When sending as `multipart/form-data`, the array must be serialized as a JSON string in the form field, then parsed server-side. Example: `learningFormats=["Demo","Didactic"]`

**Example using cURL**:

```bash
curl -X POST http://localhost:5656/api/admin/trainings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "type=Online Training" \
  -F "brand=MINT Lift® PDO Threads" \
  -F "level=Supplemental" \
  -F 'learningFormats=["Demo","Didactic"]' \
  -F "title=Advanced PDO Thread Techniques" \
  -F "speaker=Dr. Jane Smith" \
  -F "speakerIntro=Dr. Smith is a board-certified dermatologist with 15 years of experience." \
  -F "productsUsed=MINT Lift 23G Bi-directional" \
  -F "areasCovered=Midface, Jawline, Neck" \
  -F "description=A comprehensive hands-on training covering advanced PDO thread placement techniques." \
  -F "location=Morristown, NJ" \
  -F "scheduledAt=2026-03-15T09:00:00.000Z" \
  -F "backgroundImage=@/path/to/photo.jpg"
```

**Success Response** (201)

```json
{
  "success": true,
  "message": "Training created successfully",
  "data": {
    "id": "training-uuid",
    "type": "Online Training",
    "brand": "MINT Lift® PDO Threads",
    "level": "Supplemental",
    "learningFormats": ["Demo", "Didactic"],
    "title": "Advanced PDO Thread Techniques",
    "speaker": "Dr. Jane Smith",
    "speakerIntro": "Dr. Smith is a board-certified dermatologist...",
    "productsUsed": "MINT Lift 23G Bi-directional",
    "areasCovered": "Midface, Jawline, Neck",
    "description": "A comprehensive hands-on training...",
    "backgroundImagePath": "uploads/trainings-bg-img/training_1234567890.jpg",
    "location": "Morristown, NJ",
    "scheduledAt": "2026-03-15T09:00:00.000Z",
    "price": 1500,
    "creditScore": 0,
    "createdBy": "admin-user-uuid",
    "createdAt": "2026-02-26T12:00:00.000Z",
    "updatedAt": "2026-02-26T12:00:00.000Z"
  }
}
```

> **Note on `price` and `creditScore`**: These are set automatically by the server based on the chosen `level`. They are **not** accepted as request fields — any values sent will be ignored.

**Error Response** (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "type is required",
    "learningFormats must be a non-empty array"
  ]
}
```

> **Background image URL**: To display the background image, construct the full URL as `http://localhost:5656/<backgroundImagePath>`.

---

### GET /api/trainings *(MED and ADMIN)*

List all trainings. Returns a summary view — no enrollment details.

**Authentication**: Required (Bearer token — MED or ADMIN role)

**Success Response** (200)

```json
{
  "success": true,
  "message": "Trainings retrieved successfully",
  "data": [
    {
      "id": "training-uuid",
      "type": "Online Training",
      "brand": "MINT Lift® PDO Threads",
      "level": "Supplemental",
      "learningFormats": ["Demo", "Didactic"],
      "title": "Advanced PDO Thread Techniques",
      "speaker": "Dr. Jane Smith",
      "backgroundImagePath": "uploads/trainings-bg-img/training_1234567890.jpg",
      "location": "Morristown, NJ",
      "scheduledAt": "2026-03-15T09:00:00.000Z",
      "price": 1500,
      "creditScore": 0,
      "createdAt": "2026-02-26T12:00:00.000Z",
      "_count": { "enrollments": 12 }
    }
  ]
}
```

---

### GET /api/trainings/:id *(MED and ADMIN)*

Get full details of a training including whether the authenticated user is enrolled.

**Authentication**: Required (Bearer token — MED or ADMIN role)

**URL Parameter**: `id` — training UUID

**Success Response** (200)

```json
{
  "success": true,
  "message": "Training retrieved successfully",
  "data": {
    "id": "training-uuid",
    "type": "Online Training",
    "brand": "MINT Lift® PDO Threads",
    "level": "Supplemental",
    "learningFormats": ["Demo", "Didactic"],
    "title": "Advanced PDO Thread Techniques",
    "speaker": "Dr. Jane Smith",
    "speakerIntro": "Dr. Smith is a board-certified dermatologist...",
    "productsUsed": "MINT Lift 23G Bi-directional",
    "areasCovered": "Midface, Jawline, Neck",
    "description": "A comprehensive hands-on training...",
    "backgroundImagePath": "uploads/trainings-bg-img/training_1234567890.jpg",
    "location": "Morristown, NJ",
    "scheduledAt": "2026-03-15T09:00:00.000Z",
    "price": 1500,
    "creditScore": 0,
    "createdBy": "admin-user-uuid",
    "createdAt": "2026-02-26T12:00:00.000Z",
    "updatedAt": "2026-02-26T12:00:00.000Z",
    "isEnrolled": false,
    "_count": { "enrollments": 12 }
  }
}
```

**Error Response** (404)

```json
{
  "success": false,
  "message": "Training not found"
}
```

---

### POST /api/trainings/:id/enroll *(MED only)*

Enroll the authenticated MED user in a training. Idempotent — calling it again if already enrolled is a no-op and still returns success.

**Authentication**: Required (Bearer token — MED role)

**URL Parameter**: `id` — training UUID

**Request Body**: None

**Success Response** (200)

```json
{
  "success": true,
  "message": "Enrolled successfully"
}
```

**Error Response** (404)

```json
{
  "success": false,
  "message": "Training not found"
}
```

---

### Training Background Images

Background images are stored at `uploads/trainings-bg-img/` on the server filesystem. To display them in the app, construct the full URL as:

```
http://localhost:5656/<backgroundImagePath>
```

Example:
```
http://localhost:5656/uploads/trainings-bg-img/training_1706270400000.jpg
```

---

## Credit Endpoints

MED users earn credit score (in-house currency) each time they enroll in a training. Credits can later be spent in the store. This section covers the read side — tracking balance and history.

### How Credits Work

| Event | Effect |
|---|---|
| User enrolls in a training with `creditScore > 0` | `creditBalance` incremented; `EARNED` transaction recorded |
| User enrolls again in the same training | No-op — no duplicate credit awarded |
| Training with `creditScore = 0` (Supplemental) | Enrollment created; no credit transaction |
| Future store purchase | `creditBalance` decremented; `SPENT` transaction recorded |

> Credit balance is stored on the `User` row and updated atomically with each transaction, so the balance is always consistent with the transaction ledger.

---

### GET /api/credits *(MED only)*

Returns the authenticated user's current credit balance, aggregated totals, and full transaction history.

**Authentication**: Required (Bearer token — MED role)

**Success Response** (200)

```json
{
  "success": true,
  "message": "Credit summary retrieved successfully",
  "data": {
    "currentBalance": 4500,
    "totalEarned": 6000,
    "totalSpent": 1500,
    "transactions": [
      {
        "id": "txn-uuid-1",
        "type": "EARNED",
        "amount": 3000,
        "description": "Enrolled in Advanced PDO Thread Techniques",
        "referenceId": "training-uuid",
        "createdAt": "2026-02-26T14:00:00.000Z"
      },
      {
        "id": "txn-uuid-2",
        "type": "SPENT",
        "amount": 1500,
        "description": "Store purchase: MINT Lift® Kit",
        "referenceId": "order-uuid",
        "createdAt": "2026-02-25T10:30:00.000Z"
      },
      {
        "id": "txn-uuid-3",
        "type": "EARNED",
        "amount": 3000,
        "description": "Enrolled in Advanced PDO Thread Techniques",
        "referenceId": "training-uuid-2",
        "createdAt": "2026-02-20T09:00:00.000Z"
      }
    ]
  }
}
```

**Field Reference**

| Field | Type | Description |
|---|---|---|
| `currentBalance` | int | Current spendable credit balance |
| `totalEarned` | int | Lifetime credits earned across all enrollments |
| `totalSpent` | int | Lifetime credits spent (store purchases, etc.) |
| `transactions[].type` | `EARNED` \| `SPENT` | Direction of the transaction |
| `transactions[].amount` | int | Always positive — `type` indicates direction |
| `transactions[].description` | string | Human-readable label |
| `transactions[].referenceId` | string \| null | Source ID (training UUID, order ID, etc.) |

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials or token) |
| 403 | Forbidden (valid token but insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |
