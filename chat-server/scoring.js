export const DIMENSIONS = ['logical', 'numerical', 'spatial', 'verbal']
export const SCORING_VERSION = 'v2'

// Proposal from the brief: unvalidated, document your own final choice.
export const COLLAB_WEIGHTS = {
  clarification: 0.2,
  critical_verification: 0.25,
  iteration: 0.2,
  autonomy: 0.2,
  responsible_use: 0.15,
}

export const GLOBAL_WEIGHTS = { accuracy: 0.7, speed: 0.3 }

const round1 = (x) => Math.round(x * 10) / 10

/**
 * One answered question:
 * {
 *   category: 'logical' | 'numerical' | 'spatial' | 'verbal',
 *   weight: number,        // W, question weight (e.g. difficulty)
 *   correct: boolean,
 *   timeUser: number|null, // T_user, null/undefined if unanswered
 *   timeMax: number,       // T_max, the deadline for this question
 * }
 */

// Speed Ratio = (T_max - T_user) / T_max
// 0 if the user missed the deadline or answered incorrectly.
export function speedRatio({ correct, timeUser, timeMax }) {
  if (!correct) return 0
  if (timeUser == null || !(timeMax > 0) || timeUser > timeMax) return 0
  return (timeMax - timeUser) / timeMax
}

// Category Score = (Σ(correct × W) / Σ(W)) × 100
export function categoryScore(answers) {
  const totalW = answers.reduce((s, a) => s + a.weight, 0)
  if (totalW === 0) return 0
  const earned = answers.reduce((s, a) => s + (a.correct ? 1 : 0) * a.weight, 0)
  return (earned / totalW) * 100
}

// Speed Score = (Σ(W × Speed Ratio) / Σ(W)) × 100
export function speedScore(answers) {
  const totalW = answers.reduce((s, a) => s + a.weight, 0)
  if (totalW === 0) return 0
  const weighted = answers.reduce((s, a) => s + a.weight * speedRatio(a), 0)
  return (weighted / totalW) * 100
}

// Accuracy Score = (Cat1 + Cat2 + Cat3 + Cat4) / 4
// Global Score   = 0.7 × Accuracy + 0.3 × Speed
export function computeScores(answers) {
  const categories = {}
  for (const dim of DIMENSIONS) {
    categories[dim] = categoryScore(answers.filter((a) => a.category === dim))
  }

  const accuracy =
    DIMENSIONS.reduce((s, dim) => s + categories[dim], 0) / DIMENSIONS.length
  const speed = speedScore(answers)
  const global =
    GLOBAL_WEIGHTS.accuracy * accuracy + GLOBAL_WEIGHTS.speed * speed

  return {
    version: SCORING_VERSION,
    categories: Object.fromEntries(
      DIMENSIONS.map((d) => [d, round1(categories[d])])
    ),
    accuracy: round1(accuracy),
    speed: round1(speed),
    global: round1(global),
  }
}