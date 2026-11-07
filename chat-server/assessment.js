export const DIMS = ['logical', 'numerical', 'spatial', 'verbal']
const T_MAX_BASE = { verbal: 40, logical: 60, numerical: 60, spatial: 75 } // seconds
const DIFF_MULT = { 1: 1, 2: 1.25, 3: 1.5 }

export const tMaxMs = (q) =>
  Math.round(T_MAX_BASE[q.dimension] * (DIFF_MULT[q.difficulty] ?? 1.5) * 1000)

// Below this, nobody could have read the question: ~60 ms/word + 0.8 s (+1.5 s to look at an image)
export function minPlausibleMs(q, options) {
  const words = `${q.prompt} ${options.join(' ')}`.split(/\s+/).length
  return 800 + 60 * words + (q.image_path ? 1500 : 0)
}

// rs = answered responses, oldest first
export function detectRushing(rs) {
  const w = rs.slice(-5)
  if (w.length < 4) return null
  const fast = w.filter((r) => r.rapid).length
  const wrong = w.filter((r) => !r.correct).length
  const last4 = w.slice(-4)
  const straight = last4.every((r) => r.option_index != null && r.option_index === last4[0].option_index)
  if ((fast >= 3 && wrong >= 3) || (fast >= 3 && straight)) {
    return { ids: w.filter((r) => r.rapid).map((r) => r.id), fast, wrong, straight }
  }
  return null
}

const speedRatio = (r) =>
  r.correct && !r.timed_out ? Math.max(0, (r.t_max_ms - r.t_user_ms) / r.t_max_ms) : 0
const sumW = (rs) => rs.reduce((s, r) => s + r.w, 0)
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

// rows need: dimension, w (points), correct, timed_out, t_user_ms, t_max_ms
export function score(rows) {
  const category = {}
  for (const d of DIMS) {
    const rs = rows.filter((r) => r.dimension === d)
    const W = sumW(rs)
    category[d] = W ? (rs.reduce((s, r) => s + r.correct * r.w, 0) / W) * 100 : null
  }
  const W = sumW(rows)
  const speed = W ? (rows.reduce((s, r) => s + r.w * speedRatio(r), 0) / W) * 100 : null
  const known = Object.values(category).filter((v) => v != null)
  const accuracy = known.length ? mean(known) : null
  const global = accuracy == null ? null : 0.7 * accuracy + 0.3 * speed
  return { category, accuracy, speed, global }
}

export function buildResult(rows) {
  const total = sumW(rows)
  const valid = rows.filter((r) => !r.suspect)
  const validShare = total ? sumW(valid) / total : 0
  const rapidShare = total ? sumW(rows.filter((r) => r.rapid)) / total : 0

  let reliability = validShare >= 0.8 ? 'high' : validShare >= 0.5 ? 'medium' : 'low'
  if (rapidShare >= 0.3) reliability = 'low' // safety net if the coach cooldown suppressed a flag

  const adjusted = score(valid)
  return {
    reliability,
    validShare: +validShare.toFixed(2),
    rapidShare: +rapidShare.toFixed(2),
    // headline number is withheld when the data can't support it
    globalScore: reliability === 'low' ? null : adjusted.global,
    adjusted,            // computed without suspect responses
    raw: score(rows),    // everything, kept for audit
    note: reliability === 'low'
      ? 'Many answers were implausibly fast. Result is inconclusive and does not reflect ability. Retake recommended.'
      : null,
  }
}