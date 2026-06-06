# Verification Checklist

Use this checklist to verify the complete setup and functionality.

## ✅ Setup Verification

- [ ] Node.js v20+ installed (`node -v`)
- [ ] Dependencies installed (`npm install` completed without errors)
- [ ] PostgreSQL running (`docker-compose ps` shows healthy container)
- [ ] Prisma client generated (`node_modules/.prisma/client` exists)
- [ ] Database migrated (users table exists)
- [ ] Environment variables set (`.env` file exists with DATABASE_URL)

## ✅ Database Verification

Connect to PostgreSQL and verify:

```bash
docker exec -it prestige_postgres psql -U postgres -d prestige_club
```

Run these queries:

```sql
-- Check table exists
\dt

-- Check schema
\d users

-- Check indexes (IMPORTANT: verify GIN index exists)
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';

-- Expected indexes:
-- 1. users_pkey (PRIMARY KEY)
-- 2. idx_users_city
-- 3. idx_users_score
-- 4. idx_users_goals_gin (GIN) ← Critical!

-- If idx_users_goals_gin is missing, add it:
CREATE INDEX idx_users_goals_gin ON users USING gin (goals);
```

## ✅ Server Verification

- [ ] Server starts without errors (`npm run dev`)
- [ ] Health endpoint responds (`curl http://localhost:3000/health`)
- [ ] Server logs show port and environment

Expected output:
```
🚀 Server running on port 3000
📊 Environment: development
🔗 Health check: http://localhost:3000/health
```

## ✅ API Functionality Tests

### 1. Create a user
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "age": 30,
    "city": "Tehran",
    "educationLevel": "bachelor",
    "goals": ["fitness", "reading"],
    "scoreSelfGrowth": 75
  }'
```

- [ ] Returns 201 status
- [ ] Response includes `id` field (UUID)
- [ ] Response includes `createdAt` timestamp
- [ ] Goals are normalized to lowercase

### 2. List users
```bash
curl http://localhost:3000/users
```

- [ ] Returns 200 status
- [ ] Response has `data` array
- [ ] Response has `nextCursor` field

### 3. Find matches
```bash
# Replace {user-id} with actual UUID from step 1
curl http://localhost:3000/users/{user-id}/match
```

- [ ] Returns 200 status
- [ ] Response includes `userId` and `matches` array
- [ ] Each match has `user`, `score`, and `breakdown`
- [ ] Target user is NOT in matches

### 4. Error handling
```bash
# Invalid age
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Invalid", "age": 150, "city": "Tehran", "educationLevel": "bachelor", "goals": [], "scoreSelfGrowth": 50}'

# Non-existent user
curl http://localhost:3000/users/00000000-0000-0000-0000-000000000000/match

# Invalid UUID format
curl http://localhost:3000/users/invalid-id/match
```

- [ ] Returns 400 for validation errors
- [ ] Returns 404 for non-existent resources
- [ ] Error responses have consistent format

## ✅ Test Suite Verification

```bash
npm test
```

- [ ] All tests pass
- [ ] Unit tests for scoring (cityScore, ageScore, goalsScore, selfGrowthScore)
- [ ] Integration tests for all endpoints
- [ ] No test failures or errors

## ✅ Code Quality Checks

```bash
# TypeScript compilation
npm run build

# Linting (optional if eslint configured)
npm run lint

# Formatting (optional if prettier configured)
npm run format
```

- [ ] TypeScript compiles without errors
- [ ] No linting errors (if configured)
- [ ] Code is properly formatted (if configured)

## ✅ Performance Verification

### Check query performance with seed data

```bash
npm run prisma:seed
```

Then in PostgreSQL:

```sql
-- Enable query timing
\timing

-- Test match query performance
EXPLAIN ANALYZE
SELECT u.id, u.name
FROM users u
WHERE u.goals && ARRAY['fitness', 'reading']::text[]
LIMIT 10;

-- Verify it uses the GIN index
-- Look for "Bitmap Index Scan on idx_users_goals_gin"
```

- [ ] Query uses GIN index (not Seq Scan)
- [ ] Query completes in <50ms with seed data

## ✅ Documentation Verification

- [ ] README.md is comprehensive and accurate
- [ ] API.md has complete endpoint documentation
- [ ] QUICKSTART.md provides fast setup path
- [ ] All code examples work as documented

## 🐛 Common Issues & Solutions

### Issue: Port 5432 already in use
**Solution**: 
```bash
# Stop conflicting service
sudo systemctl stop postgresql

# Or change port in docker-compose.yml and .env
```

### Issue: Migration fails
**Solution**:
```bash
docker-compose down -v
docker-compose up -d
sleep 5
npm run prisma:migrate
```

### Issue: GIN index missing
**Solution**:
```bash
docker exec -it prestige_postgres psql -U postgres -d prestige_club \
  -c "CREATE INDEX idx_users_goals_gin ON users USING gin (goals);"
```

### Issue: Tests fail with connection error
**Solution**:
```bash
# Ensure PostgreSQL is running
docker-compose ps

# Check DATABASE_URL in .env
cat .env
```

### Issue: TypeScript errors about Prisma client
**Solution**:
```bash
npm run prisma:generate
```

## 📊 Success Criteria

Your setup is complete and verified when:

✅ All database indexes exist (including GIN)  
✅ Server starts and responds to health checks  
✅ All API endpoints work correctly  
✅ Error handling returns proper status codes  
✅ All tests pass  
✅ Match queries use the GIN index  

## 🎉 Ready for Development!

If all checks pass, you're ready to:
- Extend the API with new features
- Integrate with a frontend application
- Deploy to production
- Scale with the provided strategies

For issues not covered here, see:
- README.md for detailed documentation
- GitHub Issues (if using version control)
- PostgreSQL logs: `docker-compose logs postgres`
- Application logs: Check console output
