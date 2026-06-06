import { describe, it, expect } from 'vitest';
import {
  cityScore,
  ageScore,
  goalsScore,
  selfGrowthScore,
  calculateCompatibilityScore,
} from '../../src/utils/scoring.js';

describe('Scoring Utils', () => {
  describe('cityScore', () => {
    it('should return 100 for matching cities', () => {
      expect(cityScore('Tehran', 'Tehran')).toBe(100);
    });

    it('should be case-insensitive', () => {
      expect(cityScore('Tehran', 'tehran')).toBe(100);
      expect(cityScore('TEHRAN', 'tehran')).toBe(100);
    });

    it('should return 0 for different cities', () => {
      expect(cityScore('Tehran', 'Isfahan')).toBe(0);
    });
  });

  describe('ageScore', () => {
    it('should return 100 for same age', () => {
      expect(ageScore(30, 30)).toBe(100);
    });

    it('should return 50 for 10-year difference', () => {
      expect(ageScore(30, 40)).toBe(50);
      expect(ageScore(40, 30)).toBe(50);
    });

    it('should return 0 for 20-year or more difference', () => {
      expect(ageScore(30, 50)).toBe(0);
      expect(ageScore(25, 5)).toBe(0);
    });

    it('should return 90 for 2-year difference', () => {
      expect(ageScore(28, 30)).toBe(90);
    });
  });

  describe('goalsScore', () => {
    it('should return 100 for identical goal sets', () => {
      const goals = ['fitness', 'reading', 'travel'];
      expect(goalsScore(goals, goals)).toBe(100);
    });

    it('should return 0 when both goal sets are empty', () => {
      expect(goalsScore([], [])).toBe(0);
    });

    it('should calculate Jaccard similarity correctly', () => {
      const goals1 = ['fitness', 'reading', 'travel'];
      const goals2 = ['fitness', 'coding', 'startup'];
      // Intersection: 1 (fitness)
      // Union: 5 (fitness, reading, travel, coding, startup)
      // Score: 1/5 * 100 = 20
      expect(goalsScore(goals1, goals2)).toBe(20);
    });

    it('should return 0 for completely different goals', () => {
      const goals1 = ['fitness', 'reading'];
      const goals2 = ['coding', 'startup'];
      expect(goalsScore(goals1, goals2)).toBe(0);
    });

    it('should be case-insensitive', () => {
      const goals1 = ['Fitness', 'Reading'];
      const goals2 = ['fitness', 'reading'];
      expect(goalsScore(goals1, goals2)).toBe(100);
    });

    it('should handle partial overlap', () => {
      const goals1 = ['fitness', 'reading'];
      const goals2 = ['fitness', 'reading', 'travel'];
      // Intersection: 2, Union: 3
      // Score: 2/3 * 100 ≈ 66.67
      expect(goalsScore(goals1, goals2)).toBeCloseTo(66.67, 1);
    });
  });

  describe('selfGrowthScore', () => {
    it('should return 100 for identical scores', () => {
      expect(selfGrowthScore(75.5, 75.5)).toBe(100);
    });

    it('should return correct score for difference', () => {
      expect(selfGrowthScore(80, 70)).toBe(90);
      expect(selfGrowthScore(70, 80)).toBe(90);
    });

    it('should return 0 for 100-point difference', () => {
      expect(selfGrowthScore(100, 0)).toBe(0);
      expect(selfGrowthScore(0, 100)).toBe(0);
    });

    it('should handle decimal differences', () => {
      expect(selfGrowthScore(75.5, 78.5)).toBe(97);
    });
  });

  describe('calculateCompatibilityScore', () => {
    it('should calculate weighted score correctly', () => {
      const user1 = {
        city: 'Tehran',
        age: 28,
        goals: ['fitness', 'reading', 'travel'],
        scoreSelfGrowth: 75.5,
      };

      const user2 = {
        city: 'Tehran',
        age: 30,
        goals: ['fitness', 'reading'],
        scoreSelfGrowth: 78.5,
      };

      const result = calculateCompatibilityScore(user1, user2);

      // City: 100 (match)
      // Age: 90 (2 years diff)
      // Goals: 66.67 (2/3 Jaccard)
      // SelfGrowth: 97 (3-point diff)
      // Weighted: 0.2*100 + 0.2*90 + 0.3*66.67 + 0.3*97

      expect(result.breakdown.city).toBe(100);
      expect(result.breakdown.age).toBe(90);
      expect(result.breakdown.goals).toBeCloseTo(66.67, 1);
      expect(result.breakdown.selfGrowth).toBe(97);

      const expectedScore = 0.2 * 100 + 0.2 * 90 + 0.3 * 66.67 + 0.3 * 97;
      expect(result.score).toBeCloseTo(expectedScore, 1);
    });

    it('should handle completely incompatible users', () => {
      const user1 = {
        city: 'Tehran',
        age: 25,
        goals: ['fitness'],
        scoreSelfGrowth: 50,
      };

      const user2 = {
        city: 'Isfahan',
        age: 50,
        goals: ['coding'],
        scoreSelfGrowth: 100,
      };

      const result = calculateCompatibilityScore(user1, user2);

      expect(result.breakdown.city).toBe(0);
      expect(result.breakdown.age).toBe(0); // 25 year diff
      expect(result.breakdown.goals).toBe(0); // no overlap
      expect(result.breakdown.selfGrowth).toBe(50); // 50 point diff
      expect(result.score).toBe(0.3 * 50); // only selfGrowth contributes
    });

    it('should handle empty goal sets correctly', () => {
      const user1 = {
        city: 'Tehran',
        age: 30,
        goals: [],
        scoreSelfGrowth: 75,
      };

      const user2 = {
        city: 'Tehran',
        age: 30,
        goals: [],
        scoreSelfGrowth: 75,
      };

      const result = calculateCompatibilityScore(user1, user2);

      expect(result.breakdown.goals).toBe(0);
      // Total: 0.2*100 + 0.2*100 + 0.3*0 + 0.3*100 = 70
      expect(result.score).toBe(70);
    });
  });
});
