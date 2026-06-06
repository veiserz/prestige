Here's a complete, self-contained implementation prompt you can hand to a coding agent (or use as the build spec). It's scoped to Express + Prisma + Postgres and resolves the Prisma-specific tradeoffs (notably that the Jaccard match query needs raw SQL).

---

# Implementation Prompt — Prestige Club Matching Service (Express + Prisma + PostgreSQL)

## Role

You are a senior backend engineer. Build a production-quality user matching service. Follow this spec exactly. Where a decision is left open, pick the sensible default noted here and document it. Write clean, layered, tested code. Run the build and tests before declaring done.

## Tech stack (use these exact choices)

- Node.js v20+, TypeScript, ESM
- Express
- PostgreSQL 15+
- Prisma as the ORM, with `prisma migrate` for schema
- `zod` for request validation
- `vitest` + `supertest` for tests
- `testcontainers` (or a docker-compose Postgres) for integration tests
- ESLint + Prettier
- `dotenv` for config

## Project structure

prestige-club/
prisma/
schema.prisma
migrations/
seed.ts
src/
config/env.ts # zod-validated env loading
config/prisma.ts # PrismaClient singleton
routes/users.routes.ts
controllers/users.controller.ts
services/match.service.ts # matching orchestration
services/users.service.ts
repositories/users.repo.ts # Prisma + raw SQL queries
utils/scoring.ts # pure scoring functions
middleware/error.ts
middleware/validate.ts
app.ts # express wiring
server.ts # startup
tests/
unit/scoring.test.ts
integration/users.test.ts
.env.example
docker-compose.yml
package.json
tsconfig.json
README.md

Keep scoring logic in `utils/scoring.ts` (pure, no DB) so it is unit-testable. Keep all SQL/Prisma access in `repositories/`.

## Prisma schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EducationLevel {
  high_school
  associate
  bachelor
  master
  phd
}

