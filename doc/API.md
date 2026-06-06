# API Documentation

Complete reference for the Prestige Club User Matching API.

## Base URL

```
http://localhost:3000
```

## Response Format

All responses are JSON. Successful responses return the requested data. Error responses follow this format:

```json
{
  "error": "ErrorName",
  "message": "Human-readable description",
  "details": { /* optional */ }
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

## Endpoints

### Health Check

```http
GET /health
```

Check if the service is running.

**Response (200)**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Create User

```http
POST /users
Content-Type: application/json
```

Create a new user profile.

**Request Body**
```json
{
  "name": "Alice",
  "age": 28,
  "city": "Tehran",
  "educationLevel": "bachelor",
  "goals": ["fitness", "reading", "travel"],
  "scoreSelfGrowth": 75.5
}
```

**Fields**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | min length 1 | User's full name |
| `age` | integer | 0-120 | User's age in years |
| `city` | string | min length 1 | User's city |
| `educationLevel` | enum | see below | Education level |
| `goals` | string[] | array of non-empty strings | User's goals/interests |
| `scoreSelfGrowth` | number | 0-100 | Self-growth score |

**Education Levels**
- `high_school`
- `associate`
- `bachelor`
- `master`
- `phd`

**Response (201)**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Alice",
  "age": 28,
  "city": "Tehran",
  "educationLevel": "bachelor",
  "goals": ["fitness", "reading", "travel"],
  "scoreSelfGrowth": 75.5,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses**

```json
// 400 - Invalid age
{
  "error": "ValidationError",
  "message": "Invalid request data",
  "details": [
    {
      "path": "age",
      "message": "Age must be between 0 and 120"
    }
  ]
}
```

**Notes**
- Goals are automatically normalized (lowercased, deduplicated)
- Goal matching is case-insensitive

---

### List Users

```http
GET /users?limit=50&cursor=<uuid>
```

Retrieve all users with cursor-based pagination.

**Query Parameters**

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `limit` | integer | 50 | 1-200 | Number of users per page |
| `cursor` | string | none | valid UUID | Pagination cursor |

**Response (200)**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Alice",
      "age": 28,
      "city": "Tehran",
      "educationLevel": "bachelor",
      "goals": ["fitness", "reading", "travel"],
      "scoreSelfGrowth": 75.5,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Pagination Example**

```bash
# First page
curl 'http://localhost:3000/users?limit=10'

# Next page (use nextCursor from previous response)
curl 'http://localhost:3000/users?limit=10&cursor=660e8400-...'
```

**Notes**
- Results are ordered by `createdAt DESC, id ASC`
- `nextCursor` is `null` when no more results
- Keyset pagination (not offset-based) for consistent performance

---

### Find Matches

```http
GET /users/:id/match
```

Find the top 3 most compatible users for a given user.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Target user ID |

**Response (200)**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "matches": [
    {
      "user": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Bob",
        "age": 30,
        "city": "Tehran",
        "educationLevel": "master",
        "goals": ["fitness", "reading"],
        "scoreSelfGrowth": 78.5,
        "createdAt": "2025-01-01T00:00:00.000Z"
      },
      "score": 87.1,
      "breakdown": {
        "city": 100,
        "age": 90,
        "goals": 66.67,
        "selfGrowth": 97
      }
    }
  ]
}
```

**Breakdown Fields**

Each component is scored 0-100 before weighting:

| Field | Weight | Description |
|-------|--------|-------------|
| `city` | 20% | 100 if same city, 0 otherwise |
| `age` | 20% | Based on age difference (≥20yr → 0) |
| `goals` | 30% | Jaccard similarity of goal sets |
| `selfGrowth` | 30% | Based on score difference |

**Final Score Formula**
```
score = 0.2×city + 0.2×age + 0.3×goals + 0.3×selfGrowth
```

**Error Responses**

```json
// 404 - User not found
{
  "error": "NotFoundError",
  "message": "User not found"
}

// 400 - Invalid UUID format
{
  "error": "ValidationError",
  "message": "Invalid request data",
  "details": [
    {
      "path": "id",
      "message": "Invalid user ID format"
    }
  ]
}
```

**Notes**
- Returns up to 3 matches
- Target user is excluded from results
- Results are ordered by compatibility score (descending)
- If fewer than 3 compatible users exist, returns available matches

---

## Examples

### Complete Workflow

```bash
# 1. Create first user
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
# Save the returned ID

# 2. Create second user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob",
    "age": 30,
    "city": "Tehran",
    "educationLevel": "master",
    "goals": ["fitness", "coding", "startup"],
    "scoreSelfGrowth": 82.0
  }'

# 3. Get all users
curl http://localhost:3000/users

# 4. Find matches for Alice (use her ID)
curl http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440000/match
```

### Using with JavaScript/TypeScript

```typescript
const API_BASE = 'http://localhost:3000';

// Create user
const response = await fetch(`${API_BASE}/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Alice',
    age: 28,
    city: 'Tehran',
    educationLevel: 'bachelor',
    goals: ['fitness', 'reading'],
    scoreSelfGrowth: 75.5,
  }),
});

const user = await response.json();

// Find matches
const matchesResponse = await fetch(`${API_BASE}/users/${user.id}/match`);
const matches = await matchesResponse.json();

console.log(`Found ${matches.matches.length} matches for ${user.name}`);
```

### Using with Python

```python
import requests

API_BASE = 'http://localhost:3000'

# Create user
user_data = {
    'name': 'Alice',
    'age': 28,
    'city': 'Tehran',
    'educationLevel': 'bachelor',
    'goals': ['fitness', 'reading'],
    'scoreSelfGrowth': 75.5
}

response = requests.post(f'{API_BASE}/users', json=user_data)
user = response.json()

# Find matches
matches_response = requests.get(f'{API_BASE}/users/{user["id"]}/match')
matches = matches_response.json()

print(f'Found {len(matches["matches"])} matches for {user["name"]}')
```

---

## Rate Limits

Currently no rate limiting is implemented. In production, consider:
- 100 requests/minute per IP for `POST /users`
- 1000 requests/minute per IP for read endpoints

## Authentication

Currently no authentication is required. In production, implement:
- JWT-based authentication
- API key validation
- OAuth2 integration

---

For more details, see [README.md](./README.md)
