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
- "Invalid email or password"
- "Invalid OTP"
- "Invalid or expired OTP"
- "Invalid or expired reset token"
- "Invalid role"

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

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request Body**

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "password": "securepassword123",
  "confirmPassword": "securepassword123",
  "role": "USER"
}
```

**Validation Rules**

| Field | Rules |
|-------|-------|
| fullName | Required, non-empty string |
| email | Required, valid email format |
| phoneNumber | Required, non-empty string |
| password | Required, minimum 8 characters |
| confirmPassword | Must match password |
| role | Optional, must be "USER" or "MED" (defaults to "USER"). ADMIN role cannot be registered. |

**Success Response** (201)

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "role": "USER"
  }
}
```

**Error Response** (400)

```json
{
  "success": false,
  "message": "Email already registered"
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
      "phoneNumber": "+1234567890",
      "role": "USER"
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

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials or token) |
| 500 | Internal Server Error |