model User {
  id              String         @id @default(uuid()) @db.Uuid
  name            String
  age             Int
  city            String
  educationLevel  EducationLevel @map("education_level")
  goals           String[]       @default([])
  scoreSelfGrowth Decimal        @map("score_self_growth") @db.Decimal(5, 2)
  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([city], name: "idx_users_city")
  @@index([scoreSelfGrowth], name: "idx_users_score")
  @@map("users")
}
```

Important: Prisma cannot create a GIN index on the `goals` array column via the schema declaratively. After running `prisma migrate dev`, hand-edit the generated migration SQL (or add a follow-up migration) to include:

```sql
CREATE INDEX idx_users_goals_gin ON users USING gin (goals);
```

Also add CHECK constraints in that migration (Prisma doesn't model them):

```sql
ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age >= 0 AND age <= 120);
ALTER TABLE users ADD CONSTRAINT chk_score CHECK (score_self_growth >= 0 AND score_self_growth <= 100);
```

Document in the README that the GIN index and CHECK constraints are added via raw SQL in the migration because Prisma's schema language doesn't express them.

## Validation schemas (zod)

`createUserSchema`:

- `name`: string, min length 1
- `age`: int, 0–120
- `city`: string, min length 1
- `educationLevel`: enum of the five values
- `goals`: array of non-empty strings; normalize by lowercasing, trimming, de-duplicating before persisting
- `scoreSelfGrowth`: number, 0–100

`matchParamsSchema`: `id` is a uuid.

`listQuerySchema`: `limit` int 1–200 default 50, `cursor` optional string.

Use a `validate(schema, target)` middleware that parses body/params/query and throws a `ValidationError` (→ 400) on failure.

## Endpoints

### POST /users → 201

Validate, normalize goals, insert via Prisma, return the serialized user. Serialize `scoreSelfGrowth` from Prisma `Decimal` to a JS number in responses.

### GET /users → 200

Keyset pagination, not OFFSET. Order by `(createdAt, id)`. Use Prisma `cursor` + `take`. Return `{ data, nextCursor }`. The cursor is the last item's id (opaque to the client).

### GET /users/:id/match → 200

1. Validate `id` is a uuid (else 400).
2. Load the target user; if missing, 404.
3. Run the matching query (below) and return top 3 with score and component breakdown.
4. Always exclude the target user from its own results.

Response shape:

```json
{
  "userId": "uuid",
  "matches": [
    {
      "user": {
        /* user */
      },
      "score": 81.4,
      "breakdown": { "city": 100, "age": 90, "goals": 66.7, "selfGrowth": 78.5 }
    }
  ]
}
```

## Matching algorithm

Weighted total, each component on 0–100 before weighting:

S = 0.2·C + 0.2·A + 0.3·G + 0.3·Sg

- City C: 100 if same city else 0
- Age A: `100 * max(0, 1 - |a1-a2|/20)` (≥20 yr gap → 0)
- Goals G (Jaccard): `100 * |G1 ∩ G2| / |G1 ∪ G2|`; if both goal sets are empty, G = 0
- Self-growth Sg: `100 - |s1 - s2|`

### Implementation approach (resolve the Prisma limitation explicitly)

Prisma's query builder cannot express array intersection/union (Jaccard) or the weighted ORDER BY. Use `prisma.$queryRaw` for the match query. This is the correct, documented escape hatch — note it in the README.

Use a candidate pre-filter so the query stays sublinear at scale, leveraging the GIN + city indexes, then compute the exact score in SQL and `ORDER BY score DESC LIMIT 3`:

```ts
const matches = await prisma.$queryRaw<MatchRow[]>`
  SELECT
    u.id, u.name, u.age, u.city, u.education_level AS "educationLevel",
    u.goals, u.score_self_growth AS "scoreSelfGrowth", u.created_at AS "createdAt",
    (0.2 * (CASE WHEN u.city = ${target.city} THEN 100 ELSE 0 END))
    + (0.2 * 100 * GREATEST(0, 1 - ABS(u.age - ${target.age}) / 20.0))
    + (0.3 * 100 * COALESCE(
        cardinality(ARRAY(SELECT unnest(u.goals) INTERSECT SELECT unnest(${target.goals}::text[])))::numeric
        / NULLIF(cardinality(ARRAY(SELECT unnest(u.goals) UNION SELECT unnest(${target.goals}::text[]))), 0),
        0))
    + (0.3 * (100 - ABS(u.score_self_growth - ${target.scoreSelfGrowth})))
      AS score
  FROM users u
  WHERE u.id <> ${target.id}::uuid
    AND (u.city = ${target.city} OR u.goals && ${target.goals}::text[])
  ORDER BY score DESC
  LIMIT 3;
`;
```

Notes for the implementer:

- Prisma's tagged-template `$queryRaw` parameterizes interpolated values, so this is injection-safe. Do not switch to `$queryRawUnsafe` with string concatenation.
- The `WHERE … city = ? OR goals && ?` pre-filter is a deliberate accuracy/performance tradeoff: users matching neither city nor any goal can score at most 50 and realistically never reach the top 3. Document this. Provide a `MATCH_EXACT=true` env flag that drops the pre-filter (full scan, exact) for small datasets and to verify correctness in tests.
- Also implement the same four component formulas as pure functions in `utils/scoring.ts` and use them to build the `breakdown` in the response, so the SQL score and the JS breakdown stay consistent and the formulas are unit-testable.

## Error handling

Centralized Express error middleware. Single envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

Codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500). Wrap async handlers so rejections reach the middleware. Map Prisma `P2025` (record not found) to 404. Never leak stack traces; log full detail server-side, return generic message on 500.

## Config

`.env.example`:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/prestige
PORT=3000
MATCH_EXACT=false

Validate env with zod at startup; fail fast if missing.

`docker-compose.yml`: a single Postgres 15 service with a named volume.

## Seed

`prisma/seed.ts`: insert ~20 deterministic users across a few cities, varied ages, overlapping goal sets, and a spread of self-growth scores, so `GET /users/:id/match` returns a stable, assertable top-3.

## Tests

Unit (`tests/unit/scoring.test.ts`):

- City: same → 100, different → 0
- Age: 0 gap → 100, 10 gap → 50, 20+ gap → 0
- Jaccard: known overlap; both-empty → 0
- Self-growth: equal → 100, 30 apart → 70
- Combined weighted score against a hand-computed example

Integration (`tests/integration/users.test.ts`) against a throwaway Postgres:

- POST /users: 201 happy path; 400 on bad age, bad enum, missing fields
- GET /users: pagination returns nextCursor and advances correctly
- GET /users/:id/match: 400 on non-uuid, 404 on unknown id, returns exactly top 3 excluding self, with breakdown present; run with `MATCH_EXACT=true` so results are deterministic and assert the expected ordering from the seed

## package.json scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "lint": "eslint . && prettier --check .b"
  }
}
```

## README (required deliverable — grade depends on it)

Include:

