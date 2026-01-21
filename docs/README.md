# Hans Mobile API

A Node.js/Express REST API backend for the Hans mobile application (React Native).

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5
- **Database**: PostgreSQL with Prisma 7 ORM
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Email**: Nodemailer

## Project Structure

```
hans-mobile-api/
├── docs/                          # Documentation
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── app.ts                     # Application entry point
│   ├── config/
│   │   └── prisma.ts              # Prisma client singleton
│   ├── controllers/               # Request handlers
│   ├── middlewares/               # Express middlewares
│   ├── routes/                    # Route definitions
│   ├── services/                  # Business logic
│   ├── utils/                     # Helper functions
│   └── generated/prisma/          # Generated Prisma client
├── .env                           # Environment variables
├── prisma.config.ts               # Prisma 7 configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

## Getting Started

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

The API will be available at `http://localhost:5656`.

## API Documentation

See [API.md](./API.md) for complete endpoint documentation.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled production build |

## Database

This project uses Prisma 7 with PostgreSQL. Key differences from earlier Prisma versions:

- Database URL is configured in `prisma.config.ts`, not in `schema.prisma`
- Requires driver adapters (`@prisma/adapter-pg`) for database connections
- Run `npx prisma generate` after schema changes
- Run `npx prisma db push` to sync schema (development)
- Run `npx prisma migrate dev` for migrations (production)
