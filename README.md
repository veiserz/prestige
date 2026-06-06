# Prestige Club - User Matching Service

A production-quality user matching API built with Node.js, Express, Prisma, and PostgreSQL. The service matches users based on compatibility across multiple dimensions: location, age, shared goals, and personal growth metrics.

## 🚀 Features

- **User Management**: Create and retrieve user profiles with demographics and goals
- **Smart Matching**: Find top 3 most compatible users using a weighted scoring algorithm
- **High Performance**: GIN-indexed goal matching for sub-linear query performance
- **Type-Safe**: Built with TypeScript and Prisma for end-to-end type safety
- **Well-Tested**: Comprehensive unit and integration test coverage
- **Production-Ready**: Proper error handling, validation, and graceful shutdown

## 📋 Tech Stack

- **Runtime**: Node.js v20+
- **Framework**: Express
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Language**: TypeScript (ESM)
- **Validation**: Zod
- **Testing**: Vitest + Supertest
- **Linting**: ESLint + Prettier

## 🏗 Architecture

```
src/
├── config/          # Environment and database configuration
├── routes/          # Express route definitions
├── controllers/     # Request/response handling
├── services/        # Business logic layer
├── repositories/    # Database access layer (Prisma + raw SQL)
├── utils/           # Pure utility functions (scoring logic)
└── middleware/      # Validation and error handling
```

**Design Principles**:
- **Layered Architecture**: Clear separation between routes, business logic, and data access
- **Dependency Injection**: Services and repositories are injectable for testability
- **Pure Functions**: Scoring logic isolated in utils for unit testing without database
- **Raw SQL for Complex Queries**: Uses Prisma `$queryRaw` for Jaccard similarity calculations

## 🔧 Setup Instructions

### Prerequisites

- Node.js v20 or higher
- Docker and Docker Compose (for PostgreSQL)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd prestige-club
```

2. **Install dependencies**
```bash
npm install
```

3. **Start PostgreSQL with Docker**
```bash
docker-compose up -d
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env if needed (default values work with docker-compose)
```

5. **Run database migrations**
```bash
npm run prisma:generate
npm run prisma:migrate
```

This will:
- Generate Prisma client
- Create the database schema
- Add the GIN index on goals (see note below)

6. **Seed the database (optional)**
```bash
npm run prisma:seed
```

7. **Start the development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

Returns server status and timestamp.

### Create User
```
POST /users
Content-Type: application/json

