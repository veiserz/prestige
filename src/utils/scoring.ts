/**
 * Pure scoring functions for user compatibility matching.
 * All functions return scores in the 0-100 range before weighting.
 */

/**
 * City compatibility score.
 * @returns 100 if cities match, 0 otherwise
 */
export function cityScore(city1: string, city2: string): number {
  return city1.toLowerCase() === city2.toLowerCase() ? 100 : 0;
}

/**
 * Age compatibility score based on absolute difference.
 * Assumes a 20-year gap results in 0 compatibility.
 * @returns Score from 0-100
 */
export function ageScore(age1: number, age2: number): number {
  const diff = Math.abs(age1 - age2);
  return Math.max(0, 100 * (1 - diff / 20));
}

/**
 * Goals compatibility using Jaccard similarity.
 * Jaccard = |intersection| / |union|
 * If both goal sets are empty, return 0 (no signal).
 * @returns Score from 0-100
 */
export function goalsScore(goals1: string[], goals2: string[]): number {
  if (goals1.length === 0 && goals2.length === 0) {
    return 0;
  }

  const set1 = new Set(goals1.map(g => g.toLowerCase()));
  const set2 = new Set(goals2.map(g => g.toLowerCase()));

  const intersection = new Set([...set1].filter(g => set2.has(g)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) {
    return 0;
  }

  return (intersection.size / union.size) * 100;
}

/**
 * Self-growth score compatibility based on absolute difference.
 * @returns Score from 0-100
 */
export function selfGrowthScore(score1: number, score2: number): number {
  const diff = Math.abs(score1 - score2);
  return Math.max(0, 100 - diff);
}

/**
 * Component breakdown for transparency in matching results.
 */
export interface ScoreBreakdown {
  city: number;
  age: number;
  goals: number;
  selfGrowth: number;
}

/**
 * Calculate the weighted compatibility score.
 * Weights: City 20%, Age 20%, Goals 30%, Self-Growth 30%
 */
export function calculateCompatibilityScore(
  user1: {
    city: string;
    age: number;
    goals: string[];
    scoreSelfGrowth: number;
  },
  user2: {
    city: string;
    age: number;
    goals: string[];
    scoreSelfGrowth: number;
  }
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    city: cityScore(user1.city, user2.city),
    age: ageScore(user1.age, user2.age),
    goals: goalsScore(user1.goals, user2.goals),
    selfGrowth: selfGrowthScore(user1.scoreSelfGrowth, user2.scoreSelfGrowth),
  };

  const score = 
    0.2 * breakdown.city +
    0.2 * breakdown.age +
    0.3 * breakdown.goals +
    0.3 * breakdown.selfGrowth;

  return { score, breakdown };
}
