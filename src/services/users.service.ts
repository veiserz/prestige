import { User } from '@prisma/client';
import { usersRepository, CreateUserInput } from '../repositories/users.repo.js';
import { calculateCompatibilityScore } from '../utils/scoring.js';

export interface UserResponse {
  id: string;
  name: string;
  age: number;
  city: string;
  educationLevel: string;
  goals: string[];
  scoreSelfGrowth: number;
  createdAt: Date;
}

export interface MatchResult {
  user: UserResponse;
  score: number;
  breakdown: {
    city: number;
    age: number;
    goals: number;
    selfGrowth: number;
  };
}

export interface MatchResponse {
  userId: string;
  matches: MatchResult[];
}

export class UsersService {
  private serializeUser(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      age: user.age,
      city: user.city,
      educationLevel: user.educationLevel,
      goals: user.goals,
      scoreSelfGrowth: Number(user.scoreSelfGrowth),
      createdAt: user.createdAt,
    };
  }

  async createUser(input: CreateUserInput): Promise<UserResponse> {
    // Normalize goals: lowercase, trim, deduplicate
    const normalizedGoals = [...new Set(
      input.goals.map(g => g.toLowerCase().trim()).filter(g => g.length > 0)
    )];

    const user = await usersRepository.create({
      ...input,
      goals: normalizedGoals,
    });

    return this.serializeUser(user);
  }

  async getUsers(limit: number, cursor?: string): Promise<{ data: UserResponse[]; nextCursor: string | null }> {
    const result = await usersRepository.findAll(limit, cursor);
    return {
      data: result.data.map(u => this.serializeUser(u)),
      nextCursor: result.nextCursor,
    };
  }

  async getUserById(id: string): Promise<UserResponse | null> {
    const user = await usersRepository.findById(id);
    return user ? this.serializeUser(user) : null;
  }

  async findMatches(userId: string): Promise<MatchResponse> {
    const targetUser = await usersRepository.findById(userId);
    
    if (!targetUser) {
      throw new Error('User not found');
    }

    const candidates = await usersRepository.findMatches(userId, targetUser, 3);

    const matches: MatchResult[] = candidates.map(candidate => {
      const { score, breakdown } = calculateCompatibilityScore(
        {
          city: targetUser.city,
          age: targetUser.age,
          goals: targetUser.goals,
          scoreSelfGrowth: Number(targetUser.scoreSelfGrowth),
        },
        {
          city: candidate.city,
          age: candidate.age,
          goals: candidate.goals,
          scoreSelfGrowth: Number(candidate.scoreSelfGrowth),
        }
      );

      return {
        user: {
          id: candidate.id,
          name: candidate.name,
          age: candidate.age,
          city: candidate.city,
          educationLevel: candidate.educationLevel,
          goals: candidate.goals,
          scoreSelfGrowth: Number(candidate.scoreSelfGrowth),
          createdAt: candidate.createdAt,
        },
        score: Math.round(score * 100) / 100,
        breakdown: {
          city: Math.round(breakdown.city * 100) / 100,
          age: Math.round(breakdown.age * 100) / 100,
          goals: Math.round(breakdown.goals * 100) / 100,
          selfGrowth: Math.round(breakdown.selfGrowth * 100) / 100,
        },
      };
    });

    return {
      userId,
      matches,
    };
  }
}

export const usersService = new UsersService();
