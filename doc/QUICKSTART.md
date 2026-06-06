# Quick Start Guide

Get the Prestige Club matching service running in under 5 minutes.

## Prerequisites

- Node.js v20+
- Docker & Docker Compose

## Setup (5 steps)

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
docker-compose up -d

# 3. Generate Prisma client & run migrations
npm run prisma:generate
npm run prisma:migrate

# 4. Seed sample data (optional)
npm run prisma:seed

# 5. Start the server
npm run dev
```

The API is now running at `http://localhost:3000`

## Try It Out

### Create a user
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "age": 28,
    "city": "Tehran",
    "educationLevel": "bachelor",
    "goals": ["fitness", "reading", "travel"],
    "scoreSelfGrowth": 75.5
  }'
```

### Get all users
```bash
curl http://localhost:3000/users
```

### Find matches for a user
```bash
# Replace {user-id} with an actual UUID from the previous response
curl http://localhost:3000/users/{user-id}/match
```

## Run Tests

```bash
npm test
```

## Common Issues

**Port 5432 already in use?**
```bash
# Change the port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/prestige_club?schema=public"
```

**Migration issues?**
```bash
# Reset database and re-run migrations
docker-compose down -v
docker-compose up -d
npm run prisma:migrate
```

For full documentation, see [README.md](./README.md)
