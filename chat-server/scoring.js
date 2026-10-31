export const DIMENSIONS = ['visual', 'numerical', 'spatial', 'verbal']
export const SCORING_VERSION = 'v1'
// Proposal from the brief: unvalidated, document your own final choice.
export const COLLAB_WEIGHTS = {
  clarification: 0.2,
  critical_verification: 0.25,
  iteration: 0.2,
  autonomy: 0.2,
  responsible_use: 0.15,
}
const round1 = (x) => Math.round(x * 10) / 10
// Estimate with small-sample smoothing: p = (correct + 1) / (n + 2).
// The range is an approximate 95% interval, so it narrows as n grows.
// Limits: difficulty is not weighted, and tasks may carry bias (see questions.bias_notes).
export function estimate(correct, n) {
  const p = (correct + 1) / (n + 2)
  const margin = 1.96 * Math.sqrt((p * (1 - p)) / (n + 2))
  return {
    value: round1(p * 100),
    low: round1(Math.max(0, (p - margin) * 100)),
    high: round1(Math.min(100, (p + margin) * 100)),
    n,
  }
}
export function collabTotal(c) {
  let total = 0
  for (const [key, w] of Object.entries(COLLAB_WEIGHTS)) total += w * (c[key] ?? 0)
  return round1(total)
}
