Here's a complete backend engineering doc, written from the product brief and scoped to Express.js + PostgreSQL. I've made the implicit decisions explicit and added the parts a product doc usually leaves out (transactions, validation, indexing strategy, scaling, testing).

# Prestige Club — Backend Engineering Spec

## 1. Overview

We're building a user matching service. Users have a profile (demographics, goals, a self-growth score), and the system returns the top 3 most compatible users for any given user based on a weighted compatibility formula.

Scope for this task: a single service exposing three endpoints, backed by Postgres. No auth, no frontend. Focus areas per the brief are schema quality, clean code, API design, error handling, matching clarity, and performance.

## 2. Stack & conventions

- Node.js v20+
- Express (we'll use Express over Fastify since the team standard is Express)
- PostgreSQL 15+
- Query layer: `pg` with raw parameterized SQL. The matching query needs Postgres-specific operators (array intersection), so raw SQL keeps it explicit and tunable. An ORM would obscure the index usage we care about.
- Validation: `zod` at the request boundary
- Config: environment variables via `dotenv`
- Lint/format: ESLint + Prettier

Folder layout:

src/
config/ db pool, env loading
db/ migrations, seed
routes/ express routers
controllers/ request/response handling
services/ business logic (matching lives here)
repositories/ SQL queries
middleware/ error handler, validation
utils/ scoring helpers
app.js express app wiring
server.js startup
tests/

The layering keeps the matching algorithm in `services/` and the SQL in `repositories/`, so the scoring logic is unit-testable without a database.

## 3. Data model

### 3.1 User entity

| Field               | Type           | Notes                                     |
| ------------------- | -------------- | ----------------------------------------- |
| `id`                | `uuid`         | PK, `gen_random_uuid()` default           |
| `name`              | `text`         | not null                                  |
| `age`               | `integer`      | not null, check `age >= 0 AND age <= 120` |
| `city`              | `text`         | not null                                  |
| `education_level`   | enum           | not null                                  |
| `goals`             | `text[]`       | not null, default `'{}'`                  |
| `score_self_growth` | `numeric(5,2)` | not null, check `0 <= score <= 100`       |
| `created_at`        | `timestamptz`  | default `now()`                           |

We use `uuid` over serial so IDs aren't guessable or enumerable, and so we can generate them client-side later if needed.

`education_level` is a Postgres enum. The brief doesn't define the values, so we'll use a sensible default set and document it:

```sql
CREATE TYPE education_level AS ENUM (
  'high_school',
  'associate',
  'bachelor',
  'master',
  'phd'
);
```

Note: `education_level` is stored but is not part of the compatibility formula in the brief. We keep it on the model as specified but flag that it carries no scoring weight today.

### 3.2 Schema (migration)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()

CREATE TYPE education_level AS ENUM (
  'high_school', 'associate', 'bachelor', 'master', 'phd'
);

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

### 3.3 Indexes

| Index                                                          | Purpose                                                                                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CREATE INDEX idx_users_city ON users (city);`                 | The matching query can pre-filter or boost same-city candidates; useful when we later shard the candidate pool by city.                                              |
| `CREATE INDEX idx_users_goals_gin ON users USING gin (goals);` | GIN index on the `text[]` column so goal-overlap filtering (`goals && $1`) uses an index instead of scanning every row. This is the key index for matching at scale. |
| `CREATE INDEX idx_users_score ON users (score_self_growth);`   | Supports range filtering on self-growth score when we add candidate pre-filtering.                                                                                   |

The GIN index on `goals` is the one that matters most for the matching endpoint. The brief asks us to mention indexes — these are the three to call out, with the GIN index being the headline.

## 4. API contracts

All responses are JSON. Errors follow a consistent envelope (see §6).

### 4.1 POST /users

Creates a user.

Request body:

```json
{
  "name": "Ava",
  "age": 29,
  "city": "Tehran",
  "educationLevel": "master",
  "goals": ["fitness", "reading", "startup"],
  "scoreSelfGrowth": 72.5
}
```

Validation:

- `name`: non-empty string
- `age`: integer 0–120
- `city`: non-empty string
- `educationLevel`: one of the enum values
- `goals`: array of non-empty strings (we lowercase and de-duplicate before storing so goal matching is case-insensitive)
- `scoreSelfGrowth`: number 0–100

Response `201`:

```json
{
  "id": "…uuid…",
  "name": "Ava",
  "age": 29,
  "city": "Tehran",
  "educationLevel": "master",
  "goals": ["fitness", "reading", "startup"],
  "scoreSelfGrowth": 72.5,
  "createdAt": "2026-06-06T10:00:00Z"
}
```

Errors: `400` on validation failure.

### 4.2 GET /users

Returns users. Paginate from day one so this endpoint doesn't fall over at scale.

Query params:

- `limit` (default 50, max 200)
- `cursor` (opaque, keyset pagination on `created_at, id`)

Response `200`:

```json
{
  "data": [
    {
      /* user */
    }
  ],
  "nextCursor": "…or null…"
}
```

We use keyset pagination rather than `OFFSET` because `OFFSET` degrades linearly and the brief explicitly cares about 1M+ users.

### 4.3 GET /users/:id/match

Returns the top 3 most compatible users for the given user.

Path param: `id` (uuid).

Response `200`:

```json
{
  "userId": "…uuid…",
  "matches": [
    {
      "user": {
        /* matched user */
      },
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

We return the `breakdown` so the score is explainable and debuggable — this directly serves the "matching logic clarity" evaluation criterion.

Errors:

- `400` if `id` is not a valid uuid
- `404` if the user doesn't exist

The target user is always excluded from its own match results.

## 5. Matching algorithm

Final score, weighted as the brief specifies:

$$S = 0.2 \cdot C + 0.2 \cdot A + 0.3 \cdot G + 0.3 \cdot S_g$$

Each component is on a 0–100 scale before weighting.

City:
$$C = \begin{cases} 100 & \text{if } city_1 = city_2 \\ 0 & \text{otherwise} \end{cases}$$

Age, where $\Delta a = |age_1 - age_2|$:
$$A = 100 \cdot \max\left(0,\ 1 - \frac{\Delta a}{20}\right)$$
A 20-year gap or more scores 0.

Goals (Jaccard similarity):
$$G = 100 \cdot \frac{|Goals_1 \cap Goals_2|}{|Goals_1 \cup Goals_2|}$$
Edge case: if both users have empty goal sets, the union is 0. We define $G = 0$ in that case (no shared interest signal), and document it.

Self-growth, where $\Delta s = |score_1 - score_2|$:
$$S_g = 100 - \Delta s$$
Since both scores are 0–100, $\Delta s \in [0,100]$, so $S_g$ stays in range.

### 5.1 Implementation strategy

Two valid approaches; we recommend the hybrid:

1. Pure SQL — compute the score directly in the query and `ORDER BY score DESC LIMIT 3`. Fast, but the formula lives in SQL and is harder to unit test.
2. Pure app-side — load all users, score in Node. Clean and testable, but loads the whole table. Unacceptable at 1M users.

Recommended hybrid: push candidate filtering and a SQL-side score approximation into Postgres to shrink the result set, then optionally re-rank the small candidate set in Node.

Candidate pre-filter (uses the GIN and city indexes):

```sql
SELECT *
FROM users
WHERE id <> $1
  AND (city = $2 OR goals && $3)   -- same city OR at least one shared goal
ORDER BY ...
LIMIT 200;
```

Users sharing neither city nor any goal score at most `0.2·A + 0.3·Sg = max 50`, and in practice rank far below users who match on city or goals. Pre-filtering to "same city or overlapping goals" captures the realistic top matches while letting the GIN index do the heavy lifting. We document this as a deliberate accuracy/performance tradeoff.

For the exact, fully-correct version (small datasets or when accuracy must be perfect), compute the full score in SQL:

```sql
SELECT
  u.*,
  (
    0.2 * CASE WHEN u.city = $2 THEN 100 ELSE 0 END
    + 0.2 * 100 * GREATEST(0, 1 - ABS(u.age - $3) / 20.0)
    + 0.3 * 100 * (
        COALESCE(cardinality(ARRAY(SELECT unnest(u.goals) INTERSECT SELECT unnest($4::text[])), 0)::numeric
        / NULLIF(cardinality(ARRAY(SELECT unnest(u.goals) UNION SELECT unnest($4::text[])), 0)
      )
    + 0.3 * (100 - ABS(u.score_self_growth - $5))
  ) AS score
FROM users u
WHERE u.id <> $1
ORDER BY score DESC
LIMIT 3;
```

Keep the scoring functions also implemented in `utils/scoring.js` so we can unit test each component (city, age, goals, self-growth) in isolation against known inputs.

## 6. Error handling

Centralized Express error middleware. Single response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "age must be between 0 and 120"
  }
}
```

| Status | Code               | When                                             |
| ------ | ------------------ | ------------------------------------------------ |
| 400    | `VALIDATION_ERROR` | bad body / params                                |
| 404    | `NOT_FOUND`        | user id doesn't exist                            |
| 409    | `CONFLICT`         | reserved for future uniqueness rules             |
| 500    | `INTERNAL_ERROR`   | unexpected; never leak stack traces in responses |

Rules:

- Validate at the boundary with zod; convert zod errors to `400` in middleware.
- Wrap async handlers so rejected promises reach the error middleware (use `express-async-errors` or a small `asyncHandler`).
- Log full error detail server-side; return a generic message to the client on `500`.

## 7. Performance & scaling (1M+ users)

This is a core evaluation criterion, so address it explicitly in the README.

- GIN index on `goals` is what keeps the match query sublinear instead of full-scanning.
- Candidate pre-filtering (§5.1) bounds the scored set to a few hundred rows regardless of table size.
- Keyset pagination on `GET /users` avoids `OFFSET` blowup.
- Connection pooling via `pg.Pool`; size the pool to the DB's connection limit.
- For very high scale, partition `users` by `city` or by a hash, so the match candidate pool is naturally smaller per partition.
- Consider a materialized/denormalized "goal popularity" structure later if goal-overlap queries become hot.

## 8. Caching

Where caching helps, per the README requirement:

- Match results per user (`GET /users/:id/match`): the most expensive read. Cache in Redis with a short TTL (e.g. 5 min) keyed by user id. Invalidate when a new user is created (the candidate set changed) or accept staleness within the TTL.
- Individual user reads: cache-aside on user id.
- Don't cache `GET /users` list pages aggressively since they change on every insert; rely on pagination instead.

Caching is out of scope for the initial implementation but should be designed for — keep the match service behind a clean interface so a cache layer drops in without touching the algorithm.

## 9. Testing

- Unit tests for each scoring component in `utils/scoring.js` (city match, age decay at 0/10/20 year gaps, Jaccard including the empty-set edge case, self-growth delta).
- Unit test for the combined weighted score against a hand-computed example.
- Integration tests for the three endpoints against a test database (use `testcontainers` or a disposable Postgres), covering the 400/404 paths.
- Seed script that inserts a known fixture set so `GET /users/:id/match` returns a deterministic, asserted top-3.

## 10. README deliverables checklist

The brief grades the README specifically. It must cover:

- How to run (env vars, `docker-compose up` for Postgres, migrate, seed, start).
- The compatibility formula with the weights and component definitions (§5).
- Suggested indexes and why (§3.3).
- Optimizations for 1M+ users (§7).
- Where caching helps (§8).

## 11. Open questions for product

- `educationLevel` is on the model but unused in scoring. Intentional, or should it carry weight?
- Confirm the enum values for `educationLevel`.
- Should the match endpoint exclude users from different cities entirely, or just rank them lower? (Affects whether the city pre-filter is safe.)
- Is goal matching case-sensitive? We're assuming case-insensitive and normalizing on write.

---

Want me to turn this into the actual repo scaffold — migrations, the Express app, the scoring module with tests, and the README — or break it into ticketed tasks for the team first?
