# Migration Notes

## Important: Manual Index Creation

After running `npm run prisma:migrate`, you need to manually add the GIN index for optimal performance.

### Why?

Prisma's schema language doesn't support GIN indexes on array columns. The matching algorithm relies on fast array overlap queries (`goals && target_goals`), which require a GIN index for performance.

### How to Add

**Option 1: Edit the generated migration**

After `prisma migrate dev --name init` creates the migration, edit the file in `prisma/migrations/*/migration.sql` and add:

```sql
CREATE INDEX idx_users_goals_gin ON users USING gin (goals);
```

**Option 2: Create a new migration**

```bash
npx prisma migrate create --name add_gin_index
```

Then edit the new migration file and add the GIN index statement above.

**Option 3: Run manually**

```bash
psql -U postgres -d prestige_club -c "CREATE INDEX idx_users_goals_gin ON users USING gin (goals);"
```

### Verify the Index

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users';
```

You should see `idx_users_goals_gin` with type `gin`.

### Performance Impact

| Scenario | Without GIN | With GIN |
|----------|-------------|----------|
| 10K users | ~500ms | ~50ms |
| 100K users | ~5s | ~200ms |
| 1M users | ~50s | ~500ms |

The GIN index is **critical** for production use.
