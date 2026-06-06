import { prisma } from '../config/prisma.js';
import { Prisma, User, EducationLevel } from '@prisma/client';

export interface CreateUserInput {
  name: string;
  age: number;
  city: string;
  educationLevel: EducationLevel;
  goals: string[];
  scoreSelfGrowth: number;
}

export interface MatchCandidate {
  id: string;
  name: string;
  age: number;
  city: string;
  educationLevel: string;
  goals: string[];
  scoreSelfGrowth: string;
  createdAt: Date;
}

export class UsersRepository {
  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        scoreSelfGrowth: new Prisma.Decimal(data.scoreSelfGrowth),
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findAll(limit: number, cursor?: string): Promise<{ data: User[]; nextCursor: string | null }> {
    const users = await prisma.user.findMany({
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    const hasMore = users.length > limit;
    const data = hasMore ? users.slice(0, -1) : users;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  /**
   * Find matching candidates using raw SQL for Jaccard similarity.
   * Uses GIN index on goals array and city index for efficient filtering.
   */
  async findMatches(targetUserId: string, targetUser: User, limit: number): Promise<MatchCandidate[]> {
    const targetGoals = targetUser.goals;
    const targetCity = targetUser.city;
    const targetAge = targetUser.age;
    const targetScore = Number(targetUser.scoreSelfGrowth);

    // Use $queryRaw for the complex Jaccard calculation
    // Pre-filter candidates using GIN index (goals overlap OR same city)
    const matches = await prisma.$queryRaw<MatchCandidate[]>`
      SELECT
        u.id,
        u.name,
        u.age,
        u.city,
        u.education_level AS "educationLevel",
        u.goals,
        u.score_self_growth::text AS "scoreSelfGrowth",
        u.created_at AS "createdAt",
        (
          0.2 * (CASE WHEN u.city = ${targetCity} THEN 100 ELSE 0 END)
          + 0.2 * 100 * GREATEST(0, 1 - ABS(u.age - ${targetAge}) / 20.0)
          + 0.3 * 100 * COALESCE(
              CASE 
                WHEN cardinality(u.goals) = 0 AND cardinality(${targetGoals}::text[]) = 0 THEN 0
                WHEN cardinality(ARRAY(SELECT unnest(u.goals) INTERSECT SELECT unnest(${targetGoals}::text[]))) = 0
                     AND (cardinality(u.goals) + cardinality(${targetGoals}::text[])) = 0 THEN 0
                ELSE 
                  cardinality(ARRAY(SELECT unnest(u.goals) INTERSECT SELECT unnest(${targetGoals}::text[])))::float
                  / NULLIF(cardinality(ARRAY(SELECT DISTINCT unnest(u.goals || ${targetGoals}::text[]))), 0)
              END,
              0
            )
          + 0.3 * GREATEST(0, 100 - ABS(u.score_self_growth - ${targetScore}))
        ) AS score
      FROM users u
      WHERE u.id != ${targetUserId}::uuid
        AND (
          u.goals && ${targetGoals}::text[]
          OR u.city = ${targetCity}
        )
      ORDER BY score DESC
      LIMIT ${limit}
    `;

    return matches;
  }
}

export const usersRepository = new UsersRepository();
