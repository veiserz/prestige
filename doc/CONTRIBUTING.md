# Contributing Guide

Thank you for considering contributing to the Prestige Club User Matching Service!

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Follow the setup instructions in `QUICKSTART.md`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## 📝 Development Workflow

### Making Changes

1. **Write tests first** (TDD approach recommended)
   - Unit tests for pure functions in `tests/unit/`
   - Integration tests for API endpoints in `tests/integration/`

2. **Implement your feature**
   - Follow the existing architecture patterns
   - Keep layers separated (routes → controllers → services → repositories)
   - Add TypeScript types for all new interfaces

3. **Ensure quality**
   ```bash
   npm test                # All tests must pass
   npm run build           # TypeScript must compile
   npm run lint            # No linting errors
   npm run format          # Code must be formatted
   ```

4. **Update documentation**
   - Update `README.md` if adding new features
   - Update `API.md` for new endpoints
   - Add inline comments for complex logic

### Commit Guidelines

Use conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process or auxiliary tool changes

**Examples**:
```
feat(matching): add education level weight to scoring algorithm

- Add 10% weight for education level similarity
- Update tests to cover new scoring component
- Update README with new formula

Closes #42
```

```
fix(validation): handle empty goal arrays correctly

Previously empty goal arrays caused validation errors.
Now properly defaults to empty array.

Fixes #35
```

## 🏗 Architecture Guidelines

### Layer Responsibilities

**Routes** (`src/routes/`)
- Define endpoint paths and HTTP methods
- Apply validation middleware
- Delegate to controllers

**Controllers** (`src/controllers/`)
- Extract request parameters
- Call service methods
- Format responses
- Never contain business logic

**Services** (`src/services/`)
- Business logic and orchestration
- Call repositories for data access
- Transform data for responses
- No direct database queries

**Repositories** (`src/repositories/`)
- All database access (Prisma or raw SQL)
- Return domain entities
- No business logic

**Utils** (`src/utils/`)
- Pure functions only
- No side effects
- Easily testable

### Adding a New Endpoint

1. **Define validation schema** in route file
   ```typescript
   const mySchema = z.object({
     field: z.string().min(1),
   });
   ```

2. **Add route** with validation
   ```typescript
   router.post('/path', validate(mySchema, 'body'), controller.method);
   ```

3. **Implement controller method**
   ```typescript
   async method(req: Request, res: Response, next: NextFunction) {
     try {
       const result = await service.method(req.body);
       res.json(result);
     } catch (error) {
       next(error);
     }
   }
   ```

4. **Implement service logic**
   ```typescript
   async method(input: Input): Promise<Output> {
     // Business logic
     const data = await repository.getData();
     return transformData(data);
   }
   ```

5. **Add tests**
   - Unit tests for any new utility functions
   - Integration test for the endpoint

## 🧪 Testing Guidelines

### Unit Tests

- Test pure functions in isolation
- Mock external dependencies
- Cover edge cases and error conditions
- Aim for 100% coverage of utility functions

Example:
```typescript
describe('myFunction', () => {
  it('should handle normal case', () => {
    expect(myFunction(input)).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(myFunction(edgeInput)).toBe(edgeExpected);
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(invalid)).toThrow();
  });
});
```

### Integration Tests

- Test complete request/response cycles
- Use a real database (or test container)
- Clean up data between tests
- Test both success and error paths

Example:
```typescript
describe('POST /endpoint', () => {
  it('should create resource', async () => {
    const response = await request(app)
      .post('/endpoint')
      .send(validData)
      .expect(201);
    
    expect(response.body).toMatchObject(expectedShape);
  });

  it('should return 400 for invalid data', async () => {
    await request(app)
      .post('/endpoint')
      .send(invalidData)
      .expect(400);
  });
});
```

## 🎨 Code Style

### TypeScript

- Use strict mode
- Define explicit types for function parameters and returns
- Use interfaces for object shapes
- Prefer `const` over `let`, avoid `var`

### Naming Conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)
- Types: `PascalCase`

### Function Guidelines

- Keep functions small and focused
- Max 50 lines per function
- Single responsibility principle
- Pure functions when possible

### Comments

- Explain *why*, not *what*
- Use JSDoc for public APIs
- Avoid redundant comments
- Comment complex algorithms

Good:
```typescript
// Use Jaccard similarity to handle different-sized goal sets fairly
const similarity = intersection.size / union.size;
```

Bad:
```typescript
// Calculate similarity
const similarity = intersection.size / union.size;
```

## 🔒 Security Guidelines

- Always validate user input with Zod schemas
- Never log sensitive data (passwords, tokens)
- Use parameterized queries (Prisma handles this)
- Sanitize error messages in production
- Keep dependencies updated

## 📊 Performance Guidelines

- Profile before optimizing
- Use indexes for common queries
- Avoid N+1 queries
- Consider caching for expensive operations
- Use pagination for large datasets

## 🐛 Debugging Tips

### Enable Prisma Query Logging

In `src/config/prisma.ts`, set:
```typescript
log: ['query', 'error', 'warn']
```

### Database Query Analysis

```sql
-- See query execution plan
EXPLAIN ANALYZE <your-query>;

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname = 'users';
```

### Common Issues

**TypeScript errors**: Run `npm run prisma:generate`  
**Test failures**: Ensure database is clean between tests  
**Performance issues**: Check if indexes are being used  

## 📦 Submitting Changes

1. **Ensure all checks pass**
   ```bash
   npm test
   npm run build
   npm run lint
   ```

2. **Update CHANGELOG.md** (if applicable)

3. **Create a pull request**
   - Clear title describing the change
   - Reference any related issues
   - Include before/after examples for UI changes
   - Add screenshots for visual changes

4. **Respond to review feedback**
   - Address all comments
   - Push additional commits to the same branch
   - Request re-review when ready

## 🎯 Areas for Contribution

### High Priority

- [ ] Redis caching implementation
- [ ] Rate limiting middleware
- [ ] User update/delete endpoints
- [ ] Prometheus metrics
- [ ] Load testing suite

### Medium Priority

- [ ] OpenAPI/Swagger documentation
- [ ] Docker multi-stage build
- [ ] CI/CD pipeline
- [ ] Additional matching algorithms
- [ ] Email notification service

### Low Priority

- [ ] Admin dashboard
- [ ] WebSocket real-time updates
- [ ] Machine learning-based scoring
- [ ] Multi-language support
- [ ] GraphQL API

## 📚 Resources

- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev/)
- [Vitest Documentation](https://vitest.dev/)

## 💬 Getting Help

- Check existing issues for similar problems
- Read the full README.md
- Review the API.md documentation
- Ask questions in discussions (if enabled)

## 📜 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Assume good intentions

---

Thank you for contributing to Prestige Club! 🎉