1. Run instructions: `docker-compose up -d`, copy `.env.example` → `.env`, `npm i`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`.
2. The compatibility formula with weights and each component definition, including the empty-goals edge case.
3. Suggested indexes and why — call out the GIN index on `goals` as the key one for match performance, plus the city and score indexes; note GIN and CHECK constraints are applied via raw SQL in the migration.
4. Scaling to 1M+ users: GIN-backed candidate pre-filter keeps matching sublinear; keyset pagination avoids OFFSET cost; connection pooling; optional partitioning by city/hash; the `MATCH_EXACT` flag tradeoff.
5. Where caching helps: Redis cache-aside on `GET /users/:id/match` (short TTL, invalidate on new user insert) and on single-user reads; designed-for but not implemented, behind a clean service interface.

## Definition of done

- `npm run build`, `npm run lint`, and `npm test` all pass.
- All three endpoints work end-to-end against the docker-compose Postgres.
- Migration includes the GIN index and CHECK constraints.
- README covers all five required sections.
- No secrets committed; `.env` gitignored, `.env.example` present.

---

Let me re-check the original task doc so any additions stay aligned with what's actually being asked.
Good — the doc confirms most of the plan, with two things worth flagging and several additions that map directly to the stated evaluation criteria. Here's what I'd add.

## One correction to flag

The task says Fastify is preferred, Express is the fallback (file, summary section 8). My prompt picked Express. That's allowed, but since the grader stated a preference, you have two clean options:

- Stay on Express and add one line in the README justifying it (team familiarity, middleware ecosystem). Acceptable, minor.
- Switch to Fastify to match the preference and pick up easy points — Fastify also gives you native JSON-schema validation, built-in `pino` logging, and faster throughput, which all feed the "performance considerations" criterion.

I'd lean Fastify given it's explicitly preferred and the perf criterion is graded. If you agree, I'll port the prompt (the only real changes are the web layer, validation wiring via JSON schema or `fastify-type-provider-zod`, and the plugin structure — the Prisma/SQL/scoring core is unchanged).

## Additions to the implementation prompt

### A. Deterministic match ordering (correctness bug to preempt)

`ORDER BY score DESC LIMIT 3` is non-deterministic on ties, which breaks the integration test asserting a fixed top-3. Add a stable tiebreaker:

```sql
ORDER BY score DESC, u.created_at ASC, u.id ASC
LIMIT 3;
```

Round the returned score to 2 decimals at the serialization layer (not in SQL) so the JS `breakdown` and the SQL `score` reconcile exactly.

### B. API design polish (feeds the "API design" criterion)

- Add an OpenAPI 3.1 spec. On Fastify use `@fastify/swagger` + `@fastify/swagger-ui` (auto-generated from schemas); on Express use a static `openapi.yaml` served at `/docs`. A live, accurate API doc is the cheapest way to win the API-design score.
- `GET /health` (liveness) and `GET /ready` (checks DB with `SELECT 1`) — standard, and shows production awareness.
- Consistent resource semantics: `POST /users` returns `201` with a `Location: /users/:id` header.

### C. Operational hardening (feeds "error handling" + "performance")

- Structured logging with `pino`, plus a per-request correlation id (`x-request-id`, generated if absent) included in every log line and in the 500 error envelope so failures are traceable.
- Rate limiting on the match endpoint (`@fastify/rate-limit` or `express-rate-limit`) — the Jaccard query is the most expensive path; protect it.
- Graceful shutdown: on `SIGTERM`/`SIGINT`, stop accepting connections, then `prisma.$disconnect()`.
- A global query timeout / statement_timeout so a pathological match query can't pin a connection.

### D. Repo deliverables (the task requires a GitHub link + setup, section 4)

- `Dockerfile` (multi-stage: build → slim runtime) so the whole thing runs with `docker-compose up`.
- GitHub Actions CI: on PR, run `lint`, `build`, `migrate`, `test` against a Postgres service container. A green CI badge in the README signals quality directly to the reviewer.
- `.gitignore`, MIT `LICENSE`, conventional-commit-friendly history.

### E. README: explicit evaluation-criteria mapping

The doc lists six evaluation areas (section 5). Add a short table to the README that maps each criterion to where it's addressed in the code, so the reviewer doesn't have to hunt:

| Criterion        | Where                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Database design  | `schema.prisma`, migration with GIN + CHECK constraints             |
| Code structure   | layered `routes → controllers → services → repositories`            |
| API design       | OpenAPI at `/docs`, consistent envelopes, keyset pagination         |
| Error handling   | central error middleware, typed error codes, Prisma `P2025` mapping |
| Matching clarity | `utils/scoring.ts` pure functions + README formula section          |
| Performance      | GIN-backed pre-filter, keyset pagination, indexes, caching plan     |

### F. Sharper scaling section (the 1M+ question is explicitly graded)

Strengthen beyond the earlier draft with concrete, defensible numbers and ordering:

1. Lead with the GIN pre-filter: it turns matching from an O(n) scan into an index probe over the candidate set (users sharing a city or ≥1 goal).
2. Connection pooling via PgBouncer (transaction mode) in front of Prisma; note Prisma's pool sizing.
3. Read replicas for `GET /users` and match reads, primary for writes.
4. If a single goal (or city) is extremely hot and candidate sets stay large, precompute/maintain a materialized "match candidates" structure or move heavy matching to an async job + cache, rather than computing on every request.
5. Note the honest limit: exact pairwise Jaccard over truly arbitrary input doesn't scale to billions without approximation (MinHash/LSH) — mention it as the next step beyond 1M to show you know where the ceiling is.

### G. Caching plan made concrete (also explicitly graded)

- Cache-aside in Redis on `GET /users/:id/match`, key `match:{id}:{version}`, TTL ~60s.
- Invalidate by bumping a global `users:version` counter on every `POST /users` (new users can change anyone's top-3), so you avoid tracking per-user dependencies. Document this tradeoff: simple and correct, at the cost of flushing all match caches on each insert. For higher write rates, narrow invalidation to city/goal buckets.
- Keep it behind a `CachePort` interface with a no-op in-memory default, so the service runs without Redis but the design is visible.

---

These all trace back to a specific line in the task or evaluation list, so they add points rather than scope creep. Two quick decisions from you:

1. Fastify (matches the stated preference) or stay Express?
2. Want me to fold all of the above into the single consolidated implementation prompt, or go straight to scaffolding the repo?@
