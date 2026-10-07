# Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Installation

### 1. Clone and Install Dependencies

```bash
cd hans-mobile-api
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# Server
PORT=5656

# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Authentication
JWT_SECRET=your-secure-random-secret-key

# Email Configuration (Nodemailer)
# For Gmail: use smtp.gmail.com, port 587, and an App Password
# For other providers: check their SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5656) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP server port (default: 587) |
| `SMTP_USER` | No | SMTP username/email |
| `SMTP_PASS` | No | SMTP password or app password |
| `EMAIL_FROM` | No | Sender email address |

**Note**: If SMTP is not configured, OTP codes will be logged to the console for development.

### 3. Database Setup

#### Generate Prisma Client

```bash
npx prisma generate
```

#### Push Schema to Database (Development)

```bash
npx prisma db push
```

#### Create Migrations (Development)

```bash
npx prisma migrate dev --name describe_change
```

Commit migration files with the related code. On production, take a database
backup and apply only committed migrations:

```bash
NODE_ENV=production npx prisma migrate deploy
NODE_ENV=production npx prisma migrate status
```

Do not use `migrate dev`, `db push`, or reset commands in production. See
[deployment.md](./deployment.md) for the automated pipeline and failure recovery.

### 4. Start the Server

#### Development (with hot-reload)

```bash
npm run dev
```

#### Production

```bash
npm run build
npm start
```

## Verify Installation

Test the health endpoint:

```bash
curl http://localhost:5656/api/health
```

Expected response:

```json
{"status":"API is up!"}
```

This is liveness only. `/api/health/ready` verifies access to the expected database
schema and returns HTTP 503 when it is unavailable or incompatible.

## Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. Ensure the database exists and user has permissions

### Prisma Issues

```bash
# Regenerate client after schema changes
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

### TypeScript Errors

```bash
# Check for type errors
npx tsc --noEmit
```
