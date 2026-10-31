import { db } from './db.js'

// Self-contained on purpose: it does not import scoring.js, so an old
// scoring.js cannot break the seed. Keep these in sync with scoring.js.
const DIMENSIONS = ['visual', 'numerical', 'spatial', 'verbal']
const COLLAB_WEIGHTS = {
  clarification: 0.2,
  critical_verification: 0.25,
  iteration: 0.2,
  autonomy: 0.2,
  responsible_use: 0.15,
}
const collabTotal = (c) =>
  Math.round(Object.entries(COLLAB_WEIGHTS).reduce((s, [k, w]) => s + w * (c[k] ?? 0), 0) * 10) / 10

// Wipes everything. Cascades to all user tables.
db.exec('DELETE FROM users; DELETE FROM questions;')

const bias = {
  verbal: 'Language-dependent: English only; vocabulary reflects schooling and reading habits.',
  numerical: 'Assumes familiarity with Arabic numerals and school arithmetic.',
  visual: 'Text-based placeholder; replace with image tasks. Colour and shape perception may vary.',
  spatial: 'Text-based placeholder; replace with rotation tasks. Familiarity with 3D diagrams varies.',
}

// [dimension, difficulty, prompt, options, answer]
const questions = [
  ['numerical', 1, '12 + 15 = ?', ['25', '27', '29', '31'], '27'],
  ['numerical', 1, '8 × 4 = ?', ['28', '30', '32', '34'], '32'],
  ['numerical', 2, 'What comes next: 2, 4, 8, 16, ?', ['18', '24', '32', '30'], '32'],
  ['numerical', 3, 'A price of 80 is reduced by 25%. New price?', ['55', '60', '65', '70'], '60'],
  ['verbal', 1, 'Which word means "happy"?', ['Sad', 'Joyful', 'Angry', 'Tired'], 'Joyful'],
  ['verbal', 1, 'Opposite of "big"?', ['Small', 'Huge', 'Wide', 'Tall'], 'Small'],
  ['verbal', 2, 'Opposite of "scarce"?', ['Rare', 'Plentiful', 'Small', 'Costly'], 'Plentiful'],
  ['verbal', 3, '"Ephemeral" most nearly means:', ['Lasting', 'Short-lived', 'Ancient', 'Loud'], 'Short-lived'],
  ['visual', 1, 'Circle, circle, square, circle: which one is different?', ['1st', '2nd', '3rd', '4th'], '3rd'],
  ['visual', 1, 'Red, red, red, blue: which one is different?', ['1st', '2nd', '3rd', '4th'], '4th'],
  ['visual', 2, 'Pattern: ▲ ● ▲ ● ▲ ? What comes next?', ['▲', '●', '■', '◆'], '●'],
  ['visual', 3, 'A grid has 3 rows of 4 dots. The middle row is removed. How many dots remain?', ['4', '8', '12', '6'], '8'],
  ['spatial', 1, 'You face north and turn right. Which way are you facing?', ['North', 'East', 'South', 'West'], 'East'],
  ['spatial', 1, 'How many faces does a cube have?', ['4', '6', '8', '12'], '6'],
  ['spatial', 2, 'You face east, turn left, then left again. Which way now?', ['North', 'West', 'South', 'East'], 'West'],
  ['spatial', 3, 'A cube has red top and bottom faces. You roll it forward a quarter turn. Which faces are red now?', ['Top and bottom', 'Front and back', 'Left and right', 'Only the top'], 'Front and back'],
]
const insQ = db.prepare(
  'INSERT INTO questions (dimension, difficulty, prompt, options_json, correct_answer, bias_notes) VALUES (?, ?, ?, ?, ?, ?)'
)
for (const [d, diff, p, o, a] of questions) insQ.run(d, diff, p, JSON.stringify(o), a, bias[d])

// Demo user
const U = 'demo-user'
db.prepare('INSERT INTO users (id) VALUES (?)').run(U)
const insConsent = db.prepare(
  'INSERT INTO consents (user_id, type, granted, policy_version) VALUES (?, ?, ?, ?)'
)
insConsent.run(U, 'data_processing', 1, 'v1')
insConsent.run(U, 'ai_coach', 1, 'v1')

const insPlan = db.prepare(
  'INSERT INTO learning_plans (user_id, dimension, current_difficulty, updated_at) VALUES (?, ?, ?, ?)'
)
for (const d of DIMENSIONS) insPlan.run(U, d, 2, '2026-10-29')

// 5 sessions of history (demo data, clearly invented)
const dates = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
const vals = {
  visual: [52, 56, 61, 64, 68],
  numerical: [48, 51, 55, 59, 62],
  spatial: [45, 49, 54, 58, 61],
  verbal: [60, 62, 65, 66, 69],
}
const n = [4, 8, 12, 16, 20]
const margin = [9, 8, 7, 6, 5]
const collab = [
  // clarification, critical_verification, iteration, autonomy, responsible_use
  [55, 50, 58, 52, 60],
  [58, 54, 60, 56, 62],
  [63, 60, 64, 60, 66],
  [67, 65, 68, 64, 70],
  [72, 70, 73, 68, 75],
]

const cols = DIMENSIONS.flatMap((d) => [d, `${d}_low`, `${d}_high`, `${d}_n`])
const insSnap = db.prepare(
  `INSERT INTO profile_snapshots (user_id, taken_at, ${cols.join(', ')})
   VALUES (${Array(cols.length + 2).fill('?').join(', ')})`
)
const insCollab = db.prepare(
  `INSERT INTO collaboration_scores
   (user_id, snapshot_id, taken_at, total, clarification, critical_verification, iteration, autonomy, responsible_use)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
)

dates.forEach((date, i) => {
  const row = DIMENSIONS.flatMap((d) => [vals[d][i], vals[d][i] - margin[i], vals[d][i] + margin[i], n[i]])
  const snapId = Number(insSnap.run(U, date, ...row).lastInsertRowid)
  const [cl, cv, it, au, re] = collab[i]
  const total = collabTotal({ clarification: cl, critical_verification: cv, iteration: it, autonomy: au, responsible_use: re })
  insCollab.run(U, snapId, date, total, cl, cv, it, au, re)
})

// One recommendation, built from the last snapshot (the lowest dimension)
const last = dates.length - 1
const lowest = [...DIMENSIONS].sort((a, b) => vals[a][last] - vals[b][last])[0]
db.prepare(
  'INSERT INTO recommendations (user_id, created_at, dimension, text, rationale) VALUES (?, ?, ?, ?, ?)'
).run(
  U,
  dates[last],
  lowest,
  `Try two short ${lowest} tasks this week.`,
  `Your ${lowest} estimate is your lowest (about ${vals[lowest][last]}%, likely ${vals[lowest][last] - margin[last]}-${vals[lowest][last] + margin[last]}%, from ${n[last]} tasks). More practice gives a clearer picture and may help it grow.`
)

console.log('Seeded demo database.')