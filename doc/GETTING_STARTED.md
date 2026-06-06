# Getting Started with Prestige Club

Welcome! This guide will get you from zero to running in 5 minutes.

## 🎯 What You're About to Run

A user matching API that finds the top 3 most compatible users based on:
- 🏙️ Same city (20% weight)
- 📅 Similar age (20% weight)  
- 🎯 Shared goals (30% weight)
- 📈 Similar self-growth scores (30% weight)

## ⚡ Quick Start (Automated)

```bash
./setup.sh
npm run dev
```

That's it! API running at `http://localhost:3000`

## 📋 Manual Setup (Step by Step)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Database
```bash
docker-compose up -d
```

### 3. Setup Database Schema
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. (Optional) Add Sample Data
```bash
npm run prisma:seed
```

### 5. Start Server
```bash
npm run dev
```

You should see:
```
🚀 Server running on port 3000
📊 Environment: development
🔗 Health check: http://localhost:3000/health
```

## 🧪 Verify It Works

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Test 2: Create a User
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

Save the `id` from the response!

### Test 3: Find Matches
```bash
# Replace {id} with the actual UUID from Test 2
curl http://localhost:3000/users/{id}/match
```

You should get top 3 compatible users with scores!

## 📚 Next Steps

### Read the Documentation
- **README.md** - Full documentation
- **API.md** - Complete API reference
- **VERIFICATION_CHECKLIST.md** - Detailed verification steps

### Run the Tests
```bash
npm test
```

### Explore the Code
Start with these files:
- `src/utils/scoring.ts` - Matching algorithm
- `src/routes/users.routes.ts` - API endpoints
- `tests/unit/scoring.test.ts` - Algorithm tests

### Try More Requests

**List all users:**
```bash
curl http://localhost:3000/users
```

**With pagination:**
```bash
curl "http://localhost:3000/users?limit=10"
```

**Create more users and find matches!**

## 🐛 Troubleshooting

### Port 5432 already in use?
Another PostgreSQL is running. Either stop it:
```bash
sudo systemctl stop postgresql
```

Or change the port in `docker-compose.yml` and `.env`

### Migration failed?
Reset everything:
```bash
docker-compose down -v
docker-compose up -d
sleep 5
npm run prisma:migrate
```

### Tests failing?
Make sure PostgreSQL is running:
```bash
docker-compose ps
```

### TypeScript errors?
Regenerate Prisma client:
```bash
npm run prisma:generate
```

## 💡 Tips

1. **Use the seed data** - Run `npm run prisma:seed` to get 6 sample users
2. **Check the logs** - Prisma logs all SQL queries in development
3. **Test the matching** - Create users with different attributes to see scores change
4. **Read the formula** - Check README.md for detailed scoring explanation

## 🎓 Understanding the Project

### Project Structure
```
src/
├── routes/       # API endpoints
├── controllers/  # Request handlers
├── services/     # Business logic
├── repositories/ # Database queries
└── utils/        # Scoring algorithm
```

### Key Files
- `src/utils/scoring.ts` - Core matching logic (start here!)
- `src/repositories/users.repo.ts` - SQL queries for matching
- `src/routes/users.routes.ts` - API definitions

### How Matching Works
1. Get target user from database
2. Pre-filter candidates (same city OR shared goals)
3. Calculate compatibility for each candidate
4. Return top 3 with score breakdown

## 🚀 Ready for More?

- Add new features (see CONTRIBUTING.md)
- Scale the service (see README.md § Performance & Scaling)
- Deploy to production (see Docker setup)
- Integrate with a frontend

## 📞 Need Help?

1. Check **VERIFICATION_CHECKLIST.md** for setup issues
2. Read **README.md** for detailed documentation
3. See **API.md** for endpoint examples
4. Review test files for usage patterns

---

**You're all set!** 🎉

The API is running and ready to match users. Happy coding!
