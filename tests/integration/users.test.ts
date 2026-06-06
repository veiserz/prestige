import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { EducationLevel } from '@prisma/client';

const app = createApp();

describe('Users API Integration Tests', () => {
  beforeAll(async () => {
    // Clear database before tests
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Alice',
        age: 28,
        city: 'Tehran',
        educationLevel: 'bachelor',
        goals: ['fitness', 'reading', 'travel'],
        scoreSelfGrowth: 75.5,
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Alice',
        age: 28,
        city: 'Tehran',
        educationLevel: 'bachelor',
        goals: ['fitness', 'reading', 'travel'],
        scoreSelfGrowth: 75.5,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should normalize goals (lowercase, deduplicate)', async () => {
      const userData = {
        name: 'Bob',
        age: 30,
        city: 'Isfahan',
        educationLevel: 'master',
        goals: ['Fitness', 'FITNESS', 'reading', 'Reading'],
        scoreSelfGrowth: 80,
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body.goals).toEqual(['fitness', 'reading']);
    });

    it('should return 400 for invalid age', async () => {
      const userData = {
        name: 'Invalid',
        age: 150,
        city: 'Tehran',
        educationLevel: 'bachelor',
        goals: [],
        scoreSelfGrowth: 50,
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('ValidationError');
    });

    it('should return 400 for invalid scoreSelfGrowth', async () => {
      const userData = {
        name: 'Invalid',
        age: 30,
        city: 'Tehran',
        educationLevel: 'bachelor',
        goals: [],
        scoreSelfGrowth: 150,
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('ValidationError');
    });

    it('should return 400 for invalid education level', async () => {
      const userData = {
        name: 'Invalid',
        age: 30,
        city: 'Tehran',
        educationLevel: 'invalid_level',
        goals: [],
        scoreSelfGrowth: 50,
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('ValidationError');
    });
  });

  describe('GET /users', () => {
    beforeAll(async () => {
      // Create some test users
      await prisma.user.deleteMany();
      for (let i = 0; i < 5; i++) {
        await prisma.user.create({
          data: {
            name: `User${i}`,
            age: 25 + i,
            city: 'Tehran',
            educationLevel: EducationLevel.bachelor,
            goals: ['fitness'],
            scoreSelfGrowth: 70 + i,
          },
        });
      }
    });

    it('should retrieve all users with default pagination', async () => {
      const response = await request(app)
        .get('/users')
        .expect(200);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.nextCursor).toBeNull();
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get('/users?limit=2')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.nextCursor).toBeDefined();
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/users?limit=300')
        .expect(400);

      expect(response.body.error).toBe('ValidationError');
    });
  });

  describe('GET /users/:id/match', () => {
    let targetUserId: string;
    let match1Id: string;
    let match2Id: string;

    beforeAll(async () => {
      await prisma.user.deleteMany();

      // Create target user
      const targetUser = await prisma.user.create({
        data: {
          name: 'Target',
          age: 28,
          city: 'Tehran',
          educationLevel: EducationLevel.bachelor,
          goals: ['fitness', 'reading', 'travel'],
          scoreSelfGrowth: 75,
        },
      });
      targetUserId = targetUser.id;

      // Create highly compatible match (same city, close age, shared goals)
      const match1 = await prisma.user.create({
        data: {
          name: 'Match1',
          age: 30,
          city: 'Tehran',
          educationLevel: EducationLevel.master,
          goals: ['fitness', 'reading'],
          scoreSelfGrowth: 78,
        },
      });
      match1Id = match1.id;

      // Create moderately compatible match
      const match2 = await prisma.user.create({
        data: {
          name: 'Match2',
          age: 35,
          city: 'Tehran',
          educationLevel: EducationLevel.bachelor,
          goals: ['fitness', 'coding'],
          scoreSelfGrowth: 80,
        },
      });
      match2Id = match2.id;

      // Create incompatible user
      await prisma.user.create({
        data: {
          name: 'NoMatch',
          age: 50,
          city: 'Isfahan',
          educationLevel: EducationLevel.phd,
          goals: ['research', 'writing'],
          scoreSelfGrowth: 90,
        },
      });
    });

    it('should return top 3 matches with scores', async () => {
      const response = await request(app)
        .get(`/users/${targetUserId}/match`)
        .expect(200);

      expect(response.body.userId).toBe(targetUserId);
      expect(response.body.matches).toBeInstanceOf(Array);
      expect(response.body.matches.length).toBeLessThanOrEqual(3);

      // Check match structure
      const firstMatch = response.body.matches[0];
      expect(firstMatch).toHaveProperty('user');
      expect(firstMatch).toHaveProperty('score');
      expect(firstMatch).toHaveProperty('breakdown');
      expect(firstMatch.breakdown).toHaveProperty('city');
      expect(firstMatch.breakdown).toHaveProperty('age');
      expect(firstMatch.breakdown).toHaveProperty('goals');
      expect(firstMatch.breakdown).toHaveProperty('selfGrowth');
    });

    it('should not include the target user in matches', async () => {
      const response = await request(app)
        .get(`/users/${targetUserId}/match`)
        .expect(200);

      const matchIds = response.body.matches.map((m: any) => m.user.id);
      expect(matchIds).not.toContain(targetUserId);
    });

    it('should order matches by compatibility score', async () => {
      const response = await request(app)
        .get(`/users/${targetUserId}/match`)
        .expect(200);

      const scores = response.body.matches.map((m: any) => m.score);
      
      // Check that scores are in descending order
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/users/${fakeId}/match`)
        .expect(404);

      expect(response.body.error).toBe('NotFoundError');
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .get('/users/invalid-id/match')
        .expect(400);

      expect(response.body.error).toBe('ValidationError');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