{
  "name": "Alice",
  "age": 28,
  "city": "Tehran",
  "educationLevel": "bachelor",  // high_school | associate | bachelor | master | phd
  "goals": ["fitness", "reading", "travel"],
  "scoreSelfGrowth": 75.5  // 0-100
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "name": "Alice",
  "age": 28,
  "city": "Tehran",
  "educationLevel": "bachelor",
  "goals": ["fitness", "reading", "travel"],
  "scoreSelfGrowth": 75.5,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### Get All Users
```
GET /users?limit=50&cursor=<uuid>
```

**Query Parameters**:
- `limit` (optional): 1-200, default 50
- `cursor` (optional): UUID for keyset pagination

**Response** (200):
```json
{
  "data": [...users],
  "nextCursor": "uuid-or-null"
}
```

### Get User Matches
```
GET /users/:id/match
```

**Response** (200):
```json
{
  "userId": "uuid",
  "matches": [
    {
      "user": { ...user },
      "score": 81.4,
      "breakdown": {
        "city": 100,
        "age": 90,
        "goals": 66.7,
        "selfGrowth": 78.5
      }
    }
  ]
}
```

## 🧮 Compatibility Score Logic

The matching algorithm calculates a weighted compatibility score between 0-100 based on four components:

### Formula
```
S = 0.2 × C + 0.2 × A + 0.3 × G + 0.3 × Sg
```

### Components (each scored 0-100 before weighting)

**1. City Match (C)** — Weight: 20%
- 100 if cities match (case-insensitive)
- 0 otherwise

**2. Age Similarity (A)** — Weight: 20%
```
A = 100 × max(0, 1 - |age₁ - age₂| / 20)
```
- Score decreases linearly with age difference
- ≥20 year gap results in 0

**3. Shared Goals (G)** — Weight: 30%
```
G = 100 × |goals₁ ∩ goals₂| / |goals₁ ∪ goals₂|
```
- Uses Jaccard similarity: intersection over union
- Case-insensitive matching
- Returns 0 if both goal sets are empty (no signal)

**4. Self-Growth Score Similarity (Sg)** — Weight: 30%
```
Sg = 100 - |score₁ - score₂|
```
- Score decreases linearly with difference
- 100-point difference results in 0

### Example Calculation

**User A**: Tehran, age 28, goals=[fitness, reading, travel], score=75  
**User B**: Tehran, age 30, goals=[fitness, reading], score=78

```
C = 100          (same city)
A = 90           (2-year difference: 100 × (1 - 2/20))
G = 66.67        (2 shared / 3 total: 100 × 2/3)
Sg = 97          (3-point difference: 100 - 3)

S = 0.2×100 + 0.2×90 + 0.3×66.67 + 0.3×97
  = 20 + 18 + 20 + 29.1
  = 87.1
```

## 🗄 Database Design

### Schema
```sql
CREATE TYPE education_level AS ENUM ('high_school', 'associate', 'bachelor', 'master', 'phd');

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  age                 integer NOT NULL CHECK (age >= 0 AND age <= 120),
  city                text NOT NULL,
  education_level     education_level NOT NULL,
  goals               text[] NOT NULL DEFAULT '{}',
  score_self_growth   numeric(5,2) NOT NULL CHECK (score_self_growth >= 0 AND score_self_growth <= 100),
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `idx_users_city` | B-tree | Filter candidates by city for locality-based matching |
| `idx_users_score` | B-tree | Range queries on self-growth scores |
| `idx_users_goals_gin` | GIN | **Critical**: Fast array overlap queries (`goals && target_goals`) |

**Note on GIN Index**: Prisma's schema language doesn't support GIN indexes. After running `prisma migrate dev`, manually add to the migration:

```sql
CREATE INDEX idx_users_goals_gin ON users USING gin (goals);
```

This index is essential for performance — it turns the matching query from O(n) scan to an indexed probe.

## 📊 Performance & Scaling

### Current Optimizations

1. **GIN-Indexed Goal Matching**
   - Array overlap queries (`&&`) use the GIN index
   - Pre-filters candidates before scoring
   - Reduces matching from O(n) to O(log n) candidates

2. **Keyset Pagination**
   - Uses `(createdAt, id)` cursor instead of OFFSET
   - Maintains consistent performance regardless of page depth

3. **Raw SQL for Complex Scoring**
   - Calculates weighted scores in-database
   - Returns only top 3, avoiding application-side sorting

### Scaling to 1M+ Users

**Phase 1: Database Optimization** (100K - 1M users)
- ✅ GIN index already in place
- Add connection pooling via **PgBouncer** (transaction mode)
- Configure Prisma connection pool:
  ```
  DATABASE_URL="...?connection_limit=20&pool_timeout=10"
  ```
- Set up **read replicas** for `GET /users` and match queries
- Primary handles writes only

**Phase 2: Query Optimization** (1M+ users)
- **Partition by city**: If user distribution is geographic
  ```sql
  CREATE TABLE users_partitioned (...)
  PARTITION BY LIST (city);
  ```
- **Materialized candidate sets**: Pre-compute top 100 candidates per user nightly
- **Approximate matching**: For >10M, use MinHash/LSH for goal similarity

**Phase 3: Caching Layer** (high read traffic)
- See caching strategy below

**Phase 4: Horizontal Scaling** (>10M users)
- Shard database by user ID range or city
- Use a search index (Elasticsearch) for candidate discovery
- Move to async job queue for match computation

### Performance Numbers (Estimated)

| User Count | Match Query Time | Strategy |
|------------|------------------|----------|
| 10K | <50ms | Raw query with GIN index |
| 100K | <200ms | + Read replicas |
| 1M | <500ms | + Pre-filtering by city |
| 10M+ | <1s | + Materialized candidates + async jobs |

## 🗂 Caching Strategy

### Where Caching Helps

**1. Match Results** (Highest Impact)
- **Key**: `match:{userId}:{version}`
- **TTL**: 60 seconds
- **Strategy**: Cache-aside
- **Invalidation**: Bump global `users:version` counter on every `POST /users`
  - Simple and correct: new users can change anyone's top-3
  - Trade-off: Flushes all match caches on each insert
  - For high write rates, partition invalidation by city/goal buckets

**2. Individual User Reads**
- **Key**: `user:{userId}`
- **TTL**: 5 minutes
- **Invalidation**: On user update (not implemented yet)

**3. User List** (Lower Priority)
- Paginated lists change on every insert
- Cache only if read:write ratio is very high
- Use short TTL (<30s)

### Implementation Approach

```typescript
interface CachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
}

class RedisCache implements CachePort {
  // Redis implementation
}

class NoOpCache implements CachePort {
  // In-memory no-op for development
}
```

**Not Implemented Yet**: The service currently runs without caching. The architecture is designed to add Redis caching without touching the core matching logic — just wrap the `UsersService.findMatches()` call.

## 🧪 Testing Strategy

### Unit Tests (`tests/unit/`)
- Pure scoring functions in `utils/scoring.ts`
- No database dependencies
- Fast feedback loop

### Integration Tests (`tests/integration/`)
- Full API endpoint testing
- Uses real Prisma client against test database
- Tests validation, error handling, and business logic

**Run tests before committing**:
```bash
npm test
```

## 🛠 Development Notes

### Prisma Limitations & Workarounds

**Issue**: Prisma cannot express:
- GIN indexes in schema
- Complex array operations (Jaccard similarity)
- Weighted ORDER BY with multiple calculations

**Solution**: 
- Use `prisma.$queryRaw` for the match query
- Document this as the correct, recommended approach
- Keep scoring logic in TypeScript for testability

### Goal Normalization

Goals are normalized on write:
- Lowercased
- Trimmed
- Deduplicated

This ensures case-insensitive matching without runtime overhead.

### Error Handling

All errors return consistent JSON:
```json
{
  "error": "ErrorName",
  "message": "Human-readable message",
  "details": { /* optional */ }
}
```

Status codes:
- `400`: Validation errors
- `404`: Resource not found
- `409`: Conflict (e.g., unique constraint)
- `500`: Unexpected server errors

## 📝 Future Enhancements

- [ ] Add Redis caching layer
- [ ] Implement user update/delete endpoints
- [ ] Add authentication & authorization
- [ ] Expose Prometheus metrics
- [ ] Add rate limiting
- [ ] Support filtering matches by city/age range
- [ ] Real-time match notifications via WebSockets
- [ ] Machine learning-based scoring weights

## 📄 License

MIT

## 👥 Contributing

Contributions welcome! Please ensure:
- All tests pass (`npm test`)
- Code is formatted (`npm run format`)
- No linting errors (`npm run lint`)

---

Built with ❤️ for Prestige Club
